//! Completion (KRN-DX-005), where TypeScript cannot help: condition keys in ladder order,
//! `select.*` targets, a property's keyword values, and utility strings from the configured grammar.
//! Property names and token keys are TypeScript's, through `@kirana-style/core`'s types (D-007).

use std::path::Path;

use kirana_config::{ExportSource, Grammar, Rule, Variant};
use kirana_ir::{Key, Value as IrValue};
use serde_json::{Value, json};

use crate::text::{LineIndex, Slot, slot_of, string_at};
use crate::{Server, document_position};

/// LSP completion item kinds used here.
const KEYWORD: u32 = 14;
const PROPERTY: u32 = 10;
const VALUE: u32 = 12;
const COLOR: u32 = 16;
const METHOD: u32 = 2;

/// The CSS-wide keywords every property accepts.
const WIDE: &[&str] = &["inherit", "initial", "unset", "revert", "revert-layer"];

pub fn complete(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text, offset) = document_position(server, params)?;
    let index = LineIndex::new(&text);
    if text[..offset].trim_end_matches(|c: char| c.is_ascii_alphabetic()).ends_with("select.") {
        let start =
            offset - text[..offset].len() + text[..offset].trim_end_matches(|c: char| c.is_ascii_alphabetic()).len();
        let range = index.range(start, offset);
        return Ok(json!([
            item(
                "descendant",
                METHOD,
                "select.descendant(target): every matching descendant",
                &range,
                "descendant(\"$1\")"
            ),
            item("child", METHOD, "select.child(target): direct children only", &range, "child(\"$1\")"),
        ]));
    }
    let Some((start, _, _)) = string_at(&text, offset) else { return Ok(Value::Null) };
    let range = index.range(start, offset);
    let typed = &text[start..offset];
    if is_utility_string(&text, start - 1) {
        return Ok(match &server.project.config().utilities {
            Some(grammar) => utilities(server, &path, grammar, typed, &index, offset),
            None => Value::Null,
        });
    }
    Ok(match slot_of(&text, start - 1) {
        Slot::Key { nested } => conditions(nested, &range),
        Slot::Value { property } => values(&property, &range),
        Slot::Other => Value::Null,
    })
}

fn item(label: &str, kind: u32, detail: &str, range: &lsp_types::Range, insert: &str) -> Value {
    json!({
        "label": label,
        "kind": kind,
        "detail": detail,
        "insertTextFormat": if insert.contains('$') { 2 } else { 1 },
        "textEdit": { "range": range, "newText": insert },
    })
}

/// Whether the string opened at `quote` is an `sx` utility string (`sx="…"`, `sx={"…"}`, or a string
/// in an `sx` array).
fn is_utility_string(text: &str, quote: usize) -> bool {
    let before = text[..quote].trim_end();
    before.ends_with("sx=") || before.ends_with("sx={") || {
        // Inside `sx={[…]}`: the nearest unclosed `[` follows `sx={`.
        let mut depth = 0usize;
        let mut found = false;
        for (index, byte) in before.bytes().enumerate().rev() {
            let opening = matches!(byte, b'[' | b'(' | b'{');
            if matches!(byte, b']' | b')' | b'}') {
                depth += 1;
            } else if opening && depth > 0 {
                depth -= 1;
            } else if byte == b'[' {
                found = before[..index].trim_end().ends_with("sx={");
                break;
            } else if opening || byte == b'>' || byte == b';' {
                break;
            }
        }
        found
    }
}

/// Condition keys, ordered as the precedence ladder ranks them (D-014): pseudo-classes by
/// strength, attributes, then at-rules. Pseudo-elements and `select` only at the top of a style.
fn conditions(nested: bool, range: &lsp_types::Range) -> Value {
    let mut items: Vec<(u8, Value)> = Vec::new();
    for name in kirana_css_data::pseudo_selectors() {
        let element = name.starts_with("::");
        if element && nested {
            continue;
        }
        let rank = if element { 0 } else { 10 + kirana_css_data::pseudo_class_rank(name) };
        let detail = if element { "pseudo-element: a style object for it" } else { "pseudo-class condition" };
        let mut entry = item(name, if element { PROPERTY } else { KEYWORD }, detail, range, name);
        entry["sortText"] = json!(format!("{:03}{name}", 255 - rank));
        items.push((rank, entry));
    }
    for (label, insert, detail) in [
        ("[data-…]", "[data-${1:state}=\"${2:open}\"]", "attribute condition"),
        ("[aria-…]", "[aria-${1:expanded}=\"${2:true}\"]", "attribute condition"),
        ("@media", "@media (${1:width >= 48rem})", "media query (an at-rule: below every selector condition)"),
        ("@container", "@container (${1:width >= 24rem})", "container query"),
        ("@supports", "@supports (${1:display: grid})", "feature query"),
    ] {
        let mut entry = item(label, KEYWORD, detail, range, insert);
        entry["sortText"] = json!(format!("5{label}"));
        items.push((5, entry));
    }
    if nested {
        let mut base = item("base", KEYWORD, "the value when no condition matches", range, "base");
        base["sortText"] = json!("0base");
        items.push((0, base));
    }
    Value::Array(items.into_iter().map(|(_, entry)| entry).collect())
}

/// Keyword values for a property, plus the CSS-wide keywords (and `transparent`/`currentcolor` for
/// a colour property).
fn values(property: &str, range: &lsp_types::Range) -> Value {
    let mut items: Vec<Value> = kirana_css_data::keywords(property)
        .iter()
        .map(|keyword| item(keyword, VALUE, property, range, keyword))
        .collect();
    if property.contains("color") || property == "fill" || property == "stroke" {
        for keyword in ["transparent", "currentcolor"] {
            items.push(item(keyword, COLOR, property, range, keyword));
        }
    }
    for keyword in WIDE {
        let mut entry = item(keyword, VALUE, "CSS-wide keyword", range, keyword);
        entry["sortText"] = json!(format!("z{keyword}"));
        items.push(entry);
    }
    Value::Array(items)
}

/// `breakpoint.md from @kirana-style/preset-scales`.
fn exported(source: &ExportSource) -> String {
    format!("{} from {}", source.reference(), source.module)
}

/// Utility completions for the word being typed: variants, then roots; a root's scale keys once the
/// word names the root (`bg-` → `bg-red-500`, …).
fn utilities(
    server: &Server,
    path: &Path,
    grammar: &Grammar,
    typed: &str,
    index: &LineIndex<'_>,
    offset: usize,
) -> Value {
    let word = typed.rsplit(char::is_whitespace).next().unwrap_or("");
    // Variants already typed (`md:hover:`) stay; only the utility after them is completed.
    let utility = word.rsplit(':').next().unwrap_or(word);
    let range = index.range(offset - utility.len(), offset);
    let mut items = Vec::new();
    if utility.is_empty() || !utility.contains('-') {
        for (name, variant) in &grammar.variants {
            let label = format!("{name}:");
            let detail = match variant {
                Variant::Key(condition) => condition.clone(),
                Variant::Export(source) => exported(source),
            };
            let mut entry = item(&label, KEYWORD, &detail, &range, &label);
            entry["command"] = json!({ "title": "suggest", "command": "editor.action.triggerSuggest" });
            items.push(entry);
        }
    }
    for (name, source) in &grammar.handles {
        items.push(item(name, PROPERTY, &format!("the handle {}", exported(source)), &range, name));
    }
    for (root, rules) in &grammar.utilities {
        for rule in rules {
            match rule {
                Rule::Static(rule) => {
                    let detail = declarations(rule.declarations.iter());
                    items.push(item(root, PROPERTY, &detail, &range, root));
                }
                Rule::Keyword(rule) => {
                    for (key, value) in &rule.values {
                        let label = format!("{root}-{key}");
                        let detail = format!("{}: {value}", rule.properties.join(", "));
                        items.push(item(&label, PROPERTY, &detail, &range, &label));
                    }
                }
                Rule::Scale(rule) => {
                    let named = utility.strip_prefix(root.as_str()).is_some_and(|rest| rest.starts_with('-'));
                    let Some(scale) = rule.scale.as_ref().filter(|_| named) else {
                        let detail = format!("{}: <scale>", rule.properties.join(", "));
                        items.push(item(&format!("{root}-"), PROPERTY, &detail, &range, &format!("{root}-")));
                        continue;
                    };
                    for (key, value) in scale_keys(server, path, grammar, scale) {
                        let label = format!("{root}-{key}");
                        let kind = if crate::colors::parse(&value).is_some() { COLOR } else { VALUE };
                        let mut entry =
                            item(&label, kind, &format!("{}: {value}", rule.properties.join(", ")), &range, &label);
                        if kind == COLOR {
                            entry["documentation"] = json!(value);
                        }
                        items.push(entry);
                    }
                }
            }
        }
    }
    json!({ "isIncomplete": true, "items": items })
}

fn declarations<'d>(entries: impl Iterator<Item = (&'d String, &'d String)>) -> String {
    entries.map(|(property, value)| format!("{property}: {value}")).collect::<Vec<_>>().join("; ")
}

/// The keys of a scale and their CSS values, flattened (`red.500` → `red-500`).
fn scale_keys(server: &Server, path: &Path, grammar: &Grammar, scale: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for source in grammar.scales.get(scale).into_iter().flatten() {
        let value = server.project.import_value(path, &source.module, &source.export);
        flatten(&value, "", &mut out);
        if !out.is_empty() {
            break;
        }
    }
    out
}

fn flatten(value: &IrValue, prefix: &str, out: &mut Vec<(String, String)>) {
    match value {
        IrValue::Object(entries) => {
            for (key, inner) in entries.iter() {
                let Key::Str(name) = key else { continue };
                let name = if prefix.is_empty() { name.to_string() } else { format!("{prefix}-{name}") };
                flatten(inner, &name, out);
            }
        }
        IrValue::Token(token) => out.push((prefix.to_owned(), token.css.clone())),
        IrValue::Str(text) => out.push((prefix.to_owned(), text.to_string())),
        IrValue::Number(number) => out.push((prefix.to_owned(), kirana_ir::number_to_string(*number))),
        _ => {}
    }
}
