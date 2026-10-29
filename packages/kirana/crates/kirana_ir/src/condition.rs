//! Conditions and their normal form ([08](../../../../spec/08-conditions-and-cascade.md#condition-kinds)).

use std::cmp::Ordering;
use std::fmt;

use kirana_css_data::{is_pseudo_class, pseudo_class_rank};

/// How a relation reader is placed relative to the anchor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum RelationKind {
    /// The reader is a descendant of the anchor (`field.within`).
    Within,
    /// The reader is a child of the anchor (`field.parent`), as Tailwind's `*:` reads it.
    Parent,
    /// The reader is a later sibling of the anchor (`field.after`).
    After,
    /// The reader is an earlier sibling of the anchor (`field.before`).
    Before,
}

/// One condition under which a declaration applies.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Condition {
    /// `:hover`, `:nth-child(2n)`, `:has(> svg)`. The text includes the leading colon.
    Pseudo(String),
    /// `[data-state="open"]`, including brackets.
    Attribute(String),
    /// The query after `@media`.
    Media(String),
    /// `@container [name] query`.
    Container { name: Option<String>, query: String },
    /// The condition after `@supports`.
    Supports(String),
    /// A relation read: the anchor's marker class and the anchor's own state selectors.
    Relation { marker: String, kind: RelationKind, state: String },
}

/// The four condition classes of ladder step 3, weakest first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ConditionClass {
    AtRule,
    Relation,
    PseudoClass,
    Attribute,
}

/// Why a condition key was rejected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConditionError {
    pub key: String,
    pub reason: String,
}

impl fmt::Display for ConditionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{:?}: {}", self.key, self.reason)
    }
}

/// Collapses runs of whitespace to one space and trims.
pub fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

impl Condition {
    /// The class used by ladder step 3. A `parent()` read ranks with the pseudo-classes: it compiles
    /// to the selector on the element's parent that `:where(… > *)` writes, and replaces it (D-104).
    pub fn class(&self) -> ConditionClass {
        match self {
            Condition::Pseudo(_) => ConditionClass::PseudoClass,
            Condition::Attribute(_) => ConditionClass::Attribute,
            Condition::Relation { kind: RelationKind::Parent, .. } => ConditionClass::PseudoClass,
            Condition::Relation { .. } => ConditionClass::Relation,
            Condition::Media(_) | Condition::Container { .. } | Condition::Supports(_) => ConditionClass::AtRule,
        }
    }

    /// Canonical text: used for normal-form sorting, hashing and the final tie-break.
    pub fn canonical(&self) -> String {
        let mut canonical = String::new();
        self.push_canonical(&mut canonical);
        canonical
    }

    /// [`Condition::canonical`] written onto `out`, for a set's text built in one string.
    fn push_canonical(&self, out: &mut String) {
        use std::fmt::Write;
        // Writing to a `String` cannot fail.
        let _ = match self {
            Condition::Pseudo(text) | Condition::Attribute(text) => write!(out, "{text}"),
            Condition::Media(query) => write!(out, "@media {query}"),
            Condition::Container { name: Some(name), query } => write!(out, "@container {name} {query}"),
            Condition::Container { name: None, query } => write!(out, "@container {query}"),
            Condition::Supports(query) => write!(out, "@supports {query}"),
            Condition::Relation { marker, kind, state } => write!(out, "relation {kind:?} .{marker}{state}"),
        };
    }

    /// Whether this condition belongs in the rule's selector (not an at-rule wrapper).
    pub fn is_selector(&self) -> bool {
        !matches!(self.class(), ConditionClass::AtRule)
    }
}

/// Parses a string condition key into one or more conditions. Compound selector keys such as
/// `"[aria-haspopup]:active"` split into one condition per simple selector (D-038).
pub fn parse_condition_key(key: &str) -> Result<Vec<Condition>, ConditionError> {
    let error = |reason: &str| ConditionError { key: key.to_owned(), reason: reason.to_owned() };
    let trimmed = key.trim();
    if let Some(query) = trimmed.strip_prefix("@media") {
        let query = collapse_whitespace(query);
        return if query.is_empty() { Err(error("empty @media query")) } else { Ok(vec![Condition::Media(query)]) };
    }
    if let Some(rest) = trimmed.strip_prefix("@supports") {
        let query = collapse_whitespace(rest);
        return if query.is_empty() {
            Err(error("empty @supports condition"))
        } else {
            Ok(vec![Condition::Supports(query)])
        };
    }
    if let Some(rest) = trimmed.strip_prefix("@container") {
        let rest = collapse_whitespace(rest);
        if rest.is_empty() {
            return Err(error("empty @container query"));
        }
        return Ok(vec![match rest.split_once(' ') {
            Some((name, query)) if !name.starts_with('(') && !name.eq_ignore_ascii_case("not") => {
                Condition::Container { name: Some(name.to_owned()), query: query.to_owned() }
            }
            _ => Condition::Container { name: None, query: rest },
        }]);
    }
    if trimmed.starts_with('@') {
        return Err(error("only @media, @container and @supports conditions are supported"));
    }
    parse_simple_selectors(trimmed).map_err(|reason| ConditionError { key: key.to_owned(), reason })
}

/// Splits a compound selector made only of pseudo-classes and attribute selectors.
pub fn parse_simple_selectors(text: &str) -> Result<Vec<Condition>, String> {
    let bytes = text.as_bytes();
    let mut conditions = Vec::new();
    let mut index = 0;
    if bytes.is_empty() {
        return Err("empty condition".to_owned());
    }
    while index < bytes.len() {
        match bytes[index] {
            b'[' => {
                let end = find_closing(bytes, index, b'[', b']').ok_or("unclosed attribute selector")?;
                let inner = collapse_whitespace(&text[index + 1..end]);
                if inner.is_empty() {
                    return Err("empty attribute selector".to_owned());
                }
                conditions.push(Condition::Attribute(format!("[{inner}]")));
                index = end + 1;
            }
            b':' => {
                if bytes.get(index + 1) == Some(&b':') {
                    return Err("pseudo-elements are style keys, not conditions".to_owned());
                }
                let name_end = bytes[index + 1..]
                    .iter()
                    .position(|byte| !(byte.is_ascii_alphanumeric() || *byte == b'-'))
                    .map_or(bytes.len(), |offset| index + 1 + offset);
                let name = &text[index..name_end];
                if name.len() == 1 {
                    return Err("missing pseudo-class name".to_owned());
                }
                if !is_pseudo_class(&name.to_ascii_lowercase()) {
                    return Err(format!("{name} is not a pseudo-class"));
                }
                if bytes.get(name_end) == Some(&b'(') {
                    let end = find_closing(bytes, name_end, b'(', b')').ok_or("unclosed parenthesis")?;
                    let argument = collapse_whitespace(&text[name_end + 1..end]);
                    conditions.push(Condition::Pseudo(format!("{}({argument})", name.to_ascii_lowercase())));
                    index = end + 1;
                } else {
                    conditions.push(Condition::Pseudo(name.to_ascii_lowercase()));
                    index = name_end;
                }
            }
            _ => return Err("expected a pseudo-class, an attribute selector or an at-rule".to_owned()),
        }
    }
    Ok(conditions)
}

/// `svg`, `[data-slot="icon"]`, `span:last-child`, `a:hover`: an optional element name, then attribute
/// selectors and pseudo-classes — one compound selector, which the target itself matches (D-061).
pub fn is_contextual_target(selector: &str) -> bool {
    let selector = selector.trim();
    let name_end = selector.find(['[', ':']).unwrap_or(selector.len());
    let (name, rest) = selector.split_at(name_end);
    let name_ok = name.is_empty()
        || name.chars().next().is_some_and(|first| first.is_ascii_alphabetic())
            && name.chars().all(|character| character.is_ascii_alphanumeric() || character == '-');
    let rest_ok = rest.is_empty()
        || parse_simple_selectors(rest).is_ok_and(|conditions| {
            conditions.iter().all(|condition| matches!(condition, Condition::Attribute(_) | Condition::Pseudo(_)))
        });
    name_ok && rest_ok && !selector.is_empty()
}

fn find_closing(bytes: &[u8], open_index: usize, open: u8, close: u8) -> Option<usize> {
    let mut depth = 0usize;
    let mut quote: Option<u8> = None;
    for (index, byte) in bytes.iter().enumerate().skip(open_index) {
        match quote {
            Some(q) if *byte == q => quote = None,
            Some(_) => {}
            None if *byte == b'"' || *byte == b'\'' => quote = Some(*byte),
            None if *byte == open => depth += 1,
            None if *byte == close => {
                depth -= 1;
                if depth == 0 {
                    return Some(index);
                }
            }
            None => {}
        }
    }
    None
}

/// A sorted, deduplicated set of conditions: the normal form (`{md: {":hover"}}` equals
/// `{":hover": {md}}`).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Default)]
pub struct ConditionSet(Vec<Condition>);

impl ConditionSet {
    /// Builds the normal form.
    pub fn new(mut conditions: Vec<Condition>) -> Self {
        conditions.sort_by_cached_key(Condition::canonical);
        conditions.dedup();
        Self(conditions)
    }

    /// Adds conditions, keeping the normal form.
    #[must_use]
    pub fn with(&self, more: &[Condition]) -> Self {
        let mut all = self.0.clone();
        all.extend_from_slice(more);
        Self::new(all)
    }

    pub fn conditions(&self) -> &[Condition] {
        &self.0
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Canonical text of the whole set.
    pub fn canonical(&self) -> String {
        let mut canonical = String::new();
        for (index, condition) in self.0.iter().enumerate() {
            if index > 0 {
                canonical.push_str(" & ");
            }
            condition.push_canonical(&mut canonical);
        }
        canonical
    }
}

/// The within-class strength of ladder step 4, as a comparable pair.
fn within_class_rank(condition: &Condition) -> (u8, i64) {
    match condition {
        Condition::Pseudo(text) => {
            let name = text.split('(').next().unwrap_or(text);
            (pseudo_class_rank(name), 0)
        }
        Condition::Attribute(_) | Condition::Relation { .. } => (0, 0),
        Condition::Supports(_) => (0, 0),
        Condition::Media(query) => (1, query_rank(query)),
        Condition::Container { query, .. } => (2, query_rank(query)),
    }
}

/// Orders queries: non-width features above width queries; larger `min-width` wins; smaller
/// `max-width` wins. The result is scaled to 1/1000 px.
pub fn query_rank(query: &str) -> i64 {
    const WIDTH_BAND: i64 = 1_000_000_000;
    let lower = query.to_ascii_lowercase();
    let min = find_width(&lower, &["min-width:", "width>=", "width>"]);
    let max = find_width(&lower, &["max-width:", "width<=", "width<"]);
    match (min, max) {
        (Some(px), _) => (px * 1000.0) as i64,
        (None, Some(px)) => -(px * 1000.0) as i64,
        (None, None) => 2 * WIDTH_BAND,
    }
}

fn find_width(query: &str, needles: &[&str]) -> Option<f64> {
    let compact: String = query.chars().filter(|character| !character.is_whitespace()).collect();
    needles.iter().find_map(|needle| {
        let start = compact.find(needle)? + needle.len();
        let rest = &compact[start..];
        let rest = rest.strip_prefix('=').unwrap_or(rest);
        let number_end = rest.find(|character: char| !(character.is_ascii_digit() || character == '.'))?;
        let number: f64 = rest[..number_end].parse().ok()?;
        let unit = &rest[number_end..];
        Some(if unit.starts_with("rem") || unit.starts_with("em") { number * 16.0 } else { number })
    })
}

/// Ladder steps 2–4 for two condition sets (D-014). `Equal` means the sets tie up to the
/// deterministic tie-break.
pub fn compare_sets(a: &ConditionSet, b: &ConditionSet) -> Ordering {
    set_key(a).cmp(&set_key(b))
}

/// A condition set's position in ladder steps 2–4, as a value that sorts.
///
/// Sorting atoms compares these many times over, so the comparison is built once per set rather
/// than once per comparison: [`ladder_key`](crate::ladder_key) keeps one per atom.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct SetKey {
    size: usize,
    classes: Vec<ConditionClass>,
    ranks: Vec<(ConditionClass, (u8, i64))>,
}

pub fn set_key(set: &ConditionSet) -> SetKey {
    let mut ranks: Vec<(ConditionClass, (u8, i64))> =
        set.conditions().iter().map(|condition| (condition.class(), within_class_rank(condition))).collect();
    ranks.sort_by(|x, y| y.cmp(x));
    SetKey { size: set.len(), classes: ranks.iter().map(|rank| rank.0).collect(), ranks }
}

/// Whether two condition sets can never match the same element at the same time. Only provable
/// cases are recognised, on the element itself or on the same relation anchor: the same attribute
/// tested for two different values, a selector and its `:not()`, and two different positions
/// (`:first-child` / `:nth-child(2)`, `:last-child` / `:nth-last-child(2)`). `declared` adds what the
/// project says (`conditions.exclusive` and `conditions.exclusiveAcross`).
pub fn mutually_exclusive(a: &ConditionSet, b: &ConditionSet, declared: Declared<'_>) -> bool {
    a.conditions().iter().any(|x| {
        b.conditions().iter().any(|y| match (x, y) {
            (
                Condition::Relation { marker: marker_a, kind: kind_a, state: state_a },
                Condition::Relation { marker: marker_b, kind: kind_b, state: state_b },
            ) if marker_a == marker_b && kind_a == kind_b => {
                let (a, b) = (
                    parse_simple_selectors(state_a).unwrap_or_default(),
                    parse_simple_selectors(state_b).unwrap_or_default(),
                );
                a.iter().any(|left| b.iter().any(|right| simple_exclusive(left, right, declared)))
            }
            _ => simple_exclusive(x, y, declared),
        })
    })
}

/// Two conditions of one set that can never match together, so an entry under the set can never
/// apply (D-105): what [`mutually_exclusive`] proves of two sets, asked of each pair in one.
pub fn unreachable_pair(set: &ConditionSet, declared: Declared<'_>) -> Option<(String, String)> {
    let conditions = set.conditions();
    conditions.iter().enumerate().find_map(|(index, first)| {
        conditions[index + 1..].iter().find_map(|second| {
            let one = |condition: &Condition| ConditionSet::new(vec![condition.clone()]);
            mutually_exclusive(&one(first), &one(second), declared).then(|| (first.canonical(), second.canonical()))
        })
    })
}

/// What a project declares about conditions that never meet on one element, as condition text.
#[derive(Debug, Clone, Copy, Default)]
pub struct Declared<'a> {
    /// Groups no two of which match one element at the same time (`conditions.exclusive`).
    pub groups: &'a [Vec<String>],
    /// One vocabulary per library (`conditions.exclusiveAcross`, KF-015): a component is built on one
    /// library, so two conditions that no vocabulary holds together never meet.
    pub across: &'a [Vec<String>],
    /// Attributes the project's own components write (`conditions.ownAttributes`, KF-042): a key on
    /// one is the component's, not a vocabulary's, though a vocabulary names it too.
    pub own: &'a [String],
}

impl Declared<'_> {
    /// Whether the project declares `left` and `right` exclusive.
    fn exclusive(&self, left: &str, right: &str) -> bool {
        let own = |text: &str| attribute_name(text).is_some_and(|name| self.own.iter().any(|own| own == name));
        let named =
            |text: &str| !own(text) && self.across.iter().any(|vocabulary| vocabulary.iter().any(|key| key == text));
        self.groups.iter().any(|group| group.iter().any(|key| key == left) && group.iter().any(|key| key == right))
            || named(left)
                && named(right)
                && !self.across.iter().any(|vocabulary| {
                    vocabulary.iter().any(|key| key == left) && vocabulary.iter().any(|key| key == right)
                })
    }
}

/// Exclusivity of two simple conditions on one element.
fn simple_exclusive(x: &Condition, y: &Condition, declared: Declared<'_>) -> bool {
    let text = |condition: &Condition| match condition {
        Condition::Attribute(text) | Condition::Pseudo(text) => Some(text.clone()),
        _ => None,
    };
    let negates = |negation: &Condition, other: &Condition| match (negation, text(other)) {
        (Condition::Pseudo(pseudo), Some(other)) => {
            pseudo.strip_prefix(":not(").and_then(|rest| rest.strip_suffix(')')) == Some(other.as_str())
        }
        _ => false,
    };
    match (x, y) {
        (Condition::Attribute(left), Condition::Attribute(right)) if attributes_exclusive(left, right) => true,
        (Condition::Pseudo(left), Condition::Pseudo(right)) if matches!((position(left), position(right)), (Some(a), Some(b)) if a.0 == b.0 && a.1 != b.1) => {
            true
        }
        _ => {
            negates(x, y)
                || negates(y, x)
                || matches!((text(x), text(y)), (Some(left), Some(right)) if left != right
                    && declared.exclusive(&left, &right))
        }
    }
}

/// A fixed child position: whether it counts from the end, and the 1-based index.
fn position(pseudo: &str) -> Option<(bool, u32)> {
    match pseudo {
        ":first-child" => Some((false, 1)),
        ":last-child" => Some((true, 1)),
        _ => {
            let (from_end, argument) = pseudo
                .strip_prefix(":nth-child(")
                .map(|rest| (false, rest))
                .or_else(|| pseudo.strip_prefix(":nth-last-child(").map(|rest| (true, rest)))?;
            Some((from_end, argument.strip_suffix(')')?.parse().ok()?))
        }
    }
}

fn attributes_exclusive(left: &str, right: &str) -> bool {
    match (attribute_name_value(left), attribute_name_value(right)) {
        (Some((name_a, value_a)), Some((name_b, value_b))) => name_a == name_b && value_a != value_b,
        _ => false,
    }
}

/// Whether `name` is an attribute name as `conditions.ownAttributes` and `own()` take one:
/// `data-side`, lower case, digits and hyphens.
pub fn is_attribute_name(name: &str) -> bool {
    name.starts_with(|first: char| first.is_ascii_lowercase())
        && name.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

/// The attribute an attribute selector tests: `data-side` for `[data-side="left"]` or `[data-side]`.
fn attribute_name(selector: &str) -> Option<&str> {
    let inner = selector.strip_prefix('[')?;
    let end = inner.find(['=', '~', '|', '^', '$', '*', ']']).unwrap_or(inner.len());
    Some(inner[..end].trim())
}

fn attribute_name_value(selector: &str) -> Option<(&str, &str)> {
    let inner = &selector[1..selector.len() - 1];
    let (name, value) = inner.split_once('=')?;
    if name.ends_with(['~', '|', '^', '$', '*']) {
        return None;
    }
    Some((name.trim(), value.trim().trim_matches(['"', '\''])))
}
