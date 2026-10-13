//! Byte-level minification of what the writer prints (KRN-OUT-001, D-044): whitespace, leading zeros,
//! quotes and media range syntax. It never changes a colour, a number's value or a name, so class
//! names, which hash the unminified text, are unaffected.

/// What the text is, which decides the rules that apply.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Value,
    Selector,
    AtRule,
}

/// Minifies `text` of the given kind. Quoted strings and `url(…)` bodies pass through unchanged.
pub fn compact(text: &str, kind: Kind) -> String {
    let text = if kind == Kind::AtRule { ranges(text) } else { text.to_owned() };
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut index = 0;
    while index < chars.len() {
        let character = chars[index];
        if character == '"' || character == '\'' {
            let end = (index + 1..chars.len()).find(|at| chars[*at] == character).unwrap_or(chars.len() - 1);
            let quoted: String = chars[index..=end].iter().collect();
            out.push_str(&unquote(&out, &quoted, &chars, end, kind));
            index = end + 1;
            continue;
        }
        if out.ends_with("url(") {
            let end = (index..chars.len()).find(|at| chars[*at] == ')').unwrap_or(chars.len());
            out.extend(&chars[index..end]);
            index = end;
            continue;
        }
        if character == ' ' {
            let previous = out.chars().last();
            let next = chars.get(index + 1).copied();
            if previous.is_some_and(|previous| tight_after(previous, kind))
                || next.is_some_and(|next| tight_before(next, kind))
            {
                index += 1;
                continue;
            }
        }
        if character == '0'
            && chars.get(index + 1) == Some(&'.')
            && chars.get(index + 2).is_some_and(char::is_ascii_digit)
            && !out
                .chars()
                .last()
                .is_some_and(|previous| previous.is_ascii_alphanumeric() || previous == '.' || previous == '_')
            && kind != Kind::Selector
        {
            index += 1;
            continue;
        }
        out.push(character);
        index += 1;
    }
    out
}

/// Characters after which a space separates nothing. A space after `)` stays: it can separate two
/// component values (`var(--a) var(--b)`).
fn tight_after(character: char, kind: Kind) -> bool {
    match kind {
        Kind::Value => matches!(character, ',' | '/' | '*' | '('),
        Kind::Selector => matches!(character, ',' | '>' | '~' | '+' | '('),
        Kind::AtRule => matches!(character, ',' | ':' | '(' | '<' | '>' | '='),
    }
}

/// Characters before which a space separates nothing. A space before `(` stays: without it a name
/// would become a function (`@container card (…)`, `and (…)`).
fn tight_before(character: char, kind: Kind) -> bool {
    match kind {
        Kind::Value => matches!(character, ',' | '/' | '*' | ')'),
        Kind::Selector => matches!(character, ',' | '>' | '~' | '+' | ')'),
        Kind::AtRule => matches!(character, ',' | ':' | ')' | '<' | '>' | '='),
    }
}

/// An attribute selector's quoted value (`[data-x="y"]`) loses its quotes when it is an identifier.
fn unquote(out: &str, quoted: &str, chars: &[char], end: usize, kind: Kind) -> String {
    let inner = &quoted[1..quoted.len() - 1];
    let identifier = inner.chars().next().is_some_and(|first| first.is_ascii_alphabetic() || first == '_')
        && inner.chars().all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '-');
    if kind == Kind::Selector && identifier && out.ends_with('=') && chars.get(end + 1) == Some(&']') {
        inner.to_owned()
    } else {
        quoted.to_owned()
    }
}

/// `(min-width: X)` and `(max-width: X)` as range syntax, which the default targets support.
fn ranges(text: &str) -> String {
    text.replace("(min-width:", "(width>=").replace("(max-width:", "(width<=")
}
