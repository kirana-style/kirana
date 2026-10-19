//! The writer reorders atoms that share a conflict key (P6 in the compiler research). These tests
//! check that the declaration that wins on an element is the one the precedence ladder picks.

use std::collections::BTreeSet;

use kirana_emit::*;
use kirana_ir::*;

/// The conditions an atom may carry, each a subset of [`STATES`].
const CONDITIONS: [&[&str]; 5] =
    [&[], &[":hover"], &[":focus"], &["@media (width >= 48rem)"], &[":hover", "@media (width >= 48rem)"]];
const STATES: [&str; 3] = [":hover", ":focus", "@media (width >= 48rem)"];
/// Property, the longhands it covers (more than one makes a shorthand atom), and its values.
const PROPERTIES: [(&str, u8, [&str; 3]); 7] = [
    ("color", 1, ["red", "blue", "green"]),
    ("margin-left", 1, ["0px", "1px", "2px"]),
    ("margin-right", 1, ["0px", "1px", "2px"]),
    ("margin-inline-start", 1, ["0px", "1px", "2px"]),
    ("margin", 4, ["0px", "1px", "2px"]),
    ("margin-inline", 2, ["0px", "1px", "2px"]),
    // Not in the property table's box families, so the writer cannot tell what it covers.
    ("border", 12, ["0px", "1px", "2px"]),
];
const SLOTS: [&str; 3] = ["color", "margin-left", "margin-right"];

/// Whether a declaration of `property` sets `slot`, in left-to-right or right-to-left text.
fn decides(property: &str, slot: &str, rtl: bool) -> bool {
    match property {
        "margin-inline-start" => slot == if rtl { "margin-right" } else { "margin-left" },
        "margin" | "margin-inline" => slot.starts_with("margin-"),
        "border" => false,
        _ => property == slot,
    }
}

fn atom(property: usize, condition: usize, value: usize) -> Atom {
    let (name, longhands, values) = PROPERTIES[property];
    let conditions = CONDITIONS[condition].iter().flat_map(|key| parse_condition_key(key).unwrap()).collect();
    let property = if longhands > 1 { Property::shorthand(name) } else { Property::longhand(name) };
    let op = Op::Set(
        EntryKey { target: Target::Element, property, conditions: ConditionSet::new(conditions) },
        AtomValue { css: values[value].into(), deps: vec![], longhands },
    );
    let Op::Set(key, value) = op.clone() else { unreachable!() };
    Atom { class: Names::default().class(&op), key, value }
}

/// Where each atom's rule sits in the stylesheet: the offset of the body its selector opens.
fn positions(css: &str, atoms: &[Atom]) -> Vec<usize> {
    atoms
        .iter()
        .map(|atom| {
            let needle = format!(".{}", atom.class);
            let at = css
                .match_indices(&needle)
                .map(|(at, _)| at)
                .find(|at| !css[at + needle.len()..].starts_with(|c: char| c.is_ascii_alphanumeric() || c == '_'))
                .unwrap_or_else(|| panic!("{} is not in {css}", atom.class));
            let body = at + css[at..].find('{').unwrap();
            let declaration = &css[body + 1..body + css[body..].find('}').unwrap()];
            assert_eq!(declaration, format!("{}:{}", atom.key.property.name, atom.value.css), "{css}");
            body
        })
        .collect()
}

/// The value that decides `slot` on an element carrying `classes`, in state `active`, when atom `i`
/// sits at `order[i]`: the last matching rule wins, since every selector weighs the same.
fn winner<'a>(
    atoms: &'a [Atom],
    classes: &[usize],
    active: &BTreeSet<&str>,
    (slot, rtl): (&str, bool),
    order: &[usize],
) -> Option<&'a str> {
    classes
        .iter()
        .copied()
        .filter(|&i| decides(&atoms[i].key.property.name, slot, rtl))
        .filter(|&i| {
            let key = &atoms[i].key.conditions;
            CONDITIONS.iter().any(|set| {
                set.iter().all(|state| active.contains(state))
                    && *key == ConditionSet::new(set.iter().flat_map(|key| parse_condition_key(key).unwrap()).collect())
            })
        })
        .max_by_key(|&i| order[i])
        .map(|i| atoms[i].value.css.as_str())
}

proptest::proptest! {
    #![proptest_config(proptest::prelude::ProptestConfig::with_cases(4096))]

    #[test]
    fn the_ladder_still_picks_the_winner(
        written in proptest::collection::vec((0..7usize, 0..5usize, 0..3usize), 1..14),
        picks in proptest::collection::vec(proptest::bits::u16::ANY, 1..12),
    ) {
        let mut atoms: Vec<Atom> = written.iter().map(|&(p, c, v)| atom(p, c, v)).collect();
        atoms.sort_by(|a, b| a.class.cmp(&b.class));
        atoms.dedup_by(|a, b| a.class == b.class);
        let mut ladder: Vec<usize> = (0..atoms.len()).collect();
        ladder.sort_by_cached_key(|&i| ladder_key(&atoms[i]));
        let mut rank = vec![0; atoms.len()];
        for (position, &i) in ladder.iter().enumerate() {
            rank[i] = position;
        }
        let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
        let written = positions(&css, &atoms);
        for pick in &picks {
            // An element carries one atom per conflict key, as merging leaves it.
            let mut classes: Vec<usize> = Vec::new();
            for (i, atom) in atoms.iter().enumerate() {
                if pick >> (i % 16) & 1 == 1 && !classes.iter().any(|&j| atoms[j].key == atom.key) {
                    classes.push(i);
                }
            }
            for mask in 0..1u8 << STATES.len() {
                let active: BTreeSet<&str> = STATES.iter().enumerate().filter(|(bit, _)| mask >> bit & 1 == 1).map(|(_, s)| *s).collect();
                for slot in SLOTS {
                    for rtl in [false, true] {
                        proptest::prop_assert_eq!(
                            winner(&atoms, &classes, &active, (slot, rtl), &written),
                            winner(&atoms, &classes, &active, (slot, rtl), &rank),
                            "{} (rtl {}) on {:?} in {:?}\n{}", slot, rtl, classes, active, css
                        );
                    }
                }
            }
        }
    }
}

/// A declaration that one key's atoms and the next key's share is written once, whichever of the
/// first key's values sorts last.
#[test]
fn adjacent_keys_share_a_declaration() {
    for shared in [0, 1] {
        let atoms = vec![atom(0, 0, 0), atom(0, 0, 1), atom(0, 1, shared)];
        let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
        let declaration = format!("color:{}", PROPERTIES[0].2[shared]);
        assert_eq!(css.matches(&declaration).count(), 1, "{css}");
    }
}

/// A run of one atom passes its declaration on: three keys, one rule.
#[test]
fn a_single_atom_carries_the_declaration_through() {
    let atoms = vec![atom(0, 0, 0), atom(0, 0, 1), atom(0, 1, 0), atom(0, 2, 0), atom(0, 2, 2)];
    let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("color:red").count(), 1, "{css}");
}

/// A run longer than one atom cannot end with the declaration the previous key gave its start.
#[test]
fn a_run_keeps_its_first_atom_first() {
    // Base {red, blue}, hover {red, green}, focus {red}: red joins base and hover, so hover ends
    // with green and focus's red needs a rule of its own.
    let atoms = vec![atom(0, 0, 0), atom(0, 0, 1), atom(0, 1, 0), atom(0, 1, 2), atom(0, 2, 0)];
    let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("color:red").count(), 2, "{css}");
}

/// Contextual atoms keep ladder order: two ancestors can each give a descendant one of them.
#[test]
fn contextual_atoms_are_not_reordered() {
    let contextual = |condition: usize, value: usize| {
        let Atom { key, value, .. } = atom(0, condition, value);
        let target = Target::Contextual { child: false, selector: "*".into(), pseudo_element: None };
        let op = Op::Set(EntryKey { target, ..key }, value);
        let Op::Set(key, value) = op.clone() else { unreachable!() };
        Atom { class: Names::default().class(&op), key, value }
    };
    let atoms = vec![contextual(0, 0), contextual(0, 1), contextual(1, 0), contextual(1, 1)];
    let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    let mut sorted: Vec<&Atom> = atoms.iter().collect();
    sorted.sort_by_cached_key(|atom| ladder_key(atom));
    let at = |atom: &Atom| css.find(&format!(".{}", atom.class)).unwrap();
    assert!(sorted.windows(2).all(|pair| at(pair[0]) < at(pair[1])), "{css}");
}

/// A flow-relative longhand competes with every physical one it can stand for: in right-to-left
/// text `margin-inline-start` is `margin-right`, so `margin-right` cannot move past it.
#[test]
fn a_flow_relative_longhand_blocks_both_sides() {
    let atoms = vec![atom(2, 0, 0), atom(3, 1, 1), atom(2, 2, 0)];
    let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("margin-right:0px").count(), 2, "{css}");
}

/// A box shorthand shares its declaration like a longhand does, unless a rule between decides one of
/// its longhands or a flow-relative one that can stand for it.
#[test]
fn a_box_shorthand_shares_its_declaration() {
    let shared = vec![atom(4, 0, 0), atom(0, 1, 1), atom(4, 2, 0)];
    let css = emit(&shared, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("margin:0px").count(), 1, "{css}");
    for between in [1, 3] {
        let blocked = vec![atom(4, 0, 0), atom(between, 1, 1), atom(4, 2, 0)];
        let css = emit(&blocked, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
        assert_eq!(css.matches("margin:0px").count(), 2, "{css}");
    }
}

/// A box shorthand blocks the merges of its own longhands and no others.
#[test]
fn a_box_shorthand_blocks_only_its_longhands() {
    let across = vec![atom(0, 0, 0), atom(4, 1, 1), atom(0, 2, 0)];
    let css = emit(&across, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("color:red").count(), 1, "{css}");
    let covered = vec![atom(1, 0, 0), atom(4, 1, 1), atom(1, 2, 0)];
    let css = emit(&covered, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("margin-left:0px").count(), 2, "{css}");
}

/// A vendor-prefixed property may alias any other, so nothing merges across it, and it merges past
/// nothing.
#[test]
fn a_vendor_property_blocks_every_merge() {
    let vendor = |condition: usize, value: &str| {
        let conditions = CONDITIONS[condition].iter().flat_map(|key| parse_condition_key(key).unwrap()).collect();
        let op = Op::Set(
            EntryKey {
                target: Target::Element,
                property: Property::longhand("-webkit-margin-start"),
                conditions: ConditionSet::new(conditions),
            },
            AtomValue { css: value.into(), deps: vec![], longhands: 1 },
        );
        let Op::Set(key, value) = op.clone() else { unreachable!() };
        Atom { class: Names::default().class(&op), key, value }
    };
    let across = vec![atom(0, 0, 0), vendor(1, "1px"), atom(0, 2, 0)];
    let css = emit(&across, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("color:red").count(), 2, "{css}");
    let past = vec![vendor(0, "0px"), atom(0, 1, 0), vendor(2, "0px")];
    let css = emit(&past, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("-webkit-margin-start:0px").count(), 2, "{css}");
}

/// A shorthand whose longhands are all known blocks only those: `text-wrap` is not a box family,
/// and its atom is ranked as a longhand because Lightning CSS does not split it.
#[test]
fn a_listed_shorthand_blocks_only_its_longhands() {
    let names = Names::default();
    let op = Op::Set(
        EntryKey {
            target: Target::Element,
            property: Property::shorthand("text-wrap"),
            conditions: ConditionSet::default(),
        },
        AtomValue { css: "balance".into(), deps: vec![], longhands: 2 },
    );
    let Op::Set(key, value) = op.clone() else { unreachable!() };
    let across = vec![atom(0, 0, 0), Atom { class: names.class(&op), key, value }, atom(0, 1, 0)];
    let css = emit(&across, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("color:red").count(), 1, "{css}");
}

/// A shorthand nothing splits may set any property, and an alias sets the property it stands for:
/// `text-wrap-mode` cannot move past `white-space`, which sets it, nor `overflow-wrap` past
/// `word-wrap`, and nothing moves past `column-rule` or a shorthand atom the data does not know.
#[test]
fn hidden_overlaps_block_the_merge() {
    let single = |property: Property, condition: usize, css: &str| {
        let conditions = CONDITIONS[condition].iter().flat_map(|key| parse_condition_key(key).unwrap()).collect();
        let op = Op::Set(
            EntryKey { target: Target::Element, property, conditions: ConditionSet::new(conditions) },
            AtomValue { css: css.into(), deps: vec![], longhands: 1 },
        );
        let Op::Set(key, value) = op.clone() else { unreachable!() };
        Atom { class: Names::default().class(&op), key, value }
    };
    for (outer, between) in [
        ("text-wrap-mode", Property::longhand("white-space")),
        ("overflow-wrap", Property::longhand("word-wrap")),
        ("color", Property::longhand("column-rule")),
        ("white-space", Property::longhand("text-wrap")),
        ("color", Property::shorthand("future-shorthand")),
    ] {
        let atoms = vec![
            single(Property::longhand(outer), 0, "a"),
            single(between.clone(), 1, "b"),
            single(Property::longhand(outer), 2, "a"),
        ];
        let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
        assert_eq!(css.matches(&format!("{outer}:a")).count(), 2, "{outer} past {}: {css}", between.name);
    }
}
