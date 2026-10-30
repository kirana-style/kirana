//! Requests beyond LSP that a client's own views read (KRN-DX-015):
//!
//! - `kirana/inspect` `{ textDocument, position, active? }` → the resolved style of the site at the
//!   position, and which entries hold when exactly the `active` conditions and switches do;
//! - `kirana/styleRanges` `{ textDocument }` → each style object, whether it spans lines, and its
//!   summary;
//! - `kirana/stats` `{}` → the stylesheet's size and rule count, and how many components compiled.

use std::collections::BTreeSet;

use serde_json::{Value, json};

use crate::hover::site_at;
use crate::model::{self, simulate};
use crate::text::LineIndex;
use crate::{Server, document_position};

pub const INSPECT: &str = "kirana/inspect";
pub const STYLE_RANGES: &str = "kirana/styleRanges";
pub const STATS: &str = "kirana/stats";

pub fn inspect(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text, offset) = document_position(server, params)?;
    let Some((span, atoms)) = site_at(server, &path, &text, offset) else { return Ok(Value::Null) };
    let resolved = model::resolve(server, &path, &text, span, &atoms);
    let active: BTreeSet<String> = params
        .get("active")
        .and_then(Value::as_array)
        .map(|active| active.iter().filter_map(Value::as_str).map(str::to_owned).collect())
        .unwrap_or_default();
    let holding: BTreeSet<&str> =
        simulate(&resolved.entries, &active).iter().map(|entry| entry.class.as_str()).collect();
    let effective: Vec<usize> = resolved
        .entries
        .iter()
        .enumerate()
        .filter(|(_, entry)| holding.contains(entry.class.as_str()))
        .map(|(index, _)| index)
        .collect();
    let index = LineIndex::new(&text);
    let first_line = text[span.0..span.1].lines().next().unwrap_or_default();
    Ok(json!({
        "uri": params.pointer("/textDocument/uri"),
        "range": index.range(span.0, span.1),
        "label": first_line.chars().take(80).collect::<String>(),
        "kind": resolved.kind,
        "entries": resolved.entries,
        "conditions": resolved.conditions,
        "switches": resolved.switches,
        "effective": effective,
        "summary": crate::summary::summarize(&atoms, usize::MAX),
    }))
}

pub fn stats(server: &Server) -> Value {
    let css = server.project.stylesheet(true);
    let rules = css.matches('{').count().saturating_sub(css.matches('@').count());
    json!({ "bytes": css.len(), "rules": rules, "components": server.component_count() })
}
