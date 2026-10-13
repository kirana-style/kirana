//! The CSS writer (D-025, D-036). It writes the whole stylesheet from live atoms and their
//! dependencies, in one deterministic order:
//!
//! 1. the layer order statement (KRN-OUT-003);
//! 2. `kirana.tokens`: variable tokens on `:root`, per-mode overrides, keyframes, `@position-try`
//!    fallbacks and view-transition classes;
//! 3. `kirana.themes`: scoped theme overrides;
//! 4. `kirana.contextual`: `select.*` styles, ladder-ordered;
//! 5. `kirana.atoms`: element atoms, ladder-ordered. Every selector is (0,1,0) through
//!    `:where()`, so source order is the precedence ladder.
//!
//! Production output is minified by the writer itself, so colours and values are never
//! re-serialized. Lightning CSS runs only when configured targets are below the default floor.

pub mod minify;

use std::collections::BTreeMap;
use std::fmt::Write as _;

use kirana_css_data::{PropertyRank, physical_counterpart};
use kirana_ir::{
    Atom, Condition, Dep, KeyframesDef, PositionTryDef, RelationKind, Target, ThemeDef, TokenDef, TokenValue,
    ViewTransitionDef, fallback_values, ladder_key,
};
use lightningcss::stylesheet::{MinifyOptions, ParserOptions, PrinterOptions, StyleSheet};
use lightningcss::targets::Targets;

/// Options for one stylesheet.
#[derive(Debug, Clone, Default)]
pub struct EmitOptions {
    pub layers_before: Vec<String>,
    pub layers_after: Vec<String>,
    pub minify: bool,
    /// The class-name prefix (for mode markers).
    pub prefix: String,
    /// Targets below the default floor; `None` when no lowering is needed.
    pub lower_for: Option<Targets>,
}

/// The written stylesheet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmitOutput {
    pub css: String,
    /// Whether Lightning CSS lowered syntax for the configured targets (`target-lowering`).
    pub lowered: bool,
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

fn write_atoms(writer: &mut Writer, atoms: &[&Atom]) {
    let mut open: Vec<String> = Vec::new();
    let mut block: Vec<&Atom> = Vec::new();
    for atom in atoms {
        let wanted = at_rules(atom);
        if wanted != open {
            write_block(writer, &mut block);
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
    write_block(writer, &mut block);
    for _ in open {
        writer.close();
    }
}

/// One atom's rule as the stylesheet writes it when nothing shares it, at-rules included: what the
/// atom costs before rules carrying the same declaration are merged (`kirana analyze`).
pub fn atom_rule(atom: &Atom, minify: bool) -> String {
    let mut writer = Writer { out: String::new(), minify, depth: 0 };
    write_atoms(&mut writer, &[atom]);
    writer.finish()
}

/// The properties an atom decides, for the purpose of rule order.
///
/// Two declarations of different properties never compete, so their rules may be reordered freely.
/// The exceptions are the two that look like different properties and are not: a logical longhand
/// and its physical counterpart, and a shorthand, which covers longhands this does not try to
/// enumerate and so blocks every merge across it.
fn family(atom: &Atom) -> Option<&str> {
    let name = atom.key.property.name.as_str();
    match atom.key.property.rank {
        PropertyRank::Shorthand => None,
        _ => Some(physical_counterpart(name).unwrap_or(name)),
    }
}

/// Writes one at-rule block, merging rules that carry the same declaration.
///
/// A selector list costs one comma where a second rule costs its whole body, and in a stylesheet of
/// atoms the same declaration recurs under many condition sets. Two atoms are merged only when no
/// atom between them decides the same property: the merge moves a rule, and moving it past a
/// competing declaration would change which one wins.
fn write_block(writer: &mut Writer, block: &mut Vec<&Atom>) {
    let mut rules: Vec<(Vec<String>, &str, &str)> = Vec::new();
    let mut merge_into: BTreeMap<(&str, &str), usize> = BTreeMap::new();
    let mut last_for: BTreeMap<&str, usize> = BTreeMap::new();
    for atom in block.drain(..) {
        let property = atom.key.property.name.as_str();
        let value = atom.value.css.as_str();
        let Some(family) = family(atom) else {
            // A shorthand's longhands are not enumerated here, so nothing may cross it.
            rules.push((vec![selector(atom)], property, value));
            merge_into.clear();
            last_for.clear();
            continue;
        };
        match merge_into.get(&(property, value)) {
            Some(index) if last_for.get(family) == Some(index) => rules[*index].0.push(selector(atom)),
            _ => {
                let index = rules.len();
                rules.push((vec![selector(atom)], property, value));
                merge_into.insert((property, value), index);
                last_for.insert(family, index);
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
    marker_deps.iter().for_each(|dep| deps.add(dep));

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
    for (layer, list) in [("@layer kirana.contextual", &contextual), ("@layer kirana.atoms", &own)] {
        if !list.is_empty() {
            writer.open(layer);
            write_atoms(&mut writer, list);
            writer.close();
        }
    }

    let css = writer.finish();
    match &options.lower_for {
        None => EmitOutput { css, lowered: false },
        Some(targets) => lower(css, *targets, options.minify),
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
        Some(printed) => EmitOutput { css: printed.code, lowered: true },
        None => EmitOutput { css, lowered: false },
    }
}
