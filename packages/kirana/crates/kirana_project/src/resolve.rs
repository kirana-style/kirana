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
use crate::path::{ModulePath, key};

/// How many styles written out in full a session keeps (KF-059): a large application's distinct
/// literal styles fit, a long editing session's every keystroke does not.
pub(crate) const STYLES: usize = 1 << 14;

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
    /// Exported components' own handle on the element they apply `sx` to, before it (KF-083).
    pub sx_roots: FxHashMap<String, kirana_ir::Handle>,
    pub stars: Vec<String>,
    /// Exported components that spread `sx`, unread, into an installed package: name → package.
    pub sx_forwarding: FxHashMap<String, String>,
    /// The modules loading this one loads, when that is all it does beyond declaring its values
    /// (`Evaluator::top_level_loads`, D-118); `None` when its top level may act.
    pub loads: Option<Vec<String>>,
}

/// One module's evaluated exports.
pub(crate) struct ExportsEntry {
    pub hash: u64,
    pub exports: Arc<Exports>,
    /// `(dependency, hash seen)` for every module read while evaluating.
    pub provenance: Vec<(PathBuf, u64)>,
    /// Whether an import failed to resolve while evaluating ([`ModuleHost::missed`]).
    pub missed: bool,
    /// The `hash_epoch` the provenance was last verified at (`State::hash_epoch`).
    pub verified: std::sync::atomic::AtomicU64,
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
    /// The exports this module's evaluation has read whole, by module: a second binding from the
    /// same module needs neither its checks nor its provenance again, since no file changes during
    /// a transform (KF-082). Exports a cycle cut short are not kept, as the project does not keep
    /// them either: each read evaluates them again (KF-038).
    exports: RefCell<FxHashMap<ModulePath, Arc<Exports>>>,
    /// The `css()` values this evaluation kept (KF-059), put in the project's cache together when
    /// it ends (`keep_styles`): one turn at the cache's write lock per module, not one per style.
    /// By key, with the order each was kept in: every style of the module asks it, and a list
    /// searched for each made a module of twenty thousand styles quadratic (KF-105).
    styles: RefCell<FxHashMap<String, (usize, Value)>>,
    /// The modules being transformed on this thread, this one last: one of them is never dropped
    /// from an import, so compiling what an import would load ends (D-118).
    compiling: Vec<PathBuf>,
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
            exports: RefCell::default(),
            styles: RefCell::default(),
            compiling: Vec::new(),
        }
    }

    /// Puts the `css()` values this evaluation kept in the project's cache, in one turn at its lock.
    pub fn keep_styles(&self) {
        let mut kept: Vec<_> = self.styles.take().into_iter().collect();
        if kept.is_empty() {
            return;
        }
        // In the order they were kept, so the bound below starts over at the same style it did.
        kept.sort_unstable_by_key(|(_, (order, _))| *order);
        let mut styles = self.project.styles.write().expect("not poisoned");
        for (key, (_, value)) in kept {
            // An editor session compiles every keystroke of a style it types: past the bound the
            // cache starts over, as the runtime's merge cache does, rather than holding every one.
            if styles.len() >= STYLES {
                styles.clear();
            }
            styles.insert(key, value);
        }
    }

    /// The host of a transform run while `compiling` (this module last) are transformed.
    pub fn compiling(self, compiling: Vec<PathBuf>) -> Self {
        Self { compiling, ..self }
    }

    /// Whether the module at `path` is one the project evaluates. An installed package is evaluated
    /// only when it is a Kirana package: a preset or design system from npm must fold to the same
    /// values it does as a workspace package (KRN-TOK-008 rule 4), while evaluating every icon set
    /// or utility library would multiply build time.
    fn evaluates(&self, path: &Path) -> bool {
        let installed = path.components().any(|component| component.as_os_str() == "node_modules");
        let script = path
            .extension()
            .is_some_and(|extension| ["ts", "tsx", "js", "jsx", "mts", "mjs"].iter().any(|known| extension == *known));
        script && (!installed || self.project.package(path).kirana)
    }

    /// Whether loading the module at `path` does nothing but declare values and load modules that do
    /// the same (D-118), adding each to `closure`. `path` holds the modules the walk is in: reaching
    /// one again closes a cycle, which counts as acting, as does a module that does not resolve, one
    /// the project does not evaluate, and one being transformed on this thread. Reading each one's
    /// exports makes it a dependency of this module, so an edit there compiles it again.
    fn loads_only(&self, module: &Path, path: &mut Vec<PathBuf>, closure: &mut Vec<PathBuf>) -> bool {
        if closure.iter().any(|seen| seen == module) {
            return true;
        }
        if path.iter().chain(&self.stack).chain(&self.compiling).any(|entered| entered == module)
            || !self.evaluates(module)
        {
            return false;
        }
        let Some(loads) = self.exports_of(module).and_then(|exports| exports.loads.clone()) else { return false };
        path.push(module.to_path_buf());
        let only = loads.iter().all(|load| {
            self.project.resolved(module, load).is_some_and(|loaded| self.loads_only(&loaded, path, closure))
        });
        path.pop();
        if only {
            closure.push(module.to_path_buf());
        }
        only
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
            self.read.borrow().iter().filter(|(path, hash)| seen.insert((path.as_os_str(), *hash))).cloned().collect();
        read.sort();
        read
    }

    /// Files read directly or through re-exports, deduplicated and sorted.
    pub fn dependencies(&self) -> Vec<PathBuf> {
        let mut seen = FxHashSet::default();
        let mut paths: Vec<PathBuf> = self
            .read
            .borrow()
            .iter()
            .filter(|(path, _)| seen.insert(path.as_os_str()))
            .map(|(path, _)| path.clone())
            .collect();
        paths.sort();
        paths
    }

    /// Every export of the module at `path`: those of the `export *` sources it re-exports first,
    /// then its own, which shadow them.
    pub fn exported(&self, path: &Path) -> Vec<(String, Value)> {
        let Some(exports) = self.exports_of(path) else { return Vec::new() };
        let mut values = Vec::new();
        for star in &exports.stars {
            let Some(source) = self.project.resolved(path, star) else { continue };
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
        if let Some(exports) = self.exports.borrow().get(&*key(path)) {
            return Some(exports.clone());
        }
        let (exports, whole) = self.evaluated_exports(path)?;
        if whole {
            self.exports.borrow_mut().insert(ModulePath::new(path), exports.clone());
        }
        Some(exports)
    }

    /// The module's exports, and whether they are whole: from the project's cache, or evaluated
    /// without a cycle cutting a value short.
    fn evaluated_exports(&self, path: &Path) -> Option<(Arc<Exports>, bool)> {
        if self.closes_cycle(path).is_some() {
            return None;
        }
        // A cache hit is answered from the project's hash cache, without touching the file; the
        // source is read once, and only when the cached exports turn out to be stale. An entry
        // verified at the current epoch is current (`State::hash_epoch`); the hit records what the
        // entry read as this module's own reads.
        let hit = |entry: &ExportsEntry| {
            self.read.borrow_mut().push((path.to_path_buf(), entry.hash));
            self.read.borrow_mut().extend(entry.provenance.iter().cloned());
            self.missed.set(self.missed.get() || entry.missed);
            Some((entry.exports.clone(), true))
        };
        let (cached, epoch) = {
            let state = self.project.state.read().expect("not poisoned");
            let epoch = state.hash_epoch;
            match state.exports.get(&*key(path)) {
                Some(entry) if entry.verified.load(std::sync::atomic::Ordering::Relaxed) == epoch => return hit(entry),
                entry => (entry.map(Arc::clone), epoch),
            }
        };
        // Verified file by file and stamped; the stamp lands on this entry, never on one another
        // thread put in its place meanwhile.
        if let Some(entry) = cached
            && self.project.current_hash(path) == Some(entry.hash)
            && entry.provenance.iter().all(|(dependency, seen)| self.project.current_hash(dependency) == Some(*seen))
        {
            entry.verified.store(epoch, std::sync::atomic::Ordering::Relaxed);
            return hit(&entry);
        }
        let source = self.project.fs.read_to_string(path).ok()?;
        let hash = hash64(source.as_bytes());
        crate::Counters::count(&self.project.work.resolved);
        let mut stack = self.stack.clone();
        stack.push(path.to_path_buf());
        let nested = ModuleHost::new(self.project, stack);
        let file = self.project.display_name(path);
        let package = self.project.package_name(path);
        let context = Context {
            path,
            file: &file,
            package: &package,
            names: &self.project.names,
            config: &self.project.config,
            written: self.project.records_written(),
        };
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
                sx_roots: evaluator.sx_root_exports().into_iter().collect(),
                stars: evaluator.star_exports(),
                sx_forwarding: evaluator.sx_forwarding_exports().into_iter().collect(),
                loads: evaluator.top_level_loads(),
            };
            let (_, definitions) = evaluator.finish();
            (exports, definitions)
        })
        .ok()?;
        nested.keep_styles();
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
        let whole = cut >= depth;
        if !whole {
            self.cut.set(self.cut.get().min(cut));
        } else {
            let mut state = self.project.state.write().expect("not poisoned");
            state.set_hash(path, hash);
            // Verified as of the epoch the evaluation began at: what it read had these hashes then,
            // unless a known file changed meanwhile, which moved the epoch on.
            state.exports.insert(
                ModulePath::new(path),
                Arc::new(ExportsEntry {
                    hash,
                    exports: exports.clone(),
                    provenance: provenance.clone(),
                    missed,
                    verified: std::sync::atomic::AtomicU64::new(epoch),
                }),
            );
        }
        self.read.borrow_mut().push((path.to_path_buf(), hash));
        self.read.borrow_mut().extend(provenance);
        Some((exports, whole))
    }
}

impl Host for ModuleHost<'_> {
    fn import(&self, from: &Path, specifier: &str, name: &ImportName) -> Value {
        // A Node.js built-in holds no styles, and is not unresolved: it is a runtime value, quietly.
        if specifier.starts_with("node:") {
            return Value::unknown("external module");
        }
        // `resolve_file`, not `resolve`: only it finds the importer's tsconfig, so `paths` aliases apply.
        let Some(path) = self.project.resolved(from, specifier) else {
            self.missed.set(true);
            // A module the bundler provides (`externals`) is a runtime value, as a Node.js built-in is.
            if self.project.config.externals.iter().any(|prefix| specifier.starts_with(prefix.as_str())) {
                return Value::unknown("external module");
            }
            return Value::unresolved(specifier, &self.project.display_name(from));
        };
        if let Some(chain) = self.closes_cycle(&path) {
            return Value::cycle(&chain);
        }
        if !self.evaluates(&path) {
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

    fn droppable(&self, from: &Path, specifier: &str) -> bool {
        // A component's script block (`Card.vue.setup.ts`) keeps every import: its template reads
        // bindings the compiler never sees.
        if kirana_frontend::sfc::is_block_id(from) {
            return false;
        }
        let mut closure = Vec::new();
        self.project.resolved(from, specifier).is_some_and(|path| self.loads_only(&path, &mut Vec::new(), &mut closure))
            // Whether the bundler would have loaded and compiled each, or never loaded it (a TypeScript
            // transform drops an import whose bindings the compiled code no longer reads), the build
            // is the same: compiling it adds nothing. An installed package the application does not
            // compile never does.
            && closure.iter().all(|module| {
                self.project.outside_application(module) || self.project.compiles_to_nothing(module, &self.compiling)
            })
    }

    fn is_external(&self, from: &Path, specifier: &str) -> bool {
        self.project.resolved(from, specifier).is_some_and(|path| self.project.outside_application(&path))
    }

    /// Asked only for specifiers that are not installed packages (the transform checks first).
    fn sx_forwarded(&self, from: &Path, specifier: &str, name: &str) -> Option<String> {
        let path = self.project.resolved(from, specifier)?;
        self.exports_of(&path)?.sx_forwarding.get(name).cloned()
    }

    fn sx_root(&self, from: &Path, specifier: &str, name: &str) -> Option<kirana_ir::Handle> {
        let path = self.project.resolve(from, specifier)?;
        self.exports_of(&path)?.sx_roots.get(name).cloned()
    }

    fn cached_style(&self, key: &str) -> Option<Value> {
        // Kept by this evaluation, or by one before it.
        let value = self
            .styles
            .borrow()
            .get(key)
            .map(|(_, value)| value.clone())
            .or_else(|| self.project.styles.read().expect("not poisoned").get(key).cloned())?;
        crate::Counters::count(&self.project.work.styles);
        Some(value)
    }

    fn keep_style(&self, key: String, value: &Value) {
        let mut styles = self.styles.borrow_mut();
        let order = styles.len();
        styles.entry(key).or_insert_with(|| (order, value.clone()));
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
