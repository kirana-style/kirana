//! The resolved style of one site (KRN-DX-002, KRN-DX-013): every declaration it applies, grouped
//! the way a reader scans a style (layout, box, size, colour, type …), with the handle and the key
//! each came from, what overrides what, and which values hold under a chosen set of conditions.
//! Hover, the inline summary and the inspector all read this one model.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use kirana_project::SiteAtom;
use serde::Serialize;

use crate::Server;
use crate::text::{LineIndex, path_to_uri};

/// The groups declarations are shown in, in this order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Group {
    Layout,
    Box,
    Size,
    Colour,
    Type,
    Border,
    Effects,
    Motion,
    Other,
}

impl Group {
    /// The group's name, as clients receive it (`layout`, `box` …).
    pub fn name(self) -> &'static str {
        match self {
            Group::Layout => "layout",
            Group::Box => "box",
            Group::Size => "size",
            Group::Colour => "colour",
            Group::Type => "type",
            Group::Border => "border",
            Group::Effects => "effects",
            Group::Motion => "motion",
            Group::Other => "other",
        }
    }

    pub fn of(property: &str) -> Group {
        let starts = |prefixes: &[&str]| prefixes.iter().any(|prefix| property.starts_with(prefix));
        if starts(&["padding", "margin", "box-sizing", "scroll-margin", "scroll-padding"]) {
            Group::Box
        } else if matches!(
            property,
            "color" | "fill" | "stroke" | "accent-color" | "caret-color" | "text-decoration-color" | "outline-color"
        ) || starts(&["background"])
            || property.starts_with("border") && property.ends_with("-color")
        {
            Group::Colour
        } else if starts(&["border", "outline"]) {
            Group::Border
        } else if matches!(property, "width" | "height" | "aspect-ratio" | "inline-size" | "block-size")
            || starts(&["min-", "max-"])
        {
            Group::Size
        } else if matches!(
            property,
            "display"
                | "position"
                | "inset"
                | "top"
                | "right"
                | "bottom"
                | "left"
                | "z-index"
                | "float"
                | "clear"
                | "order"
                | "visibility"
                | "isolation"
                | "container-type"
        ) || starts(&[
            "flex",
            "grid",
            "gap",
            "row-gap",
            "column-gap",
            "align-",
            "justify-",
            "place-",
            "overflow",
            "inset-",
        ]) {
            Group::Layout
        } else if starts(&[
            "font",
            "line-height",
            "letter-spacing",
            "text-",
            "white-space",
            "word-",
            "hyphens",
            "tab-size",
        ]) || matches!(property, "vertical-align" | "line-clamp" | "-webkit-line-clamp")
        {
            Group::Type
        } else if starts(&["transition", "animation"]) {
            Group::Motion
        } else if matches!(
            property,
            "box-shadow"
                | "opacity"
                | "filter"
                | "backdrop-filter"
                | "mix-blend-mode"
                | "transform"
                | "rotate"
                | "scale"
                | "translate"
                | "cursor"
                | "pointer-events"
                | "user-select"
        ) {
            Group::Effects
        } else {
            Group::Other
        }
    }
}

/// Where a declaration was written.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Source {
    /// How the `sx` value names it: `card`, `styles.probe`; `css()` for an inline style.
    pub label: String,
    /// The condition the value is applied under in the `sx` (`on` in `on && wide`).
    pub when: Option<String>,
    /// The key that set it (or the `css()` call when the key cannot be found).
    pub uri: String,
    pub line: u32,
    pub character: u32,
    /// `Card.vue:4`, for display.
    pub place: String,
}

/// One declaration a site applies.
#[derive(Debug, Clone, Serialize)]
pub(crate) struct Entry {
    pub property: String,
    pub value: String,
    pub conditions: Vec<String>,
    pub target: String,
    pub group: Group,
    pub tokens: Vec<Token>,
    pub rank: u32,
    pub class: String,
    pub rule: String,
    pub source: Option<Source>,
    /// The value in pixels when it is a plain `rem` length.
    pub pixels: Option<String>,
}

/// A token a value reads: its value, or its light and dark values for a mode token.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Token {
    pub identity: String,
    pub light: String,
    pub dark: Option<String>,
}

/// The resolved style of one site.
#[derive(Debug, Clone, Serialize)]
pub(crate) struct Resolved {
    pub kind: &'static str,
    pub entries: Vec<Entry>,
    /// Every condition any entry is written under, for a viewer to toggle.
    pub conditions: Vec<String>,
    /// Every guard a handle is applied under in the `sx` (`on` in `on && wide`), for a viewer to
    /// toggle; `!x` reads as "x is off".
    pub switches: Vec<String>,
}

impl Resolved {
    /// Every entry. The compiler merges an `sx`'s static handles before the server sees them, so a
    /// site never holds a value a later handle overrides: one replaced only under a guard
    /// (`on && wide`) still holds otherwise.
    pub fn effective(&self) -> impl Iterator<Item = &Entry> {
        self.entries.iter()
    }

    /// The labels of the distinct sources, in first-use order.
    pub fn sources(&self) -> Vec<&Source> {
        let mut seen = BTreeSet::new();
        self.entries
            .iter()
            .filter_map(|entry| entry.source.as_ref())
            .filter(|source| seen.insert((source.label.clone(), source.when.clone())))
            .collect()
    }
}

/// The values that hold when exactly `active` conditions and switches do: per property and target,
/// of the entries that apply, the one written under the stronger conditions (the higher rank), or
/// for the same conditions the later in merge order.
pub(crate) fn simulate<'r>(entries: &'r [Entry], active: &BTreeSet<String>) -> Vec<&'r Entry> {
    let applies = |entry: &Entry| {
        entry.conditions.iter().all(|condition| active.contains(condition))
            && entry.source.as_ref().and_then(|source| source.when.as_deref()).is_none_or(|when| {
                match when.strip_prefix('!') {
                    Some(off) => !active.contains(off),
                    None => active.contains(when),
                }
            })
    };
    let mut winners: BTreeMap<(&str, &str), &Entry> = BTreeMap::new();
    for entry in entries.iter().filter(|entry| applies(entry)) {
        let key = (entry.property.as_str(), entry.target.as_str());
        let wins = winners
            .get(&key)
            .is_none_or(|current| current.conditions == entry.conditions || current.rank <= entry.rank);
        if wins {
            winners.insert(key, entry);
        }
    }
    let mut out: Vec<&Entry> = winners.into_values().collect();
    out.sort_by_key(|entry| (entry.group, entry.rank));
    out
}

/// `1.5rem` → `24px` at `root` pixels per rem; `None` for anything but one plain `rem` length.
pub(crate) fn pixels(value: &str, root: f64) -> Option<String> {
    let number: f64 = value.trim().strip_suffix("rem")?.parse().ok()?;
    let px = number * root;
    let text = format!("{:.2}", px);
    Some(format!("{}px", text.trim_end_matches('0').trim_end_matches('.')))
}

/// Where the classes of `atoms` are produced (`Server::origins`), looked up once for many sites.
pub(crate) type Produced = Vec<(PathBuf, (usize, usize), String)>;

pub(crate) fn produced<'a>(server: &Server, atoms: impl Iterator<Item = &'a SiteAtom>) -> Produced {
    let classes: BTreeSet<&str> = atoms.map(|atom| atom.class.as_str()).collect();
    server.origins(&classes)
}

/// Resolves the site spanning `span` in `path`.
pub(crate) fn resolve(server: &Server, path: &Path, text: &str, span: (usize, usize), atoms: &[SiteAtom]) -> Resolved {
    resolve_with(server, path, text, span, atoms, &produced(server, atoms.iter()))
}

/// [`resolve`] with the origins already looked up.
pub(crate) fn resolve_with(
    server: &Server,
    path: &Path,
    text: &str,
    span: (usize, usize),
    atoms: &[SiteAtom],
    produced: &Produced,
) -> Resolved {
    let site = &text[span.0..span.1];
    let kind = crate::hover::site_kind(site).trim_matches('`');
    let origins = origins(server, path, span, atoms, produced);
    let tokens = server.project.tokens();
    let entries: Vec<Entry> = atoms
        .iter()
        .map(|atom| {
            let source = origins.get(atom.class.as_str()).map(|(label, location)| Source {
                label: label.clone(),
                when: when(site, label),
                uri: location.0.clone(),
                line: location.1,
                character: location.2,
                place: location.3.clone(),
            });
            Entry {
                property: atom.property.clone(),
                value: atom.value.clone(),
                conditions: atom.conditions.clone(),
                target: atom.target.clone(),
                group: Group::of(&atom.property),
                tokens: atom
                    .tokens
                    .iter()
                    .map(|identity| {
                        let found = tokens.iter().find(|token| &token.identity == identity);
                        Token {
                            identity: identity.clone(),
                            // Every token an atom reads is one the session evaluated.
                            light: found.map_or_else(String::new, |token| {
                                token.light.clone().unwrap_or_else(|| token.value.clone())
                            }),
                            dark: found.and_then(|token| token.dark.clone()),
                        }
                    })
                    .collect(),
                rank: atom.rank,
                class: atom.class.clone(),
                rule: atom.rule.clone(),
                source,
                pixels: pixels(&atom.value, server.options.root_font_size),
            }
        })
        .collect();
    let conditions: BTreeSet<String> = entries.iter().flat_map(|entry| entry.conditions.iter().cloned()).collect();
    let switches: BTreeSet<String> = entries
        .iter()
        .filter_map(|entry| entry.source.as_ref()?.when.as_ref())
        .map(|when| when.trim_start_matches('!').to_owned())
        .collect();
    Resolved { kind, entries, conditions: conditions.into_iter().collect(), switches: switches.into_iter().collect() }
}

/// `(label, (uri, line, character, place))` per class: the `css()` or `recipe()` site, other than
/// this one, that produces it, and the key inside it.
type Location = (String, u32, u32, String);

fn origins(
    server: &Server,
    path: &Path,
    span: (usize, usize),
    atoms: &[SiteAtom],
    produced: &Produced,
) -> BTreeMap<String, (String, Location)> {
    let classes: BTreeSet<&str> = atoms.iter().map(|atom| atom.class.as_str()).collect();
    let this = server.source(path).unwrap_or_default();
    let site_text = this.get(span.0..span.1).unwrap_or_default();
    let mut sources: BTreeMap<&Path, Option<String>> = BTreeMap::new();
    // Every definition producing each class. Equal declarations share a class, so the one this site
    // names wins, in this file before any other (two files may both call a handle `styles.card`).
    let mut candidates: BTreeMap<String, Vec<(String, Location, u8)>> = BTreeMap::new();
    for (file, site_span, class) in produced {
        let site_span = *site_span;
        if !classes.contains(class.as_str()) || file == path && site_span == span {
            continue;
        }
        let source = sources.entry(file.as_path()).or_insert_with(|| server.source(file));
        let Some(source) = source.as_deref() else { continue };
        let Some(site) = source.get(site_span.0..site_span.1) else { continue };
        if !(site.starts_with("css(") || site.starts_with("recipe(")) {
            continue;
        }
        let property = atoms.iter().find(|atom| &atom.class == class).map(|atom| atom.property.as_str()).unwrap_or("");
        let at = site_span.0 + key_offset(site, property).unwrap_or(0);
        let label = binding_name(source, site_span.0).unwrap_or_else(|| "css()".to_owned());
        let last = label.rsplit('.').next().unwrap_or(&label);
        let named = words(site_text).any(|word| word == last);
        let preference = match (named, file == path) {
            (true, true) => 0,
            (true, false) => 1,
            (false, true) => 2,
            (false, false) => 3,
        };
        let position = LineIndex::new(source).position(at);
        let place = format!(
            "{}:{}",
            file.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default(),
            position.line + 1
        );
        let location = (path_to_uri(file).as_str().to_owned(), position.line, position.character, place);
        candidates.entry(class.clone()).or_default().push((label, location, preference));
    }
    candidates
        .into_iter()
        .filter_map(|(class, found)| {
            found
                .into_iter()
                .min_by_key(|(_, _, preference)| *preference)
                .map(|(label, location, _)| (class, (label, location)))
        })
        .collect()
}

fn words(text: &str) -> impl Iterator<Item = &str> {
    text.split(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$')).filter(|word| !word.is_empty())
}

/// Where `property`'s key is written in a style object: `paddingTop`, `"padding-top"`, or the
/// shorthand it was split from.
pub(crate) fn key_offset(site: &str, property: &str) -> Option<usize> {
    let mut names = vec![camel(property), property.to_owned()];
    if let Some((shorthand, _)) = property.rsplit_once('-') {
        names.push(camel(shorthand));
    }
    for name in names.iter().filter(|name| !name.is_empty()) {
        let mut from = 0;
        while let Some(found) = site[from..].find(name.as_str()) {
            let start = from + found;
            from = start + name.len();
            let before = site[..start].chars().next_back();
            let boundary = !before.is_some_and(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$' || c == '-');
            let after = site[from..].trim_start_matches(['"', '\'']).trim_start();
            if boundary && after.starts_with(':') {
                let quoted = matches!(before, Some('"' | '\''));
                return Some(if quoted { start - 1 } else { start });
            }
        }
    }
    None
}

fn camel(kebab: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for character in kebab.chars() {
        if character == '-' {
            upper = !out.is_empty();
        } else if upper {
            out.extend(character.to_uppercase());
            upper = false;
        } else {
            out.push(character);
        }
    }
    out
}

/// The name a `css()` call at `start` is bound to: `card` in `const card = css(`, `styles.probe`
/// when `probe: css(` sits in `const styles = {`.
pub(crate) fn binding_name(text: &str, start: usize) -> Option<String> {
    let before = text[..start].trim_end();
    let is_word = |c: char| c.is_ascii_alphanumeric() || c == '_' || c == '$';
    let (rest, separator) = before
        .strip_suffix('=')
        .map(|rest| (rest, '='))
        .or_else(|| before.strip_suffix(':').map(|rest| (rest, ':')))?;
    let rest = rest.trim_end().trim_end_matches(['"', '\'']);
    let name_start = rest.rfind(|c: char| !is_word(c)).map_or(0, |index| index + 1);
    let name = &rest[name_start..];
    if name.is_empty() {
        return None;
    }
    if separator == '=' {
        return Some(name.to_owned());
    }
    // An object entry: prefix the object's own name, if it is bound to one.
    let mut depth = 0usize;
    for (index, byte) in rest.bytes().enumerate().rev() {
        match byte {
            b'}' | b')' | b']' => depth += 1,
            b'(' | b'[' if depth > 0 => depth -= 1,
            b'{' if depth > 0 => depth -= 1,
            b'{' => {
                return Some(match binding_name(text, index) {
                    Some(object) => format!("{object}.{name}"),
                    None => name.to_owned(),
                });
            }
            _ => {}
        }
    }
    Some(name.to_owned())
}

/// The condition `label` is applied under in an `sx` value: `on` in `on && card`, `mono` in
/// `mono ? card : null` and `!mono` in `mono ? null : card`.
pub(crate) fn when(site: &str, label: &str) -> Option<String> {
    let name = label.rsplit('.').next().unwrap_or(label);
    for part in top_level_parts(site) {
        let words: Vec<&str> = part
            .split(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$'))
            .filter(|word| !word.is_empty())
            .collect();
        if !words.contains(&name) {
            continue;
        }
        if let Some((condition, value)) = part.rsplit_once("&&")
            && value.contains(name)
        {
            return Some(condition.trim().to_owned());
        }
        if let Some((condition, branches)) = part.split_once('?')
            && let Some((yes, no)) = branches.split_once(':')
        {
            let condition = condition.trim();
            if yes.contains(name) {
                return Some(condition.to_owned());
            }
            if no.contains(name) {
                return Some(format!("!{condition}"));
            }
        }
    }
    None
}

/// The comma-separated parts of an `sx` value's outermost array (or the value itself).
fn top_level_parts(site: &str) -> Vec<&str> {
    let inner = crate::summary::binding_expression(site);
    let inner = inner.strip_prefix('[').and_then(|rest| rest.strip_suffix(']')).unwrap_or(inner);
    let mut parts = Vec::new();
    let mut depth = 0usize;
    let mut start = 0;
    for (index, byte) in inner.bytes().enumerate() {
        match byte {
            b'(' | b'[' | b'{' => depth += 1,
            b')' | b']' | b'}' => depth = depth.saturating_sub(1),
            b',' if depth == 0 => {
                parts.push(&inner[start..index]);
                start = index + 1;
            }
            _ => {}
        }
    }
    parts.push(&inner[start..]);
    parts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_cover_the_properties_a_reader_scans_for() {
        for (property, group) in [
            ("padding-top", Group::Box),
            ("margin", Group::Box),
            ("color", Group::Colour),
            ("background-image", Group::Colour),
            ("border-top-color", Group::Colour),
            ("border-radius", Group::Border),
            ("outline-width", Group::Border),
            ("width", Group::Size),
            ("max-height", Group::Size),
            ("display", Group::Layout),
            ("grid-template-columns", Group::Layout),
            ("align-items", Group::Layout),
            ("font-size", Group::Type),
            ("line-clamp", Group::Type),
            ("transition-duration", Group::Motion),
            ("box-shadow", Group::Effects),
            ("content", Group::Other),
        ] {
            assert_eq!(Group::of(property), group, "{property}");
            assert!(!group.name().is_empty());
        }
    }

    #[test]
    fn pixels_for_plain_rem_lengths() {
        assert_eq!(pixels("1.5rem", 16.0).as_deref(), Some("24px"));
        assert_eq!(pixels("0.875rem", 16.0).as_deref(), Some("14px"));
        assert_eq!(pixels(".3rem", 10.0).as_deref(), Some("3px"));
        assert_eq!(pixels("0.33rem", 16.0).as_deref(), Some("5.28px"));
        assert_eq!(pixels("1rem 2rem", 16.0), None);
        assert_eq!(pixels("12px", 16.0), None);
    }

    #[test]
    fn names_bound_to_a_call() {
        let text = "const card = css({})\nconst styles = {\n  probe: css({}),\n  \"quoted\": css({}),\n}\nfoo(css({}))\nconst x = { a: [1, (2)], b: css({}) }\n";
        let at = |needle: &str| text.find(needle).unwrap();
        assert_eq!(binding_name(text, at("css({})\nconst styles")).as_deref(), Some("card"));
        assert_eq!(binding_name(text, at("css({}),\n  \"q")).as_deref(), Some("styles.probe"));
        assert_eq!(binding_name(text, at("css({}),\n}")).as_deref(), Some("styles.quoted"));
        assert_eq!(binding_name(text, at("css({}))")), None);
        assert_eq!(binding_name(text, at("css({}) }")).as_deref(), Some("x.b"));
        assert_eq!(binding_name("({ a: css() })", 6).as_deref(), Some("a"));
        assert_eq!(binding_name("= css()", 2), None);
        assert_eq!(binding_name("a: css()", 3).as_deref(), Some("a"));
    }

    #[test]
    fn guards_of_handles_in_an_sx_value() {
        assert_eq!(when("sx={[card, on && wide]}", "wide").as_deref(), Some("on"));
        assert_eq!(when("sx={[card, on && wide]}", "card"), None);
        assert_eq!(when("sx={mono ? styles.mono : null}", "styles.mono").as_deref(), Some("mono"));
        assert_eq!(when("sx={mono ? null : plain}", "plain").as_deref(), Some("!mono"));
        assert_eq!(when(":sx=\"[a, f(x, y) && b]\"", "b").as_deref(), Some("f(x, y)"));
        assert_eq!(when("sx={a ? b}", "b"), None);
        assert_eq!(when("sx={other}", "b"), None);
        // Named in the condition only, in neither branch.
        assert_eq!(when("sx={on ? x : y}", "on"), None);
    }

    #[test]
    fn keys_found_camel_quoted_or_as_their_shorthand() {
        let site = "css({ paddingTop: 1, \"margin-left\": 2, border: \"1px\", xpadding: 3 })";
        assert_eq!(key_offset(site, "padding-top"), site.find("paddingTop"));
        assert_eq!(key_offset(site, "margin-left"), site.find("\"margin-left\""));
        assert_eq!(key_offset(site, "border-width"), site.find("border:"));
        assert_eq!(key_offset(site, "padding"), None);
        assert_eq!(camel("-webkit-line-clamp"), "webkitLineClamp");
    }

    fn entry(property: &str, value: &str, conditions: &[&str], rank: u32, when: Option<&str>) -> Entry {
        Entry {
            property: property.to_owned(),
            value: value.to_owned(),
            conditions: conditions.iter().map(|c| (*c).to_owned()).collect(),
            target: String::new(),
            group: Group::of(property),
            tokens: Vec::new(),
            rank,
            class: format!("{property}-{value}"),
            rule: String::new(),
            source: when.map(|when| Source {
                label: "x".to_owned(),
                when: Some(when.to_owned()),
                uri: String::new(),
                line: 0,
                character: 0,
                place: String::new(),
            }),
            pixels: None,
        }
    }

    #[test]
    fn simulation_picks_what_holds() {
        let entries = vec![
            entry("color", "black", &[], 0, None),
            entry("color", "red", &[":hover"], 2, None),
            entry("color", "blue", &["@media (width >= 48rem)"], 1, None),
            entry("padding", "1rem", &[], 0, None),
            entry("padding", "2rem", &[], 0, Some("on")),
            entry("margin", "0", &[], 0, Some("!on")),
        ];
        let values = |active: &[&str]| -> Vec<String> {
            let active: BTreeSet<String> = active.iter().map(|a| (*a).to_owned()).collect();
            simulate(&entries, &active).iter().map(|entry| format!("{} {}", entry.property, entry.value)).collect()
        };
        assert_eq!(values(&[]), ["margin 0", "padding 1rem", "color black"]);
        assert_eq!(values(&[":hover", "@media (width >= 48rem)", "on"]), ["padding 2rem", "color red"]);
        assert_eq!(values(&["@media (width >= 48rem)"]), ["margin 0", "padding 1rem", "color blue"]);
    }
}
