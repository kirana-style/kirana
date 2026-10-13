//! A document's styles as structure (KRN-DX-014): its `css()` and `recipe()` handles, tokens and
//! relations in the outline; folding for style objects with their summary as the folded text;
//! highlights between a key and the elements that receive it; and the "used by" count.

use std::collections::BTreeSet;
use std::path::Path;

use serde_json::{Value, json};

use crate::hover::{atoms_of, site_at};
use crate::model;
use crate::summary::{is_binding, summarize};
use crate::text::{LineIndex, path_to_uri};
use crate::{Server, document, document_position};

/// The `css()` and `recipe()` sites of a document, with the name each is bound to.
pub(crate) fn definitions(server: &Server, path: &Path, text: &str) -> Vec<((usize, usize), String, bool)> {
    let mut seen = BTreeSet::new();
    server
        .sites(path)
        .iter()
        .map(|site| (site.span.start as usize, site.span.end as usize))
        .filter(|span| seen.insert(*span))
        .filter_map(|span| {
            let site = text.get(span.0..span.1)?;
            let recipe = site.starts_with("recipe(");
            (recipe || site.starts_with("css(")).then(|| {
                let name = model::binding_name(text, span.0)
                    .unwrap_or_else(|| if recipe { "recipe()" } else { "css()" }.to_owned());
                (span, name, recipe)
            })
        })
        .collect()
}

pub fn document_symbols(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text) = document(server, params)?;
    let index = LineIndex::new(&text);
    let sites = server.sites(&path);
    let mut out = Vec::new();
    for (span, name, recipe) in definitions(server, &path, &text) {
        let detail = summarize(&atoms_of(&sites, (span.0 as u32, span.1 as u32)), 48);
        let start = index.position(span.0);
        out.push(json!({
            "name": name,
            "detail": detail,
            // Class for a recipe (it has variants), variable for a style.
            "kind": if recipe { 5 } else { 13 },
            "range": index.range(span.0, span.1),
            "selectionRange": { "start": start, "end": start },
        }));
    }
    let file = server.project.display_name(&path);
    for token in server.project.tokens().into_iter().filter(|token| token.file == file) {
        out.push(json!({
            "name": token.identity,
            "detail": token.value,
            "kind": 14,
            "range": index.range(token.span.start as usize, token.span.end as usize),
            "selectionRange": index.range(token.span.start as usize, token.span.start as usize),
        }));
    }
    for relation in server.project.relations().into_iter().filter(|relation| relation.declared_in.contains(&file)) {
        for quote in ['"', '\'', '`'] {
            let needle = format!("relation({quote}{}{quote})", relation.name);
            if let Some(start) = text.find(&needle) {
                out.push(json!({
                    "name": relation.name,
                    "detail": "relation",
                    "kind": 24,
                    "range": index.range(start, start + needle.len()),
                    "selectionRange": index.range(start, start),
                }));
                break;
            }
        }
    }
    out.sort_by_key(|symbol| {
        (symbol["range"]["start"]["line"].as_u64(), symbol["range"]["start"]["character"].as_u64())
    });
    Ok(Value::Array(out))
}

pub fn folding_ranges(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text) = document(server, params)?;
    let index = LineIndex::new(&text);
    let sites = server.sites(&path);
    let mut out = Vec::new();
    for (span, _, _) in definitions(server, &path, &text) {
        let (start, end) = (index.position(span.0).line, index.position(span.1).line);
        if end <= start {
            continue;
        }
        // The closing `})` stays visible; the folded text is what the style sets.
        out.push(json!({
            "startLine": start,
            "endLine": end - 1,
            "kind": "region",
            "collapsedText": summarize(&atoms_of(&sites, (span.0 as u32, span.1 as u32)), 60),
        }));
    }
    Ok(Value::Array(out))
}

/// The ranges `kirana/styleRanges` returns for a client's style fold: each style object (from after
/// its `css(` to before its `)`), whether it spans lines, and its summary.
pub fn style_ranges(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text) = document(server, params)?;
    let index = LineIndex::new(&text);
    let sites = server.sites(&path);
    let mut out = Vec::new();
    for (span, name, _) in definitions(server, &path, &text) {
        let site = &text[span.0..span.1];
        // A definition is a call: `css(` … `)`.
        let (open, close) = (site.find('(').unwrap_or(0), site.rfind(')').unwrap_or(site.len()));
        out.push(json!({
            "name": name,
            "multiline": site[open..close].contains('\n'),
            "range": index.range(span.0 + open + 1, span.0 + close),
            "summary": summarize(&atoms_of(&sites, (span.0 as u32, span.1 as u32)), 72),
        }));
    }
    Ok(Value::Array(out))
}

pub fn highlights(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text, offset) = document_position(server, params)?;
    let index = LineIndex::new(&text);
    let Some((span, atoms)) = site_at(server, &path, &text, offset) else { return Ok(Value::Null) };
    let site = &text[span.0..span.1];
    let sites = server.sites(&path);
    let mut out = Vec::new();
    if site.starts_with("css(") || site.starts_with("recipe(") {
        // On a key: the key, and every element in this document that receives what it sets.
        let Some(crate::hover::Focus::Property(property)) = crate::hover::key_at(&text, offset) else {
            return Ok(Value::Null);
        };
        let classes: BTreeSet<&str> =
            atoms.iter().filter(|atom| crate::hover::covers(atom, &property)).map(|atom| atom.class.as_str()).collect();
        if let Some(key) = model::key_offset(site, &property) {
            out.push(json!({ "range": index.range(span.0 + key, span.0 + key), "kind": 3 }));
        }
        let mut seen = BTreeSet::new();
        for other in &sites {
            let other_span = (other.span.start as usize, other.span.end as usize);
            let Some(other_text) = text.get(other_span.0..other_span.1) else { continue };
            if is_binding(other_text)
                && other.atoms.iter().any(|atom| classes.contains(atom.class.as_str()))
                && seen.insert(other_span)
            {
                out.push(json!({ "range": index.range(other_span.0, other_span.1), "kind": 2 }));
            }
        }
    } else {
        // On an element: the keys in this document that set what it receives.
        let classes: BTreeSet<&str> = atoms.iter().map(|atom| atom.class.as_str()).collect();
        for (definition, _, _) in definitions(server, &path, &text) {
            let definition_text = &text[definition.0..definition.1];
            for atom in atoms_of(&sites, (definition.0 as u32, definition.1 as u32)) {
                if classes.contains(atom.class.as_str())
                    && let Some(key) = model::key_offset(definition_text, &atom.property)
                {
                    let at = definition.0 + key;
                    let range = index.range(at, at + key_length(definition_text, key));
                    if !out.iter().any(|existing| existing["range"] == json!(range)) {
                        out.push(json!({ "range": range, "kind": 3 }));
                    }
                }
            }
        }
        out.push(json!({ "range": index.range(span.0, span.1), "kind": 2 }));
    }
    Ok(Value::Array(out))
}

/// The length of the key written at `at` (with its quotes).
fn key_length(text: &str, at: usize) -> usize {
    let rest = &text[at..];
    match rest.chars().next() {
        Some(quote @ ('"' | '\'')) => rest[1..].find(quote).map_or(1, |end| end + 2),
        _ => rest.find(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$')).unwrap_or(rest.len()),
    }
}

/// The elements across the project that receive anything a `css()` or `recipe()` site produces:
/// `(file, span)` of each, the definition itself excluded.
pub(crate) fn uses(server: &Server, path: &Path, span: (usize, usize)) -> Vec<(std::path::PathBuf, (usize, usize))> {
    let sites = server.sites(path);
    let atoms = atoms_of(&sites, (span.0 as u32, span.1 as u32));
    uses_with(server, path, span, &model::produced(server, atoms.iter()))
}

/// [`uses`] with the origins of the definition's classes already looked up.
pub(crate) fn uses_with(
    server: &Server,
    path: &Path,
    span: (usize, usize),
    produced: &model::Produced,
) -> Vec<(std::path::PathBuf, (usize, usize))> {
    let sites = server.sites(path);
    let atoms = atoms_of(&sites, (span.0 as u32, span.1 as u32));
    let classes: BTreeSet<&str> = atoms.iter().map(|atom| atom.class.as_str()).collect();
    // The name the definition is bound to (`title` for `styles.title`): an element uses it when its
    // `sx` names it. Every `font-weight: 600` in a project shares one class, so classes alone
    // would count elements that never mention the handle.
    let name = server.source(path).and_then(|source| model::binding_name(&source, span.0));
    let name = name.as_deref().map(|name| name.rsplit('.').next().unwrap_or(name).to_owned());
    let mut out: Vec<(std::path::PathBuf, (usize, usize))> = Vec::new();
    for (file, site, class) in produced {
        let (file, site) = (file.clone(), *site);
        if !classes.contains(class.as_str())
            || file == path && site == span
            || out.iter().any(|(seen, seen_span)| *seen == file && *seen_span == site)
        {
            continue;
        }
        let source = server.source(&file).unwrap_or_default();
        let Some(element) = source.get(site.0..site.1).filter(|element| is_binding(element)) else { continue };
        let names_it = name.as_deref().is_none_or(|name| {
            element.split(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$')).any(|word| word == name)
        });
        if !names_it {
            continue;
        }
        // Equal declarations share a class: an element counts when it receives most of what the
        // definition produces, not one declaration it happens to share.
        let received = server
            .sites(&file)
            .iter()
            .filter(|other| (other.span.start as usize, other.span.end as usize) == site)
            .flat_map(|other| other.atoms.iter().map(|atom| atom.class.clone()))
            .filter(|class| classes.contains(class.as_str()))
            .collect::<BTreeSet<String>>()
            .len();
        if received * 2 >= classes.len().max(1) {
            out.push((file, site));
        }
    }
    out
}

/// `kirana.showUses`: `[uri, offset]` → the locations of the elements a definition reaches.
pub(crate) fn show_uses(server: &Server, path: &Path, text: &str, offset: usize) -> Value {
    let Some((span, _)) = site_at(server, path, text, offset) else { return json!([]) };
    let locations: Vec<Value> = uses(server, path, span)
        .into_iter()
        .map(|(file, site)| {
            // `uses` read every file it returns.
            let source = server.source(&file).unwrap_or_default();
            let index = LineIndex::new(&source);
            json!({ "uri": path_to_uri(&file), "range": index.range(site.0, site.1) })
        })
        .collect();
    Value::Array(locations)
}
