//! Atoms, handles and merge semantics ([08](../../../../spec/08-conditions-and-cascade.md#merge-semantics)).

use std::cmp::Ordering;
use std::sync::Arc;

use kirana_css_data::{PropertyRank, is_logical, property_index};
use kirana_shared::{base62, hash_parts, push_base62, push_base62_compact};

use crate::condition::{Condition, ConditionSet, compare_sets};
use crate::defs::Dep;
use crate::value::{Key, TokenRef};

/// What an atom styles.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Target {
    /// The element carrying the class.
    Element,
    /// A pseudo-element of it, such as `::after`.
    PseudoElement(String),
    /// A descendant (`select.descendant`) or child (`select.child`) matching a selector.
    Contextual { child: bool, selector: String, pseudo_element: Option<String> },
}

impl Target {
    /// Contextual styles live in their own, lower layer (D-016).
    pub fn is_contextual(&self) -> bool {
        matches!(self, Target::Contextual { .. })
    }
}

/// A longhand property (or a flagged unsplittable shorthand).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Property {
    /// Kebab-case name, or `--custom`.
    pub name: String,
    pub rank: PropertyRank,
}

impl Property {
    /// A longhand or custom property.
    pub fn longhand(name: impl Into<String>) -> Self {
        let name = name.into();
        let rank = if is_logical(&name) { PropertyRank::Logical } else { PropertyRank::Physical };
        Self { name, rank }
    }

    /// A shorthand atom, which covers every longhand of the shorthand (D-045).
    pub fn shorthand(name: impl Into<String>) -> Self {
        Self { name: name.into(), rank: PropertyRank::Shorthand }
    }

    /// The property code of a class name (D-037): the base-62 index of a known property, or a
    /// five-character hash of a custom property.
    pub fn code(&self) -> String {
        let mut code = String::new();
        self.push_code(&mut code);
        code
    }

    /// [`Property::code`] written onto `out`: class names are built in one string.
    fn push_code(&self, out: &mut String) {
        match property_index(&self.name) {
            Some(index) if !self.name.starts_with("--") => push_base62_compact(out, index as u64),
            _ => push_base62(out, hash_parts(&[&self.name]), 5),
        }
    }
}

/// The characters of hash a definition name carries (a relation marker, a token variable, a theme
/// class or a keyframes name).
///
/// Four, not five: these names repeat through the stylesheet often enough to be worth a byte each,
/// and the registry reports a collision (KRN1903) rather than letting two definitions share a name
/// silently. Anything that reads a name back out of CSS text counts these characters, so the width
/// lives here rather than at each site.
pub const NAME_HASH: usize = 4;

/// The identity that merging replaces by: target, property and condition set.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct EntryKey {
    pub target: Target,
    pub property: Property,
    pub conditions: ConditionSet,
    /// How the entry was written; no part of its identity.
    pub written: Written,
}

/// How an entry was written (KF-027), for `export --definitions`: the keys down to it and its value
/// as the source spells it. Merging, naming and the cascade never read it, so it takes no part in
/// equality or hashing, and an entry the evaluator did not write (a test's, an unfold's copy) has
/// none of its own.
#[derive(Debug, Clone, Default)]
pub struct Written(pub Option<Arc<WrittenEntry>>);

impl PartialEq for Written {
    fn eq(&self, _: &Self) -> bool {
        true
    }
}

impl Eq for Written {}

impl std::hash::Hash for Written {
    fn hash<H: std::hash::Hasher>(&self, _: &mut H) {}
}

/// The object keys from the top of a style object down to an entry's value, and that value.
#[derive(Debug, Clone)]
pub struct WrittenEntry {
    /// As written: `["color", ":hover"]`, a computed key as its condition, target or token.
    pub path: Vec<Key>,
    /// `None` for a removal, a value only known at runtime, or a named rule (`keyframes()`).
    pub value: Option<WrittenValue>,
}

/// A value as the source spells it, before it is compiled.
#[derive(Debug, Clone)]
pub enum WrittenValue {
    Number(f64),
    Str(Arc<str>),
    /// A token, variable or not.
    Token(Arc<TokenRef>),
    /// A template literal that reads tokens: its text and tokens in order.
    Template(Vec<WrittenValue>),
    /// `firstThatWorks(...)`, preferred first.
    Fallbacks(Vec<WrittenValue>),
}

impl WrittenValue {
    /// The tokens the value reads, in order, each once.
    pub fn tokens(&self) -> Vec<&TokenRef> {
        let mut out: Vec<&TokenRef> = Vec::new();
        self.collect_tokens(&mut out);
        out
    }

    fn collect_tokens<'v>(&'v self, out: &mut Vec<&'v TokenRef>) {
        match self {
            WrittenValue::Token(token) => {
                if !out.iter().any(|seen| seen.identity == token.identity) {
                    out.push(token);
                }
            }
            WrittenValue::Template(parts) | WrittenValue::Fallbacks(parts) => {
                parts.iter().for_each(|part| part.collect_tokens(out));
            }
            WrittenValue::Number(_) | WrittenValue::Str(_) => {}
        }
    }
}

impl EntryKey {
    /// An entry key with no record of how it was written.
    pub fn new(target: Target, property: Property, conditions: ConditionSet) -> Self {
        Self { target, property, conditions, written: Written::default() }
    }

    /// The conflict-key segment of a class name: property code, then `-` + a 3-character target
    /// hash when the target is not the element, then `-` + a 4-character condition hash.
    pub fn segment(&self) -> String {
        let mut segment = String::new();
        self.push_segment(&mut segment);
        segment
    }

    fn push_segment(&self, out: &mut String) {
        self.property.push_code(out);
        push_target_segment(out, &self.target);
        push_condition_segment(out, &self.conditions);
    }
}

/// `-` + a 3-character hash of a target other than the element.
fn push_target_segment(out: &mut String, target: &Target) {
    let hash = match target {
        Target::Element => return,
        Target::PseudoElement(name) => hash_parts(&[name]),
        Target::Contextual { child, selector, pseudo_element } => hash_parts(&[&format!(
            "{}{selector}{}",
            if *child { "> " } else { "  " },
            pseudo_element.as_deref().unwrap_or("")
        )]),
    };
    out.push('-');
    push_base62(out, hash, 3);
}

/// `-` + a 4-character hash of a condition set that is not empty.
fn push_condition_segment(out: &mut String, conditions: &ConditionSet) {
    if !conditions.is_empty() {
        out.push('-');
        push_base62(out, hash_parts(&[&conditions.canonical()]), 4);
    }
}

/// The CSS value of one entry.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AtomValue {
    /// Normalized CSS text.
    pub css: String,
    /// Tokens, keyframes and themes this value needs in the stylesheet.
    pub deps: Vec<Dep>,
    /// How many longhands the authored declaration set (1 for a longhand, 4 for `padding`).
    /// Ladder step 5: a declaration that sets fewer longhands wins.
    pub longhands: u8,
}

impl AtomValue {
    /// A value written as a longhand.
    pub fn longhand(css: impl Into<String>) -> Self {
        Self { css: css.into(), deps: Vec::new(), longhands: 1 }
    }
}

/// Separates the members of a `firstThatWorks` run inside one CSS text (KRN-API-017). A record
/// separator cannot appear in a CSS value unescaped, so the joined text stays one value for hashing,
/// merging and deduplication, and only the writer and the inspector split it.
pub const FALLBACK_SEPARATOR: char = '\u{1e}';

/// The members of a value, preferred first: one member unless it is a `firstThatWorks` run.
pub fn fallback_values(css: &str) -> std::str::Split<'_, char> {
    css.split(FALLBACK_SEPARATOR)
}

/// A value as the author wrote it: a `firstThatWorks` run reads back as the call, for hover,
/// `kirana-style trace` and `kirana-style analyze`.
pub fn readable_value(css: &str) -> String {
    if css.contains(FALLBACK_SEPARATOR) {
        format!("firstThatWorks({})", fallback_values(css).collect::<Vec<_>>().join(", "))
    } else {
        css.to_owned()
    }
}

/// One operation in a handle, in merge order.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Op {
    /// Sets one entry.
    Set(EntryKey, AtomValue),
    /// Removes one entry (`{ [condition]: null }` or `{ base: null }`).
    Remove(EntryKey),
    /// Removes every entry of a property on a target (`prop: null`, `"*": null`).
    RemoveProperty(Target, Property),
    /// Replaces earlier shorthand atoms of `shorthand` on `target` by atoms of the longhands in
    /// `keep`, with the shorthand's value (D-045). `conditions` is `None` for every condition set.
    /// A write that removes or partly overrides some of a shorthand's longhands emits it first, so
    /// the remaining longhands keep the value they had.
    Unfold { target: Target, shorthand: Property, keep: Vec<Property>, conditions: Option<ConditionSet> },
}

/// A compiled style handle: the merge table of one or more styles, plus marker classes.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Default)]
pub struct Handle {
    pub ops: Vec<Op>,
    /// Marker classes (relation anchors, themes, modes) in first-applied order.
    pub markers: Vec<String>,
    /// Stylesheet items needed by the markers (themes, mode rules).
    pub marker_deps: Vec<Dep>,
    /// Attributes the component writes itself (`own()`, KF-044): in a style built on this handle, a
    /// key on one is the component's, as `conditions.ownAttributes` makes it for the whole project.
    pub own: Vec<String>,
}

impl Handle {
    /// Applies `later` on top of `self` with the rules of KRN-CAS-004.
    pub fn merge(&mut self, later: &Handle) {
        if self.ops.is_empty() {
            // A handle's operations are already merged: applied one by one to nothing, they give
            // themselves back.
            self.ops.clone_from(&later.ops);
        } else {
            for op in &later.ops {
                self.apply(op.clone());
            }
        }
        self.merge_markers(later);
    }

    /// [`Handle::merge`] of a handle no longer needed: its operations move instead of being copied,
    /// which is what building a style does with each declaration's handle.
    pub fn absorb(&mut self, later: Handle) {
        if self.ops.is_empty() {
            self.ops = later.ops;
        } else {
            for op in later.ops {
                self.apply(op);
            }
        }
        self.merge_markers(&Handle { ops: Vec::new(), ..later });
    }

    fn merge_markers(&mut self, later: &Handle) {
        for marker in &later.markers {
            if !self.markers.contains(marker) {
                self.markers.push(marker.clone());
            }
        }
        for dep in &later.marker_deps {
            if !self.marker_deps.contains(dep) {
                self.marker_deps.push(dep.clone());
            }
        }
        for attribute in &later.own {
            if !self.own.contains(attribute) {
                self.own.push(attribute.clone());
            }
        }
    }

    /// Applies one operation, keeping at most one op per entry key. The private runtime performs the
    /// same steps on class strings ([09](../../../../spec/09-dynamic-styles.md#private-runtime)).
    pub fn apply(&mut self, op: Op) {
        match &op {
            Op::Set(key, _) | Op::Remove(key) => {
                // A box family atom, or its tombstone, also replaces its longhands, which its code
                // locates (D-045).
                let family = match key.property.rank {
                    PropertyRank::Shorthand => {
                        kirana_css_data::family_longhands(&key.property.name).unwrap_or_default()
                    }
                    _ => &[],
                };
                self.ops.retain(|existing| match existing {
                    Op::Set(other, _) | Op::Remove(other) => {
                        other != key
                            && !(other.target == key.target
                                && other.conditions == key.conditions
                                && family.contains(&other.property.name.as_str()))
                    }
                    _ => true,
                });
            }
            Op::RemoveProperty(target, property) => {
                self.ops.retain(|existing| match existing {
                    Op::Set(key, _) | Op::Remove(key) => !(key.target == *target && key.property == *property),
                    Op::RemoveProperty(existing_target, existing_property) => {
                        !(existing_target == target && existing_property == property)
                    }
                    Op::Unfold { .. } => true,
                });
            }
            Op::Unfold { target, shorthand, keep, conditions } => {
                // The longhands take the atom's place, so the op order stays the order the values
                // were written in.
                let earlier = std::mem::take(&mut self.ops);
                for (index, existing) in earlier.iter().enumerate() {
                    match existing {
                        Op::Set(key, value)
                            if key.target == *target
                                && key.property == *shorthand
                                && conditions.as_ref().is_none_or(|conditions| key.conditions == *conditions) =>
                        {
                            for longhand in keep {
                                let longhand_key = EntryKey { property: longhand.clone(), ..key.clone() };
                                let at = |other: &Op| matches!(other, Op::Set(other, _) | Op::Remove(other) if *other == longhand_key);
                                // A longhand entry after the atom was written after it and keeps its
                                // value. One before it is the atom's own tombstone, or a value a
                                // broader atom written earlier unfolded into, which this atom overrides.
                                if !earlier[index + 1..].iter().any(at) {
                                    self.ops.retain(|other| !at(other));
                                    self.ops.push(Op::Set(longhand_key.clone(), value.clone()));
                                }
                            }
                        }
                        _ => self.ops.push(existing.clone()),
                    }
                }
                self.ops.retain(|existing| *existing != op);
            }
        }
        self.ops.push(op);
    }

    /// The entries that set values, in order.
    pub fn entries(&self) -> impl Iterator<Item = (&EntryKey, &AtomValue)> {
        self.ops.iter().filter_map(|op| match op {
            Op::Set(key, value) => Some((key, value)),
            _ => None,
        })
    }

    /// Records how every entry the handle sets or removes was written.
    pub fn stamp(&mut self, written: &Written) {
        for op in &mut self.ops {
            if let Op::Set(key, _) | Op::Remove(key) = op {
                key.written = written.clone();
            }
        }
    }

    /// Whether the handle has no operations and no markers.
    pub fn is_empty(&self) -> bool {
        self.ops.is_empty() && self.markers.is_empty()
    }
}

/// Class-name rules for one build.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Names {
    pub prefix: String,
    /// A dense build (D-084): [`Names::written`] marks every name the compiler writes into code.
    pub mark: bool,
}

impl Default for Names {
    fn default() -> Self {
        Self { prefix: "k".to_owned(), mark: false }
    }
}

impl Names {
    /// Names as the compiler writes them into code: `text` is a class string or a bridged
    /// variable. In a dense build every name in it gets [`crate::dense::MARK`], so that renaming
    /// touches what the compiler wrote and nothing else.
    pub fn written(&self, text: &str) -> String {
        if !self.mark {
            return text.to_owned();
        }
        let variable = format!("--{}", self.prefix);
        text.split(' ')
            .map(|token| {
                if token.starts_with(&self.prefix) || token.starts_with(&variable) {
                    format!("{}{token}", crate::dense::MARK)
                } else {
                    token.to_owned()
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// `{prefix}{key}_{value}` for a set entry; `{prefix}{key}_` (a tombstone) for a removal;
    /// `{prefix}{property segment}*_` for a property removal;
    /// `{prefix}{shorthand code}/{kept codes joined by .}{target}{-conditions | *}_` for an unfold.
    pub fn class(&self, op: &Op) -> String {
        let mut class = String::with_capacity(self.prefix.len() + 12);
        self.push_class(&mut class, op);
        class
    }

    /// [`Names::class`] written onto `out`. Every class of a project is built here, so it builds the
    /// name in place rather than from a string per segment.
    fn push_class(&self, out: &mut String, op: &Op) {
        out.push_str(&self.prefix);
        match op {
            Op::Set(key, value) => {
                key.push_segment(out);
                out.push('_');
                push_value_segment(out, value);
            }
            Op::Remove(key) => {
                key.push_segment(out);
                out.push('_');
            }
            Op::RemoveProperty(target, property) => {
                property.push_code(out);
                push_target_segment(out, target);
                out.push_str("*_");
            }
            Op::Unfold { target, shorthand, keep, conditions } => {
                shorthand.push_code(out);
                out.push('/');
                for (index, property) in keep.iter().enumerate() {
                    if index > 0 {
                        out.push('.');
                    }
                    property.push_code(out);
                }
                // The target segment follows the codes.
                push_target_segment(out, target);
                match conditions {
                    None => out.push('*'),
                    Some(conditions) => push_condition_segment(out, conditions),
                }
                out.push('_');
            }
        }
    }

    /// The class attribute text of a handle: markers, then one class per op.
    pub fn class_string(&self, handle: &Handle) -> String {
        self.join_classes(handle, |_| true)
    }

    /// The `class` attribute a host element receives: markers and set entries only. Tombstones
    /// exist to carry removals into later runtime merges, so they never reach the DOM.
    pub fn dom_class_string(&self, handle: &Handle) -> String {
        self.join_classes(handle, |op| matches!(op, Op::Set(..)))
    }

    /// A handle's markers, then the class of each op `keep` accepts, joined by spaces.
    fn join_classes(&self, handle: &Handle, keep: fn(&Op) -> bool) -> String {
        let mut out = String::new();
        let mut separator = "";
        for marker in &handle.markers {
            out.push_str(separator);
            out.push_str(marker);
            separator = " ";
        }
        for op in handle.ops.iter().filter(|op| keep(op)) {
            out.push_str(separator);
            self.push_class(&mut out, op);
            separator = " ";
        }
        out
    }

    /// The custom property a bridged entry reads (KRN-DYN-003).
    pub fn bridge_variable(&self, key: &EntryKey) -> String {
        format!("--{}{}", self.prefix, key.segment())
    }

    /// A marker or definition name: `{prefix}{kind}` and [`NAME_HASH`] characters.
    pub fn named(&self, kind: char, parts: &[&str]) -> String {
        format!("{}{kind}{}", self.prefix, base62(hash_parts(parts), NAME_HASH))
    }

    /// A variable-token custom property.
    pub fn token_variable(&self, parts: &[&str]) -> String {
        format!("--{}", self.named('v', parts))
    }

    /// A mode marker class (`km-light`).
    pub fn mode_marker(&self, mode: &str) -> String {
        format!("{}m-{mode}", self.prefix)
    }
}

/// The 4-character value segment of a class name. The longhand count takes part when a shorthand
/// produced the value, so atoms that rank differently never share a name.
///
/// Four characters, not three (Q-01): a collision here is a hard error, and across the values one
/// property carries in a real application three characters left a measurable chance of one per
/// build. The fourth character costs about 1.7 % of the stylesheet and buys two orders of
/// magnitude of headroom.
pub fn value_segment(value: &AtomValue) -> String {
    let mut segment = String::new();
    push_value_segment(&mut segment, value);
    segment
}

fn push_value_segment(out: &mut String, value: &AtomValue) {
    let hash = if value.longhands <= 1 {
        hash_parts(&[&value.css])
    } else {
        hash_parts(&[&value.css, &value.longhands.to_string()])
    };
    push_base62(out, hash, 4);
}

/// One rule-producing unit: a set entry with its class name.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Atom {
    pub class: String,
    pub key: EntryKey,
    pub value: AtomValue,
}

impl Atom {
    /// Builds the atoms of a handle.
    pub fn from_handle(names: &Names, handle: &Handle) -> Vec<Atom> {
        handle
            .ops
            .iter()
            .filter_map(|op| match op {
                Op::Set(key, value) => Some(Atom { class: names.class(op), key: key.clone(), value: value.clone() }),
                _ => None,
            })
            .collect()
    }
}

/// The global stylesheet order (D-036): ladder steps 2–4; step 5, where a declaration that set fewer
/// longhands wins and physical beats logical at equal count; then the
/// deterministic tie-break on condition text and class name (step 6). Contextual and own
/// atoms are ordered separately because they live in different layers (step 1).
pub fn ladder_order(a: &Atom, b: &Atom) -> Ordering {
    ladder_key(a).cmp(&ladder_key(b))
}

/// One atom's place in that order, as a value.
///
/// A comparator that builds this on both sides rebuilds it for every comparison, and a stylesheet's
/// atoms are compared O(n log n) times; `sort_by_cached_key(ladder_key)` builds one per atom.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct LadderKey {
    rank: LadderRank,
    /// Last, so it only breaks ties.
    class: String,
}

/// [`LadderKey`] without the class, which only breaks ties: atoms already in class order, sorted
/// stably by this, come out in the same order with far less to compare, since most atoms share
/// every other field (`ladder_rank`).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct LadderRank {
    conditions: crate::condition::SetKey,
    /// Fewer longhands first: ladder step 5 ranks the narrower declaration higher.
    breadth: std::cmp::Reverse<u8>,
    rank: PropertyRank,
    canonical: String,
}

impl LadderRank {
    /// Whether two atoms sit in one tier of the ladder: the same condition set's rank, breadth and
    /// property rank. Atoms of one tier never outrank each other but by their position, which only
    /// an `ambiguous-precedence` pair depends on; `layers.tiers` writes each tier as a sub-layer
    /// (KF-052).
    pub fn same_tier(&self, other: &LadderRank) -> bool {
        self.conditions == other.conditions && self.breadth == other.breadth && self.rank == other.rank
    }
}

pub fn ladder_key(atom: &Atom) -> LadderKey {
    LadderKey { rank: ladder_rank(atom), class: atom.class.clone() }
}

/// An atom's place in the ladder but for the class ([`LadderRank`]).
pub fn ladder_rank(atom: &Atom) -> LadderRank {
    LadderRank {
        conditions: crate::condition::set_key(&atom.key.conditions),
        breadth: std::cmp::Reverse(atom.value.longhands),
        rank: atom.key.property.rank,
        canonical: atom.key.conditions.canonical(),
    }
}

/// A merged handle's entries that share a property and target and tie through ladder step 5
/// while able to match together (`ambiguous-precedence`, KRN-CAS-003). Entries with the same value
/// are never ambiguous: whichever wins, the element looks the same. Nor is a pair another entry
/// resolves: one whose conditions include both sets beats each of them whenever both match, which is
/// what nesting one condition inside the other writes. `declared` is the project's
/// `conditions.exclusive`. Returns the property name and the two condition texts.
pub fn ambiguous_pairs(handle: &Handle, declared: crate::condition::Declared<'_>) -> Vec<(String, String, String)> {
    let entries: Vec<(&EntryKey, &AtomValue)> = handle.entries().collect();
    let mut pairs = Vec::new();
    for (index, (first, first_value)) in entries.iter().enumerate() {
        for (second, second_value) in &entries[index + 1..] {
            if first_value.css != second_value.css
                && first.target == second.target
                && first.property == second.property
                && first.conditions != second.conditions
                && compare_sets(&first.conditions, &second.conditions) == Ordering::Equal
                && !crate::condition::mutually_exclusive(&first.conditions, &second.conditions, declared)
                && !entries.iter().any(|(other, _)| {
                    other.target == first.target
                        && other.property == first.property
                        && first
                            .conditions
                            .conditions()
                            .iter()
                            .all(|condition| other.conditions.conditions().contains(condition))
                        && second
                            .conditions
                            .conditions()
                            .iter()
                            .all(|condition| other.conditions.conditions().contains(condition))
                })
            {
                pairs.push((first.property.name.clone(), first.conditions.canonical(), second.conditions.canonical()));
            }
        }
    }
    pairs
}

/// Shared, immutable handle.
pub type SharedHandle = Arc<Handle>;

/// Helper for tests and callers: the condition set of a list of conditions.
pub fn set(conditions: Vec<Condition>) -> ConditionSet {
    ConditionSet::new(conditions)
}
