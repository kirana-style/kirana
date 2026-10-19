//! Dense names (D-084): the condition and value hashes of finished class names replaced by short
//! codes assigned from the whole build, keeping everything the runtime merge reads.
//!
//! A D-037 name is `{prefix}{property}[-{target 3}][-{conditions 4}]_{value 4}`. Dense names keep the
//! prefix, the property code and the target segment, and replace the two 4-character hashes:
//!
//! - a condition hash becomes a code of 1 or 2 characters, never 3, so it is never mistaken for a
//!   target segment and never equal to a hash;
//! - a value hash becomes a code of 1 or 2 characters from one space shared by every key, because a
//!   runtime unfold builds a longhand's name from a shorthand atom's value segment (D-045).
//!
//! In a chunk, only names the compiler wrote are renamed: a dense build writes [`MARK`] before each
//! of them (`Names::written`), and renaming removes every mark. Text that only looks like a name — a
//! documentation page quoting one — has no mark and stays as written. A stylesheet is the
//! compiler's alone and is renamed unmarked.
//!
//! Codes are assigned once and never change for the life of a [`DenseNames`]: a segment seen later is
//! appended after every earlier one. A segment with no code keeps its hash, which is longer than any
//! code, so a name that misses the map costs bytes and never meets another name.

use std::collections::BTreeMap;

use kirana_shared::base62;

/// Written before every name the compiler puts into a chunk in a dense build. Printable ASCII, so no
/// minifier escapes it, and never part of a class name, a string delimiter or a template.
pub const MARK: &str = "^~";

/// How many codes of at most two characters exist: 62 of one, 62² of two.
const CAPACITY: usize = 62 + 62 * 62;

/// The code at a rank, or `None` past [`CAPACITY`].
fn code(rank: usize) -> Option<String> {
    match rank {
        0..62 => Some(base62(rank as u64, 1)),
        62..CAPACITY => Some(base62((rank - 62) as u64, 2)),
        _ => None,
    }
}

/// Which hash segment a use counts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Segment {
    Condition,
    Value,
}

/// One replacement in a text: bytes `start..end` become `text`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Edit {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

/// The codes of one build.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DenseNames {
    conditions: BTreeMap<String, String>,
    values: BTreeMap<String, String>,
}

impl DenseNames {
    /// Assigns codes to the hashes in `uses` that have none yet: the most used first, ties in hash
    /// order, after every code already assigned. `uses` holds `(segment, hash, count)`; a hash may
    /// appear more than once and its counts add up.
    pub fn extend<'a>(&mut self, uses: impl IntoIterator<Item = (Segment, &'a str, usize)>) {
        let mut counts: BTreeMap<(Segment, &str), usize> = BTreeMap::new();
        for (segment, hash, count) in uses {
            *counts.entry((segment, hash)).or_default() += count;
        }
        for segment in [Segment::Condition, Segment::Value] {
            let map = match segment {
                Segment::Condition => &mut self.conditions,
                Segment::Value => &mut self.values,
            };
            let mut fresh: Vec<(&str, usize)> = counts
                .iter()
                .filter(|((kind, hash), _)| *kind == segment && !map.contains_key(*hash))
                .map(|((_, hash), count)| (*hash, *count))
                .collect();
            fresh.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
            for (hash, _) in fresh {
                let Some(code) = code(map.len()) else { break };
                map.insert(hash.to_owned(), code);
            }
        }
    }

    /// Whether no code has been assigned.
    pub fn is_empty(&self) -> bool {
        self.conditions.is_empty() && self.values.is_empty()
    }

    /// The edits that rename every Kirana name in `text` written with `prefix`; with `marked`, only
    /// the names after a [`MARK`], removing every mark.
    pub fn edits(&self, prefix: &str, text: &str, marked: bool) -> Vec<Edit> {
        let mut edits = Vec::new();
        for name in names(prefix, text, marked) {
            if let Some((start, end)) = name.mark {
                edits.push(Edit { start, end, text: String::new() });
            }
            if let Some((start, end)) = name.condition
                && let Some(code) = self.conditions.get(&text[start..end])
            {
                edits.push(Edit { start, end, text: code.clone() });
            }
            if let Some((start, end)) = name.value
                && let Some(code) = self.values.get(&text[start..end])
            {
                edits.push(Edit { start, end, text: code.clone() });
            }
        }
        edits
    }

    /// `text` with every Kirana name renamed (with `marked`, as [`DenseNames::edits`]).
    pub fn rename(&self, prefix: &str, text: &str, marked: bool) -> String {
        let mut out = String::with_capacity(text.len());
        let mut last = 0;
        for edit in self.edits(prefix, text, marked) {
            out.push_str(&text[last..edit.start]);
            out.push_str(&edit.text);
            last = edit.end;
        }
        out.push_str(&text[last..]);
        out
    }
}

/// Where a name's hash segments sit in a text, as byte ranges.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Name {
    /// The [`MARK`] before a marked name.
    pub mark: Option<(usize, usize)>,
    pub condition: Option<(usize, usize)>,
    pub value: Option<(usize, usize)>,
}

const fn alnum(byte: u8) -> bool {
    byte.is_ascii_alphanumeric()
}

/// A character that may continue a class name or a custom property's name.
const fn ident(byte: u8) -> bool {
    alnum(byte) || byte == b'_' || byte == b'-'
}

/// The end of the run of alphanumerics starting at `at`.
fn run(bytes: &[u8], at: usize) -> usize {
    bytes[at..].iter().position(|&byte| !alnum(byte)).map_or(bytes.len(), |length| at + length)
}

/// Every Kirana name in `text` and its hash segments. Recognised forms (D-037, D-045):
///
/// - `{prefix}{property}[-{target}][-{conditions}]_{value}`, an atom;
/// - the same without a value, an entry tombstone;
/// - `{prefix}{property}[-{target}]*_`, a property tombstone;
/// - `{prefix}{shorthand}/{codes}[-{target}](-{conditions}|*)_`, an unfold;
/// - `--{prefix}{property}[-{target}][-{conditions}]`, a bridged variable.
///
/// A segment counts by its length: 3 is a target, 4 a hash, and 1 or 2 a code already assigned.
///
/// With `marked`, only names right after a [`MARK`] count, and every mark followed by the prefix
/// is reported, with empty segments when what follows is not a name (a relation marker).
pub fn names(prefix: &str, text: &str, marked: bool) -> Vec<Name> {
    if marked {
        return marked_names(prefix, text);
    }
    let bytes = text.as_bytes();
    let mut found = Vec::new();
    let mut from = 0;
    while let Some(offset) = text[from..].find(prefix) {
        let start = from + offset;
        from = start + 1;
        let bridged = match start.checked_sub(1).map(|at| bytes[at]) {
            None => false,
            Some(b'-') => {
                if start < 2 || bytes[start - 2] != b'-' || (start > 2 && ident(bytes[start - 3])) {
                    continue;
                }
                true
            }
            Some(byte) if ident(byte) => continue,
            Some(_) => false,
        };
        if let Some((name, end)) = parse(bytes, start + prefix.len(), bridged) {
            found.push(name);
            from = end;
        }
    }
    found
}

fn marked_names(prefix: &str, text: &str) -> Vec<Name> {
    let bytes = text.as_bytes();
    let mut found = Vec::new();
    let mut from = 0;
    while let Some(offset) = text[from..].find(MARK) {
        let mark = from + offset;
        let mut at = mark + MARK.len();
        from = at;
        let bridged = text[at..].starts_with("--");
        if bridged {
            at += 2;
        }
        if !text[at..].starts_with(prefix) {
            continue;
        }
        let parsed = parse(bytes, at + prefix.len(), bridged);
        let (name, end) = parsed.unwrap_or((Name { mark: None, condition: None, value: None }, at));
        found.push(Name { mark: Some((mark, mark + MARK.len())), ..name });
        from = end;
    }
    found
}

/// Parses one name after its prefix; returns its segments and where it ends.
fn parse(bytes: &[u8], at: usize, bridged: bool) -> Option<(Name, usize)> {
    let mut at = at;
    let property_end = run(bytes, at);
    if property_end == at {
        return None;
    }
    at = property_end;
    let unfold = !bridged && bytes.get(at) == Some(&b'/');
    if unfold {
        at += 1;
        let codes_start = at;
        while at < bytes.len() && (alnum(bytes[at]) || bytes[at] == b'.') {
            at += 1;
        }
        if at == codes_start {
            return None;
        }
    }
    // Up to two segments: a target (3), then conditions (a hash of 4, or a code of 1 or 2).
    let mut condition = None;
    let mut target = false;
    while bytes.get(at) == Some(&b'-') {
        let end = run(bytes, at + 1);
        match end - at - 1 {
            3 if !target && condition.is_none() => target = true,
            1 | 2 | 4 if condition.is_none() => condition = Some((at + 1, end)),
            _ => return None,
        }
        at = end;
    }
    let boundary = |at: usize| bytes.get(at).is_none_or(|&byte| !ident(byte));
    if bridged {
        return boundary(at).then_some((Name { mark: None, condition, value: None }, at));
    }
    if bytes.get(at) == Some(&b'*') {
        // A property tombstone carries no conditions; an unfold's `*` stands for all of them.
        if condition.is_some() {
            return None;
        }
        at += 1;
    } else if unfold && condition.is_none() {
        return None;
    }
    if bytes.get(at) != Some(&b'_') {
        return None;
    }
    at += 1;
    let value_end = run(bytes, at);
    let value = match value_end - at {
        0 => None,
        _ if unfold || bytes[at - 2] == b'*' => return None,
        1 | 2 | 4 => Some((at, value_end)),
        _ => return None,
    };
    boundary(value_end).then_some((Name { mark: None, condition, value }, value_end))
}

#[cfg(test)]
mod tests {
    use super::*;

    impl DenseNames {
        fn rename_plain(&self, prefix: &str, text: &str) -> String {
            self.rename(prefix, text, false)
        }
    }

    fn segments(text: &str) -> Vec<(Option<&str>, Option<&str>)> {
        names("k", text, false)
            .into_iter()
            .map(|name| (name.condition.map(|(a, b)| &text[a..b]), name.value.map(|(a, b)| &text[a..b])))
            .collect()
    }

    #[test]
    fn finds_every_form_and_its_hashes() {
        assert_eq!(segments("k50_D9ur"), [(None, Some("D9ur"))]);
        assert_eq!(segments(".k50-KFHz_D9ur:where(:hover){color:red}"), [(Some("KFHz"), Some("D9ur"))]);
        assert_eq!(segments("k87-abc-dKOL_ufrO"), [(Some("dKOL"), Some("ufrO"))]);
        assert_eq!(segments("k87-abc_ufrO"), [(None, Some("ufrO"))]);
        assert_eq!(segments("k50-KFHz_ k50_"), [(Some("KFHz"), None), (None, None)]);
        assert_eq!(segments("k50*_ k50-abc*_"), [(None, None), (None, None)]);
        assert_eq!(segments("k0/1.2.3*_ k0/1.2-abc-KFHz_"), [(None, None), (Some("KFHz"), None)]);
        assert_eq!(segments("var(--k50-KFHz) --k50:1"), [(Some("KFHz"), None), (None, None)]);
        assert_eq!(segments("`kk_YYql kk-6i4r_7J6Q`"), [(None, Some("YYql")), (Some("6i4r"), Some("7J6Q"))]);
    }

    #[test]
    fn ignores_what_is_not_a_name() {
        for text in [
            "kr1AbC2",      // a relation marker: no `_`
            "--kvAbCd",     // a variable token: nothing to rename, so no segments
            "ok50_D9ur",    // inside a word
            "k50_D9urx",    // a value of 5
            "k50-abcde_x",  // a segment of 5
            "k50-ab-cd_x",  // two condition segments
            "k50-KFHz*_",   // a property tombstone with conditions
            "k0/_",         // an unfold with no codes
            "k0/1.2_",      // an unfold with no scope
            "k0/1.2*_D9ur", // an unfold with a value
            "k50*_D9ur",    // a property tombstone with a value
            "k_",           // no property
            "a-k50-KFHz",   // a single dash before the prefix
            "x--k50-KFHz",  // a custom property inside a longer word
            "k50-KFHz_D9ur-x",
        ] {
            assert!(
                names("k", text, false).iter().all(|n| *n == Name { mark: None, condition: None, value: None }),
                "{text}"
            );
        }
    }

    #[test]
    fn codes_follow_use_then_hash_and_never_change() {
        let mut dense = DenseNames::default();
        dense.extend([(Segment::Value, "AAAA", 1), (Segment::Value, "BBBB", 3), (Segment::Value, "CCCC", 1)]);
        dense.extend([(Segment::Condition, "KFHz", 2), (Segment::Value, "AAAA", 9)]);
        assert_eq!(dense.rename_plain("k", "k1_BBBB k1_AAAA k1_CCCC k1-KFHz_AAAA"), "k1_0 k1_1 k1_2 k1-0_1");
        // A later use, however frequent, takes the next code.
        dense.extend([(Segment::Value, "DDDD", 100)]);
        assert_eq!(dense.rename_plain("k", "k1_DDDD k1_BBBB"), "k1_3 k1_0");
        assert!(!dense.is_empty());
        assert!(DenseNames::default().is_empty());
    }

    #[test]
    fn renames_tombstones_unfolds_and_bridges_with_their_key() {
        let mut dense = DenseNames::default();
        dense.extend([(Segment::Condition, "KFHz", 1), (Segment::Value, "D9ur", 1)]);
        let text = ".k50-KFHz_D9ur{} k50-KFHz_ k0/1.2-abc-KFHz_ var(--k50-KFHz) k50_xxxx";
        assert_eq!(dense.rename_plain("k", text), ".k50-0_0{} k50-0_ k0/1.2-abc-0_ var(--k50-0) k50_xxxx");
    }

    #[test]
    fn a_renamed_name_still_parses_and_is_left_alone() {
        let mut dense = DenseNames::default();
        dense.extend([(Segment::Condition, "KFHz", 1), (Segment::Value, "D9ur", 1)]);
        let once = dense.rename_plain("k", "k50-KFHz_D9ur");
        assert_eq!(segments(&once), [(Some("0"), Some("0"))]);
        assert_eq!(dense.rename_plain("k", &once), once);
    }

    #[test]
    fn codes_have_one_or_two_characters_until_they_run_out() {
        assert_eq!(code(0).as_deref(), Some("0"));
        assert_eq!(code(61).as_deref(), Some("Z"));
        assert_eq!(code(62).as_deref(), Some("00"));
        assert_eq!(code(CAPACITY - 1).as_deref(), Some("ZZ"));
        assert_eq!(code(CAPACITY), None);
        let hashes: Vec<String> = (0..CAPACITY + 1).map(|i| format!("{i:04}")).collect();
        let mut dense = DenseNames::default();
        dense.extend(hashes.iter().map(|hash| (Segment::Value, hash.as_str(), 1)));
        // The one past capacity keeps its hash.
        assert_eq!(dense.rename_plain("k", &format!("k1_{}", hashes[CAPACITY])), format!("k1_{}", hashes[CAPACITY]));
    }

    #[test]
    fn in_a_chunk_only_marked_names_are_renamed_and_every_mark_goes() {
        let mut dense = DenseNames::default();
        dense.extend([(Segment::Condition, "KFHz", 1), (Segment::Value, "D9ur", 1)]);
        let chunk = r#"a("^~k50-KFHz_D9ur ^~krAbc12 ^~k50*_"), b(".k50-KFHz_D9ur{}"), c("^~--k50-KFHz", 1), d("^~x")"#;
        assert_eq!(
            dense.rename("k", chunk, true),
            r#"a("k50-0_0 krAbc12 k50*_"), b(".k50-KFHz_D9ur{}"), c("--k50-0", 1), d("^~x")"#
        );
        let marks: Vec<_> = names("k", chunk, true).into_iter().map(|name| name.mark.is_some()).collect();
        assert_eq!(marks, [true, true, true, true]);
    }

    #[test]
    fn other_prefixes() {
        let mut dense = DenseNames::default();
        dense.extend([(Segment::Value, "D9ur", 1)]);
        assert_eq!(dense.rename_plain("app", "app50_D9ur k50_D9ur"), "app50_0 k50_D9ur");
    }
}
