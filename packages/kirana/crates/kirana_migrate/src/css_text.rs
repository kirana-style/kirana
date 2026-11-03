//! Reading and writing CSS for the codemods that start from CSS text: styled-components' and
//! Emotion's templates ([`crate::styled`]) and CSS Modules ([`crate::css_modules`]).
//!
//! [`Parser`] only splits a stylesheet into declarations, nested blocks and the text it cannot read;
//! it never evaluates CSS. A template's interpolations stand in its text as placeholders. [`Tree`]
//! writes a style back out as the object `css()` takes, conditions inside each property.

use crate::Piece;

/// A `${…}` in a template's CSS: the expression's index between two Unicode noncharacters, which
/// no text holds (an icon font's private-use glyph may be in a `content` value).
pub(crate) const OPEN: char = '\u{FDD0}';
pub(crate) const CLOSE: char = '\u{FDD1}';

/// A rule of a template's CSS, with offsets into the joined text.
#[derive(Debug)]
pub(crate) enum Rule {
    Declaration { property: String, value: String, at: usize },
    Block { selector: String, rules: Vec<Rule>, text: String, at: usize },
    Interpolation { index: usize, at: usize },
    Unread { text: String, at: usize },
}

/// Reads the CSS of a template, its interpolations already placeholders.
pub(crate) struct Parser<'t> {
    pub(crate) text: &'t str,
    pub(crate) at: usize,
}

impl Parser<'_> {
    pub(crate) fn rules(&mut self, nested: bool) -> Vec<Rule> {
        let mut rules = Vec::new();
        loop {
            self.skip();
            match self.text[self.at..].chars().next() {
                None => break,
                Some('}') => {
                    self.at += 1;
                    if nested {
                        break;
                    }
                    continue;
                }
                Some(';') => {
                    self.at += 1;
                    continue;
                }
                Some(_) => {}
            }
            // A placeholder alone on its line, or before a semicolon, is a block of styles.
            if let Some((index, end)) = placeholder(self.text, self.at) {
                let after = self.text[end..].trim_start_matches([' ', '\t']);
                if after.is_empty() || after.starts_with(['\n', '\r', ';', '}']) {
                    rules.push(Rule::Interpolation { index, at: self.at });
                    self.at = end;
                    continue;
                }
            }
            let start = self.at;
            let end = self.statement_end();
            let text = self.text[start..end].trim();
            if self.text[end..].starts_with('{') {
                self.at = end + 1;
                let inner = self.rules(true);
                rules.push(Rule::Block {
                    selector: text.to_owned(),
                    rules: inner,
                    text: self.text[start..self.at].to_owned(),
                    at: start,
                });
                continue;
            }
            self.at = end;
            rules.push(match split_declaration(text) {
                Some((property, value)) => Rule::Declaration { property, value, at: start },
                None => Rule::Unread { text: text.to_owned(), at: start },
            });
        }
        rules
    }

    /// Skips whitespace and comments, `//` ones included: styled-components and Emotion strip both.
    fn skip(&mut self) {
        loop {
            let rest = &self.text[self.at..];
            let trimmed = rest.trim_start();
            self.at += rest.len() - trimmed.len();
            if trimmed.starts_with("/*") {
                self.at = trimmed.find("*/").map_or(self.text.len(), |end| self.at + end + 2);
            } else if trimmed.starts_with("//") {
                self.at = trimmed.find('\n').map_or(self.text.len(), |end| self.at + end);
            } else {
                return;
            }
        }
    }

    /// Where the statement at `at` ends: its `;`, `{` or `}`, outside strings and parentheses.
    fn statement_end(&self) -> usize {
        let mut quote = None;
        let mut escaped = false;
        let mut depth = 0usize;
        for (index, character) in self.text[self.at..].char_indices() {
            if let Some(open) = quote {
                if escaped {
                    escaped = false;
                } else if character == '\\' {
                    escaped = true;
                } else if character == open {
                    quote = None;
                }
                continue;
            }
            match character {
                '"' | '\'' => quote = Some(character),
                '(' => depth += 1,
                ')' => depth = depth.saturating_sub(1),
                ';' | '{' | '}' if depth == 0 => return self.at + index,
                _ => {}
            }
        }
        self.text.len()
    }
}

/// The placeholder at `at`: the expression's index and where the placeholder ends.
pub(crate) fn placeholder(text: &str, at: usize) -> Option<(usize, usize)> {
    let rest = text[at..].strip_prefix(OPEN)?;
    let (index, _) = rest.split_once(CLOSE).expect("written by `joined`");
    Some((index.parse().expect("an index"), at + OPEN.len_utf8() + index.len() + CLOSE.len_utf8()))
}

/// `property: value`, split at its first colon.
pub(crate) fn split_declaration(text: &str) -> Option<(String, String)> {
    let (property, value) = text.split_once(':')?;
    let property = property.trim();
    if property.is_empty() || property.contains(char::is_whitespace) {
        return None;
    }
    Some((property.to_owned(), value.trim().to_owned()))
}

/// `-webkit-line-clamp` as `WebkitLineClamp`, `background-color` as `backgroundColor`.
pub(crate) fn camel(property: &str) -> String {
    let lower = property.to_ascii_lowercase();
    let (prefix, rest) = match lower.strip_prefix("-ms-") {
        Some(rest) => ("ms-", rest),
        None => ("", lower.strip_prefix('-').unwrap_or(&lower)),
    };
    let mut out = String::new();
    let mut upper = lower.starts_with('-') && prefix.is_empty();
    for character in prefix.chars().chain(rest.chars()) {
        if character == '-' {
            upper = true;
        } else if upper {
            out.push(character.to_ascii_uppercase());
            upper = false;
        } else {
            out.push(character);
        }
    }
    out
}

/// A JavaScript string literal holding `text`.
pub(crate) fn js_string(text: &str) -> String {
    let mut out = String::from("\"");
    for character in text.chars() {
        match character {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            other => out.push(other),
        }
    }
    out.push('"');
    out
}

/// Whether `text` is a plain number, as CSS writes one.
pub(crate) fn is_number(text: &str) -> bool {
    !text.is_empty()
        && text.chars().any(|character| character.is_ascii_digit())
        && text.chars().all(|character| character.is_ascii_digit() || character == '.' || character == '-')
        && text.parse::<f64>().is_ok()
}

/// Runs of whitespace as one space, so a comment or a value written over lines fits on one.
pub(crate) fn one_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// A style as it is written out: properties with their conditions, the blocks of a pseudo-element
/// or a `select` target, and what was not migrated, as comments.
#[derive(Default)]
pub(crate) struct Tree {
    pub(crate) entries: Vec<(String, String, Piece)>,
    pub(crate) blocks: Vec<(String, Tree)>,
    pub(crate) comments: Vec<String>,
}

impl Tree {
    pub(crate) fn is_empty(&self) -> bool {
        self.entries.is_empty() && self.blocks.is_empty() && self.comments.is_empty()
    }

    /// The block under `keys`, made when it is not there yet.
    pub(crate) fn at(&mut self, keys: &[String]) -> &mut Tree {
        let Some((first, rest)) = keys.split_first() else { return self };
        let index = self.blocks.iter().position(|(key, _)| key == first).unwrap_or_else(|| {
            self.blocks.push((first.clone(), Tree::default()));
            self.blocks.len() - 1
        });
        self.blocks[index].1.at(rest)
    }

    /// The style as an object literal: over lines indented by `indent` when `indent` is given, else
    /// on one line, without comments.
    pub(crate) fn render(&self, indent: Option<&str>) -> String {
        let mut items = Vec::new();
        for (_, key, piece) in &self.entries {
            let mut value = String::new();
            piece.render(&mut value);
            items.push(format!("{key}: {value}"));
        }
        for (key, block) in &self.blocks {
            let inner = indent.map(|indent| format!("{indent}  "));
            items.push(format!("{key}: {}", block.render(inner.as_deref())));
        }
        // Only a static style holds comments, and only a static style is written over lines.
        let Some(indent) = indent else { return format!("{{ {} }}", items.join(", ")) };
        let mut out = String::from("{\n");
        for item in &items {
            out.push_str(&format!("{indent}  {item},\n"));
        }
        for comment in &self.comments {
            out.push_str(&format!("{indent}  /* not migrated: {} */\n", comment.replace("*/", "*\\/")));
        }
        out.push_str(indent);
        out.push('}');
        out
    }
}

/// Splits a selector list at its top-level commas.
pub(crate) fn split_selectors(selector: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut depth = 0usize;
    let mut start = 0;
    for (index, character) in selector.char_indices() {
        match character {
            '(' | '[' => depth += 1,
            ')' | ']' => depth = depth.saturating_sub(1),
            ',' if depth == 0 => {
                out.push(selector[start..index].trim().to_owned());
                start = index + 1;
            }
            _ => {}
        }
    }
    out.push(selector[start..].trim().to_owned());
    out
}

/// `:before` and the other pseudo-elements CSS 2 wrote with one colon, with two.
pub(crate) fn legacy_pseudo_element(compound: &str) -> String {
    for name in [":before", ":after", ":first-line", ":first-letter"] {
        if let Some(at) = compound.find(name)
            && !compound[..at].ends_with(':')
        {
            return format!("{}:{}", &compound[..at], &compound[at..]);
        }
    }
    compound.to_owned()
}

/// `text` without its `/* … */` comments.
pub(crate) fn strip_comments(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find("/*") {
        out.push_str(&rest[..start]);
        rest = rest[start..].find("*/").map_or("", |end| &rest[start + end + 2..]);
    }
    out.push_str(rest);
    out
}
