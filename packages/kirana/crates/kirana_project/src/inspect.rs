//! The inspection API (KRN-DX-001, KRN-DX-009): what the compiler knows about a module's styles,
//! its tokens and its relations, for the language server and the lint plugin. Tools read these
//! answers instead of re-implementing the compiler, so they never disagree with the build.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use kirana_diagnostics::Span;
use kirana_ir::{Atom, Condition, ConditionSet, Dep, Op, RelationKind, Target, TokenValue};
use serde::Serialize;

use crate::{Project, State};

/// One atom a site applies, with the rule the stylesheet carries for it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SiteAtom {
    /// Kebab-case property; a shorthand atom names the shorthand.
    pub property: String,
    pub value: String,
    /// Readable conditions (`:hover`, `@media (width >= 40rem)`, `card.within(:hover)`); empty for
    /// the base value.
    pub conditions: Vec<String>,
    /// `""` for the element, `::before` for a pseudo-element, `> [data-slot="x"]` for a contextual
    /// target.
    pub target: String,
    pub class: String,
    pub layer: &'static str,
    /// The CSS rule as the stylesheet writes it, at-rules included, unminified.
    pub rule: String,
    /// Identities (`namespace.path`) of the variable tokens the value reads.
    pub tokens: Vec<String>,
    /// The atom's place among its site's atoms in stylesheet order (the precedence ladder): of two
    /// atoms whose conditions all hold, for one property and target, the higher rank wins.
    pub rank: u32,
}

/// Where a class is produced: one site of one module.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Origin {
    pub path: std::path::PathBuf,
    pub span: Span,
    pub class: String,
}

/// One place in a module that produces a style: a `css()` call, an `sx` value or a recipe.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Site {
    pub span: Span,
    pub atoms: Vec<SiteAtom>,
}

/// One token as declared.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TokenInfo {
    /// `namespace.path`.
    pub identity: String,
    pub package: String,
    pub file: String,
    /// The token's entry in `defineTokens`.
    pub span: Span,
    /// The value used in CSS: the inlined text, `light-dark(…)` for a colour pair, or the light and
    /// dark values joined by a space for a mode token.
    pub value: String,
    /// Per-mode values, for a mode token or a colour pair; otherwise `None`.
    pub light: Option<String>,
    pub dark: Option<String>,
    /// Whether the token is a custom property (assignable, theme-able).
    pub variable: bool,
}

/// One relation: where it is declared, anchored and read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RelationInfo {
    pub name: String,
    pub marker: String,
    pub declared_in: Vec<String>,
    pub anchored_in: Vec<String>,
    pub read_in: Vec<String>,
}

impl Project {
    /// The style sites of a module the session has transformed, in source order. Empty for a
    /// module it has not transformed or that has no styles.
    pub fn sites(&self, path: &Path) -> Vec<Site> {
        let state = self.state.read().expect("not poisoned");
        let Some(record) = state.modules.get(&*crate::path::key(path)) else { return Vec::new() };
        let names: BTreeMap<&str, &str> =
            state.relations.iter().map(|(marker, (name, _))| (marker.as_str(), name.as_str())).collect();
        let mut sites: Vec<Site> = record
            .handles
            .iter()
            .map(|(span, handle)| {
                let atoms = Atom::from_handle(&self.names, handle);
                let mut order: Vec<usize> = (0..atoms.len()).collect();
                order.sort_by_cached_key(|index| kirana_ir::ladder_key(&atoms[*index]));
                let mut ranks = vec![0u32; atoms.len()];
                for (rank, index) in order.into_iter().enumerate() {
                    ranks[index] = rank as u32;
                }
                Site {
                    span: Span::new(span.0, span.1),
                    atoms: atoms.iter().zip(ranks).map(|(atom, rank)| site_atom(atom, rank, &names)).collect(),
                }
            })
            .collect();
        sites.sort_by_key(|site| (site.span.start, site.span.end));
        sites
    }

    /// The classes of the atoms at the sites of `path` whose span `matches`, as `sites` would list
    /// them, without the rest a `Site` carries: a "used by" count asks this of thousands of sites.
    pub fn classes_at(&self, path: &Path, matches: &dyn Fn(Span) -> bool) -> Vec<String> {
        let state = self.state.read().expect("not poisoned");
        let Some(record) = state.modules.get(&*crate::path::key(path)) else { return Vec::new() };
        record
            .handles
            .iter()
            .filter(|(span, _)| matches(Span::new(span.0, span.1)))
            .flat_map(|(_, handle)| classes(&self.names, handle))
            .collect()
    }

    /// Where each of `classes` is produced: every site, in every module, whose atoms carry it — the
    /// `css()` an `sx` value took a declaration from, and the `sx` values that apply it. By module,
    /// then span. Answered from an index built the first time it is asked and kept in step with the
    /// modules after (`OriginIndex`): an editor asks for a hover's origins at every hover, and a
    /// common declaration's are in most of a project's modules.
    pub fn origins(&self, classes: &BTreeSet<&str>) -> Vec<Origin> {
        // Built under the write lock the first time; the lookup after holds the same lock, which
        // a transform's turn at the session waits for as it would for any write.
        let mut state = self.state.write().expect("not poisoned");
        if !state.origins.built {
            let State { origins, modules, .. } = &mut *state;
            origins.build(&self.names, modules.iter());
        }
        // By module in path order, each module's by span then class: the modules are kept in path
        // order, so only each module's few entries are sorted.
        let mut per_module: kirana_shared::FxHashMap<u32, Vec<Found<'_>>> = kirana_shared::FxHashMap::default();
        for class in classes {
            for (module, span) in state.origins.by_class.get(*class).into_iter().flatten() {
                per_module.entry(*module).or_default().push((span.0, class, *span));
            }
        }
        let mut out = Vec::new();
        for module in &state.origins.order {
            let Some(mut entries) = per_module.remove(module) else { continue };
            entries.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
            let path = state.origins.modules[*module as usize].as_path();
            out.extend(entries.into_iter().map(|(_, class, span)| Origin {
                path: path.to_path_buf(),
                span: Span::new(span.0, span.1),
                class: class.to_owned(),
            }));
        }
        out
    }

    /// The definition of the token whose custom property is `variable`, once a module declaring it
    /// was evaluated.
    pub fn token_definition(&self, variable: &str) -> Option<std::sync::Arc<kirana_ir::TokenDef>> {
        self.state.read().expect("not poisoned").tokens.get(variable).cloned()
    }

    /// Every token the session has evaluated, by package, then identity.
    pub fn tokens(&self) -> Vec<TokenInfo> {
        let state = self.state.read().expect("not poisoned");
        let mut tokens: Vec<TokenInfo> = state
            .catalogue
            .iter()
            .flat_map(|(file, (package, entries))| {
                entries.iter().map(move |entry| {
                    let (value, light, dark) = match &entry.value {
                        TokenValue::Plain(css) => {
                            let pair = split_light_dark(css);
                            (css.clone(), pair.as_ref().map(|pair| pair.0.clone()), pair.map(|pair| pair.1))
                        }
                        TokenValue::Modes { light, dark } => {
                            (format!("{light} {dark}"), Some(light.clone()), Some(dark.clone()))
                        }
                    };
                    TokenInfo {
                        identity: entry.identity.clone(),
                        package: package.clone(),
                        file: file.clone(),
                        span: Span::new(entry.span.0, entry.span.1),
                        value,
                        light,
                        dark,
                        variable: entry.variable,
                    }
                })
            })
            .collect();
        tokens.sort_by(|a, b| (&a.package, &a.identity, &a.file).cmp(&(&b.package, &b.identity, &b.file)));
        tokens
    }

    /// Every relation the session has seen declared, by name.
    pub fn relations(&self) -> Vec<RelationInfo> {
        let state = self.state.read().expect("not poisoned");
        let mut anchored: BTreeMap<&str, BTreeSet<String>> = BTreeMap::new();
        let mut read: BTreeMap<&str, BTreeSet<String>> = BTreeMap::new();
        for (path, record) in &state.modules {
            for marker in &record.anchors {
                anchored.entry(marker).or_default().insert(self.display_name(path));
            }
            for marker in &record.reads {
                read.entry(marker).or_default().insert(self.display_name(path));
            }
        }
        let mut relations: Vec<RelationInfo> = state
            .relations
            .iter()
            .map(|(marker, (name, files))| RelationInfo {
                name: name.clone(),
                marker: marker.clone(),
                declared_in: files.iter().cloned().collect(),
                anchored_in: anchored.remove(marker.as_str()).unwrap_or_default().into_iter().collect(),
                read_in: read.remove(marker.as_str()).unwrap_or_default().into_iter().collect(),
            })
            .collect();
        relations.sort_by(|a, b| (&a.name, &a.marker).cmp(&(&b.name, &b.marker)));
        relations
    }
}

/// Where every class is produced: for each class, the `(module, site span)` of every atom carrying
/// it in a handle written there, one entry per atom as `Atom::from_handle` lists them. Empty until
/// `Project::origins` first asks (`built`); kept in step with the records after, so an edit costs its
/// own module's entries, not a walk over every module.
#[derive(Default)]
pub struct OriginIndex {
    pub(crate) built: bool,
    /// Each module that ever had an entry, once; an entry names its module by index here.
    pub(crate) modules: Vec<crate::path::ModulePath>,
    /// The indexes of `modules` in path order, as `Project::origins` lists them.
    pub(crate) order: Vec<u32>,
    slot: kirana_shared::FxHashMap<crate::path::ModulePath, u32>,
    pub(crate) by_class: kirana_shared::FxHashMap<String, Vec<Entry>>,
}

/// An origin found for a request: the span's start, the class and the span, in sort order.
type Found<'c> = (u32, &'c str, (u32, u32));

/// One origin in the index: the module (an index into `OriginIndex::modules`) and the site's span.
type Entry = (u32, (u32, u32));

impl OriginIndex {
    /// Builds the index from every record, once.
    pub(crate) fn build<'r>(
        &mut self,
        names: &kirana_ir::Names,
        records: impl Iterator<Item = (&'r crate::path::ModulePath, &'r crate::registry::ModuleRecord)>,
    ) {
        for (path, record) in records {
            self.add(names, path.as_path(), record);
        }
        self.built = true;
    }

    /// Puts `current`'s entries in place of `previous`'s for the module at `path`; nothing until the
    /// index is built, since the build reads every record then.
    pub(crate) fn replace(
        &mut self,
        names: &kirana_ir::Names,
        path: &Path,
        previous: Option<&crate::registry::ModuleRecord>,
        current: Option<&crate::registry::ModuleRecord>,
    ) {
        if !self.built {
            return;
        }
        if let Some(previous) = previous {
            self.remove(names, path, previous);
        }
        if let Some(current) = current {
            self.add(names, path, current);
        }
    }

    fn module(&mut self, path: &Path) -> u32 {
        let key = crate::path::key(path);
        match self.slot.get(&*key) {
            Some(slot) => *slot,
            None => {
                let slot = self.modules.len() as u32;
                let module = crate::path::ModulePath::new(path);
                let at = self.order.partition_point(|other| self.modules[*other as usize].as_path() < module.as_path());
                self.order.insert(at, slot);
                self.modules.push(module.clone());
                self.slot.insert(module, slot);
                slot
            }
        }
    }

    fn add(&mut self, names: &kirana_ir::Names, path: &Path, record: &crate::registry::ModuleRecord) {
        let module = self.module(path);
        for (span, handle) in &record.handles {
            for class in classes(names, handle) {
                self.by_class.entry(class).or_default().push((module, *span));
            }
        }
    }

    fn remove(&mut self, names: &kirana_ir::Names, path: &Path, record: &crate::registry::ModuleRecord) {
        let module = self.module(path);
        for (span, handle) in &record.handles {
            for class in classes(names, handle) {
                self.by_class.entry(class).or_default().retain(|entry| *entry != (module, *span));
            }
        }
    }
}

/// A handle's classes, one per atom in `Atom::from_handle`'s order (its `Set`s): only the class is
/// read, so the key and value are not copied for every declaration in the project.
fn classes<'h>(names: &'h kirana_ir::Names, handle: &'h kirana_ir::Handle) -> impl Iterator<Item = String> + 'h {
    handle.ops.iter().filter(|op| matches!(op, Op::Set(..))).map(|op| names.class(op))
}

pub(crate) fn site_atom(atom: &Atom, rank: u32, relations: &BTreeMap<&str, &str>) -> SiteAtom {
    let mut rule = String::new();
    let preludes = kirana_emit::at_rules(atom);
    for prelude in &preludes {
        rule.push_str(prelude);
        rule.push_str(" { ");
    }
    let property = &atom.key.property.name;
    let declarations: Vec<String> =
        kirana_ir::fallback_values(&atom.value.css).rev().map(|value| format!("{property}: {value}")).collect();
    rule.push_str(&format!("{} {{ {} }}", kirana_emit::selector(atom), declarations.join("; ")));
    rule.push_str(&" }".repeat(preludes.len()));
    SiteAtom {
        property: atom.key.property.name.to_string(),
        value: kirana_ir::readable_value(&atom.value.css),
        conditions: readable(&atom.key.conditions, relations),
        target: match &atom.key.target {
            Target::Element => String::new(),
            Target::PseudoElement(name) => name.clone(),
            Target::Contextual { child, selector, pseudo_element } => {
                format!("{}{selector}{}", if *child { "> " } else { "" }, pseudo_element.as_deref().unwrap_or(""))
            }
        },
        class: atom.class.clone(),
        layer: if atom.key.target.is_contextual() { "kirana.contextual" } else { "kirana.atoms" },
        rule,
        tokens: atom
            .value
            .deps
            .iter()
            .filter_map(|dep| match dep {
                Dep::Token(token) => Some(token.identity.clone()),
                _ => None,
            })
            .collect(),
        rank,
    }
}

/// Conditions as an author writes them, with relation markers replaced by relation names.
fn readable(conditions: &ConditionSet, relations: &BTreeMap<&str, &str>) -> Vec<String> {
    conditions
        .conditions()
        .iter()
        .map(|condition| match condition {
            Condition::Relation { marker, kind, state } => {
                let name = relations.get(marker.as_str()).copied().unwrap_or(marker);
                let kind = match kind {
                    RelationKind::Within => "within",
                    RelationKind::Parent => "parent",
                    RelationKind::After => "after",
                    RelationKind::Before => "before",
                };
                format!("{name}.{kind}({state})")
            }
            other => other.canonical(),
        })
        .collect()
}

/// `light-dark(a, b)` → `(a, b)`, splitting at the top-level comma.
pub fn split_light_dark(css: &str) -> Option<(String, String)> {
    let inner = css.trim().strip_prefix("light-dark(")?.strip_suffix(')')?;
    let mut depth = 0usize;
    for (index, byte) in inner.bytes().enumerate() {
        match byte {
            b'(' => depth += 1,
            b')' => depth = depth.saturating_sub(1),
            b',' if depth == 0 => {
                return Some((inner[..index].trim().to_owned(), inner[index + 1..].trim().to_owned()));
            }
            _ => {}
        }
    }
    None
}
