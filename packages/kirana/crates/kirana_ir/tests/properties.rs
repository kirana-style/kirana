//! Property tests (KRN-TEST-003): build-time merge ≡ runtime merge, merge associativity and
//! idempotence (as class sets), and the ladder as a strict total order.
//!
//! Merge equivalence crosses languages through `fixtures/merge/vectors.json`: this test generates
//! the vectors from a fixed seed and checks the file is current (`KIRANA_UPDATE_FIXTURES=1`
//! rewrites it); `npm/core/test/merge-vectors.test.ts` replays every vector through the runtime.

use std::cmp::Ordering;
use std::path::Path;

use kirana_ir::*;
use proptest::prelude::*;

const TARGETS: usize = 3;
const PROPERTIES: [&str; 6] =
    ["color", "padding-top", "padding-left", "padding-right", "margin-inline-start", "--k-size"];
/// The longhands of `padding` among `PROPERTIES` stand in for a whole family; the shorthand atom
/// covers them (D-045).
const PADDING: [usize; 3] = [1, 2, 3];
const CONDITIONS: [&[&str]; 6] = [
    &[],
    &[":hover"],
    &["@media (width >= 48rem)"],
    &[":hover", "@media (width >= 48rem)"],
    &["[data-state=\"open\"]"],
    &[":focus-visible", "[data-size=\"sm\"]"],
];
const VALUES: [&str; 4] = ["red", "1rem", "var(--x)", "0"];
const MARKERS: [&str; 3] = ["krAbc12", "km-dark", "ktQ9x0Z"];

fn target(index: usize) -> Target {
    match index {
        0 => Target::Element,
        1 => Target::PseudoElement("::after".into()),
        _ => Target::Contextual { child: true, selector: "svg".into(), pseudo_element: None },
    }
}

fn key(target_index: usize, property: usize, conditions: usize) -> EntryKey {
    EntryKey::new(
        target(target_index),
        Property::longhand(PROPERTIES[property]),
        ConditionSet::new(CONDITIONS[conditions].iter().flat_map(|text| parse_condition_key(text).unwrap()).collect()),
    )
}

/// One generated operation: `(kind, target, property, conditions, value, longhands)`.
type OpSeed = (u8, usize, usize, usize, usize, u8);

/// Kinds 0–2 are a removal, a property removal and a set of `property`; 3 sets a padding shorthand
/// atom and 4 removes every padding atom, both as the compiler writes them (D-045). A removal of a
/// padding longhand is preceded by its unfold, as the compiler guarantees.
fn ops((kind, target_index, property, conditions, value, longhands): OpSeed) -> Vec<Op> {
    let key = key(target_index, property, conditions);
    let padding = Property::shorthand("padding");
    let covered = PADDING.contains(&property);
    let unfold = |conditions: Option<ConditionSet>| Op::Unfold {
        target: key.target.clone(),
        shorthand: padding.clone(),
        keep: PADDING
            .iter()
            .filter(|longhand| **longhand != property)
            .map(|longhand| Property::longhand(PROPERTIES[*longhand]))
            .collect(),
        conditions,
    };
    let longhand = |index: &usize| Property::longhand(PROPERTIES[*index]);
    match kind {
        0 if covered => vec![unfold(Some(key.conditions.clone())), Op::Remove(key)],
        0 => vec![Op::Remove(key)],
        1 if covered => vec![unfold(None), Op::RemoveProperty(key.target, key.property)],
        1 => vec![Op::RemoveProperty(key.target, key.property)],
        2 => vec![Op::Set(key, AtomValue { css: VALUES[value].into(), deps: vec![], longhands })],
        3 => {
            // A family atom replaces its longhands by itself; no tombstones travel with it.
            let atom = AtomValue { css: VALUES[value].into(), deps: vec![], longhands: 4 };
            vec![Op::Set(EntryKey { property: padding.clone(), ..key.clone() }, atom)]
        }
        _ => std::iter::once(padding.clone())
            .chain(PADDING.iter().map(longhand))
            .map(|property| Op::RemoveProperty(key.target.clone(), property))
            .collect(),
    }
}

fn handle(seeds: &[OpSeed], markers: &[usize]) -> Handle {
    let mut handle = Handle::default();
    for seed in seeds {
        ops(*seed).into_iter().for_each(|op| handle.apply(op));
    }
    handle.markers = markers.iter().map(|index| MARKERS[*index].to_owned()).collect();
    handle.markers.dedup();
    handle
}

/// Class tokens split into markers (no `_`) and merge-table classes, each in order.
fn partition(classes: &str) -> (Vec<&str>, Vec<&str>) {
    classes.split(' ').filter(|token| !token.is_empty()).partition(|token| !token.contains('_'))
}

/// SplitMix64: a fixed, dependency-free sequence so the vector file never changes by accident.
struct Seeded(u64);

impl Seeded {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn below(&mut self, bound: usize) -> usize {
        (self.next() % bound as u64) as usize
    }
}

#[test]
fn merge_vectors_are_current() {
    let names = Names::default();
    let mut random = Seeded(0x4B49_5241_4E41);
    let mut lines = Vec::new();
    for _ in 0..400 {
        let mut merged = Handle::default();
        let mut inputs = Vec::new();
        for _ in 0..1 + random.below(4) {
            let ops: Vec<OpSeed> = (0..random.below(7))
                .map(|_| {
                    let kind = match random.below(24) {
                        0..4 => 0,
                        4..7 => 1,
                        7..15 => 2,
                        15..21 => 3,
                        _ => 4,
                    };
                    let longhands = if random.below(4) == 0 { 4 } else { 1 };
                    (
                        kind,
                        random.below(TARGETS),
                        random.below(PROPERTIES.len()),
                        random.below(CONDITIONS.len()),
                        random.below(VALUES.len()),
                        longhands,
                    )
                })
                .collect();
            let markers: Vec<usize> = (0..usize::from(random.below(5) == 0)).map(|_| random.below(3)).collect();
            let part = handle(&ops, &markers);
            inputs.push(names.class_string(&part));
            merged.merge(&part);
        }
        let classes = names.class_string(&merged);
        let dom = names.dom_class_string(&merged);
        let ((markers, atoms), (_, dom_atoms)) = (partition(&classes), partition(&dom));
        // Keys written by hand: `json!` key order depends on whether a workspace crate enables
        // serde_json's `preserve_order` feature.
        let list = |items: &[&str]| serde_json::to_string(items).unwrap();
        let inputs: Vec<&str> = inputs.iter().map(String::as_str).collect();
        lines.push(format!(
            r#"{{"inputs":{},"markers":{},"atoms":{},"dom":{}}}"#,
            list(&inputs),
            list(&markers),
            list(&atoms),
            list(&dom_atoms)
        ));
    }
    let text = format!("[\n{}\n]\n", lines.join(",\n"));
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/merge/vectors.json");
    if std::env::var_os("KIRANA_UPDATE_FIXTURES").is_some() {
        std::fs::write(&path, &text).unwrap();
    }
    let current = std::fs::read_to_string(&path).unwrap_or_default();
    assert!(current == text, "fixtures/merge/vectors.json is stale; rerun with KIRANA_UPDATE_FIXTURES=1");

    // The same vectors in dense names (D-084): the runtime must merge renamed classes into the
    // renamed result. Every hash in the file gets a code, as a build would give them.
    let mut dense = dense::DenseNames::default();
    let uses: Vec<(dense::Segment, &str, usize)> = dense::names("k", &text, false)
        .into_iter()
        .flat_map(|name| [(dense::Segment::Condition, name.condition), (dense::Segment::Value, name.value)])
        .filter_map(|(segment, range)| range.map(|(start, end)| (segment, &text[start..end], 1)))
        .collect();
    dense.extend(uses);
    let renamed = dense.rename("k", &text, false);
    assert!(renamed.len() < text.len());
    let path = path.with_file_name("dense-vectors.json");
    if std::env::var_os("KIRANA_UPDATE_FIXTURES").is_some() {
        std::fs::write(&path, &renamed).unwrap();
    }
    let current = std::fs::read_to_string(&path).unwrap_or_default();
    assert!(current == renamed, "fixtures/merge/dense-vectors.json is stale; rerun with KIRANA_UPDATE_FIXTURES=1");
}

fn op_seed() -> impl Strategy<Value = OpSeed> {
    (0u8..5, 0..TARGETS, 0..PROPERTIES.len(), 0..CONDITIONS.len(), 0..VALUES.len(), prop_oneof![Just(1u8), Just(4u8)])
}

fn handle_seed() -> impl Strategy<Value = Handle> {
    (prop::collection::vec(op_seed(), 0..8), prop::collection::vec(0..MARKERS.len(), 0..2))
        .prop_map(|(ops, markers)| handle(&ops, &markers))
}

fn atom_seed() -> impl Strategy<Value = Atom> {
    (0..TARGETS, 0..PROPERTIES.len(), 0..CONDITIONS.len(), 0..VALUES.len(), prop_oneof![Just(1u8), Just(4u8)]).prop_map(
        |(target_index, property, conditions, value, longhands)| {
            let op = ops((2, target_index, property, conditions, value, longhands)).remove(0);
            Atom::from_handle(&Names::default(), &Handle { ops: vec![op], ..Handle::default() }).remove(0)
        },
    )
}

/// A handle as the set of classes it writes. Merges keep one op per key, and class order never
/// changes styling; an unfold appends its longhands, so equal handles can list them in another order.
fn classes(handle: &Handle) -> (Vec<String>, Vec<String>) {
    let names = Names::default();
    let mut ops: Vec<String> = handle.ops.iter().map(|op| names.class(op)).collect();
    ops.sort();
    let mut markers = handle.markers.clone();
    markers.sort();
    (ops, markers)
}

proptest! {
    #[test]
    fn merge_is_associative(a in handle_seed(), b in handle_seed(), c in handle_seed()) {
        let mut left = a.clone();
        left.merge(&b);
        left.merge(&c);
        let mut tail = b;
        tail.merge(&c);
        let mut right = a;
        right.merge(&tail);
        prop_assert_eq!(classes(&left), classes(&right));
    }

    #[test]
    fn merging_twice_changes_nothing(a in handle_seed(), b in handle_seed()) {
        let mut once = a;
        once.merge(&b);
        let mut twice = once.clone();
        twice.merge(&b);
        prop_assert_eq!(classes(&once), classes(&twice));
    }

    #[test]
    fn ladder_is_a_strict_total_order(a in atom_seed(), b in atom_seed(), c in atom_seed()) {
        let ab = ladder_order(&a, &b);
        prop_assert_eq!(ab, ladder_order(&b, &a).reverse());
        prop_assert_eq!(ab == Ordering::Equal, a.class == b.class);
        if ab != Ordering::Greater && ladder_order(&b, &c) != Ordering::Greater {
            prop_assert_ne!(ladder_order(&a, &c), Ordering::Greater);
        }
    }

    #[test]
    fn ladder_sort_ignores_input_order(atoms in prop::collection::vec(atom_seed(), 0..16)) {
        let mut forward = atoms.clone();
        forward.sort_by(ladder_order);
        let mut backward: Vec<Atom> = atoms.into_iter().rev().collect();
        backward.sort_by(ladder_order);
        prop_assert_eq!(forward, backward);
    }
}
