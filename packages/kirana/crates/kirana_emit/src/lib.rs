//! The CSS writer (D-025, D-036). It writes the whole stylesheet from live atoms and their
//! dependencies, in one deterministic order:
//!
//! 1. the layer order statement (KRN-OUT-003);
//! 2. `kirana.tokens`: variable tokens on `:root`, per-mode overrides, keyframes, `@position-try`
//!    fallbacks, `@counter-style` rules and view-transition classes;
//! 3. `kirana.themes`: scoped theme overrides;
//! 4. `kirana.contextual`: `select.*` styles, ladder-ordered;
//! 5. `kirana.atoms`: element atoms, ladder-ordered. Every selector is (0,1,0) through
//!    `:where()`, so source order is the precedence ladder. Atoms that share a conflict key are
//!    ordered among themselves so that more rules share a declaration.
//!
//! Production output is minified by the writer itself, so colours and values are never
//! re-serialized. Lightning CSS runs only when configured targets are below the default floor.

pub mod minify;

use std::collections::BTreeMap;
use std::fmt::Write as _;

use kirana_css_data::{PropertyRank, Sets, flow_group, sets};
use kirana_ir::{
    Atom, Condition, CounterStyleDef, Dep, KeyframesDef, PositionTryDef, RelationKind, Target, ThemeDef, TokenDef,
    TokenValue, ViewTransitionDef, fallback_values, ladder_key,
};
use lightningcss::stylesheet::{MinifyOptions, ParserOptions, PrinterOptions, StyleSheet};
use lightningcss::targets::Targets;

/// Options for one stylesheet.
#[derive(Debug, Clone, Default)]
pub struct EmitOptions {
    pub layers_before: Vec<String>,
    pub layers_after: Vec<String>,
    /// Each ladder tier of `kirana.atoms` in its own sub-layer (`layers.tiers`, D-114).
    pub tiers: bool,
    pub minify: bool,
    /// The class-name prefix (for mode markers).
    pub prefix: String,
    /// Targets below the default floor; `None` when no lowering is needed.
    pub lower_for: Option<Targets>,
    /// The variable tokens and keyframes a finished bundle still names (D-086, D-094). A token or a
    /// keyframes rule that only code names, and no rule reads, is written when it is in this set (or,
    /// for a token, declared `runtime: true`). `None` when no bundle is known (a dev server, `check`,
    /// a host that does not report one): every such definition is written.
    pub named: Option<std::collections::BTreeSet<String>>,
}

/// The written stylesheet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmitOutput {
    pub css: String,
    /// Whether Lightning CSS lowered syntax for the configured targets (`target-lowering`).
    pub lowered: bool,
    /// Variable tokens and keyframes left out because no rule reads them and the bundle does not name
    /// them, as `(name, identity)` in order (D-086, D-094); a keyframes rule's identity is
    /// `@keyframes {name}`. A host fails a later chunk that names one.
    pub pruned: Vec<(String, String)>,
}

struct Writer {
    out: String,
    minify: bool,
    depth: usize,
}

impl Writer {
    fn open(&mut self, prelude: &str) {
        self.indent();
        if self.minify {
            let kind = if prelude.starts_with('@') { minify::Kind::AtRule } else { minify::Kind::Selector };
            self.out.push_str(&minify::compact(prelude, kind));
        } else {
            self.out.push_str(prelude);
        }
        self.out.push_str(if self.minify { "{" } else { " {\n" });
        self.depth += 1;
    }

    fn close(&mut self) {
        self.depth -= 1;
        self.indent();
        self.out.push_str(if self.minify { "}" } else { "}\n" });
    }

    /// Writes one declaration, or one per member of a `firstThatWorks` run: the fallbacks first and
    /// the preferred value last, because a browser keeps the last declaration it understands.
    fn declaration(&mut self, property: &str, value: &str) {
        let members: Vec<&str> = fallback_values(value).collect();
        for value in members.into_iter().rev() {
            self.indent();
            if self.minify {
                let _ = write!(self.out, "{property}:{};", minify::compact(value, minify::Kind::Value));
            } else {
                let _ = writeln!(self.out, "{property}: {value};");
            }
        }
    }

    fn statement(&mut self, text: &str) {
        self.indent();
        self.out.push_str(text);
        self.out.push_str(if self.minify { ";" } else { ";\n" });
    }

    fn indent(&mut self) {
        if !self.minify {
            self.out.push_str(&"  ".repeat(self.depth));
        }
    }

    fn separator(&self) -> &'static str {
        if self.minify { "," } else { ", " }
    }

    /// Removes the trailing `;` before `}` in minified output.
    fn finish(mut self) -> String {
        if self.minify {
            self.out = self.out.replace(";}", "}");
        }
        self.out
    }
}

/// Collects every dependency, transitively, keyed for deterministic order.
#[derive(Default)]
struct Deps {
    tokens: BTreeMap<String, TokenDef>,
    themes: BTreeMap<String, ThemeDef>,
    keyframes: BTreeMap<String, KeyframesDef>,
    position_tries: BTreeMap<String, PositionTryDef>,
    counter_styles: BTreeMap<String, CounterStyleDef>,
    view_transitions: BTreeMap<String, ViewTransitionDef>,
}

impl Deps {
    fn add(&mut self, dep: &Dep) {
        match dep {
            Dep::Token(token) => {
                if !self.tokens.contains_key(&token.variable) {
                    self.tokens.insert(token.variable.clone(), (**token).clone());
                    token.deps.iter().for_each(|inner| self.add(inner));
                }
            }
            Dep::Theme(theme) => {
                if !self.themes.contains_key(&theme.class) {
                    self.themes.insert(theme.class.clone(), (**theme).clone());
                    theme.deps.iter().for_each(|inner| self.add(inner));
                }
            }
            Dep::Keyframes(frames) => {
                if !self.keyframes.contains_key(&frames.name) {
                    self.keyframes.insert(frames.name.clone(), (**frames).clone());
                    frames.deps.iter().for_each(|inner| self.add(inner));
                }
            }
            Dep::PositionTry(fallback) => {
                if !self.position_tries.contains_key(&fallback.name) {
                    self.position_tries.insert(fallback.name.clone(), (**fallback).clone());
                    fallback.deps.iter().for_each(|inner| self.add(inner));
                }
            }
            Dep::CounterStyle(style) => {
                if !self.counter_styles.contains_key(&style.name) {
                    self.counter_styles.insert(style.name.clone(), (**style).clone());
                    style.deps.iter().for_each(|inner| self.add(inner));
                }
            }
            Dep::ViewTransition(transition) => {
                if !self.view_transitions.contains_key(&transition.class) {
                    self.view_transitions.insert(transition.class.clone(), (**transition).clone());
                    transition.deps.iter().for_each(|inner| self.add(inner));
                }
            }
        }
    }
}

/// The selector of one atom.
///
/// Pseudo-classes and attributes go in one `:where()`, each relation in another, and every part is
/// zero-specificity so that source order alone decides the ladder. When there is a relation, the
/// compound rides along inside its `:where()` — `:where(.m *:hover)` matches exactly what
/// `:where(:hover):where(.m *)` matches, in eight fewer bytes per rule.
pub fn selector(atom: &Atom) -> String {
    let mut selector = format!(".{}", atom.class);
    let mut compound = String::new();
    let mut relations = 0;
    for condition in atom.key.conditions.conditions() {
        if let Condition::Pseudo(text) | Condition::Attribute(text) = condition {
            compound.push_str(text);
        }
    }
    // The compound joins the first relation, so it is written before the others.
    let mut riding = compound.as_str();
    for condition in atom.key.conditions.conditions() {
        let (marker, kind, state) = match condition {
            Condition::Relation { marker, kind, state } => (marker, kind, state),
            _ => continue,
        };
        relations += 1;
        let _ = match kind {
            RelationKind::Within => write!(selector, ":where(.{marker}{state} *{riding})"),
            RelationKind::Parent => write!(selector, ":where(.{marker}{state} > *{riding})"),
            RelationKind::After => write!(selector, ":where(.{marker}{state} ~ *{riding})"),
            RelationKind::Before => write!(selector, ":where(:has(~ .{marker}{state}){riding})"),
        };
        riding = "";
    }
    if relations == 0 && !compound.is_empty() {
        let _ = write!(selector, ":where({compound})");
    }
    match &atom.key.target {
        Target::Element => {}
        Target::PseudoElement(name) => selector.push_str(name),
        Target::Contextual { child, selector: target, pseudo_element } => {
            let _ = write!(
                selector,
                "{}:where({target}){}",
                if *child { " > " } else { " " },
                pseudo_element.as_deref().unwrap_or("")
            );
        }
    }
    selector
}

/// The at-rule preludes wrapping an atom, outermost first.
pub fn at_rules(atom: &Atom) -> Vec<String> {
    let conditions = atom.key.conditions.conditions();
    let mut preludes = Vec::new();
    for condition in conditions {
        if let Condition::Supports(query) = condition {
            preludes.push(format!("@supports {query}"));
        }
    }
    for condition in conditions {
        if let Condition::Media(query) = condition {
            preludes.push(format!("@media {query}"));
        }
    }
    for condition in conditions {
        if let Condition::Container { .. } = condition {
            preludes.push(condition.canonical());
        }
    }
    preludes
}

/// Writes ladder-ordered atoms, one at-rule block at a time. `own` says the atoms style the element
/// that carries their class, which lets [`arrange`] reorder atoms that share a conflict key.
fn write_atoms(writer: &mut Writer, atoms: &[&Atom], own: bool) {
    let mut open: Vec<String> = Vec::new();
    let mut block: Vec<&Atom> = Vec::new();
    for atom in atoms {
        let wanted = at_rules(atom);
        if wanted != open {
            write_block(writer, &mut block, own);
        }
        let shared = open.iter().zip(&wanted).take_while(|(a, b)| a == b).count();
        while open.len() > shared {
            writer.close();
            open.pop();
        }
        for prelude in &wanted[shared..] {
            writer.open(prelude);
            open.push(prelude.clone());
        }
        block.push(atom);
    }
    write_block(writer, &mut block, own);
    for _ in open {
        writer.close();
    }
}

/// One atom's rule as the stylesheet writes it when nothing shares it, at-rules included: what the
/// atom costs before rules carrying the same declaration are merged (`kirana-style analyze`).
pub fn atom_rule(atom: &Atom, minify: bool) -> String {
    let mut writer = Writer { out: String::new(), minify, depth: 0 };
    write_atoms(&mut writer, &[atom], true);
    writer.finish()
}

/// Where the last rule deciding each property sits, so that a merge can tell whether it would move a
/// rule past one that competes with it.
///
/// Two declarations of different properties never compete, so their rules may be reordered freely.
/// The exceptions are the ones that look like different properties and are not
/// ([`kirana_css_data::competes`]): a flow-relative longhand and the physical ones it can stand for,
/// a shorthand and its longhands, and a vendor-prefixed alias.
#[derive(Default)]
struct Decided<'a> {
    property: BTreeMap<&'a str, usize>,
    /// By flow group, and whether the property is the flow-relative member.
    group: BTreeMap<(String, bool), usize>,
    /// The last rule that competes with every property: a vendor-prefixed one, or a shorthand whose
    /// longhands are not in the property table.
    everything: Option<usize>,
    any: Option<usize>,
}

impl<'a> Decided<'a> {
    /// Records that rule `index` decides `atom`'s property, or every longhand of its shorthand.
    fn record(&mut self, atom: &'a Atom, index: usize) {
        let name = atom.key.property.name.as_str();
        self.any = Some(index);
        self.property.insert(name, index);
        match covered(atom) {
            Some(longhands) => longhands.iter().for_each(|longhand| self.longhand(longhand, index)),
            None => self.everything = Some(index),
        }
    }

    fn longhand(&mut self, name: &'a str, index: usize) {
        if is_vendor(name) {
            self.everything = Some(index);
        }
        self.property.insert(name, index);
        self.group.insert(flow_group(name), index);
    }

    /// Whether `atom`'s declaration may join rule `index`: no rule after it decides the atom's
    /// property, one of its longhands, or a property that competes with one.
    fn free(&self, atom: &Atom, index: usize) -> bool {
        let after = |at: Option<&usize>| at.is_some_and(|at| *at > index);
        covered(atom).is_some_and(|longhands| {
            !after(self.property.get(atom.key.property.name.as_str()))
                && longhands.iter().all(|longhand| self.free_since(longhand, index))
        })
    }

    fn free_since(&self, name: &str, index: usize) -> bool {
        let after = |at: Option<&usize>| at.is_some_and(|at| *at > index);
        if after(self.property.get(name)) || after(self.everything.as_ref()) {
            return false;
        }
        if is_vendor(name) {
            return !after(self.any.as_ref());
        }
        let (group, logical) = flow_group(name);
        !after(self.group.get(&(group.clone(), true))) && !(logical && after(self.group.get(&(group, false))))
    }
}

fn is_vendor(name: &str) -> bool {
    name.starts_with('-') && !name.starts_with("--")
}

/// The longhands an atom decides ([`sets`]); `None` for a shorthand whose longhands are not all
/// known, which competes with everything, and for a shorthand atom the property data does not know.
fn covered(atom: &Atom) -> Option<Vec<&str>> {
    let name = atom.key.property.name.as_str();
    match sets(name) {
        Sets::Itself if atom.key.property.rank == PropertyRank::Shorthand => None,
        Sets::Itself => Some(vec![name]),
        Sets::Longhands(longhands) => Some(longhands.to_vec()),
        Sets::Unknown => None,
    }
}

/// Orders the atoms inside each conflict key so that adjacent keys of one property can share a rule.
///
/// The ladder orders keys, not the atoms within one: an element carries one value per conflict key,
/// because merging keeps one, so atoms with the same key never compete and any order of them
/// renders the same. The writer merges two rules only when no rule between them decides a competing
/// property, so a declaration that ends one key's run and starts the next one's is written once.
/// Each boundary takes at most one such declaration, the longest, and a run whose first atom the
/// previous boundary chose keeps it first.
///
/// Atoms of the contextual layer are left in ladder order: two ancestors can each bring one with the
/// same key to a descendant, and there the order between them decides.
fn arrange(block: &mut [&Atom]) {
    let mut runs: Vec<std::ops::Range<usize>> = Vec::new();
    for (index, atom) in block.iter().enumerate() {
        match runs.last_mut() {
            Some(run) if block[run.start].key == atom.key => run.end = index + 1,
            _ => runs.push(index..index + 1),
        }
    }
    let mut first: Vec<Option<&str>> = vec![None; runs.len()];
    let mut last: Vec<Option<&str>> = vec![None; runs.len()];
    let mut decided = Decided::default();
    for (index, run) in runs.iter().enumerate() {
        let atoms = &block[run.clone()];
        let name = atoms[0].key.property.name.as_str();
        let before =
            decided.property.get(name).copied().filter(|before| {
                block[runs[*before].start].key.property.name == name && decided.free(atoms[0], *before)
            });
        if let Some(before) = before {
            let left = &block[runs[before].clone()];
            // A run of one atom can end with the declaration it starts with; a longer one cannot.
            let taken = first[before].filter(|_| left.len() > 1);
            let shared = atoms
                .iter()
                .map(|atom| atom.value.css.as_str())
                .filter(|css| Some(*css) != taken && left.iter().any(|atom| atom.value.css == *css))
                .max_by(|a, b| a.len().cmp(&b.len()).then_with(|| b.cmp(a)));
            if let Some(css) = shared {
                last[before] = Some(css);
                first[index] = Some(css);
            }
        }
        decided.record(atoms[0], index);
    }
    let mut arranged: Vec<&Atom> = Vec::with_capacity(block.len());
    for ((run, first), last) in runs.into_iter().zip(first).zip(last) {
        let mut atoms = block[run].to_vec();
        atoms.sort_by_key(|atom| {
            let css = Some(atom.value.css.as_str());
            if css == first {
                0
            } else if css == last {
                2
            } else {
                1
            }
        });
        arranged.extend(atoms);
    }
    block.copy_from_slice(&arranged);
}

/// Writes one at-rule block, merging rules that carry the same declaration.
///
/// A selector list costs one comma where a second rule costs its whole body, and in a stylesheet of
/// atoms the same declaration recurs under many condition sets. Two atoms are merged only when no
/// rule between them decides a competing property ([`Decided`]): the merge moves a rule, and moving
/// it past a competing declaration would change which one wins.
fn write_block(writer: &mut Writer, block: &mut Vec<&Atom>, own: bool) {
    if own {
        arrange(block);
    }
    let mut rules: Vec<(Vec<String>, &str, &str)> = Vec::new();
    let mut merge_into: BTreeMap<(&str, &str), usize> = BTreeMap::new();
    let mut decided = Decided::default();
    for atom in block.drain(..) {
        let property = atom.key.property.name.as_str();
        let value = atom.value.css.as_str();
        match merge_into.get(&(property, value)) {
            Some(&index) if decided.free(atom, index) => rules[index].0.push(selector(atom)),
            _ => {
                let index = rules.len();
                rules.push((vec![selector(atom)], property, value));
                merge_into.insert((property, value), index);
                decided.record(atom, index);
            }
        }
    }
    for (selectors, property, value) in rules {
        writer.open(&selectors.join(", "));
        writer.declaration(property, value);
        writer.close();
    }
}

fn write_modes(
    writer: &mut Writer,
    selector_for: impl Fn(Option<&str>) -> String,
    declarations: &[(String, &TokenValue)],
    prefix: &str,
) {
    let plain: Vec<_> = declarations
        .iter()
        .map(|(name, value)| match value {
            TokenValue::Plain(text) => (name.as_str(), text.as_str()),
            TokenValue::Modes { light, .. } => (name.as_str(), light.as_str()),
        })
        .collect();
    writer.open(&selector_for(None));
    for (name, value) in &plain {
        writer.declaration(name, value);
    }
    writer.close();
    let modes: Vec<_> = declarations
        .iter()
        .filter_map(|(name, value)| match value {
            TokenValue::Modes { light, dark } => Some((name.as_str(), light.as_str(), dark.as_str())),
            TokenValue::Plain(_) => None,
        })
        .collect();
    if modes.is_empty() {
        return;
    }
    writer.open("@media (prefers-color-scheme: dark)");
    writer.open(&selector_for(None));
    for (name, _, dark) in &modes {
        writer.declaration(name, dark);
    }
    writer.close();
    writer.close();
    for (mode, pick_dark) in [("light", false), ("dark", true)] {
        let marker = format!("{prefix}m-{mode}");
        writer.open(&selector_for(Some(&marker)));
        for (name, light, dark) in &modes {
            writer.declaration(name, if pick_dark { dark } else { light });
        }
        writer.close();
    }
}

/// A view-transition class (KRN-API-019): the class names itself as the element's
/// `view-transition-class`, and each part styles its pseudo-element for every element of the class.
/// The `*.class` argument matches any `view-transition-name` that carries the class.
fn write_view_transition(writer: &mut Writer, transition: &ViewTransitionDef) {
    let class = &transition.class;
    writer.open(&format!(".{class}"));
    writer.declaration("view-transition-class", class);
    writer.close();
    for (part, rules) in &transition.parts {
        let selector = format!("{}(*.{class})", part.pseudo_element());
        for (preludes, declarations) in rules {
            for prelude in preludes {
                writer.open(prelude);
            }
            writer.open(&selector);
            for (property, value) in declarations {
                writer.declaration(property, value);
            }
            writer.close();
            for _ in preludes {
                writer.close();
            }
        }
    }
}

/// Writes the stylesheet for a set of live atoms and marker dependencies (KRN-OUT-008: callers
/// pass only what the build graph references).
pub fn emit(atoms: &[Atom], marker_deps: &[Dep], options: &EmitOptions) -> EmitOutput {
    let mut deps = Deps::default();
    for atom in atoms {
        atom.value.deps.iter().for_each(|dep| deps.add(dep));
    }
    // What rules read is written. A token only code names (a token object, a runtime value) is
    // written when the bundle still names it or it is declared `runtime: true` (D-086); so is a
    // keyframes rule, which a library's exported animations would otherwise ship unused (D-094).
    let mut left_out = Vec::new();
    for dep in marker_deps {
        match (dep, &options.named) {
            (Dep::Token(token), Some(named))
                if !token.runtime && !named.contains(&token.variable) && !deps.tokens.contains_key(&token.variable) =>
            {
                left_out.push((token.variable.clone(), token.identity.clone()));
            }
            (Dep::Keyframes(frames), Some(named))
                if !named.contains(&frames.name) && !deps.keyframes.contains_key(&frames.name) =>
            {
                left_out.push((frames.name.clone(), format!("@keyframes {}", frames.name)));
            }
            _ => deps.add(dep),
        }
    }
    // A kept definition can read one left out (an alias, a transition's keyframes): then it is
    // written after all.
    let mut pruned: Vec<(String, String)> = left_out
        .into_iter()
        .filter(|(name, _)| !deps.tokens.contains_key(name) && !deps.keyframes.contains_key(name))
        .collect();
    pruned.sort();
    pruned.dedup();

    let mut writer = Writer { out: String::new(), minify: options.minify, depth: 0 };
    let separator = writer.separator();
    let order: Vec<&str> = options
        .layers_before
        .iter()
        .map(String::as_str)
        .chain(["kirana"])
        .chain(options.layers_after.iter().map(String::as_str))
        .collect();
    writer.statement(&format!("@layer {}", order.join(separator)));
    writer.statement(&format!(
        "@layer {}",
        ["kirana.tokens", "kirana.themes", "kirana.contextual", "kirana.atoms"].join(separator)
    ));

    // Registered custom properties (KRN-TOK-011). `@property` is not layered; its initial value
    // replaces the `:root` declaration.
    for token in deps.tokens.values() {
        let (Some(registration), TokenValue::Plain(initial)) = (&token.registration, &token.value) else { continue };
        writer.open(&format!("@property {}", token.variable));
        writer.declaration("syntax", &format!("\"{}\"", registration.syntax));
        writer.declaration("inherits", if registration.inherits { "true" } else { "false" });
        // A token of the universal syntax may start unset: no initial value at all.
        if !initial.is_empty() {
            writer.declaration("initial-value", initial);
        }
        writer.close();
    }

    let declarations: Vec<(String, &TokenValue)> = deps
        .tokens
        .values()
        .filter(|token| token.registration.is_none())
        .map(|token| (token.variable.clone(), &token.value))
        .collect();
    if !declarations.is_empty()
        || !deps.keyframes.is_empty()
        || !deps.position_tries.is_empty()
        || !deps.counter_styles.is_empty()
        || !deps.view_transitions.is_empty()
    {
        writer.open("@layer kirana.tokens");
        if !declarations.is_empty() {
            write_modes(
                &mut writer,
                |marker| marker.map_or_else(|| ":root".to_owned(), |marker| format!(".{marker}")),
                &declarations,
                &options.prefix,
            );
        }
        for frames in deps.keyframes.values() {
            writer.open(&format!("@keyframes {}", frames.name));
            for (frame, declarations) in &frames.frames {
                writer.open(frame);
                for (property, value) in declarations {
                    writer.declaration(property, value);
                }
                writer.close();
            }
            writer.close();
        }
        for fallback in deps.position_tries.values() {
            writer.open(&format!("@position-try {}", fallback.name));
            for (property, value) in &fallback.declarations {
                writer.declaration(property, value);
            }
            writer.close();
        }
        for style in deps.counter_styles.values() {
            writer.open(&format!("@counter-style {}", style.name));
            for (descriptor, value) in &style.descriptors {
                writer.declaration(descriptor, value);
            }
            writer.close();
        }
        for transition in deps.view_transitions.values() {
            write_view_transition(&mut writer, transition);
        }
        writer.close();
    }

    if !deps.themes.is_empty() {
        writer.open("@layer kirana.themes");
        for theme in deps.themes.values() {
            let declarations: Vec<(String, &TokenValue)> =
                theme.declarations.iter().map(|(name, value)| (name.clone(), value)).collect();
            let class = theme.class.clone();
            write_modes(
                &mut writer,
                |marker| match marker {
                    None => format!(".{class}"),
                    Some(marker) => format!(".{marker} .{class}{}.{marker}.{class}", separator),
                },
                &declarations,
                &options.prefix,
            );
        }
        writer.close();
    }

    let mut contextual: Vec<&Atom> = atoms.iter().filter(|atom| atom.key.target.is_contextual()).collect();
    let mut own: Vec<&Atom> = atoms.iter().filter(|atom| !atom.key.target.is_contextual()).collect();
    contextual.sort_by_cached_key(|atom| ladder_key(atom));
    own.sort_by_cached_key(|atom| ladder_key(atom));
    contextual.dedup_by(|a, b| a.class == b.class);
    own.dedup_by(|a, b| a.class == b.class);
    if !contextual.is_empty() {
        writer.open("@layer kirana.contextual");
        write_atoms(&mut writer, &contextual, false);
        writer.close();
    }
    if !own.is_empty() {
        writer.open("@layer kirana.atoms");
        if options.tiers {
            write_tiers(&mut writer, &own);
        } else {
            write_atoms(&mut writer, &own, true);
        }
        writer.close();
    }

    let css = writer.finish();
    let output = match &options.lower_for {
        None => EmitOutput { css, lowered: false, pruned: Vec::new() },
        Some(targets) => lower(css, *targets, options.minify),
    };
    EmitOutput { pruned, ..output }
}

/// Ladder-ordered atoms of `kirana.atoms`, one sub-layer per tier (D-114): the order statement names
/// every tier first, so layer order, not a rule's place, ranks one tier above another. Rules merge
/// within a tier only. The contextual layer stays whole: two ancestors can each bring an atom of one
/// key to a descendant, and there the order between them decides.
fn write_tiers(writer: &mut Writer, atoms: &[&Atom]) {
    let mut tiers: Vec<Vec<&Atom>> = Vec::new();
    let mut last: Option<kirana_ir::LadderKey> = None;
    for atom in atoms {
        let key = ladder_key(atom);
        match &last {
            Some(previous) if previous.same_tier(&key) => tiers.last_mut().expect("a tier is open").push(atom),
            _ => tiers.push(vec![atom]),
        }
        last = Some(key);
    }
    let names: Vec<String> = (0..tiers.len()).map(|index| format!("t{index}")).collect();
    let separator = writer.separator();
    writer.statement(&format!("@layer {}", names.join(separator)));
    for (name, tier) in names.iter().zip(&tiers) {
        writer.open(&format!("@layer {name}"));
        write_atoms(writer, tier, true);
        writer.close();
    }
}

/// Rewrites the stylesheet for browsers below the default floor.
///
/// Lightning CSS is given text this writer produced, so it should always parse; if any step of it
/// fails, the stylesheet is served as written rather than taking the build down with it. The
/// `lowered` flag then says what actually happened.
pub fn lower(css: String, targets: Targets, minify: bool) -> EmitOutput {
    let printed = StyleSheet::parse(&css, ParserOptions::default()).ok().and_then(|mut sheet| {
        sheet
            .minify(MinifyOptions { targets, ..MinifyOptions::default() })
            .ok()
            .and_then(|()| sheet.to_css(PrinterOptions { minify, targets, ..PrinterOptions::default() }).ok())
    });
    match printed {
        Some(printed) => EmitOutput { css: printed.code, lowered: true, pruned: Vec::new() },
        None => EmitOutput { css, lowered: false, pruned: Vec::new() },
    }
}
