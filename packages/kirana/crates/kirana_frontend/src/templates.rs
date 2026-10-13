//! Server templates (D-069): the style names a Blade, Twig, ERB, HEEx or Edge template passes to
//! Kirana's helper — `@kirana('card')`, `{{ kirana('card', active ? 'card.active') }}`,
//! `<%= kirana :card %>`, `kirana(["card"])` — found by a scanner, as the language server needs them.
//! Every string literal or Ruby symbol among a call's arguments is a name; the call ends at its
//! closing parenthesis, or, without one (ERB's `kirana :card`), at the end of its line or tag.

use std::path::Path;

/// The template files that name styles through the helper.
pub const TEMPLATE_SUFFIXES: &[&str] = &[".blade.php", ".erb", ".heex", ".twig", ".edge"];

/// Whether `path` is a server template.
pub fn is_template(path: &Path) -> bool {
    let name = path.to_string_lossy();
    TEMPLATE_SUFFIXES.iter().any(|suffix| name.ends_with(suffix))
}

/// One style name in a template.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StyleName {
    /// The literal, quotes or colon included.
    pub start: usize,
    pub end: usize,
    /// The name itself.
    pub name: String,
}

/// Every style name passed to `kirana` in `text`, in order.
pub fn style_names(text: &str) -> Vec<StyleName> {
    let bytes = text.as_bytes();
    let mut names = Vec::new();
    let mut search = 0;
    while let Some(found) = text[search..].find("kirana") {
        let at = search + found;
        search = at + "kirana".len();
        let before = at.checked_sub(1).map(|index| bytes[index]);
        if before.is_some_and(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'.') {
            continue;
        }
        let mut cursor = search;
        while cursor < bytes.len() && bytes[cursor] == b' ' {
            cursor += 1;
        }
        let parenthesised = bytes.get(cursor) == Some(&b'(');
        // Ruby's call without parentheses: `kirana :card, "card.active"`.
        let bare = !parenthesised && cursor > search && matches!(bytes.get(cursor), Some(b':' | b'"' | b'\''));
        if !parenthesised && !bare {
            continue;
        }
        let mut depth = 0usize;
        while cursor < bytes.len() {
            match bytes[cursor] {
                b'(' | b'[' => depth += 1,
                b')' | b']' => {
                    depth = depth.saturating_sub(1);
                    if parenthesised && depth == 0 {
                        break;
                    }
                }
                b'\n' if bare => break,
                b'%' if bare && bytes.get(cursor + 1) == Some(&b'>') => break,
                quote @ (b'"' | b'\'') => {
                    let start = cursor;
                    cursor += 1;
                    while cursor < bytes.len() && bytes[cursor] != quote {
                        cursor += if bytes[cursor] == b'\\' { 2 } else { 1 };
                    }
                    let end = (cursor + 1).min(bytes.len());
                    names.push(StyleName { start, end, name: text[start + 1..cursor.min(bytes.len())].to_owned() });
                }
                // A Ruby symbol (`:card`), not a ternary's colon or a hash key's.
                b':' if bytes.get(cursor + 1).is_some_and(|byte| byte.is_ascii_alphabetic() || *byte == b'_')
                    && cursor.checked_sub(1).is_none_or(|index| matches!(bytes[index], b' ' | b'(' | b',' | b'[')) =>
                {
                    let start = cursor;
                    cursor += 1;
                    while cursor < bytes.len() && (bytes[cursor].is_ascii_alphanumeric() || bytes[cursor] == b'_') {
                        cursor += 1;
                    }
                    names.push(StyleName { start, end: cursor, name: text[start + 1..cursor].to_owned() });
                    continue;
                }
                _ => {}
            }
            cursor += 1;
        }
        search = cursor.min(bytes.len()).max(search);
    }
    names
}
