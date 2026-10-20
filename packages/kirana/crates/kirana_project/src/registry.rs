//! The atom registry: what each module contributes to the stylesheet (KRN-OUT-008), and the
//! project-wide checks over it.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use kirana_diagnostics::{Code, Diagnostic, Span, apply_level};
use kirana_emit::{EmitOptions, EmitOutput, emit};
use kirana_evaluator::{Definitions, relation_reads};
use kirana_ir::dense::{self, Edit, Segment};
use kirana_ir::{Atom, Dep, EntryKey, Handle, Names, Op, Property, Target};
use kirana_transform::TransformOutput;
use lightningcss::targets::{Browsers, Targets};

use crate::Project;

/// One module's contribution.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ModuleRecord {
    /// `(site span, handle)` for every handle written into the module's output.
    pub handles: Vec<((u32, u32), Arc<Handle>)>,
    pub atoms: Vec<Atom>,
    pub marker_deps: Vec<Dep>,
    pub anchors: Vec<String>,
    /// Relation markers read by atoms.
    pub reads: Vec<String>,
    /// `(shorthand, target)` for every unfold token in the module's handles (D-045).
    pub unfolds: Vec<(Property, Target)>,
    /// `(name, marker)` relations declared here.
    pub relations: Vec<(String, String)>,
}

impl ModuleRecord {
    pub(crate) fn new(names: &Names, output: &TransformOutput, definitions: &Definitions) -> Self {
        let mut record = ModuleRecord {
            handles: output.handles.clone(),
            marker_deps: output.marker_deps.clone(),
            anchors: output.anchors.clone(),
            relations: definitions.relations.clone(),
            ..ModuleRecord::default()
        };
        let mut seen = BTreeSet::new();
        for (_, handle) in &output.handles {
            for atom in Atom::from_handle(names, handle) {
                if seen.insert(atom.class.clone()) {
                    record.atoms.push(atom);
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

/// The last stylesheet and the last project diagnostics, with the revision they were computed at
/// ([`crate::State::revision`]). A bundler asks for both once per environment, and a production
/// build has two or more environments compiling the same modules.
#[derive(Debug, Default)]
pub(crate) struct Cached {
    /// `(revision, minify, named, output)`.
    stylesheet: Option<(u64, bool, Option<BTreeSet<String>>, EmitOutput)>,
    diagnostics: Option<(u64, Vec<Diagnostic>)>,
}

impl Project {
    fn live(&self) -> (Vec<Atom>, Vec<Dep>) {
        let state = self.state.read().expect("not poisoned");
        let mut paths: Vec<_> = state.modules.keys().collect();
        paths.sort();
        let mut atoms: BTreeMap<String, Atom> = BTreeMap::new();
        let mut deps = Vec::new();
        for path in paths {
            let record = &state.modules[path];
            for atom in &record.atoms {
                // Modules repeat each other's atoms; only the first copy is worth a clone, and the
                // key is only worth one when it is actually inserted.
                if !atoms.contains_key(&atom.class) {
                    atoms.insert(atom.class.clone(), atom.clone());
                }
            }
            for dep in &record.marker_deps {
                if !deps.contains(dep) {
                    deps.push(dep.clone());
                }
            }
        }
        // A runtime merge can unfold a shorthand atom into its longhands, reusing the atom's value
        // segment. Those longhand rules exist only where some module can unfold that shorthand.
        let unfolds: BTreeSet<(String, &Target)> = state
            .modules
            .values()
            .flat_map(|record| record.unfolds.iter().map(|(shorthand, target)| (shorthand.name.clone(), target)))
            .collect();
        let siblings: Vec<Atom> = atoms
            .values()
            .filter(|atom| unfolds.contains(&(atom.key.property.name.clone(), &atom.key.target)))
            .flat_map(|atom| {
                kirana_cascade::longhands_of(&atom.key.property.name).unwrap_or_default().into_iter().map(|longhand| {
                    let key = EntryKey { property: longhand, ..atom.key.clone() };
                    let op = Op::Set(key.clone(), atom.value.clone());
                    Atom { class: self.names.class(&op), key, value: atom.value.clone() }
                })
            })
            .collect();
        for atom in siblings {
            atoms.entry(atom.class.clone()).or_insert(atom);
        }
        (atoms.into_values().collect(), deps)
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
        let revision = {
            let state = self.state.read().expect("not poisoned");
            if let Some((at, cached_minify, cached_named, output)) = &state.cached.stylesheet
                && *at == state.revision
                && *cached_minify == minify
                && *cached_named == named
            {
                return output.clone();
            }
            state.revision
        };
        let (atoms, deps) = self.live();
        let options = EmitOptions {
            layers_before: self.config.layers.before.clone(),
            layers_after: self.config.layers.after.clone(),
            minify,
            prefix: self.names.prefix.clone(),
            lower_for: self.lowering_targets(),
            named: named.clone(),
        };
        let output = emit(&atoms, &deps, &options);
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
        let mut classes: Vec<String> = self.live().0.into_iter().map(|atom| atom.class).collect();
        {
            let state = self.state.read().expect("not poisoned");
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
            for (name, marker) in &record.relations {
                relation_names.insert(marker, name);
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
        for marker in &anchors {
            if !reads.contains_key(marker) {
                let name = relation_names.get(marker).copied().unwrap_or(marker);
                out.push(Diagnostic::new(
                    Code::RelationUnused,
                    "",
                    Span::default(),
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
        let mut different_value = atom.clone();
        different_value.value.css = "a different value".to_owned();
        let mut different_key = atom.clone();
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
            atoms: vec![different_value, different_key],
            marker_deps: vec![theme("black"), theme("white")],
            ..ModuleRecord::default()
        };
        state.modules.insert(path.with_extension("ghost"), ghost);
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
