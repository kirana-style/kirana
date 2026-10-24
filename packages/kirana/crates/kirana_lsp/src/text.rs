//! Text plumbing: LSP positions (UTF-16 by default) against the engine's UTF-8 byte offsets, file
//! URIs against paths, and what the cursor is on.

use std::path::{Path, PathBuf};
use std::str::FromStr;

use lsp_types::{Position, Range, Uri};

/// Line starts of one text, for offset ↔ position conversion.
pub struct LineIndex<'t> {
    text: &'t str,
    starts: Vec<usize>,
}

impl<'t> LineIndex<'t> {
    pub fn new(text: &'t str) -> Self {
        let mut starts = vec![0];
        starts.extend(text.match_indices('\n').map(|(index, _)| index + 1));
        Self { text, starts }
    }

    /// The position of a byte offset; an offset inside a character or past the end is clamped.
    pub fn position(&self, offset: usize) -> Position {
        let offset = offset.min(self.text.len());
        let line = self.starts.partition_point(|start| *start <= offset) - 1;
        let start = self.starts[line];
        let character = self.text[start..floor_char_boundary(self.text, offset)].encode_utf16().count();
        Position::new(line as u32, character as u32)
    }

    /// The byte offset of a position; one past a line's end is clamped to the line's end.
    pub fn offset(&self, position: Position) -> usize {
        let Some(&start) = self.starts.get(position.line as usize) else { return self.text.len() };
        let end = self.starts.get(position.line as usize + 1).map_or(self.text.len(), |next| next - 1);
        let mut units = 0u32;
        for (index, character) in self.text[start..end].char_indices() {
            if units >= position.character {
                return start + index;
            }
            units += character.len_utf16() as u32;
        }
        end
    }

    pub fn range(&self, start: usize, end: usize) -> Range {
        Range::new(self.position(start), self.position(end))
    }
}

fn floor_char_boundary(text: &str, mut offset: usize) -> usize {
    while !text.is_char_boundary(offset) {
        offset -= 1;
    }
    offset
}

/// The path of a `file:` URI, percent-decoded; `None` for other schemes.
pub fn uri_to_path(uri: &Uri) -> Option<PathBuf> {
    let rest = uri.as_str().strip_prefix("file://")?;
    let bytes = rest.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let hex = |at: usize| bytes.get(at).and_then(|byte| (*byte as char).to_digit(16));
        match (bytes[index], hex(index + 1), hex(index + 2)) {
            (b'%', Some(high), Some(low)) => {
                decoded.push((high * 16 + low) as u8);
                index += 3;
            }
            (byte, ..) => {
                decoded.push(byte);
                index += 1;
            }
        }
    }
    let text = String::from_utf8(decoded).ok()?;
    // `file:///C:/app` names `C:/app` on Windows.
    let windows = text.len() > 2 && text.as_bytes()[2] == b':' && text.starts_with('/');
    Some(PathBuf::from(if windows { &text[1..] } else { &text }))
}

/// The `file:` URI of an absolute path.
pub fn path_to_uri(path: &Path) -> Uri {
    let text = path.to_string_lossy().replace('\\', "/");
    let mut encoded = String::from(if text.starts_with('/') { "file://" } else { "file:///" });
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric() || b"-._~/:".contains(&byte) {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    Uri::from_str(&encoded).expect("an encoded file URI parses")
}

/// The member chain under the cursor (`color.brand.500`, `card.within`), with its byte range. Any
/// byte offset is accepted: one inside a multi-byte character (`—`) reads from its start.
pub fn chain_at(text: &str, offset: usize) -> Option<(&str, usize, usize)> {
    let is_part = |byte: u8| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$' || byte == b'.';
    let bytes = text.as_bytes();
    let offset = floor_char_boundary(text, offset.min(bytes.len()));
    let mut start = offset;
    while start > 0 && is_part(bytes[start - 1]) {
        start -= 1;
    }
    let mut end = offset.min(bytes.len());
    while end < bytes.len() && is_part(bytes[end]) {
        end += 1;
    }
    let chain = text[start..end].trim_matches('.');
    let start = start + text[start..end].find(chain).unwrap_or(0);
    (!chain.is_empty() && !chain.as_bytes()[0].is_ascii_digit()).then_some((chain, start, start + chain.len()))
}

/// The string literal around the cursor on its line: `(content start, content end, quote)`.
pub fn string_at(text: &str, offset: usize) -> Option<(usize, usize, u8)> {
    let bytes = text.as_bytes();
    let offset = floor_char_boundary(text, offset.min(bytes.len()));
    let line_start = text[..offset].rfind('\n').map_or(0, |index| index + 1);
    let mut open: Option<(usize, u8)> = None;
    let mut index = line_start;
    while index < offset {
        let byte = bytes[index];
        match open {
            Some(_) if byte == b'\\' => index += 1,
            Some((_, quote)) if byte == quote => open = None,
            None if matches!(byte, b'"' | b'\'' | b'`') => open = Some((index + 1, byte)),
            _ => {}
        }
        index += 1;
    }
    let (start, quote) = open?;
    let mut end = offset;
    while end < bytes.len() && bytes[end] != quote && bytes[end] != b'\n' {
        end += if bytes[end] == b'\\' { 2 } else { 1 };
    }
    Some((start, end.min(bytes.len()), quote))
}

/// What a string at `start` (just after its opening quote) is in a style object.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Slot {
    /// A key: a property, a condition or a pseudo-element. `nested` is true inside a property's
    /// conditional value.
    Key { nested: bool },
    /// The value of a property (kebab-case), possibly inside its conditional value.
    Value { property: String },
    /// Neither (a call argument, JSX text).
    Other,
}

/// Classifies the string opened at `quote` by reading backwards: what comes before it, and the
/// enclosing keys.
pub fn slot_of(text: &str, quote: usize) -> Slot {
    let before = text[..quote].trim_end();
    match before.as_bytes().last() {
        Some(b'{' | b',' | b'[') => {
            let nested = enclosing_key(text, before.len()).is_some_and(|key| !is_structural(&key));
            Slot::Key { nested }
        }
        Some(b':') => {
            let key_end = before.len() - 1;
            let mut key = key_before(text, key_end);
            let mut from = key_end;
            // A condition's value belongs to the property whose value object holds it.
            while key.as_deref().is_some_and(is_condition) {
                match enclosing(text, from) {
                    Some((brace, outer)) => {
                        key = outer;
                        from = brace;
                    }
                    None => return Slot::Other,
                }
            }
            match key {
                Some(key) if !is_structural(&key) => Slot::Value { property: kirana_shared::kebab_case(&key) },
                _ => Slot::Other,
            }
        }
        _ => Slot::Other,
    }
}

/// A key that names a condition rather than a property.
fn is_condition(key: &str) -> bool {
    key == "base"
        || key.starts_with([':', '@', '['])
        || key.contains(".within(")
        || key.contains(".parent(")
        || key.contains(".after(")
}

/// A key that holds a style object (pseudo-element, `select.*`), not a property's value.
fn is_structural(key: &str) -> bool {
    key.starts_with("::") || key.starts_with("select.")
}

/// The key of the object enclosing `at`, if it is the value of one.
fn enclosing_key(text: &str, at: usize) -> Option<String> {
    enclosing(text, at).and_then(|(_, key)| key)
}

/// The unmatched `{` before `at`, and the key its object is the value of.
fn enclosing(text: &str, at: usize) -> Option<(usize, Option<String>)> {
    let bytes = text.as_bytes();
    let mut depth = 0usize;
    let mut index = at;
    while index > 0 {
        index -= 1;
        match bytes[index] {
            b'}' => depth += 1,
            b'{' if depth == 0 => {
                let before = text[..index].trim_end();
                let key = before.strip_suffix(':').and_then(|rest| key_before(text, rest.len()));
                return Some((index, key));
            }
            b'{' => depth -= 1,
            _ => {}
        }
    }
    None
}

/// The key written just before the colon at `colon` (`width`, `"width"`, `[":hover"]`,
/// `[card.within(":hover")]`).
fn key_before(text: &str, colon: usize) -> Option<String> {
    let before = text[..colon].trim_end();
    let bytes = before.as_bytes();
    match bytes.last()? {
        &quote @ (b'"' | b'\'') => {
            let quote = quote as char;
            let open = before[..before.len() - 1].rfind(quote)?;
            Some(before[open + 1..before.len() - 1].to_owned())
        }
        b']' => {
            let mut depth = 0usize;
            for (index, byte) in bytes.iter().enumerate().rev() {
                match byte {
                    b']' => depth += 1,
                    b'[' => {
                        depth -= 1;
                        if depth == 0 {
                            let inner = before[index + 1..before.len() - 1].trim();
                            return Some(inner.trim_matches(|c| c == '"' || c == '\'' || c == '`').to_owned());
                        }
                    }
                    _ => {}
                }
            }
            None
        }
        _ => {
            let start = before
                .rfind(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$'))
                .map_or(0, |index| index + 1);
            (start < before.len()).then(|| before[start..].to_owned())
        }
    }
}
