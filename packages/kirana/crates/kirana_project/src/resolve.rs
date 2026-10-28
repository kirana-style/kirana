//! Cross-file resolution (KRN-CMP-004): `oxc_resolver` finds modules; each module's exports are
//! evaluated once and cached with the content hashes they were computed from.

use std::cell::{Cell, RefCell};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use kirana_evaluator::{Context, Evaluator, Host, ImportName, portable};
use kirana_ir::{Dep, Key, Value};
use kirana_shared::{FxHashMap, FxHashSet, hash64};
use oxc_resolver::{ResolveOptions, Resolver, TsconfigDiscovery};

use crate::Project;

pub(crate) fn resolver() -> Resolver {
    Resolver::new(ResolveOptions {
        tsconfig: Some(TsconfigDiscovery::Auto),
        extensions: [".tsx", ".ts", ".jsx", ".js", ".mts", ".mjs"].map(str::to_owned).to_vec(),
        extension_alias: vec![(".js".to_owned(), vec![".ts".to_owned(), ".tsx".to_owned(), ".js".to_owned()])],
        condition_names: ["import", "module", "default"].map(str::to_owned).to_vec(),
        main_fields: vec!["module".to_owned(), "main".to_owned()],
        symlinks: true,
        ..ResolveOptions::default()
    })
}

/// A module's evaluated exports and its `export *` sources.
#[derive(Debug, Default)]
pub(crate) struct Exports {
    pub values: FxHashMap<String, Value>,
    pub stars: Vec<String>,
    /// Exported components that spread `sx`, unread, into an installed package: name → package.
    pub sx_forwarding: FxHashMap<String, String>,
}

/// One module's evaluated exports.
#[derive(Clone)]
pub(crate) struct ExportsEntry {
    pub hash: u64,
    pub exports: Arc<Exports>,
    /// `(dependency, hash seen)` for every module read while evaluating.
    pub provenance: Vec<(PathBuf, u64)>,
    /// Whether an import failed to resolve while evaluating ([`ModuleHost::missed`]).
    pub missed: bool,
}

/// The evaluator host for one module: resolves imports through the project and records which
/// files were read.
pub(crate) struct ModuleHost<'p> {
    project: &'p Project,
    stack: Vec<PathBuf>,
    read: RefCell<Vec<(PathBuf, u64)>>,
    /// `export *` chains being followed, so a cycle of star re-exports ends.
    stars: RefCell<Vec<PathBuf>>,
    /// The lowest place on `stack` an import cycle closed at while this module was evaluated,
    /// directly or in a module it imported: what was read there was cut short.
    cut: Cell<usize>,
    /// Every import cycle closed while this module was evaluated, as `a.ts → b.ts → a.ts`.
    cycles: RefCell<Vec<String>>,
    /// Whether an import failed to resolve, here or in a module it imported.
    missed: Cell<bool>,
}

impl<'p> ModuleHost<'p> {
    pub fn new(project: &'p Project, stack: Vec<PathBuf>) -> Self {
        Self {
            project,
            stack,
            read: RefCell::default(),
            stars: RefCell::default(),
            cut: Cell::new(usize::MAX),
            cycles: RefCell::default(),
            missed: Cell::new(false),
        }
    }

    /// Whether an import failed to resolve, here or in a module it imported: a file created later
    /// may be the one it names.
    pub fn missed(&self) -> bool {
        self.missed.get()
    }

    /// The cycle importing `path` closes, when it is already on the stack: noted as a cut.
    fn closes_cycle(&self, path: &Path) -> Option<String> {
        let at = self.stack.iter().position(|entry| entry == path)?;
        self.cut.set(self.cut.get().min(at));
        let chain: Vec<String> = self.stack[at..]
            .iter()
            .chain([&path.to_path_buf()])
            .map(|module| self.project.display_name(module))
            .collect();
        let chain = chain.join(" → ");
        self.cycles.borrow_mut().push(chain.clone());
        Some(chain)
    }

    /// `(file, hash seen)` for every file read, directly or through re-exports, deduplicated.
    pub fn provenance(&self) -> Vec<(PathBuf, u64)> {
        // Deduplicated before sorting: a path compares component by component, and each import of
        // a preset brings every file the preset reads (KF-060).
        let mut seen = FxHashSet::default();
        let mut read: Vec<(PathBuf, u64)> =
            self.read.borrow().iter().filter(|entry| seen.insert(*entry)).cloned().collect();
        read.sort();
        read
    }

    /// Files read directly or through re-exports, deduplicated and sorted.
    pub fn dependencies(&self) -> Vec<PathBuf> {
        let mut seen = FxHashSet::default();
        let mut paths: Vec<PathBuf> =
            self.read.borrow().iter().filter(|(path, _)| seen.insert(path)).map(|(path, _)| path.clone()).collect();
        paths.sort();
        paths
    }

    /// Every export of the module at `path`: those of the `export *` sources it re-exports first,
    /// then its own, which shadow them.
    pub fn exported(&self, path: &Path) -> Vec<(String, Value)> {
        let Some(exports) = self.exports_of(path) else { return Vec::new() };
        let mut values = Vec::new();
        for star in &exports.stars {
            let Ok(resolution) = self.project.resolver.resolve_file(path, star) else { continue };
            let source = resolution.full_path();
            if self.stars.borrow().contains(&source) {
                continue;
            }
            self.stars.borrow_mut().push(source.clone());
            values.extend(self.exported(&source));
            self.stars.borrow_mut().pop();
        }
        let mut own: Vec<(String, Value)> =
            exports.values.iter().map(|(name, value)| (name.clone(), value.clone())).collect();
        own.sort_by(|a, b| a.0.cmp(&b.0));
        values.extend(own);
        values
    }

    pub(crate) fn exports_of(&self, path: &Path) -> Option<Arc<Exports>> {
        if self.closes_cycle(path).is_some() {
            return None;
        }
        // A cache hit is answered from the project's hash cache, without touching the file; the
        // source is read once, and only when the cached exports turn out to be stale.
        let cached = self.project.state.read().expect("not poisoned").exports.get(path).cloned();
        if let Some(entry) = cached
            && self.project.current_hash(path) == Some(entry.hash)
            && entry.provenance.iter().all(|(dependency, seen)| self.project.current_hash(dependency) == Some(*seen))
        {
            self.read.borrow_mut().push((path.to_path_buf(), entry.hash));
            self.read.borrow_mut().extend(entry.provenance.iter().cloned());
            self.missed.set(self.missed.get() || entry.missed);
            return Some(entry.exports.clone());
        }
        let source = self.project.fs.read_to_string(path).ok()?;
        let hash = hash64(source.as_bytes());
        self.project.state.write().expect("not poisoned").work.resolved += 1;
        let mut stack = self.stack.clone();
        stack.push(path.to_path_buf());
        let nested = ModuleHost::new(self.project, stack);
        let file = self.project.display_name(path);
        let package = self.project.package_name(path);
        let context =
            Context { path, file: &file, package: &package, names: &self.project.names, config: &self.project.config };
        let (exports, definitions) = kirana_frontend::with_parsed(path, &file, &source, |parsed| {
            let evaluator = Evaluator::new(parsed, context, &nested);
            let values = evaluator
                .export_names()
                .into_iter()
                .map(|name| {
                    let before = nested.cycles.borrow().len();
                    let value = portable(&evaluator.export(&name));
                    // A value left unknown by a cycle closed while it was evaluated says so, however
                    // far it travels: the module that reads it names the cycle (KF-038).
                    let value = match nested.cycles.borrow().get(before) {
                        Some(chain) => through_cycle(value, chain),
                        None => value,
                    };
                    (name, value)
                })
                .collect();
            let exports = Exports {
                values,
                stars: evaluator.star_exports(),
                sx_forwarding: evaluator.sx_forwarding_exports().into_iter().collect(),
            };
            let (_, definitions) = evaluator.finish();
            (exports, definitions)
        })
        .ok()?;
        self.project.register_definitions(&definitions, &package, &file);
        let exports = Arc::new(exports);
        // Kept deduplicated: every importer's cache hit checks and copies it.
        let provenance = nested.provenance();
        // A cycle that closed at this module leaves its exports as every importer sees them. One that
        // closed further up the stack cut a value this module read, which another starting point
        // would have had in full: those exports stay this evaluation's own (KF-038).
        self.cycles.borrow_mut().extend(nested.cycles.take());
        let missed = nested.missed.get();
        self.missed.set(self.missed.get() || missed);
        let depth = self.stack.len();
        let cut = nested.cut.get();
        if cut < depth {
            self.cut.set(self.cut.get().min(cut));
        } else {
            let mut state = self.project.state.write().expect("not poisoned");
            state.hashes.insert(path.to_path_buf(), hash);
            state.exports.insert(
                path.to_path_buf(),
                ExportsEntry { hash, exports: exports.clone(), provenance: provenance.clone(), missed },
            );
        }
        self.read.borrow_mut().push((path.to_path_buf(), hash));
        self.read.borrow_mut().extend(provenance);
        Some(exports)
    }
}

impl Host for ModuleHost<'_> {
    fn import(&self, from: &Path, specifier: &str, name: &ImportName) -> Value {
        // A Node.js built-in holds no styles, and is not unresolved: it is a runtime value, quietly.
        if specifier.starts_with("node:") {
            return Value::unknown("external module");
        }
        // `resolve_file`, not `resolve`: only it finds the importer's tsconfig, so `paths` aliases apply.
        let Ok(resolution) = self.project.resolver.resolve_file(from, specifier) else {
            self.missed.set(true);
            // A module the bundler provides (`externals`) is a runtime value, as a Node.js built-in is.
            if self.project.config.externals.iter().any(|prefix| specifier.starts_with(prefix.as_str())) {
                return Value::unknown("external module");
            }
            return Value::unresolved(specifier, &self.project.display_name(from));
        };
        let path = resolution.full_path();
        if let Some(chain) = self.closes_cycle(&path) {
            return Value::cycle(&chain);
        }
        // An installed package is evaluated only when it is a Kirana package: a preset or design
        // system from npm must fold to the same values it does as a workspace package (KRN-TOK-008
        // rule 4), while evaluating every icon set or utility library would multiply build time.
        let installed = path.components().any(|component| component.as_os_str() == "node_modules");
        let script = path
            .extension()
            .is_some_and(|extension| ["ts", "tsx", "js", "jsx", "mts", "mjs"].iter().any(|known| extension == *known));
        if !script || installed && !self.project.package(&path).kirana {
            return Value::unknown("external module");
        }
        let Some(exports) = self.exports_of(&path) else { return Value::unknown("module could not be evaluated") };
        match name {
            ImportName::Named(name) => exports.values.get(name).cloned().unwrap_or_else(|| {
                if self.stars.borrow().contains(&path) {
                    return Value::Undefined;
                }
                self.stars.borrow_mut().push(path.clone());
                let found = exports
                    .stars
                    .iter()
                    .map(|star| self.import(&path, star, &ImportName::Named(name.clone())))
                    .find(|value| *value != Value::Undefined)
                    .unwrap_or(Value::Undefined);
                self.stars.borrow_mut().pop();
                found
            }),
            ImportName::Default => exports.values.get("default").cloned().unwrap_or(Value::Undefined),
            ImportName::Namespace => {
                let mut entries: Vec<(Key, Value)> = exports
                    .values
                    .iter()
                    .map(|(name, value)| (Key::Str(Arc::from(name.as_str())), value.clone()))
                    .collect();
                entries.sort_by(|a, b| format!("{:?}", a.0).cmp(&format!("{:?}", b.0)));
                Value::Object(Arc::new(entries))
            }
        }
    }

    fn is_external(&self, from: &Path, specifier: &str) -> bool {
        self.project.resolver.resolve_file(from, specifier).ok().is_some_and(|resolution| {
            resolution.full_path().components().any(|component| component.as_os_str() == "node_modules")
        })
    }

    /// Asked only for specifiers that are not installed packages (the transform checks first).
    fn sx_forwarded(&self, from: &Path, specifier: &str, name: &str) -> Option<String> {
        let path = self.project.resolver.resolve_file(from, specifier).ok()?.full_path();
        self.exports_of(&path)?.sx_forwarding.get(name).cloned()
    }

    fn lookup_dep(&self, name: &str) -> Option<Dep> {
        let state = self.project.state.read().expect("not poisoned");
        state
            .tokens
            .get(name)
            .cloned()
            .map(Dep::Token)
            .or_else(|| state.keyframes.get(name).cloned().map(Dep::Keyframes))
            .or_else(|| state.position_tries.get(name).cloned().map(Dep::PositionTry))
            .or_else(|| state.view_transitions.get(name).cloned().map(Dep::ViewTransition))
            .or_else(|| state.counter_styles.get(name).cloned().map(Dep::CounterStyle))
    }
}

/// `value` with each part a cycle left unknown naming `chain`: a module-scope value that read the
/// cycle's other half before it was evaluated is unknown in its module, whatever it was meant to be.
fn through_cycle(value: Value, chain: &str) -> Value {
    match value {
        Value::Unknown(_) if value.unresolved_import().is_none() => Value::cycle(chain),
        Value::Array(items) => {
            Value::Array(Arc::new(items.iter().map(|item| through_cycle(item.clone(), chain)).collect()))
        }
        Value::Object(entries) => Value::Object(Arc::new(
            entries.iter().map(|(key, value)| (key.clone(), through_cycle(value.clone(), chain))).collect(),
        )),
        other => other,
    }
}
