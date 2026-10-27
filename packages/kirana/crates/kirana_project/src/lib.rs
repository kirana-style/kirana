//! The project façade (tier 3, KRN-CMP-008): the only crate hosts talk to. It owns the module
//! records, the cross-file export cache with provenance (KRN-CMP-004), the atom registry, the
//! stylesheet, project-wide diagnostics and precedence tracing.

mod analyze;
mod classes;
mod describe;
mod export;
mod files;
mod inspect;
mod registry;
mod resolve;
mod trace;

use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use kirana_config::Config;
use kirana_diagnostics::{Diagnostic, apply_level};
use kirana_evaluator::{Context, Evaluator, Host, ImportName};
use kirana_ir::{Names, Value};
use kirana_shared::{Fs, FxHashMap, FxHashSet, hash64};
use rayon::prelude::*;

pub use analyze::{
    Analysis, AtomUse, Finding, LayerSize, ModuleSize, ReuseBucket, ThemeUse, UnprovenRead, UnusedToken, layer_sizes,
};
pub use classes::ClassMap;
pub use describe::ConditionInfo;
pub use export::{
    Definition, DesignSystem, EntryExport, NamedExport, RecipeExport, RecipePartExport, StyleExport, ThemeExport,
    TokenExport,
};
pub use files::{SCRIPT_EXTENSIONS, absolute, collect_sources, plain_path};
pub use inspect::{Origin, RelationInfo, Site, SiteAtom, TokenInfo, split_light_dark};
pub use registry::ModuleRecord;
pub use trace::{RecipePart, TraceAnswer, TraceLine, TraceQuery};

/// The result of transforming one module.
#[derive(Debug, Clone, PartialEq)]
pub struct Transformed {
    /// `None` when the module is returned unchanged.
    pub code: Option<String>,
    pub map: Option<String>,
    pub diagnostics: Vec<Diagnostic>,
    /// Whether the stylesheet changed because of this module.
    pub css_changed: bool,
    /// Files whose exports this module read (for watchers).
    pub dependencies: Vec<PathBuf>,
}

/// A compilation session.
pub struct Project {
    pub(crate) config: Config,
    pub(crate) names: Names,
    /// `names` marking what the compiler writes, for a dense build (D-084).
    pub(crate) marked: Names,
    /// Whether transforms write marked names: set by a host building with dense names.
    pub(crate) dense: std::sync::atomic::AtomicBool,
    /// Whether a transform of unchanged input returns the previous one (`Project::reuse_transforms`).
    pub(crate) reuse: std::sync::atomic::AtomicBool,
    /// Whether every source file was compiled (`compile_paths`), as `kirana-style check` and the
    /// language server do. A bundler build compiles only what it reaches, so it cannot tell that an
    /// exported relation has no reader (D-090).
    pub(crate) walked: std::sync::atomic::AtomicBool,
    pub(crate) root: PathBuf,
    pub(crate) fs: Arc<dyn Fs>,
    pub(crate) resolver: oxc_resolver::Resolver,
    pub(crate) state: RwLock<State>,
}

/// What the project knows about one `package.json`.
#[derive(Debug, Clone, Default)]
pub(crate) struct PackageInfo {
    pub name: String,
    pub kirana: bool,
}

#[derive(Default)]
pub(crate) struct State {
    pub modules: FxHashMap<PathBuf, ModuleRecord>,
    pub exports: FxHashMap<PathBuf, resolve::ExportsEntry>,
    pub hashes: FxHashMap<PathBuf, u64>,
    pub packages: FxHashMap<PathBuf, PackageInfo>,
    pub tokens: FxHashMap<String, Arc<kirana_ir::TokenDef>>,
    pub keyframes: FxHashMap<String, Arc<kirana_ir::KeyframesDef>>,
    pub position_tries: FxHashMap<String, Arc<kirana_ir::PositionTryDef>>,
    pub view_transitions: FxHashMap<String, Arc<kirana_ir::ViewTransitionDef>>,
    pub counter_styles: FxHashMap<String, Arc<kirana_ir::CounterStyleDef>>,
    /// dependency → modules whose output used its exports.
    pub importers: FxHashMap<PathBuf, FxHashSet<PathBuf>>,
    /// `(package, namespace)` → files declaring that token namespace, from every evaluation.
    pub namespaces: std::collections::BTreeMap<(String, String), std::collections::BTreeSet<String>>,
    /// Relation marker → `(name, files declaring it)`. A relation is identified by package and name,
    /// so two modules declaring one name share a marker (`relation-name-collision`).
    pub relations: std::collections::BTreeMap<String, (String, std::collections::BTreeSet<String>)>,
    /// File → `(package, tokens it declares)`, for tooling.
    pub catalogue: std::collections::BTreeMap<String, (String, Vec<kirana_evaluator::TokenEntry>)>,
    pub work: Work,
    /// Dense-name codes assigned so far (D-084), and whether a module changed since they were.
    pub dense: kirana_ir::dense::DenseNames,
    pub dense_stale: bool,
    /// The last transform of each module, when transforms are reused (`Project::reuse_transforms`).
    pub reused: FxHashMap<PathBuf, Reusable>,
    /// Bumped whenever a module's record or a declaration changes. The stylesheet and the
    /// project's diagnostics hold from one bump to the next, so they are kept with the revision
    /// they were computed at.
    pub revision: u64,
    pub cached: registry::Cached,
}

/// A module's last transform, and what it depended on: the source, how it was parsed and written,
/// and every file its evaluation read, each with the hash it had.
#[derive(Clone)]
pub(crate) struct Reusable {
    hash: u64,
    jsx: bool,
    marked: bool,
    provenance: Vec<(PathBuf, u64)>,
    output: Transformed,
}

/// What the session did, for KRN-PERF-002 and E-02.
///
/// The claim these numbers stand behind is that work is proportional to styling, not to the
/// dependency graph: most modules of an application carry no styles, and the prefilter is what
/// keeps them from being parsed. A claim like that should be countable.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Work {
    /// Modules handed to `transform`.
    pub seen: u64,
    /// Of those, the ones the byte prefilter rejected without parsing (KRN-CMP-002).
    pub prefiltered: u64,
    /// Modules parsed for their own transform. Imported modules parsed for evaluation are counted
    /// by `resolved` instead.
    pub parsed: u64,
    /// Modules parsed to read another module's imports, after the cache missed.
    pub resolved: u64,
    /// Transforms answered from the module's previous transform (`Project::reuse_transforms`).
    pub reused: u64,
}

impl Project {
    /// Creates a session from resolved configuration JSON.
    pub fn new(config_json: &str, fs: Arc<dyn Fs>) -> Result<Project, Vec<Diagnostic>> {
        let config = Config::from_json(config_json)?;
        let names = Names { prefix: config.names.prefix.clone(), mark: false };
        let marked = Names { mark: true, ..names.clone() };
        let root = PathBuf::from(&config.root);
        Ok(Project {
            resolver: resolve::resolver(),
            names,
            marked,
            dense: std::sync::atomic::AtomicBool::new(false),
            reuse: std::sync::atomic::AtomicBool::new(false),
            walked: std::sync::atomic::AtomicBool::new(false),
            root,
            fs,
            config,
            state: RwLock::default(),
        })
    }

    /// What this session has done so far (E-02).
    pub fn work(&self) -> Work {
        self.state.read().expect("not poisoned").work
    }

    /// The configuration in use.
    pub fn config(&self) -> &Config {
        &self.config
    }

    /// The project root, as configured.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// The value `name` exported by `specifier` has, imported from `from` (for codemods, which read
    /// token scales the way a module would).
    pub fn import_value(&self, from: &Path, specifier: &str, name: &str) -> Value {
        resolve::ModuleHost::new(self, vec![from.to_path_buf()]).import(
            from,
            specifier,
            &ImportName::Named(name.to_owned()),
        )
    }

    /// The file `specifier` resolves to from `from`.
    pub fn resolve(&self, from: &Path, specifier: &str) -> Option<PathBuf> {
        self.resolver.resolve_file(from, specifier).ok().map(|resolution| resolution.full_path())
    }

    /// Whether `specifier`, imported from `from`, is an installed package rather than project source.
    pub fn is_external(&self, from: &Path, specifier: &str) -> bool {
        resolve::ModuleHost::new(self, Vec::new()).is_external(from, specifier)
    }

    /// The file name used in diagnostics: relative to the root when inside it.
    pub fn display_name(&self, path: &Path) -> String {
        path.strip_prefix(&self.root).unwrap_or(path).to_string_lossy().replace('\\', "/")
    }

    /// Transforms one module (KRN-CMP-007).
    pub fn transform(&self, path: &Path, source: &str) -> Transformed {
        self.transform_as(path, source, kirana_frontend::source_type(path))
    }

    /// [`Project::transform`] parsing with JSX whatever the path's extension: the language server
    /// appends a component's template bindings to its script block as JSX (`Card.vue.setup.ts`).
    pub fn transform_jsx(&self, path: &Path, source: &str) -> Transformed {
        self.transform_as(path, source, kirana_frontend::source_type(path).with_jsx(true))
    }

    /// From now on, a transform of a module whose source, and every file its evaluation read, are
    /// unchanged returns the previous transform instead of compiling it again. A bundler host turns
    /// this on: Vite compiles the same modules for the client and again for the server.
    pub fn reuse_transforms(&self) {
        self.reuse.store(true, std::sync::atomic::Ordering::Relaxed);
    }

    fn transform_as(&self, path: &Path, source: &str, source_type: kirana_frontend::SourceType) -> Transformed {
        let hash = hash64(source.as_bytes());
        {
            let mut state = self.state.write().expect("not poisoned");
            state.hashes.insert(path.to_path_buf(), hash);
            state.work.seen += 1;
        }
        let reuse = self.reuse.load(std::sync::atomic::Ordering::Relaxed);
        let marked = self.dense.load(std::sync::atomic::Ordering::Relaxed);
        let jsx = source_type.is_jsx();
        if reuse && let Some(previous) = self.reusable(path, hash, jsx, marked) {
            self.state.write().expect("not poisoned").work.reused += 1;
            // The module's record is the one this transform wrote: the stylesheet is unchanged.
            return Transformed { css_changed: false, ..previous };
        }
        if !kirana_frontend::may_be_style_bearing(source) {
            self.state.write().expect("not poisoned").work.prefiltered += 1;
            let css_changed = self.set_record(path, ModuleRecord::default());
            return Transformed {
                code: None,
                map: None,
                diagnostics: Vec::new(),
                css_changed,
                dependencies: Vec::new(),
            };
        }
        self.state.write().expect("not poisoned").work.parsed += 1;
        let file = self.display_name(path);
        let package = self.package_name(path);
        let host = resolve::ModuleHost::new(self, vec![path.to_path_buf()]);
        let names = if self.dense.load(std::sync::atomic::Ordering::Relaxed) { &self.marked } else { &self.names };
        let context = Context { path, file: &file, package: &package, names, config: &self.config };
        let outcome = kirana_frontend::with_parsed_as(source_type, &file, source, |parsed| {
            let evaluator = Evaluator::new(parsed, context, &host);
            let output = kirana_transform::transform(&evaluator);
            let (mut diagnostics, definitions) = evaluator.finish();
            diagnostics.extend(output.diagnostics.iter().cloned());
            (output, diagnostics, definitions)
        });
        let (output, diagnostics, definitions) = match outcome {
            Ok(result) => result,
            Err(diagnostics) => {
                let css_changed = self.set_record(path, ModuleRecord::default());
                return Transformed { code: None, map: None, diagnostics, css_changed, dependencies: Vec::new() };
            }
        };
        self.register_definitions(&definitions, &package, &file);
        let dependencies = host.dependencies();
        let provenance = if reuse { host.provenance() } else { Vec::new() };
        {
            let mut state = self.state.write().expect("not poisoned");
            for dependency in &dependencies {
                state.importers.entry(dependency.clone()).or_default().insert(path.to_path_buf());
            }
        }
        let record = ModuleRecord::new(&self.names, &output, &definitions);
        let css_changed = self.set_record(path, record);
        let mut diagnostics: Vec<Diagnostic> = diagnostics
            .into_iter()
            .filter_map(|diagnostic| {
                let level = self.config.level(diagnostic.code);
                apply_level(diagnostic, level)
            })
            .collect();
        diagnostics.sort_by(|a, b| a.span.start.cmp(&b.span.start).then(a.code.code().cmp(b.code.code())));
        let transformed = Transformed { code: output.code, map: output.map, diagnostics, css_changed, dependencies };
        if reuse {
            let entry = Reusable { hash, jsx, marked, provenance, output: transformed.clone() };
            self.state.write().expect("not poisoned").reused.insert(path.to_path_buf(), entry);
        }
        transformed
    }

    /// The previous transform of `path`, when it was of this source, parsed and written the same
    /// way, and every file it read still has the hash it had then.
    fn reusable(&self, path: &Path, hash: u64, jsx: bool, marked: bool) -> Option<Transformed> {
        let entry = self.state.read().expect("not poisoned").reused.get(path).cloned()?;
        let current = entry.hash == hash
            && entry.jsx == jsx
            && entry.marked == marked
            && entry.provenance.iter().all(|(file, seen)| self.current_hash(file) == Some(*seen));
        current.then_some(entry.output)
    }

    /// The content hash of a file as the project last saw it, reading it when unknown.
    pub(crate) fn current_hash(&self, path: &Path) -> Option<u64> {
        if let Some(hash) = self.state.read().expect("not poisoned").hashes.get(path) {
            return Some(*hash);
        }
        let hash = hash64(self.fs.read_to_string(path).ok()?.as_bytes());
        self.state.write().expect("not poisoned").hashes.insert(path.to_path_buf(), hash);
        Some(hash)
    }

    fn set_record(&self, path: &Path, record: ModuleRecord) -> bool {
        let mut state = self.state.write().expect("not poisoned");
        let previous = state.modules.insert(path.to_path_buf(), record);
        state.dense_stale = true;
        if previous.as_ref() != state.modules.get(path) {
            state.revision += 1;
        }
        let current = state.modules.get(path).expect("just inserted");
        previous.as_ref().map_or(!current.is_empty(), |previous| previous.css_key() != current.css_key())
    }

    /// Records that a file changed on disk or was deleted; returns the modules whose output may
    /// depend on it, transitively (KRN-INT-009).
    pub fn invalidate(&self, path: &Path) -> Vec<PathBuf> {
        let file = self.display_name(path);
        let mut state = self.state.write().expect("not poisoned");
        state.revision += 1;
        // Its declarations are recorded again when it is next evaluated; a long-lived session (the
        // language server) must not keep a namespace or relation the file no longer declares.
        forget_declarations(&mut state, &file);
        // A new or changed manifest can rename a package, or make a directory a Kirana package.
        if path.file_name().is_some_and(|name| name == "package.json") {
            state.packages.clear();
            // Package names are in class names and definitions: nothing compiled before is current.
            state.reused.clear();
        }
        state.reused.remove(path);
        state.hashes.remove(path);
        state.exports.remove(path);
        let mut affected = Vec::new();
        let mut queue = vec![path.to_path_buf()];
        let mut seen = FxHashSet::default();
        while let Some(current) = queue.pop() {
            for importer in state.importers.get(&current).into_iter().flatten() {
                if seen.insert(importer.clone()) {
                    affected.push(importer.clone());
                    queue.push(importer.clone());
                }
            }
        }
        for module in &affected {
            state.exports.remove(module);
        }
        affected.sort();
        affected
    }

    /// Removes a module from the build graph (KRN-OUT-008).
    pub fn remove(&self, path: &Path) -> bool {
        let file = self.display_name(path);
        let mut state = self.state.write().expect("not poisoned");
        state.revision += 1;
        forget_declarations(&mut state, &file);
        state.reused.remove(path);
        state.modules.remove(path).is_some_and(|record| !record.is_empty())
    }

    /// Transforms many files in parallel (KRN-CMP-009). Registry updates are ordered by path, so
    /// the result does not depend on thread scheduling.
    pub fn build(&self, paths: &[PathBuf]) -> Vec<(PathBuf, Result<Transformed, String>)> {
        let mut sorted = paths.to_vec();
        sorted.sort();
        sorted.dedup();
        sorted
            .par_iter()
            .map(|path| {
                let result = self
                    .fs
                    .read_to_string(path)
                    .map(|source| self.transform(path, &source))
                    .map_err(|error| error.to_string());
                (path.clone(), result)
            })
            .collect()
    }

    fn package_name(&self, path: &Path) -> String {
        self.package(path).name
    }

    /// The nearest `package.json` above `path`: its name, and whether it is a Kirana package (it is
    /// `@kirana-style/*` or depends on `@kirana-style/core`), which decides whether an installed copy is evaluated.
    fn package(&self, path: &Path) -> PackageInfo {
        // Every directory walked is remembered, not only the one that holds the manifest: a module
        // several directories down otherwise costs a failed read per level, on every transform.
        let mut walked: Vec<&Path> = Vec::new();
        let mut directory = path.parent();
        let found = loop {
            let Some(current) = directory else { break PackageInfo::default() };
            if let Some(info) = self.state.read().expect("not poisoned").packages.get(current) {
                break info.clone();
            }
            walked.push(current);
            if let Ok(text) = self.fs.read_to_string(&current.join("package.json")) {
                let json = serde_json::from_str::<serde_json::Value>(&text).unwrap_or_default();
                let name = json.get("name").and_then(|name| name.as_str()).unwrap_or_default().to_owned();
                let depends = ["dependencies", "peerDependencies"]
                    .iter()
                    .any(|field| json.get(field).and_then(|deps| deps.get("@kirana-style/core")).is_some());
                break PackageInfo { kirana: depends || name.starts_with("@kirana-style/"), name };
            }
            directory = current.parent();
        };
        if !walked.is_empty() {
            let mut state = self.state.write().expect("not poisoned");
            for current in walked {
                state.packages.insert(current.to_path_buf(), found.clone());
            }
        }
        found
    }

    fn register_definitions(&self, definitions: &kirana_evaluator::Definitions, package: &str, file: &str) {
        let mut state = self.state.write().expect("not poisoned");
        state.revision += 1;
        for (namespace, _) in &definitions.namespaces {
            state.namespaces.entry((package.to_owned(), namespace.clone())).or_default().insert(file.to_owned());
        }
        state.catalogue.insert(file.to_owned(), (package.to_owned(), definitions.catalogue.clone()));
        for (name, marker, _) in &definitions.relations {
            let entry = state.relations.entry(marker.clone()).or_insert_with(|| (name.clone(), Default::default()));
            entry.1.insert(file.to_owned());
        }
        for token in &definitions.tokens {
            state.tokens.insert(token.variable.clone(), token.clone());
        }
        for frames in &definitions.keyframes {
            state.keyframes.insert(frames.name.clone(), frames.clone());
        }
        for fallback in &definitions.position_tries {
            state.position_tries.insert(fallback.name.clone(), fallback.clone());
        }
        for transition in &definitions.view_transitions {
            state.view_transitions.insert(transition.class.clone(), transition.clone());
        }
        for style in &definitions.counter_styles {
            state.counter_styles.insert(style.name.clone(), style.clone());
        }
    }
}

/// Drops the token namespaces and relations `file` declared.
fn forget_declarations(state: &mut State, file: &str) {
    state.namespaces.retain(|_, files| {
        files.remove(file);
        !files.is_empty()
    });
    state.catalogue.remove(file);
    state.relations.retain(|_, (_, files)| {
        files.remove(file);
        !files.is_empty()
    });
}
