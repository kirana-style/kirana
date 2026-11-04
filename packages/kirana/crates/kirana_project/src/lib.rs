//! The project façade (tier 3, KRN-CMP-008): the only crate hosts talk to. It owns the module
//! records, the cross-file export cache with provenance (KRN-CMP-004), the atom registry, the
//! stylesheet, project-wide diagnostics and precedence tracing.

mod analyze;
mod classes;
pub mod component;
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
pub use files::{SCRIPT_EXTENSIONS, Tree, absolute, collect_sources, plain_path};
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
    /// Whether this is the module's previous transform, answered again (`Project::reuse_transforms`).
    pub reused: bool,
    /// Whether the same source will be answered with this transform until the module or a file it
    /// read changes: reuse is on and every import resolved. A host may answer it again itself.
    pub reusable: bool,
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
    /// Whether `build` compiles one file after another on the calling thread (`Project::compile_serially`).
    pub(crate) serial: std::sync::atomic::AtomicBool,
    /// Whether every entry records how it was written (KF-027): on for `export --definitions`, which
    /// alone reads the record, and off in a build, which would pay for a record per declaration.
    pub(crate) record_written: std::sync::atomic::AtomicBool,
    pub(crate) root: PathBuf,
    pub(crate) fs: Arc<dyn Fs>,
    pub(crate) resolver: oxc_resolver::Resolver,
    /// What each specifier resolved to from each importing file (`Project::resolved`), cleared
    /// with the resolver's own cache.
    pub(crate) resolutions: RwLock<FxHashMap<PathBuf, FxHashMap<String, Option<PathBuf>>>>,
    pub(crate) state: RwLock<State>,
    /// `css()` values compiled from source written out in full, by that source (KF-059). Such a
    /// value depends on nothing a later change in the session can touch, so it is never cleared.
    pub(crate) styles: RwLock<FxHashMap<String, Value>>,
    /// `css()` calls answered from `styles`, kept apart from `state` so a hit takes no write lock on it.
    pub(crate) styles_reused: std::sync::atomic::AtomicU64,
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
    /// module → the files its last compile read: what it stops importing leaves `importers`, so an
    /// edit there no longer compiles it again.
    pub imports: FxHashMap<PathBuf, Vec<PathBuf>>,
    /// file → the names its last evaluation defined (variable tokens, keyframes, position-try
    /// fallbacks, view transitions, counter styles), and name → the files defining it. A name no
    /// file defines any more leaves the registries: a content-hashed name changes with every edit.
    pub definers: FxHashMap<String, Vec<String>>,
    pub defined_by: FxHashMap<String, FxHashSet<String>>,
    /// Modules whose last compile had an import that did not resolve: a file created since may be
    /// the one it names.
    pub unresolved: FxHashSet<PathBuf>,
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
    /// Codes of the definitions finished stylesheets named alone (D-084).
    pub dense_definitions: kirana_ir::dense::DenseDefinitions,
    /// The last transform of each module, when transforms are reused (`Project::reuse_transforms`).
    pub reused: FxHashMap<PathBuf, Reusable>,
    /// Whether compiling each module adds nothing to the build (D-118): no rule, relation or
    /// diagnostic. A module's compile reads others, so every change clears it.
    pub inert: FxHashMap<PathBuf, bool>,
    /// Bumped whenever a module's record or a declaration changes. The stylesheet and the
    /// project's diagnostics hold from one bump to the next, so they are kept with the revision
    /// they were computed at.
    pub revision: u64,
    pub cached: registry::Cached,
    /// The atoms, marker dependencies and unfolds of every record, kept with `modules` (KF-062).
    pub index: registry::AtomIndex,
}

impl State {
    /// Records `record` for `path`, keeping the atom index in step; returns the record it replaced.
    pub(crate) fn put_module(&mut self, path: &Path, record: ModuleRecord) -> Option<ModuleRecord> {
        let previous = self.modules.remove(path);
        self.index.replace(path, previous.as_ref(), &record);
        self.modules.insert(path.to_path_buf(), record);
        previous
    }

    /// Forgets the record for `path`, keeping the atom index in step.
    pub(crate) fn take_module(&mut self, path: &Path) -> Option<ModuleRecord> {
        let previous = self.modules.remove(path)?;
        self.index.replace(path, Some(&previous), &ModuleRecord::default());
        Some(previous)
    }

    /// Records what `path`'s compile read, taking back the edges of what it no longer imports.
    pub(crate) fn set_imports(&mut self, path: &Path, dependencies: &[PathBuf]) {
        for old in self.imports.remove(path).unwrap_or_default() {
            if dependencies.contains(&old) {
                continue;
            }
            let importers = self.importers.get_mut(&old).expect("recorded with the import");
            importers.remove(path);
            if importers.is_empty() {
                self.importers.remove(&old);
            }
        }
        for dependency in dependencies {
            self.importers.entry(dependency.clone()).or_default().insert(path.to_path_buf());
        }
        if !dependencies.is_empty() {
            self.imports.insert(path.to_path_buf(), dependencies.to_vec());
        }
    }

    /// Records the names `file` defines now; one no file defines any more leaves the registries.
    pub(crate) fn set_definitions(&mut self, file: &str, names: Vec<String>) {
        let current: FxHashSet<&str> = names.iter().map(String::as_str).collect();
        for old in self.definers.remove(file).unwrap_or_default() {
            if current.contains(old.as_str()) {
                continue;
            }
            let files = self.defined_by.get_mut(&old).expect("recorded with the file");
            files.remove(file);
            if files.is_empty() {
                self.defined_by.remove(&old);
                self.tokens.remove(&old);
                self.keyframes.remove(&old);
                self.position_tries.remove(&old);
                self.view_transitions.remove(&old);
                self.counter_styles.remove(&old);
            }
        }
        for name in &names {
            self.defined_by.entry(name.clone()).or_default().insert(file.to_owned());
        }
        if !names.is_empty() {
            self.definers.insert(file.to_owned(), names);
        }
    }
}

/// A module's last transform, and what it depended on: the source, how it was parsed and written,
/// and every file its evaluation read, each with the hash it had.
#[derive(Clone)]
pub(crate) struct Reusable {
    hash: u64,
    jsx: bool,
    marked: bool,
    maps: bool,
    provenance: Vec<(PathBuf, u64)>,
    output: Transformed,
}

/// What the session did, for KRN-PERF-002 and E-02.
///
/// They count the claim that work is proportional to styling, not to the dependency graph: most
/// modules carry no styles, and the prefilter keeps them from being parsed.
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
    /// `css()` calls answered from one of the same source compiled earlier in the session (KF-059).
    pub styles: u64,
    /// Imported modules compiled only to learn whether their import can go (D-118).
    pub answered: u64,
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
            resolutions: RwLock::default(),
            names,
            marked,
            dense: std::sync::atomic::AtomicBool::new(false),
            reuse: std::sync::atomic::AtomicBool::new(false),
            walked: std::sync::atomic::AtomicBool::new(false),
            serial: std::sync::atomic::AtomicBool::new(false),
            record_written: std::sync::atomic::AtomicBool::new(false),
            root,
            fs,
            config,
            state: RwLock::default(),
            styles: RwLock::default(),
            styles_reused: std::sync::atomic::AtomicU64::new(0),
        })
    }

    /// Whether entries record how they were written (KF-027).
    pub(crate) fn records_written(&self) -> bool {
        self.record_written.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// From now on every entry records how it was written (KF-027), for `export --definitions`. What
    /// the session evaluated without the record (module exports, reused transforms, the literal-style
    /// cache, the import answers) is dropped, so the next compile builds it with the record.
    pub fn record_written(&self) {
        if self.record_written.swap(true, std::sync::atomic::Ordering::Relaxed) {
            return;
        }
        self.styles.write().expect("not poisoned").clear();
        let mut state = self.state.write().expect("not poisoned");
        state.exports.clear();
        state.reused.clear();
        state.inert.clear();
        state.revision += 1;
    }

    /// What this session has done so far (E-02).
    pub fn work(&self) -> Work {
        let styles = self.styles_reused.load(std::sync::atomic::Ordering::Relaxed);
        Work { styles, ..self.state.read().expect("not poisoned").work }
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
        self.resolved(from, specifier)
    }

    /// [`Project::resolve`], from the session when the same file asked before: every import of
    /// every module resolves, and a resolution walks the importer's directories and finds its
    /// tsconfig, which a module that reads four bindings from a preset paid four times, and an
    /// edit of the module again (KF-082). The importing file, not its directory, is the key: the
    /// tsconfig that applies can depend on the file. Cleared with the resolver's own cache, when a
    /// file appears or disappears.
    pub(crate) fn resolved(&self, from: &Path, specifier: &str) -> Option<PathBuf> {
        let known = self.resolutions.read().expect("not poisoned").get(from).and_then(|by| by.get(specifier).cloned());
        if let Some(resolved) = known {
            return resolved;
        }
        let resolved = self.resolver.resolve_file(from, specifier).ok().map(|resolution| resolution.full_path());
        self.resolutions
            .write()
            .expect("not poisoned")
            .entry(from.to_path_buf())
            .or_default()
            .insert(specifier.to_owned(), resolved.clone());
        resolved
    }

    /// Whether `specifier`, imported from `from`, is an installed package the application does not
    /// compile as its own, rather than project source or a listed library.
    pub fn is_external(&self, from: &Path, specifier: &str) -> bool {
        resolve::ModuleHost::new(self, Vec::new()).is_external(from, specifier)
    }

    /// Whether `path` is in an installed package the application does not compile as its own: under
    /// `node_modules`, and not in a package listed in `libraries`, matched as `node_modules/<name>/`
    /// as the hosts match it (KRN-INT-008). A listed library's components are compiled with the
    /// application's, so they read `sx` as its own do.
    pub(crate) fn outside_application(&self, path: &Path) -> bool {
        let path = path.to_string_lossy().replace('\\', "/");
        path.contains("/node_modules/")
            && !self.config.libraries.iter().any(|name| path.contains(&format!("/node_modules/{name}/")))
    }

    /// The file name used in diagnostics: relative to the root when inside it.
    pub fn display_name(&self, path: &Path) -> String {
        path.strip_prefix(&self.root).unwrap_or(path).to_string_lossy().replace('\\', "/")
    }

    /// Transforms one module (KRN-CMP-007).
    pub fn transform(&self, path: &Path, source: &str) -> Transformed {
        self.transform_with(path, source, true)
    }

    /// [`Project::transform`], with its source map only when `maps`: a host that writes none (a
    /// build without `sourcemap`, a lint, a stylesheet-only host) asks for none.
    pub fn transform_with(&self, path: &Path, source: &str, maps: bool) -> Transformed {
        self.transform_as(path, source, kirana_frontend::source_type(path), maps)
    }

    /// [`Project::transform`] parsing with JSX whatever the path's extension: the language server
    /// appends a component's template bindings to its script block as JSX (`Card.vue.setup.ts`).
    pub fn transform_jsx(&self, path: &Path, source: &str) -> Transformed {
        self.transform_as(path, source, kirana_frontend::source_type(path).with_jsx(true), true)
    }

    /// From now on, a transform of a module whose source, and every file its evaluation read, are
    /// unchanged returns the previous transform instead of compiling it again. A bundler host turns
    /// this on, in a build, a watch build and a dev server alike: Vite compiles the same modules for
    /// the client and again for the server, and sends unchanged ones again.
    pub fn reuse_transforms(&self) {
        self.reuse.store(true, std::sync::atomic::Ordering::Relaxed);
    }

    /// Whether compiling the module at `path` adds nothing to the build (D-118): it reports no
    /// diagnostic and writes no rule, relation, anchor or class, so whether the bundler compiles it
    /// or never loads it is the same build. Compiled for the answer and not recorded; `compiling` are
    /// the transforms in progress on this thread.
    pub(crate) fn compiles_to_nothing(&self, path: &Path, compiling: &[PathBuf]) -> bool {
        {
            let state = self.state.read().expect("not poisoned");
            if let Some(inert) = state.inert.get(path) {
                return *inert;
            }
            // Its exports were evaluated for the import, which registered what it defines: a variable
            // token, keyframes or another definition is written into the build, and a relation is
            // recorded, so such a module never compiles to nothing. Its first statement answers what
            // compiling it again would (KF-092).
            let file = self.display_name(path);
            if state.definers.contains_key(&file) || state.relations.values().any(|(_, files)| files.contains(&file)) {
                return false;
            }
        }
        // Read when its exports were: a file gone since is not answered for.
        let inert = self.fs.read_to_string(path).is_ok_and(|source| {
            if !kirana_frontend::may_be_style_bearing(&source) {
                return true;
            }
            self.state.write().expect("not poisoned").work.answered += 1;
            let host = resolve::ModuleHost::new(self, vec![path.to_path_buf()])
                .compiling(compiling.iter().cloned().chain([path.to_path_buf()]).collect());
            let (file, package) = (self.display_name(path), self.package_name(path));
            self.compile(
                path,
                &source,
                kirana_frontend::source_type(path),
                false,
                (&file, &package),
                &self.names,
                &host,
            )
            .is_ok_and(|(output, diagnostics, definitions)| {
                ModuleRecord::new(&self.names, &output, &definitions) == ModuleRecord::default()
                    && diagnostics.into_iter().all(|diagnostic| {
                        let level = self.config.level(diagnostic.code);
                        apply_level(diagnostic, level).is_none()
                    })
            })
        });
        self.state.write().expect("not poisoned").inert.insert(path.to_path_buf(), inert);
        inert
    }

    /// Parses, evaluates and rewrites `source` as the module at `path` (`file` in `package`) through
    /// `host`: its output, its diagnostics before their levels apply, and what it defines.
    #[allow(clippy::too_many_arguments)]
    fn compile(
        &self,
        path: &Path,
        source: &str,
        source_type: kirana_frontend::SourceType,
        maps: bool,
        (file, package): (&str, &str),
        names: &Names,
        host: &resolve::ModuleHost<'_>,
    ) -> Result<(kirana_transform::TransformOutput, Vec<Diagnostic>, kirana_evaluator::Definitions), Vec<Diagnostic>>
    {
        let context = Context { path, file, package, names, config: &self.config, written: self.records_written() };
        kirana_frontend::with_parsed_as(source_type, file, source, |parsed| {
            let evaluator = Evaluator::new(parsed, context, host);
            let output = kirana_transform::transform(&evaluator, maps);
            let (mut diagnostics, definitions) = evaluator.finish();
            diagnostics.extend(output.diagnostics.iter().cloned());
            (output, diagnostics, definitions)
        })
    }

    fn transform_as(
        &self,
        path: &Path,
        source: &str,
        source_type: kirana_frontend::SourceType,
        maps: bool,
    ) -> Transformed {
        let hash = hash64(source.as_bytes());
        {
            let mut state = self.state.write().expect("not poisoned");
            state.hashes.insert(path.to_path_buf(), hash);
            state.work.seen += 1;
        }
        let reuse = self.reuse.load(std::sync::atomic::Ordering::Relaxed);
        let marked = self.dense.load(std::sync::atomic::Ordering::Relaxed);
        let jsx = source_type.is_jsx();
        if reuse && let Some(previous) = self.reusable(path, hash, jsx, marked, maps) {
            self.state.write().expect("not poisoned").work.reused += 1;
            // The module's record is the one this transform wrote: the stylesheet is unchanged.
            return Transformed { css_changed: false, reused: true, ..previous };
        }
        self.state.write().expect("not poisoned").unresolved.remove(path);
        if !kirana_frontend::may_be_style_bearing(source) {
            {
                let mut state = self.state.write().expect("not poisoned");
                state.work.prefiltered += 1;
                state.set_imports(path, &[]);
            }
            let css_changed = self.set_record(path, ModuleRecord::default());
            return Transformed {
                code: None,
                map: None,
                diagnostics: Vec::new(),
                css_changed,
                dependencies: Vec::new(),
                reused: false,
                reusable: false,
            };
        }
        self.state.write().expect("not poisoned").work.parsed += 1;
        let file = self.display_name(path);
        let package = self.package_name(path);
        let host = resolve::ModuleHost::new(self, vec![path.to_path_buf()]).compiling(vec![path.to_path_buf()]);
        let names = if self.dense.load(std::sync::atomic::Ordering::Relaxed) { &self.marked } else { &self.names };
        let outcome = self.compile(path, source, source_type, maps, (&file, &package), names, &host);
        let (output, diagnostics, definitions) = match outcome {
            Ok(result) => result,
            Err(diagnostics) => {
                self.state.write().expect("not poisoned").set_imports(path, &[]);
                let css_changed = self.set_record(path, ModuleRecord::default());
                return Transformed {
                    code: None,
                    map: None,
                    diagnostics,
                    css_changed,
                    dependencies: Vec::new(),
                    reused: false,
                    reusable: false,
                };
            }
        };
        self.register_definitions(&definitions, &package, &file);
        let dependencies = host.dependencies();
        let provenance = if reuse { host.provenance() } else { Vec::new() };
        {
            let mut state = self.state.write().expect("not poisoned");
            state.set_imports(path, &dependencies);
            if host.missed() {
                state.unresolved.insert(path.to_path_buf());
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
        let missed = host.missed();
        let transformed = Transformed {
            code: output.code,
            map: output.map,
            diagnostics,
            css_changed,
            dependencies,
            reused: false,
            reusable: reuse && !missed,
        };
        if reuse {
            let entry = Reusable { hash, jsx, marked, maps, provenance, output: transformed.clone() };
            self.state.write().expect("not poisoned").reused.insert(path.to_path_buf(), entry);
        }
        transformed
    }

    /// The previous transform of `path`, when it was of this source, parsed and written the same
    /// way, and every file it read still has the hash it had then. One that missed an import is
    /// never reused: it compiles each time, as without reuse, so the file it names is found once it
    /// exists and the session has been told (KF-063).
    fn reusable(&self, path: &Path, hash: u64, jsx: bool, marked: bool, maps: bool) -> Option<Transformed> {
        let entry = {
            let state = self.state.read().expect("not poisoned");
            if state.unresolved.contains(path) {
                return None;
            }
            state.reused.get(path).cloned()?
        };
        let current = entry.hash == hash
            && entry.jsx == jsx
            && entry.marked == marked
            && entry.maps == maps
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
        let previous = state.put_module(path, record);
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
        let exists = self.fs.read_to_string(path).is_ok();
        let mut state = self.state.write().expect("not poisoned");
        // A file the session never read may be new, and one it read may be gone: either can change
        // what an import resolves to, which the resolver caches. Every resolution is made again, and
        // the modules that failed one compile again. Hosts invalidate between transforms, never
        // during one, as clearing the resolver's cache requires.
        let reshaped = !exists || !state.hashes.contains_key(path);
        if reshaped {
            self.resolver.clear_cache();
            self.resolutions.write().expect("not poisoned").clear();
            state.exports.clear();
            state.reused.clear();
        }
        state.inert.clear();
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
        if reshaped {
            // Kept until each compiles again: a host that does not recompile what is returned asks
            // again at the next change.
            let unresolved: Vec<PathBuf> = state.unresolved.iter().cloned().collect();
            for module in unresolved {
                seen.insert(module.clone());
                affected.push(module.clone());
                queue.push(module);
            }
        }
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
        state.set_definitions(&file, Vec::new());
        state.set_imports(path, &[]);
        state.reused.remove(path);
        state.unresolved.remove(path);
        state.take_module(path).is_some_and(|record| !record.is_empty())
    }

    /// Transforms many files in parallel (KRN-CMP-009). Registry updates are ordered by path, so
    /// the result does not depend on thread scheduling.
    pub fn build(&self, paths: &[PathBuf]) -> Vec<(PathBuf, Result<Transformed, String>)> {
        self.each(paths, |path| {
            let result = self
                .fs
                .read_to_string(path)
                .map(|source| self.transform(path, &source))
                .map_err(|error| error.to_string());
            (path.clone(), result)
        })
    }

    /// [`Project::transform_with`] for every `(path, source)` of `modules` at once, in parallel
    /// unless the project compiles serially; the results in the modules' order. A bundler hands a
    /// host hundreds of modules in one turn of its event loop, and the host crosses into the engine
    /// once for all of them instead of once per module (KRN-CMP-009).
    pub fn transform_many(&self, modules: &[(&Path, &str)], maps: bool) -> Vec<Transformed> {
        let compile = |&(path, source): &(&Path, &str)| self.transform_with(path, source, maps);
        if self.serial.load(std::sync::atomic::Ordering::Relaxed) {
            modules.iter().map(compile).collect()
        } else {
            modules.par_iter().map(compile).collect()
        }
    }

    /// `compile` for each of `paths`, sorted and without repeats, in parallel unless the project
    /// compiles serially; the results in path order.
    pub(crate) fn each<T: Send>(&self, paths: &[PathBuf], compile: impl Fn(&PathBuf) -> T + Sync + Send) -> Vec<T> {
        let mut sorted = paths.to_vec();
        sorted.sort();
        sorted.dedup();
        if self.serial.load(std::sync::atomic::Ordering::Relaxed) {
            sorted.iter().map(compile).collect()
        } else {
            sorted.par_iter().map(compile).collect()
        }
    }

    /// From now on, `build` compiles one file after another on the calling thread. A browser page's
    /// main thread may not block, and a parallel build waits there for the threads compiling with it
    /// (`Atomics.wait`), so the language server a page runs indexes this way (KF-065).
    pub fn compile_serially(&self) {
        self.serial.store(true, std::sync::atomic::Ordering::Relaxed);
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
        let names = definitions
            .tokens
            .iter()
            .map(|token| token.variable.clone())
            .chain(definitions.keyframes.iter().map(|frames| frames.name.clone()))
            .chain(definitions.position_tries.iter().map(|fallback| fallback.name.clone()))
            .chain(definitions.view_transitions.iter().map(|transition| transition.class.clone()))
            .chain(definitions.counter_styles.iter().map(|style| style.name.clone()))
            .collect();
        state.set_definitions(file, names);
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
