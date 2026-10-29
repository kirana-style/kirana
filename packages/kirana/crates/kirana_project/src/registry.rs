//! The atom registry: what each module contributes to the stylesheet (KRN-OUT-008), and the
//! project-wide checks over it.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::{Arc, OnceLock};

use kirana_diagnostics::{Code, Diagnostic, Span, apply_level};
use kirana_emit::{EmitOptions, EmitOutput, emit_ranked};
use kirana_evaluator::{Definitions, relation_reads};
use kirana_ir::dense::{self, Edit, Segment};
use kirana_ir::{Atom, Dep, EntryKey, Handle, LadderRank, Names, Op, Property, Recipe, Target, ladder_rank, same_rank};
use kirana_shared::{FxHashMap, FxHashSet};
use kirana_transform::TransformOutput;
use lightningcss::targets::{Browsers, Targets};

use crate::Project;

/// One module's contribution.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ModuleRecord {
    /// `(site span, handle)` for every handle written into the module's output.
    pub handles: Vec<((u32, u32), Arc<Handle>)>,
    /// `(site span, recipe)` for every recipe written; its handles are in `handles` too.
    pub recipes: Vec<((u32, u32), Arc<Recipe>)>,
    /// Shared with the atom index, which holds every module's atoms.
    pub atoms: Vec<Arc<Atom>>,
    pub marker_deps: Vec<Dep>,
    pub anchors: Vec<String>,
    /// Relation markers read by atoms.
    pub reads: Vec<String>,
    /// `(shorthand, target)` for every unfold token in the module's handles (D-045).
    pub unfolds: Vec<(Property, Target)>,
    /// `(name, marker, optional)` relations declared here.
    pub relations: Vec<(String, String, bool)>,
}

impl ModuleRecord {
    pub(crate) fn new(names: &Names, output: &TransformOutput, definitions: &Definitions) -> Self {
        let mut record = ModuleRecord {
            handles: output.handles.clone(),
            recipes: output.recipes.clone(),
            marker_deps: output.marker_deps.clone(),
            anchors: output.anchors.clone(),
            relations: definitions.relations.clone(),
            ..ModuleRecord::default()
        };
        let mut seen = kirana_shared::FxHashSet::default();
        for (_, handle) in &output.handles {
            for op in &handle.ops {
                // A class seen already (handles of one module share their entries) is not built again.
                let Op::Set(key, value) = op else { continue };
                let class = names.class(op);
                if !seen.contains(&class) {
                    seen.insert(class.clone());
                    record.atoms.push(Arc::new(Atom { class, key: key.clone(), value: value.clone() }));
                }
            }
            for op in &handle.ops {
                if let Op::Unfold { target, shorthand, .. } = op {
                    let unfold = (shorthand.clone(), target.clone());
                    if !record.unfolds.contains(&unfold) {
                        record.unfolds.push(unfold);
                    }
                }
            }
            for (marker, _) in relation_reads(handle) {
                if !record.reads.contains(&marker) {
                    record.reads.push(marker);
                }
            }
        }
        record
    }

    /// Whether the module contributes nothing.
    pub fn is_empty(&self) -> bool {
        self.atoms.is_empty() && self.marker_deps.is_empty() && self.unfolds.is_empty()
    }

    /// What decides the stylesheet: atom classes, marker dependencies and unfolds.
    pub(crate) fn css_key(&self) -> (Vec<&str>, &[Dep], &[(Property, Target)]) {
        (self.atoms.iter().map(|atom| atom.class.as_str()).collect(), &self.marker_deps, &self.unfolds)
    }
}

/// What every module contributes to the stylesheet, kept as records change, so that writing it walks
/// the atoms once instead of every module's copy of them (KF-062), in the order it writes them.
#[derive(Debug, Default)]
pub(crate) struct AtomIndex {
    /// Class → each module writing it, with its atom. The stylesheet takes the first module's, in
    /// path order, as a walk of the modules in that order did: two atoms share a class only when
    /// `class-name-collision` reports them.
    atoms: FxHashMap<Arc<str>, Writers>,
    /// Every class in the stylesheet's order (D-036): ranked when it arrives, and again only when
    /// the atom written for it ranks otherwise, so writing the stylesheet sorts nothing. Grouped by
    /// rank, since most classes share one of a few: placing a class compares ranks among those few,
    /// then classes alone.
    ordered: BTreeMap<LadderRank, BTreeSet<Arc<str>>>,
    /// Shorthand → the classes of its atoms, so the shorthands a runtime merge unfolds (every one a
    /// shorthand of the property table) are found without walking every class. A class names its
    /// property, whichever module's atom is written.
    by_property: BTreeMap<String, BTreeSet<Arc<str>>>,
    /// The marker dependencies of each module that has any, in path order.
    marker_deps: BTreeMap<ModuleKey, Vec<Dep>>,
    /// Shorthand → target → how many unfold tokens name it, across modules.
    unfolds: BTreeMap<String, BTreeMap<Target, usize>>,
}

/// The modules writing one class, and the rank of the atom the stylesheet takes from them.
#[derive(Debug)]
struct Writers {
    rank: LadderRank,
    modules: BTreeMap<ModuleKey, Arc<Atom>>,
    /// The longhand rules a runtime unfold of the written atom reads, built when a stylesheet first
    /// needs them and dropped when the class's modules change.
    longhands: OnceLock<Vec<(LadderRank, Atom)>>,
}

impl Writers {
    /// The atom the stylesheet takes: the first module's.
    fn written(&self) -> &Arc<Atom> {
        self.modules.first_key_value().expect("a class has a module").1
    }
}

/// The longhand rules a runtime unfold of `atom` reads, with their ranks.
fn longhands(names: &Names, atom: &Atom) -> Vec<(LadderRank, Atom)> {
    let longhands = kirana_cascade::longhands_of(&atom.key.property.name).unwrap_or_default();
    longhands
        .into_iter()
        .map(|longhand| {
            let key = EntryKey { property: longhand, ..atom.key.clone() };
            let op = Op::Set(key.clone(), atom.value.clone());
            let sibling = Atom { class: names.class(&op), key, value: atom.value.clone() };
            (ladder_rank(&sibling), sibling)
        })
        .collect()
}

/// A module's path as the index orders it: its bytes, each separator as `\0`, which sorts as the
/// path's components do and compares as bytes, where a path compares component by component. A key
/// is shared by every atom of its module.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct ModuleKey(Arc<[u8]>);

impl ModuleKey {
    fn new(path: &Path) -> Self {
        let text = path.to_string_lossy();
        Self(text.bytes().map(|byte| if byte == b'/' || byte == b'\\' { 0 } else { byte }).collect())
    }
}

impl AtomIndex {
    /// Puts `record` in place of `previous` as what the module at `path` writes. A class both write
    /// stays where it is unless its atom now ranks otherwise, so recompiling a module ranks only
    /// what it changed.
    pub(crate) fn replace(&mut self, path: &Path, previous: Option<&ModuleRecord>, record: &ModuleRecord) {
        let module = ModuleKey::new(path);
        if let Some(previous) = previous {
            let kept: FxHashSet<&str> = record.atoms.iter().map(|atom| atom.class.as_str()).collect();
            for atom in previous.atoms.iter().filter(|atom| !kept.contains(atom.class.as_str())) {
                self.remove_atom(&module, &atom.class);
            }
            self.marker_deps.remove(&module);
            for (shorthand, target) in &previous.unfolds {
                let targets = self.unfolds.get_mut(&shorthand.name).expect("added with the record");
                let count = targets.get_mut(target).expect("added with the record");
                *count -= 1;
                if *count == 0 {
                    targets.remove(target);
                    if targets.is_empty() {
                        self.unfolds.remove(&shorthand.name);
                    }
                }
            }
        }
        for atom in &record.atoms {
            self.add_atom(&module, atom);
        }
        if !record.marker_deps.is_empty() {
            self.marker_deps.insert(module, record.marker_deps.clone());
        }
        for (shorthand, target) in &record.unfolds {
            *self.unfolds.entry(shorthand.name.clone()).or_default().entry(target.clone()).or_default() += 1;
        }
    }

    fn add_atom(&mut self, module: &ModuleKey, atom: &Arc<Atom>) {
        match self.atoms.get_mut(atom.class.as_str()) {
            Some(writers) => {
                let before = writers.written().clone();
                writers.modules.insert(module.clone(), atom.clone());
                self.rerank(&atom.class, &before);
            }
            None => {
                // One copy of the class, shared by the three places that hold it.
                let class: Arc<str> = Arc::from(atom.class.as_str());
                let rank = ladder_rank(atom);
                self.place(&rank, &class);
                let property = &atom.key.property.name;
                if kirana_css_data::is_shorthand(property) {
                    self.by_property.entry(property.clone()).or_default().insert(class.clone());
                }
                let modules = BTreeMap::from([(module.clone(), atom.clone())]);
                self.atoms.insert(class, Writers { rank, modules, longhands: OnceLock::new() });
            }
        }
    }

    fn remove_atom(&mut self, module: &ModuleKey, class: &str) {
        let writers = self.atoms.get_mut(class).expect("added with the record");
        let before = writers.written().clone();
        writers.modules.remove(module);
        if writers.modules.is_empty() {
            let (class, Writers { rank, .. }) = self.atoms.remove_entry(class).expect("found above");
            let property = &before.key.property.name;
            if kirana_css_data::is_shorthand(property) {
                let classes = self.by_property.get_mut(property).expect("added with the class");
                classes.remove(&class);
                if classes.is_empty() {
                    self.by_property.remove(property);
                }
            }
            self.unplace(&rank, &class);
        } else {
            self.rerank(class, &before);
        }
    }

    /// Moves `class` in the stylesheet's order when the atom written for it, once `before`, now
    /// ranks otherwise: only a collision gives one class two ranks.
    fn rerank(&mut self, class: &str, before: &Atom) {
        let writers = self.atoms.get_mut(class).expect("still written");
        writers.longhands.take();
        let after = writers.modules.first_key_value().expect("a class has a module").1;
        if same_rank(before, after) {
            return;
        }
        let rank = ladder_rank(after);
        let old = std::mem::replace(&mut writers.rank, rank.clone());
        let class = self.atoms.get_key_value(class).expect("still written").0.clone();
        self.unplace(&old, &class);
        self.place(&rank, &class);
    }

    /// Puts `class` among the classes of `rank`.
    fn place(&mut self, rank: &LadderRank, class: &Arc<str>) {
        match self.ordered.get_mut(rank) {
            Some(classes) => {
                classes.insert(class.clone());
            }
            None => {
                self.ordered.insert(rank.clone(), BTreeSet::from([class.clone()]));
            }
        }
    }

    /// Takes `class` from the classes of `rank`.
    fn unplace(&mut self, rank: &LadderRank, class: &Arc<str>) {
        let classes = self.ordered.get_mut(rank).expect("placed with the class");
        classes.remove(class);
        if classes.is_empty() {
            self.ordered.remove(rank);
        }
    }

    /// The marker dependencies of every module, each once, in path order.
    fn marker_deps(&self) -> Vec<Dep> {
        let mut deps = Vec::new();
        for dep in self.marker_deps.values().flatten() {
            if !deps.contains(dep) {
                deps.push(dep.clone());
            }
        }
        deps
    }

    /// Each class's written atom with its rank, in the stylesheet's order.
    fn written(&self) -> impl Iterator<Item = (&LadderRank, &Atom)> {
        self.ordered
            .iter()
            .flat_map(move |(rank, classes)| classes.iter().map(move |class| (rank, &**self.atoms[&**class].written())))
    }

    /// A runtime merge can unfold a shorthand atom into its longhands, reusing the atom's value
    /// segment. Those longhand rules exist only where some module can unfold that shorthand: these
    /// are they, in the stylesheet's order. A class a module writes itself keeps that module's atom,
    /// and a class two shorthands' longhands share keeps the one met first.
    fn siblings(&self, names: &Names) -> Vec<(&LadderRank, &Atom)> {
        let mut siblings: Vec<(&LadderRank, &Atom)> = self
            .unfolds
            .iter()
            .flat_map(|(shorthand, targets)| {
                let classes = self.by_property.get(shorthand).into_iter().flatten();
                classes
                    .map(|class| &self.atoms[&**class])
                    .filter(|writers| targets.contains_key(&writers.written().key.target))
            })
            .flat_map(|writers| writers.longhands.get_or_init(|| longhands(names, writers.written())))
            .map(|(rank, sibling)| (rank, sibling))
            .filter(|(_, sibling)| !self.atoms.contains_key(sibling.class.as_str()))
            .collect();
        // A stable sort keeps the first of a class ahead of the others, and `dedup` keeps that one.
        siblings.sort_by(|a, b| a.0.cmp(b.0).then_with(|| a.1.class.cmp(&b.1.class)));
        siblings.dedup_by(|later, earlier| later.1.class == earlier.1.class);
        siblings
    }

    /// The stylesheet's atoms in its order, with their ranks: each class's written atom, and the
    /// longhand siblings merged in where they rank.
    fn ranked(&self, names: &Names) -> Vec<(&LadderRank, &Atom)> {
        let siblings = self.siblings(names);
        let mut out = Vec::with_capacity(self.atoms.len() + siblings.len());
        let mut rest = siblings.into_iter().peekable();
        for (rank, atom) in self.written() {
            while let Some(sibling) = rest.next_if(|(other, sibling)| (*other, &sibling.class) < (rank, &atom.class)) {
                out.push(sibling);
            }
            out.push((rank, atom));
        }
        out.extend(rest);
        out
    }
}

/// The last stylesheet and the last project diagnostics, with the revision they were computed at
/// ([`crate::State::revision`]). A bundler asks for both once per environment, and a production
/// build has two or more environments compiling the same modules.
#[derive(Debug, Default)]
pub(crate) struct Cached {
    /// `(revision, minify, named, output)`.
    stylesheet: Option<(u64, bool, Option<BTreeSet<String>>, EmitOutput)>,
    diagnostics: Option<(u64, Vec<Diagnostic>)>,
}

/// The markers of every relation in a value, inside arrays and objects too.
/// The relations an exported value lets another module read: the relation itself, or a read of it (a
/// condition, a style that reads it, or the bound `within`), at any depth of an object or array
/// (KF-024). A module that exports `{ anchor, style: { lyra: ui.within(…) } }` lets others read the
/// relation as surely as one that exports the relation; an exported anchor alone does not, since no
/// other module could read it.
fn relation_markers(value: &kirana_ir::Value, out: &mut BTreeSet<String>) {
    use kirana_ir::{Condition, Method, Value};
    let handle = |handle: &kirana_ir::Handle, out: &mut BTreeSet<String>| {
        out.extend(relation_reads(handle).into_iter().map(|(marker, _)| marker));
    };
    match value {
        Value::Relation(relation) => {
            out.insert(relation.marker.clone());
        }
        Value::Handle(found) => handle(found, out),
        Value::Recipe(recipe) => {
            let parts = recipe.base.iter().chain(
                recipe
                    .variants
                    .iter()
                    .flat_map(|(_, options)| options.iter().flat_map(|(_, handles)| handles))
                    .chain(recipe.compounds.iter().flat_map(|(_, handles)| handles)),
            );
            parts.for_each(|found| handle(found, out));
        }
        Value::Conditions(conditions) => out.extend(conditions.iter().filter_map(|condition| match condition {
            Condition::Relation { marker, .. } => Some(marker.clone()),
            _ => None,
        })),
        Value::Method(method) => {
            if let Method::RelationRead(relation, _) = &**method {
                out.insert(relation.marker.clone());
            }
        }
        Value::Array(items) => items.iter().for_each(|item| relation_markers(item, out)),
        Value::Object(entries) => entries.iter().for_each(|(_, item)| relation_markers(item, out)),
        _ => {}
    }
}

impl Project {
    /// The span of `relation("name")` in the project file `file`, or an empty span when it is not
    /// written that way.
    fn declaration(&self, file: &str, name: &str) -> Span {
        let source = self.fs.read_to_string(&self.root.join(file)).unwrap_or_default();
        ["\"", "'", "`"]
            .iter()
            .find_map(|quote| {
                let call = format!("relation({quote}{name}{quote})");
                source.find(&call).map(|start| Span::new(start as u32, (start + call.len()) as u32))
            })
            .unwrap_or_default()
    }

    /// The stylesheet for every module in the build graph (KRN-OUT-001 – -003, -007, -008).
    pub fn stylesheet(&self, minify: bool) -> String {
        self.write_stylesheet(minify, None).css
    }

    /// The stylesheet of a finished bundle (D-086): a variable token that only code names, and no
    /// rule reads, is written when `named` (the token names the bundle's chunks and other
    /// stylesheets still hold) includes it or it is declared `runtime: true`. Returns the stylesheet
    /// and the tokens left out, as `(variable, identity)`.
    pub fn finished_stylesheet(&self, minify: bool, named: &[String]) -> (String, Vec<(String, String)>) {
        let output = self.write_stylesheet(minify, Some(named.iter().cloned().collect()));
        (output.css, output.pruned)
    }

    fn write_stylesheet(&self, minify: bool, named: Option<std::collections::BTreeSet<String>>) -> EmitOutput {
        let (revision, output) = {
            let state = self.state.read().expect("not poisoned");
            if let Some((at, cached_minify, cached_named, output)) = &state.cached.stylesheet
                && *at == state.revision
                && *cached_minify == minify
                && *cached_named == named
            {
                return output.clone();
            }
            let options = EmitOptions {
                layers_before: self.config.layers.before.clone(),
                layers_after: self.config.layers.after.clone(),
                tiers: self.config.layers.tiers,
                minify,
                prefix: self.names.prefix.clone(),
                lower_for: self.lowering_targets(),
                named: named.clone(),
            };
            // Written from the index as it stands, borrowed rather than copied out of it.
            let atoms = state.index.ranked(&self.names);
            (state.revision, emit_ranked(&atoms, &state.index.marker_deps(), &options))
        };
        self.state.write().expect("not poisoned").cached.stylesheet = Some((revision, minify, named, output.clone()));
        output
    }

    /// From now on, transforms mark every name they write (D-084), so that [`Project::dense_edits`]
    /// renames what the compiler wrote and nothing else. A host turns this on before a dense build.
    pub fn mark_dense(&self) {
        self.dense.store(true, std::sync::atomic::Ordering::Relaxed);
    }

    /// The edits that give a chunk `text` dense names (D-084), renaming marked names and removing marks: every condition and value hash in the build
    /// has a code, assigned the first time it is seen and kept for the rest of the session, so text
    /// renamed earlier stays valid as later modules compile.
    pub fn dense_edits(&self, text: &str) -> Vec<Edit> {
        self.assign_dense();
        self.state.read().expect("not poisoned").dense.edits(&self.names.prefix, text, true)
    }

    /// A stylesheet `text` with dense names (D-084): every name in it is the compiler's.
    pub fn dense_rename(&self, text: &str) -> String {
        self.assign_dense();
        self.state.read().expect("not poisoned").dense.rename(&self.names.prefix, text, false)
    }

    /// Codes for the hashes of every name the modules write and the stylesheet holds, counted once
    /// per site that writes them.
    fn assign_dense(&self) {
        if !self.state.read().expect("not poisoned").dense_stale {
            return;
        }
        let mut classes: Vec<String> = Vec::new();
        {
            let state = self.state.read().expect("not poisoned");
            classes.extend(state.index.ranked(&self.names).into_iter().map(|(_, atom)| atom.class.clone()));
            for record in state.modules.values() {
                for (_, handle) in &record.handles {
                    classes.extend(handle.ops.iter().map(|op| self.names.class(op)));
                }
            }
        }
        let prefix = &self.names.prefix;
        let mut uses = Vec::new();
        for class in &classes {
            for name in dense::names(prefix, class, false) {
                for (segment, range) in [(Segment::Condition, name.condition), (Segment::Value, name.value)] {
                    if let Some((start, end)) = range.filter(|(start, end)| end - start == 4) {
                        uses.push((segment, &class[start..end], 1));
                    }
                }
            }
        }
        let mut state = self.state.write().expect("not poisoned");
        state.dense.extend(uses);
        state.dense_stale = false;
    }

    fn lowering_targets(&self) -> Option<Targets> {
        if self.config.targets_at_floor() {
            return None;
        }
        let targets = self.config.targets.as_ref().expect("below the floor implies targets");
        let encode =
            |version: &Option<kirana_config::Version>| version.as_ref().and_then(kirana_config::encode_version);
        Some(Targets {
            browsers: Some(Browsers {
                chrome: encode(&targets.chrome),
                safari: encode(&targets.safari),
                firefox: encode(&targets.firefox),
                ..Browsers::default()
            }),
            ..Targets::default()
        })
    }

    /// Project-wide diagnostics: relation R1/R2, token namespace and class-name collisions,
    /// target lowering (KRN-CAS-005, KRN-TOK-010, D-037).
    pub fn diagnostics(&self) -> Vec<Diagnostic> {
        let revision = {
            let state = self.state.read().expect("not poisoned");
            if let Some((at, diagnostics)) = &state.cached.diagnostics
                && *at == state.revision
            {
                return diagnostics.clone();
            }
            state.revision
        };
        let diagnostics = self.check_project();
        self.state.write().expect("not poisoned").cached.diagnostics = Some((revision, diagnostics.clone()));
        diagnostics
    }

    fn check_project(&self) -> Vec<Diagnostic> {
        let state = self.state.read().expect("not poisoned");
        let mut out = Vec::new();
        let mut paths: Vec<_> = state.modules.keys().collect();
        paths.sort();
        let mut anchors = BTreeSet::new();
        let mut reads: BTreeMap<&str, String> = BTreeMap::new();
        let mut relation_names: BTreeMap<&str, &str> = BTreeMap::new();
        // Relations declared `{ optional: true }`: read where their anchor's component may not be
        // installed, which R1 leaves alone (KF-037, D-112), and anchored where their readers may not
        // be, which R2 leaves alone (KF-067).
        let mut optional_relations = BTreeSet::new();
        let mut classes: BTreeMap<&str, (&Atom, String)> = BTreeMap::new();
        let mut segments: BTreeMap<&str, (&kirana_ir::EntryKey, String)> = BTreeMap::new();
        // Definition names (`{prefix}v…`, `t…`, `f…`) are shorter than an atom's class, so they
        // are checked the same way: one name, one definition, or the build is not trustworthy.
        let mut names: BTreeMap<String, (String, String)> = BTreeMap::new();
        for path in &paths {
            let record = &state.modules[*path];
            let file = self.display_name(path);
            anchors.extend(record.anchors.iter().map(String::as_str));
            for marker in &record.reads {
                reads.entry(marker).or_insert_with(|| file.clone());
            }
            for (name, marker, optional) in &record.relations {
                relation_names.insert(marker, name);
                if *optional {
                    optional_relations.insert(marker.as_str());
                }
            }
            for dep in record.marker_deps.iter().chain(record.atoms.iter().flat_map(|atom| &atom.value.deps)) {
                check_named(dep, &file, &mut names, &mut out);
            }
            for atom in &record.atoms {
                if let Some((existing, first)) = classes.get(atom.class.as_str()) {
                    if existing.key != atom.key || existing.value.css != atom.value.css {
                        out.push(collision(&file, &atom.class, first));
                    }
                } else {
                    classes.insert(&atom.class, (atom, file.clone()));
                }
                // The runtime merges by the key segment written in the class name.
                let segment = &atom.class
                    [self.names.prefix.len()..atom.class.rfind('_').expect("atom classes have a value segment")];
                match segments.get(segment) {
                    Some((key, first)) if **key != atom.key => out.push(collision(&file, &atom.class, first)),
                    Some(_) => {}
                    None => {
                        segments.insert(segment, (&atom.key, file.clone()));
                    }
                }
            }
        }
        // One group name in two packages compiles to two sets of properties, but reads alike in
        // `export`, hovers and code (KF-011): say so once, where the later package declares it.
        let mut packages: BTreeMap<&str, Vec<(&str, &str)>> = BTreeMap::new();
        for ((package, namespace), files) in &state.namespaces {
            let file = files.iter().next().expect("a namespace has a file");
            packages.entry(namespace).or_default().push((package, file));
        }
        for (namespace, declared) in &packages {
            let (first_package, first_file) = declared[0];
            for (_, file) in &declared[1..] {
                out.push(Diagnostic::new(
                    Code::TokenNamespaceShared,
                    *file,
                    Span::default(),
                    format!(
                        "token group {namespace:?} is also declared by {first_package:?} in {first_file}: the two \
                         stay apart, but read alike as `{namespace}.*`; `kirana-style export` tells them apart by \
                         `package`"
                    ),
                ));
            }
        }
        for ((_, namespace), files) in &state.namespaces {
            if files.len() > 1 {
                let mut files = files.iter();
                let first = files.next().expect("more than one");
                for other in files {
                    out.push(Diagnostic::new(
                        Code::TokenNamespaceCollision,
                        other,
                        Span::default(),
                        format!("token namespace {namespace:?} is also declared in {first}"),
                    ));
                }
            }
        }
        for (name, files) in state.relations.values() {
            let mut files = files.iter();
            let first = files.next().expect("a declared relation has a file");
            for other in files {
                out.push(
                    Diagnostic::new(
                        Code::RelationNameCollision,
                        other,
                        Span::default(),
                        format!("relation {name:?} is also declared in {first}, so both share one marker"),
                    )
                    .with_help("export the relation from one module and import it where it is read"),
                );
            }
        }
        for (marker, file) in &reads {
            // A relation declared in a module this build never compiled (its import only carried a
            // style) is anchored where that module renders, which this build cannot see: `kirana
            // check`, compiling every module, decides it (D-062).
            if let Some(name) = relation_names.get(marker)
                && !anchors.contains(marker)
                && !optional_relations.contains(marker)
            {
                out.push(
                    Diagnostic::new(
                        Code::RelationWithoutAnchor,
                        file,
                        Span::default(),
                        format!("relation {name:?} is read but its anchor is never applied"),
                    )
                    .with_help("apply `relation.anchor` to the element whose state is read"),
                );
            }
        }
        // An exported relation may be read by a module this build never reached; only a project
        // compiled whole can say that none does (D-090). A relation its module keeps to itself is
        // read there or nowhere, so every build reports it.
        let walked = self.walked.load(std::sync::atomic::Ordering::Relaxed);
        let mut exported = BTreeSet::new();
        if !walked {
            for entry in state.exports.values() {
                for value in entry.exports.values.values() {
                    relation_markers(value, &mut exported);
                }
            }
        }
        for marker in &anchors {
            if !reads.contains_key(marker)
                && !optional_relations.contains(*marker)
                && (walked || !exported.contains(*marker))
            {
                // The declaring module may only have been evaluated, not compiled: its name is then
                // in the session's table of declarations.
                let name = relation_names
                    .get(marker)
                    .copied()
                    .or_else(|| state.relations.get(*marker).map(|(name, _)| name.as_str()))
                    .unwrap_or(marker);
                // Where it is declared, as every other diagnostic says where it is.
                let (file, span): (String, Span) = state
                    .relations
                    .get(*marker)
                    .and_then(|(_, files)| files.iter().next())
                    .map(|file| (file.clone(), self.declaration(file, name)))
                    .unwrap_or_default();
                out.push(Diagnostic::new(
                    Code::RelationUnused,
                    &file,
                    span,
                    format!("relation {name:?} is anchored but never read"),
                ));
            }
        }
        if self.lowering_targets().is_some() {
            out.push(Diagnostic::new(
                Code::TargetLowering,
                "",
                Span::default(),
                "the stylesheet is lowered for targets below the default floor",
            ));
        }
        out.into_iter()
            .filter_map(|diagnostic| apply_level(diagnostic.clone(), self.config.level(diagnostic.code)))
            .collect()
    }
}

impl Project {
    /// Test support: adds a module whose atoms reuse a real atom's class with another value, and
    /// its key segment with another key, and whose marker deps give one definition name to two
    /// different definitions, so every collision check fires.
    #[doc(hidden)]
    pub fn debug_force_collision(&self, path: &std::path::Path) {
        let mut state = self.state.write().expect("not poisoned");
        state.revision += 1;
        let atom = state.modules.get(path).and_then(|record| record.atoms.first().cloned()).expect("an atom");
        let mut different_value = (*atom).clone();
        different_value.value.css = "a different value".to_owned();
        // Ranked otherwise too, so the index moves the class when this module writes it first.
        different_value.value.longhands = 7;
        let mut different_key = (*atom).clone();
        different_key.class = format!("{}_zzz", &atom.class[..atom.class.rfind('_').expect("value segment")]);
        different_key.key.property = kirana_ir::Property::longhand("--renamed");
        let theme = |ink: &str| {
            Dep::Theme(std::sync::Arc::new(kirana_ir::ThemeDef {
                class: "ktSame".to_owned(),
                declarations: vec![("--kvInk".to_owned(), kirana_ir::TokenValue::Plain(ink.to_owned()))],
                deps: Vec::new(),
            }))
        };
        let ghost = ModuleRecord {
            atoms: vec![Arc::new(different_value), Arc::new(different_key)],
            marker_deps: vec![theme("black"), theme("white")],
            ..ModuleRecord::default()
        };
        state.put_module(&path.with_extension("ghost"), ghost);
    }
}

/// Reports a definition name that two different definitions produced, following nested deps.
fn check_named(dep: &Dep, file: &str, names: &mut BTreeMap<String, (String, String)>, out: &mut Vec<Diagnostic>) {
    let (name, identity, inner) = match dep {
        Dep::Token(token) => (&token.variable, format!("token {}", token.identity), &token.deps),
        Dep::Theme(theme) => (&theme.class, format!("theme {:?}", theme.declarations), &theme.deps),
        Dep::Keyframes(frames) => (&frames.name, format!("keyframes {:?}", frames.frames), &frames.deps),
        Dep::PositionTry(fallback) => {
            (&fallback.name, format!("position-try {:?}", fallback.declarations), &fallback.deps)
        }
        Dep::ViewTransition(transition) => {
            (&transition.class, format!("view transition {:?}", transition.parts), &transition.deps)
        }
        Dep::CounterStyle(style) => (&style.name, format!("counter style {:?}", style.descriptors), &style.deps),
    };
    match names.get(name) {
        Some((first_identity, _)) if *first_identity == identity => return,
        Some((_, first)) => out.push(collision(file, name, first)),
        None => {
            names.insert(name.clone(), (identity, file.to_owned()));
        }
    }
    for dep in inner {
        check_named(dep, file, names, out);
    }
}

fn collision(file: &str, class: &str, first: &str) -> Diagnostic {
    Diagnostic::new(
        Code::ClassNameCollision,
        file,
        Span::default(),
        format!("class {class} names two different atoms (also in {first})"),
    )
    .with_help("report this: two atoms hashed to the same name; the build cannot be trusted")
}
