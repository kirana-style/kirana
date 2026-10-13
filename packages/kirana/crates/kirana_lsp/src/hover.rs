//! Hover (KRN-DX-002): on a style, the CSS it compiles to grouped by condition; on one property,
//! its entries in ladder order with why the first wins; on a token, its value in both modes.

use std::path::Path;

use kirana_project::{Site, SiteAtom, TokenInfo};
use serde_json::{Value, json};

use crate::text::{LineIndex, chain_at};
use crate::{Server, document_position};

pub fn hover(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text, offset) = document_position(server, params)?;
    let index = LineIndex::new(&text);
    if let Some((chain, start, end)) = chain_at(&text, offset) {
        let tokens = tokens_for(server, chain, &text);
        if !tokens.is_empty() {
            let value = tokens.iter().map(token_markdown).collect::<Vec<_>>().join("\n\n---\n\n");
            return Ok(markdown(value, Some(index.range(start, end))));
        }
    }
    let Some((span, atoms)) = site_at(server, &path, &text, offset) else { return Ok(Value::Null) };
    let site_text = &text[span.0..span.1];
    let Some(focus) = key_at(&text, offset) else {
        let card = crate::card::card(server, &path, &text, span, &atoms);
        return Ok(markdown(card, Some(index.range(span.0, span.1))));
    };
    let mut out = String::new();
    let kind = site_kind(site_text);
    let shown: Vec<&SiteAtom> = match &focus {
        Focus::Property(property) => atoms.iter().filter(|atom| covers(atom, property)).collect(),
        Focus::Condition(condition) => {
            atoms.iter().filter(|atom| atom.conditions.iter().any(|written| written == condition)).collect()
        }
    };
    let shown = if shown.is_empty() { atoms.iter().collect() } else { shown };
    out.push_str(&format!("**Kirana** · {kind} · {}\n", count(shown.len(), "declaration")));
    out.push_str("\n```css\n");
    for atom in &shown {
        out.push_str(&pretty_rule(atom));
        out.push('\n');
    }
    out.push_str("```\n");
    if let Focus::Property(property) = &focus {
        let line = index.position(offset).line as usize + 1;
        let trace = server.trace(&path, &text, line, property);
        if trace.len() > 1 {
            out.push_str("\n**Precedence**, strongest first:\n\n");
            for entry in &trace {
                let why = if entry.reason.is_empty() { String::new() } else { format!(" — {}", entry.reason) };
                out.push_str(&format!("- `{}` at `{}`{why}\n", entry.value, entry.conditions));
            }
        }
        if !server.is_component(&path) {
            out.push_str(&format!(
                "\n`kirana trace {}:{line} {property}` explains it from the command line.",
                server.project.display_name(&path)
            ));
        }
    }
    let tokens: Vec<&str> = shown.iter().flat_map(|atom| atom.tokens.iter().map(String::as_str)).collect();
    if !tokens.is_empty() {
        out.push_str(&format!("\n\nReads {}.", tokens.iter().map(|t| format!("`{t}`")).collect::<Vec<_>>().join(", ")));
    }
    Ok(markdown(out, Some(index.range(span.0, span.1))))
}

/// A `command:` link a client runs when the hover is trusted.
pub(crate) fn command_link(command: &str, arguments: &Value) -> String {
    let mut encoded = String::new();
    for byte in arguments.to_string().bytes() {
        if byte.is_ascii_alphanumeric() || b"-._~".contains(&byte) {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    format!("command:{command}?{encoded}")
}

fn markdown(value: String, range: Option<lsp_types::Range>) -> Value {
    json!({ "contents": { "kind": "markdown", "value": value }, "range": range })
}

fn count(n: usize, word: &str) -> String {
    format!("{n} {word}{}", if n == 1 { "" } else { "s" })
}

/// What kind of site a span is, from its text.
pub(crate) fn site_kind(text: &str) -> &'static str {
    if text.starts_with("css(") {
        "`css()`"
    } else if text.starts_with("recipe(") {
        "`recipe()`"
    } else if text.starts_with("sx=\"") || text.starts_with("sx='") || text.starts_with("sx={\"") {
        "utility string"
    } else {
        "`sx`"
    }
}

/// The innermost site around `offset`, with the atoms of every part sharing its span, in merge
/// order.
/// Only spans that fit `text`: a file changed on disk without a notification keeps the spans of its
/// last compile until the next one.
pub(crate) fn site_at(
    server: &Server,
    path: &Path,
    text: &str,
    offset: usize,
) -> Option<((usize, usize), Vec<SiteAtom>)> {
    let sites = server.sites(path);
    let innermost = sites
        .iter()
        .filter(|site| (site.span.start as usize) <= offset && offset <= site.span.end as usize)
        .filter(|site| text.get(site.span.start as usize..site.span.end as usize).is_some())
        .min_by_key(|site| site.span.end - site.span.start)?;
    let span = (innermost.span.start, innermost.span.end);
    Some(((span.0 as usize, span.1 as usize), atoms_of(&sites, span)))
}

/// The atoms of every part with this span, in order.
pub(crate) fn atoms_of(sites: &[Site], span: (u32, u32)) -> Vec<SiteAtom> {
    sites
        .iter()
        .filter(|site| (site.span.start, site.span.end) == span)
        .flat_map(|site| site.atoms.iter().cloned())
        .collect()
}

/// Whether an atom sets `property` (kebab-case), itself or as one of a shorthand atom's longhands.
pub(crate) fn covers(atom: &SiteAtom, property: &str) -> bool {
    atom.property == property
        || kirana_cascade::longhands_of(&atom.property)
            .is_ok_and(|longhands| longhands.len() > 1 && longhands.iter().any(|longhand| longhand.name == property))
        || kirana_cascade::longhands_of(property).is_ok_and(|longhands| {
            longhands.len() > 1 && longhands.iter().any(|longhand| longhand.name == atom.property)
        })
}

/// A rule as a person reads it: the selector's class kept, at-rules on their own lines.
pub(crate) fn pretty_rule(atom: &SiteAtom) -> String {
    let mut depth = 0;
    let mut out = String::new();
    let mut rest = atom.rule.as_str();
    while let Some(at) = rest.strip_prefix('@') {
        let open = at.find(" { ").unwrap_or(at.len());
        out.push_str(&format!("{}@{} {{\n", "  ".repeat(depth), &at[..open]));
        depth += 1;
        rest = at.get(open + 3..).unwrap_or("");
    }
    let rule = rest.trim_end_matches(" }").trim_end_matches('}').trim_end();
    let (selector, declaration) = rule.split_once(" { ").unwrap_or((rule, ""));
    out.push_str(&format!("{}{selector} {{ {} }}", "  ".repeat(depth), declaration.trim_end_matches(" }").trim()));
    for level in (0..depth).rev() {
        out.push_str(&format!("\n{}}}", "  ".repeat(level)));
    }
    out
}

/// The tokens a member chain can name in `text`: `color.brand` names the token `color.brand`, and
/// so does `palette.brand` when `palette` is imported (`import { color as palette }`). A local
/// object (`styles.card`) never names a token, whatever its keys. Exact identities first.
pub(crate) fn tokens_for(server: &Server, chain: &str, text: &str) -> Vec<TokenInfo> {
    let Some((root, path)) = chain.split_once('.') else { return Vec::new() };
    let tokens = server.project.tokens();
    let exact: Vec<TokenInfo> = tokens.iter().filter(|token| token.identity == chain).cloned().collect();
    if !exact.is_empty() || !imported(text, root) {
        return exact;
    }
    tokens.into_iter().filter(|token| token.identity.split_once('.').is_some_and(|(_, rest)| rest == path)).collect()
}

/// Whether an `import` statement in `text` binds `name`.
fn imported(text: &str, name: &str) -> bool {
    let mut rest = text;
    while let Some(at) = rest.find("import ") {
        let statement = &rest[at..];
        let end = statement.find(" from ").unwrap_or(statement.len());
        let words = statement[..end].split(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$'));
        if words.into_iter().any(|word| word == name) {
            return true;
        }
        rest = &rest[at + 7..];
    }
    false
}

fn token_markdown(token: &TokenInfo) -> String {
    let mut out = format!("**token** `{}` · {}\n\n", token.identity, token.file);
    match (&token.light, &token.dark) {
        (Some(light), Some(dark)) => {
            out.push_str(&format!("| light | dark |\n| --- | --- |\n| `{light}` | `{dark}` |\n"))
        }
        _ => out.push_str(&format!("`{}`\n", token.value)),
    }
    out.push_str(if token.variable {
        "\nA custom property: themes and `{ [token]: value }` can assign it."
    } else {
        "\nInlined into every rule that reads it."
    });
    out
}

/// What the cursor is on inside a style object.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Focus {
    /// A property key, kebab-case.
    Property(String),
    /// A condition key as written (`:hover`).
    Condition(String),
}

/// The key under the cursor: an identifier or string followed by `:`.
pub(crate) fn key_at(text: &str, offset: usize) -> Option<Focus> {
    let bytes = text.as_bytes();
    let quoted = crate::text::string_at(text, offset);
    let (start, end) = match quoted {
        Some((start, end, _)) => (start, end),
        None => {
            let is_word = |byte: u8| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$';
            let mut start = offset.min(bytes.len());
            while start > 0 && is_word(bytes[start - 1]) {
                start -= 1;
            }
            let mut end = offset.min(bytes.len());
            while end < bytes.len() && is_word(bytes[end]) {
                end += 1;
            }
            (start, end)
        }
    };
    if start >= end {
        return None;
    }
    let after = text[end..].trim_start_matches(['"', '\'', '`', ']']).trim_start();
    if !after.starts_with(':') {
        return None;
    }
    let key = &text[start..end];
    if key.starts_with([':', '@', '[']) {
        Some(Focus::Condition(key.to_owned()))
    } else if key == "base" || key.starts_with("::") {
        None
    } else {
        Some(Focus::Property(kirana_shared::kebab_case(key)))
    }
}
