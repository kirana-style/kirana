//! The style summary (KRN-DX-004): after `sx={…}`, what the element receives
//! (`grid · gap 1rem · p 1.5rem · md: cols 2`); on a `css()` or `recipe()` definition, a code lens
//! with declaration, condition and bridged-value counts that opens the compiled CSS.

use std::collections::BTreeSet;

use kirana_diagnostics::Code;
use kirana_project::SiteAtom;
use serde_json::{Value, json};

use crate::actions::SHOW_CSS;
use crate::hover::{atoms_of, site_kind};
use crate::text::{LineIndex, path_to_uri};
use crate::{Server, document, model};

/// The longest one declaration reads in a summary; the whole summary is `Options::summary_length`.
const PART: usize = 48;

pub fn inlay_hints(server: &Server, params: &Value) -> Result<Value, String> {
    if !server.options.summary {
        return Ok(json!([]));
    }
    let (path, text) = document(server, params)?;
    let index = LineIndex::new(&text);
    let sites = server.sites(&path);
    let spans: BTreeSet<(u32, u32)> = sites.iter().map(|site| (site.span.start, site.span.end)).collect();
    let mut elements: Vec<((usize, usize), Vec<SiteAtom>)> = Vec::new();
    for span in spans {
        let Some(site) = text.get(span.0 as usize..span.1 as usize) else { continue };
        if is_binding(site) {
            elements.push(((span.0 as usize, span.1 as usize), atoms_of(&sites, span)));
        }
    }
    // One lookup of where every class comes from serves every hint in the document.
    let produced = model::produced(server, elements.iter().flat_map(|(_, atoms)| atoms.iter()));
    let mut out = Vec::new();
    for (span, atoms) in elements {
        let resolved = model::resolve_with(server, &path, &text, span, &atoms, &produced);
        let label = label(&resolved, server.options.summary_length);
        if label.is_empty() {
            continue;
        }
        let (mark, parts) = summary_parts(&resolved, server.options.summary_length);
        let parts: Vec<Value> = parts
            .into_iter()
            .map(|(text, group)| json!({ "text": text, "group": group, "colour": crate::brand::colour(group) }))
            .collect();
        // The card is the tooltip, filled in by `inlayHint/resolve` when the hint is hovered.
        out.push(json!({
            "position": index.position(hint_end(&text, span.1)),
            "label": label,
            "kind": 1,
            "paddingLeft": true,
            // The parts let a client colour the summary by group, as the card colours properties.
            "data": { "uri": path_to_uri(&path), "start": span.0, "end": span.1, "mark": mark, "parts": parts },
        }));
    }
    Ok(Value::Array(out))
}

/// The summary an element's hint shows: a layout mark, then each declaration in utility vocabulary,
/// separated by ` · `, cut at `limit` characters with `+N` for the rest.
fn label(resolved: &model::Resolved, limit: usize) -> String {
    let (mark, parts) = summary_parts(resolved, limit);
    if parts.is_empty() {
        return String::new();
    }
    let texts: Vec<&str> = parts.iter().map(|(text, _)| text.as_str()).collect();
    format!("{}{}", if mark.is_empty() { String::new() } else { format!("{mark} ") }, texts.join(" · "))
}

/// The summary as its layout mark (`▦`, `⇶` or empty) and its parts, each with the group it belongs
/// to (`layout`, `box` …, `more` for `+N`), so a client can colour them as the card does.
fn summary_parts(resolved: &model::Resolved, limit: usize) -> (&'static str, Vec<(String, &'static str)>) {
    let mut chosen: Vec<&model::Entry> = Vec::new();
    for entry in resolved.effective() {
        let when = entry.source.as_ref().and_then(|source| source.when.as_ref());
        chosen.retain(|kept| {
            !(kept.property == entry.property
                && kept.conditions == entry.conditions
                && kept.target == entry.target
                && kept.source.as_ref().and_then(|source| source.when.as_ref()) == when)
        });
        chosen.push(entry);
    }
    let conditional = |entry: &model::Entry| {
        !entry.conditions.is_empty()
            || !entry.target.is_empty()
            || entry.source.as_ref().is_some_and(|source| source.when.is_some())
    };
    chosen.sort_by_key(|entry| conditional(entry) as u8);
    let sides = merged_sides(&chosen);
    let mut parts: Vec<(String, &'static str)> = Vec::new();
    let mut length = 0;
    for (shown, entry) in chosen.iter().enumerate() {
        let merged = sides.iter().find(|(first, ..)| std::ptr::eq(*first, *entry));
        if merged.is_none()
            && sides.iter().any(|(_, members, _)| members.iter().any(|member| std::ptr::eq(*member, *entry)))
        {
            continue;
        }
        let mut prefix: Vec<String> = entry.conditions.iter().map(|condition| short_condition(condition)).collect();
        if !entry.target.is_empty() {
            prefix.push(entry.target.trim_start_matches("::").trim_start_matches("> ").to_owned());
        }
        if let Some(when) = entry.source.as_ref().and_then(|source| source.when.as_ref()) {
            prefix.insert(0, when.clone());
        }
        let body = match merged {
            Some((_, _, body)) => body.clone(),
            None => short(&entry.property, &entry.value, entry.tokens.first().map(|token| token.identity.as_str())),
        };
        let text = if prefix.is_empty() { body } else { format!("{}: {body}", prefix.join(":")) };
        // One long value (a font stack) must not crowd out the rest.
        let text = if text.chars().count() > PART {
            format!("{}…", text.chars().take(PART - 1).collect::<String>())
        } else {
            text
        };
        let separator = if parts.is_empty() { 0 } else { 3 };
        if !parts.is_empty() && length + separator + text.chars().count() > limit {
            parts.push((format!("+{}", chosen.len() - shown), "more"));
            break;
        }
        length += separator + text.chars().count();
        let group = if merged.is_some() { model::Group::Box } else { entry.group };
        parts.push((text, group.name()));
    }
    // The mark is the element's own layout: never one a condition or an `sx` guard switches to.
    let display = resolved.effective().find(|entry| {
        entry.property == "display"
            && entry.conditions.is_empty()
            && entry.source.as_ref().is_none_or(|source| source.when.is_none())
    });
    let mark = match display.map(|entry| entry.value.as_str()) {
        Some(value) if value.contains("grid") => "▦",
        Some(value) if value.contains("flex") => "⇶",
        _ => "",
    };
    (mark, parts)
}

/// `inlayHint/resolve`: the hint's tooltip is the card of the element it summarizes.
pub fn resolve_hint(server: &Server, params: &Value) -> Result<Value, String> {
    let mut hint = params.clone();
    let data = params.get("data").ok_or("inlay hint without data")?;
    let uri: lsp_types::Uri =
        serde_json::from_value(data.get("uri").cloned().unwrap_or_default()).map_err(|error| error.to_string())?;
    let path = crate::text::uri_to_path(&uri).ok_or("not a file URI")?;
    let text = server.source(&path).ok_or_else(|| format!("cannot read {}", path.display()))?;
    let span = (
        data.get("start").and_then(Value::as_u64).unwrap_or_default() as usize,
        data.get("end").and_then(Value::as_u64).unwrap_or_default() as usize,
    );
    let atoms = atoms_of(&server.sites(&path), (span.0 as u32, span.1 as u32));
    if !atoms.is_empty() && text.get(span.0..span.1).is_some() {
        hint["tooltip"] = json!({ "kind": "markdown", "value": crate::card::card(server, &path, &text, span, &atoms) });
    }
    Ok(hint)
}

/// Padding and margin set on all four sides under the same conditions: shown as one shorthand
/// (`m 0.5rem 1rem`). Each is `(first side shown, the other sides, the text)`.
fn merged_sides<'e>(chosen: &[&'e model::Entry]) -> Vec<(&'e model::Entry, Vec<&'e model::Entry>, String)> {
    let mut out = Vec::new();
    for (property, short) in [("padding", "p"), ("margin", "m")] {
        for first in chosen.iter().filter(|entry| entry.property == format!("{property}-top")) {
            let same = |entry: &&&model::Entry| {
                entry.conditions == first.conditions
                    && entry.target == first.target
                    && entry.source.as_ref().map(|source| &source.when)
                        == first.source.as_ref().map(|source| &source.when)
            };
            let sides: Vec<Option<&model::Entry>> = ["top", "right", "bottom", "left"]
                .iter()
                .map(|side| {
                    chosen.iter().filter(same).find(|entry| entry.property == format!("{property}-{side}")).copied()
                })
                .collect();
            if sides.iter().all(Option::is_some) {
                let sides: Vec<&model::Entry> = sides.into_iter().flatten().collect();
                let values = [0, 1, 2, 3].map(|index| Some(sides[index].value.clone()));
                out.push((sides[0], sides[1..].to_vec(), format!("{short} {}", crate::diagram::label(&values))));
            }
        }
    }
    out
}

/// The `)` closing a call whose arguments start at `open`.
pub(crate) fn closing(text: &str, open: usize) -> Option<usize> {
    let mut depth = 0usize;
    for (index, byte) in text[open..].bytes().enumerate() {
        match byte {
            b'(' | b'[' | b'{' => depth += 1,
            b')' if depth == 0 => return Some(open + index),
            b')' | b']' | b'}' => depth = depth.saturating_sub(1),
            _ => {}
        }
    }
    None
}

pub fn code_lenses(server: &Server, params: &Value) -> Result<Value, String> {
    if !server.options.code_lens {
        return Ok(json!([]));
    }
    let (path, text) = document(server, params)?;
    let index = LineIndex::new(&text);
    let sites = server.sites(&path);
    let spans: BTreeSet<(u32, u32)> = sites.iter().map(|site| (site.span.start, site.span.end)).collect();
    let bridged: Vec<u32> = server
        .diagnostics_of(&path)
        .iter()
        .filter(|diagnostic| diagnostic.code == Code::DynamicBridged)
        .map(|diagnostic| diagnostic.span.start)
        .collect();
    let uri = path_to_uri(&path);
    let definitions: Vec<(u32, u32)> = spans
        .iter()
        .copied()
        .filter(|span| {
            text.get(span.0 as usize..span.1 as usize)
                .is_some_and(|site| site.starts_with("css(") || site.starts_with("recipe("))
        })
        .collect();
    // One lookup of every class the definitions produce serves every "used by" count.
    let produced =
        model::produced(server, definitions.iter().flat_map(|span| atoms_of(&sites, *span)).collect::<Vec<_>>().iter());
    let mut out = Vec::new();
    for span in definitions {
        let site = &text[span.0 as usize..span.1 as usize];
        let atoms = atoms_of(&sites, span);
        let conditional = atoms.iter().filter(|atom| !atom.conditions.is_empty() || !atom.target.is_empty()).count();
        let bridges = bridged.iter().filter(|start| (span.0..span.1).contains(start)).count();
        let mut title = vec![plural(atoms.len(), "declaration")];
        if conditional > 0 {
            title.push(format!("{conditional} conditional"));
        }
        if bridges > 0 {
            title.push(format!("{bridges} bridged"));
        }
        let start = index.position(span.0 as usize);
        out.push(json!({
            "range": { "start": start, "end": start },
            "command": {
                "title": format!("{} · {}", site_kind(site).trim_matches('`'), title.join(" · ")),
                "command": SHOW_CSS,
                "arguments": [uri, span.0],
            },
        }));
        let uses = crate::outline::uses_with(server, &path, (span.0 as usize, span.1 as usize), &produced).len();
        if uses > 0 {
            out.push(json!({
                "range": { "start": start, "end": start },
                "command": {
                    "title": format!("used by {}", plural(uses, "element")),
                    "command": crate::actions::SHOW_USES,
                    "arguments": [uri, span.0],
                },
            }));
        }
    }
    Ok(Value::Array(out))
}

/// Whether a site's text is an element's `sx`, as opposed to a `css()` or `recipe()` definition.
/// The compiler records an element as its attribute (`sx={…}`, Vue `:sx="…"`, `{sx}`) or, when it
/// merges at runtime with a value it cannot see (`sx={[styles.action, sx]}` in a component that
/// hands its own `sx` on), as the expression alone.
pub(crate) fn is_binding(site: &str) -> bool {
    !(site.starts_with("css(") || site.starts_with("recipe("))
}

/// The expression an element's site holds: `styles.card` in `sx={styles.card}` or `:sx="…"`, the
/// text itself when the site is the expression.
pub(crate) fn binding_expression(site: &str) -> &str {
    if site == "{sx}" {
        return "sx";
    }
    // An element that spreads props is recorded with all its attributes: read its `sx` among them.
    if !["sx", ":sx", "v-bind:sx"].iter().any(|prefix| site.starts_with(prefix))
        && let Some(at) = attribute(site)
    {
        return binding_expression(&site[at..]);
    }
    let Some(rest) = ["sx", ":sx", "v-bind:sx"]
        .iter()
        .find_map(|prefix| site.strip_prefix(prefix).and_then(|rest| rest.trim_start().strip_prefix('=')))
    else {
        return site;
    };
    let rest = rest.trim();
    if rest.starts_with('{') {
        // The braces' own contents, other attributes after them left out.
        let mut depth = 0usize;
        for (index, byte) in rest.bytes().enumerate() {
            match byte {
                b'{' => depth += 1,
                b'}' if depth == 1 => return rest[1..index].trim(),
                b'}' => depth -= 1,
                _ => {}
            }
        }
    }
    for (open, close) in [('{', '}'), ('"', '"'), ('\'', '\'')] {
        if let Some(inner) = rest.strip_prefix(open).and_then(|inner| inner.strip_suffix(close)) {
            return inner.trim();
        }
    }
    rest
}

/// Where an `sx={…}` attribute starts among an element's attributes, through its balanced braces.
fn attribute(site: &str) -> Option<usize> {
    let bytes = site.as_bytes();
    let mut from = 0;
    while let Some(found) = site[from..].find("sx=") {
        let at = from + found;
        from = at + 3;
        let boundary = at == 0 || bytes[at - 1].is_ascii_whitespace();
        if boundary && site[from..].starts_with('{') {
            return Some(at);
        }
    }
    None
}

/// Where an element's hint goes: at the end of the line its `sx` ends on, past any text and tags
/// that follow, so every hint reads in the same place as the line's last word.
fn hint_end(text: &str, end: usize) -> usize {
    let line_end = text[end..].find('\n').map_or(text.len(), |at| end + at);
    end + text[end..line_end].trim_end().len()
}

fn plural(n: usize, word: &str) -> String {
    format!("{n} {word}{}", if n == 1 { "" } else { "s" })
}

/// The compact summary of what an element receives: the last value per property, condition and
/// target, base values first, in the vocabulary a utility reader knows.
pub(crate) fn summarize(atoms: &[SiteAtom], limit: usize) -> String {
    let mut effective: Vec<&SiteAtom> = Vec::new();
    for atom in atoms {
        effective.retain(|kept| {
            !(kept.property == atom.property && kept.conditions == atom.conditions && kept.target == atom.target)
        });
        effective.push(atom);
    }
    effective.sort_by_key(|atom| (!atom.conditions.is_empty() || !atom.target.is_empty()) as u8);
    let mut parts: Vec<String> = Vec::new();
    for atom in effective {
        let mut prefix: Vec<String> = atom.conditions.iter().map(|condition| short_condition(condition)).collect();
        if !atom.target.is_empty() {
            prefix.push(atom.target.trim_start_matches("::").trim_start_matches("> ").to_owned());
        }
        let body = short_declaration(atom);
        parts.push(if prefix.is_empty() { body } else { format!("{}: {body}", prefix.join(":")) });
    }
    let mut out = String::new();
    for part in parts {
        let next = if out.is_empty() { part } else { format!(" · {part}") };
        if out.chars().count() + next.chars().count() > limit {
            out.push_str(" · …");
            break;
        }
        out.push_str(&next);
    }
    out
}

/// A declaration in utility vocabulary: `display: grid` → `grid`, `padding: 1rem` → `p 1rem`; a
/// variable token's value is named by the token, not its custom property.
fn short_declaration(atom: &SiteAtom) -> String {
    short(&atom.property, &atom.value, atom.tokens.first().map(String::as_str))
}

/// [`short_declaration`] from its parts.
pub(crate) fn short(property: &str, value: &str, token: Option<&str>) -> String {
    let value = match token {
        Some(token) if value.starts_with("var(") => {
            token.rsplit('.').take(2).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join(".")
        }
        // A colour pair reads as both its colours.
        _ => match kirana_project::split_light_dark(value) {
            Some((light, dark)) => format!("{light}/{dark}"),
            None => value.to_owned(),
        },
    };
    if property == "display" {
        return if value == "none" { "hidden".to_owned() } else { value };
    }
    format!("{} {value}", short_property(property))
}

/// A property's utility name: `padding` → `p`, `background-color` → `bg`; others as written.
pub(crate) fn short_property(property: &str) -> &str {
    match property {
        "padding" => "p",
        "padding-inline" => "px",
        "padding-block" => "py",
        "padding-top" => "pt",
        "padding-right" => "pr",
        "padding-bottom" => "pb",
        "padding-left" => "pl",
        "padding-inline-start" => "ps",
        "padding-inline-end" => "pe",
        "margin" => "m",
        "margin-inline" => "mx",
        "margin-block" => "my",
        "margin-top" => "mt",
        "margin-right" => "mr",
        "margin-bottom" => "mb",
        "margin-left" => "ml",
        "margin-inline-start" => "ms",
        "margin-inline-end" => "me",
        "width" => "w",
        "height" => "h",
        "min-width" => "min-w",
        "max-width" => "max-w",
        "min-height" => "min-h",
        "max-height" => "max-h",
        "background-color" => "bg",
        "color" => "text",
        "font-size" => "text",
        "font-weight" => "font",
        "line-height" => "leading",
        "letter-spacing" => "tracking",
        "border-radius" => "rounded",
        "border-width" => "border",
        "border-color" => "border",
        "z-index" => "z",
        "grid-template-columns" => "cols",
        "grid-template-rows" => "rows",
        "align-items" => "items",
        "justify-content" => "justify",
        "flex-direction" => "flex",
        "box-shadow" => "shadow",
        other => other,
    }
}

/// A condition the way a breakpoint or state reads: the preset's breakpoints by name.
pub(crate) fn short_condition(condition: &str) -> String {
    for (name, width) in [("sm", "40rem"), ("md", "48rem"), ("lg", "64rem"), ("xl", "80rem"), ("2xl", "96rem")] {
        if condition == format!("@media (width >= {width})") {
            return name.to_owned();
        }
    }
    condition.strip_prefix(':').map_or_else(|| condition.to_owned(), str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_expression_an_element_holds() {
        assert_eq!(binding_expression("sx={styles.card}"), "styles.card");
        assert_eq!(binding_expression(":sx=\"[a, b]\""), "[a, b]");
        assert_eq!(binding_expression("v-bind:sx='a'"), "a");
        assert_eq!(binding_expression("{sx}"), "sx");
        // Recorded as the expression, or with every attribute of an element that spreads props.
        assert_eq!(binding_expression("[styles.action, sx]"), "[styles.action, sx]");
        assert_eq!(binding_expression("data-x=\"1\" {...props} sx={[a, { b: 1 }]} title=\"t\""), "[a, { b: 1 }]");
        assert_eq!(binding_expression("data-sx={a} xsx={b}"), "data-sx={a} xsx={b}");
        // Unbalanced or unquoted: as written.
        assert_eq!(binding_expression("sx={a"), "{a");
        assert_eq!(binding_expression("sx=a"), "a");
    }

    #[test]
    fn calls_close_at_their_own_paren() {
        assert_eq!(closing("css({ a: f(1) })", 4), Some(15));
        assert_eq!(closing("css({ a: [1] ", 4), None);
    }

    #[test]
    fn hints_sit_after_the_attribute() {
        assert_eq!(hint_end("<p sx={a}>text</p>  \nx", 8), 18);
        assert_eq!(hint_end("<p sx={a}>", 10), 10);
    }
}
