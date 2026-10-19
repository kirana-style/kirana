use std::sync::Arc;

use kirana_css_data::PropertyRank;
use kirana_ir::*;

fn key(property: &str, conditions: &[&str]) -> EntryKey {
    EntryKey {
        target: Target::Element,
        property: Property::longhand(property),
        conditions: ConditionSet::new(conditions.iter().flat_map(|c| parse_condition_key(c).unwrap()).collect()),
    }
}

fn value(css: &str) -> AtomValue {
    AtomValue { css: css.into(), deps: vec![], longhands: 1 }
}

fn set_op(property: &str, conditions: &[&str], css: &str) -> Op {
    Op::Set(key(property, conditions), value(css))
}

fn handle(ops: Vec<Op>) -> Handle {
    let mut handle = Handle::default();
    for op in ops {
        handle.apply(op);
    }
    handle
}

fn table(handle: &Handle) -> Vec<String> {
    handle
        .ops
        .iter()
        .map(|op| match op {
            Op::Set(key, value) => format!("{}|{} = {}", key.property.name, key.conditions.canonical(), value.css),
            Op::Remove(key) => format!("{}|{} removed", key.property.name, key.conditions.canonical()),
            Op::RemoveProperty(_, property) => format!("{} all removed", property.name),
            Op::Unfold { shorthand, keep, .. } => format!(
                "{} unfolded to {}",
                shorthand.name,
                keep.iter().map(|longhand| longhand.name.as_str()).collect::<Vec<_>>().join(",")
            ),
        })
        .collect()
}

#[test]
fn merge_rules() {
    // Rule: omitted keeps; value replaces base only.
    let mut merged = handle(vec![set_op("color", &[], "gray"), set_op("color", &[":hover"], "black")]);
    merged.merge(&handle(vec![set_op("color", &[], "blue")]));
    assert_eq!(table(&merged), ["color|:hover = black", "color| = blue"]);

    // Rule: a condition entry replaces that condition only.
    merged.merge(&handle(vec![set_op("color", &[":hover"], "red")]));
    assert_eq!(table(&merged), ["color| = blue", "color|:hover = red"]);

    // Rule: removing one entry.
    merged.merge(&handle(vec![Op::Remove(key("color", &[]))]));
    assert_eq!(table(&merged), ["color|:hover = red", "color| removed"]);

    // Rule: removing every entry, then adding (the `"*": null` form).
    merged.merge(&handle(vec![
        Op::RemoveProperty(Target::Element, Property::longhand("color")),
        set_op("color", &["@media (x)"], "green"),
    ]));
    assert_eq!(table(&merged), ["color all removed", "color|@media (x) = green"]);

    // A second property removal replaces the first; other properties are untouched.
    merged.apply(set_op("opacity", &[], "1"));
    merged.apply(Op::RemoveProperty(Target::Element, Property::longhand("color")));
    assert_eq!(table(&merged), ["opacity| = 1", "color all removed"]);
    // A property removal does not remove other targets.
    let mut targets = handle(vec![Op::Set(
        EntryKey { target: Target::PseudoElement("::after".into()), ..key("color", &[]) },
        value("red"),
    )]);
    targets.apply(Op::RemoveProperty(Target::Element, Property::longhand("color")));
    assert_eq!(targets.ops.len(), 2);
    assert_eq!(targets.entries().count(), 1);
}

#[test]
fn unfolds_take_the_atoms_place() {
    let shorthand = |name: &str, css: &str, longhands: u8| {
        Op::Set(
            EntryKey { property: Property::shorthand(name), ..key("", &[]) },
            AtomValue { css: css.into(), deps: vec![], longhands },
        )
    };
    let unfold = |name: &str, keep: &[&str]| Op::Unfold {
        target: Target::Element,
        shorthand: Property::shorthand(name),
        keep: keep.iter().copied().map(Property::longhand).collect(),
        conditions: None,
    };
    // `border: var(--v)`, then `borderWidth: 0`, then `borderColor: null` unfolds `border` into its
    // widths in `border`'s place, before the later `border-width` atom.
    let mut merged = handle(vec![shorthand("border", "var(--v)", 12), shorthand("border-width", "0", 4)]);
    merged.apply(unfold("border", &["border-top-width", "border-right-width"]));
    assert_eq!(
        table(&merged),
        [
            "border-top-width| = var(--v)",
            "border-right-width| = var(--v)",
            "border-width| = 0",
            "border unfolded to border-top-width,border-right-width"
        ]
    );
    // `borderTop: null` then unfolds `border-width`: its value replaces the earlier widths, while a
    // longhand written after it keeps its own.
    merged.apply(set_op("border-bottom-width", &[], "2px"));
    merged.apply(unfold("border-width", &["border-right-width", "border-bottom-width"]));
    assert_eq!(
        table(&merged),
        [
            "border-top-width| = var(--v)",
            "border-right-width| = 0",
            "border unfolded to border-top-width,border-right-width",
            "border-bottom-width| = 2px",
            "border-width unfolded to border-right-width,border-bottom-width"
        ]
    );
}

#[test]
fn markers_merge_once() {
    let mut first = Handle { markers: vec!["krA".into()], ..Handle::default() };
    let theme = Dep::Theme(Arc::new(ThemeDef { class: "ktA".into(), declarations: vec![], deps: vec![] }));
    let second =
        Handle { markers: vec!["krA".into(), "ktA".into()], marker_deps: vec![theme.clone()], ..Handle::default() };
    first.merge(&second);
    first.merge(&second);
    assert_eq!(first.markers, ["krA", "ktA"]);
    assert_eq!(first.marker_deps, [theme]);
    assert!(!first.is_empty());
    assert!(Handle::default().is_empty());
}

#[test]
fn class_names() {
    let names = Names::default();
    let color = set_op("color", &[], "red");
    let class = names.class(&color);
    assert!(class.starts_with('k') && class.contains('_'), "{class}");
    let (segment, value_part) = class[1..].split_once('_').unwrap();
    assert!(segment.len() <= 2 && value_part.len() == 4, "{class}");
    // Same value, same name; different value, different name.
    assert_eq!(class, names.class(&set_op("color", &[], "red")));
    assert_ne!(class, names.class(&set_op("color", &[], "blue")));
    // Conditions add a 4-character segment; targets a 3-character one.
    let hover = names.class(&set_op("color", &[":hover"], "red"));
    assert_eq!(hover[1..].split_once('_').unwrap().0.split('-').nth(1).unwrap().len(), 4);
    let after =
        Op::Set(EntryKey { target: Target::PseudoElement("::after".into()), ..key("color", &[]) }, value("red"));
    assert_eq!(names.class(&after)[1..].split_once('_').unwrap().0.split('-').nth(1).unwrap().len(), 3);
    // Tombstones.
    assert!(names.class(&Op::Remove(key("color", &[":hover"]))).ends_with('_'));
    assert!(names.class(&Op::RemoveProperty(Target::Element, Property::longhand("color"))).ends_with("*_"));
    // Custom properties use a 5-character hash.
    let custom = names.class(&set_op("--gap", &[], "1rem"));
    assert_eq!(custom[1..].split_once('_').unwrap().0.len(), 5);
    // Other names.
    let ds = Names { prefix: "ds".into(), mark: false };
    assert_eq!(ds.bridge_variable(&key("color", &[])), format!("--ds{}", key("color", &[]).segment()));
    assert!(ds.named('r', &["pkg", "field"]).starts_with("dsr"));
    assert_eq!(ds.named('r', &["pkg", "field"]).len(), 3 + kirana_ir::NAME_HASH);
    assert!(ds.token_variable(&["pkg", "space", "4"]).starts_with("--dsv"));
    assert_eq!(ds.mode_marker("dark"), "dsm-dark");
    let marked = Handle { markers: vec!["krA".into()], ops: vec![color.clone()], ..Handle::default() };
    assert_eq!(names.class_string(&marked), format!("krA {class}"));
    let mut removed = marked.clone();
    removed.apply(Op::Remove(key("opacity", &[])));
    assert_eq!(names.dom_class_string(&removed), format!("krA {class}"));
    assert!(names.class_string(&removed).ends_with('_'));
}

#[test]
fn properties_and_targets() {
    assert_eq!(Property::longhand("padding-inline-start").rank, PropertyRank::Logical);
    assert_eq!(Property::longhand("padding-left").rank, PropertyRank::Physical);
    assert_eq!(Property::shorthand("padding").rank, PropertyRank::Shorthand);
    assert_eq!(Property::longhand("not-a-property").code().len(), 5);
    assert!(!Target::Element.is_contextual());
    let contextual =
        |child| Target::Contextual { child, selector: "svg".into(), pseudo_element: Some("::after".into()) };
    assert!(contextual(true).is_contextual());
    let child = EntryKey { target: contextual(true), ..key("width", &[]) };
    let descendant = EntryKey { target: contextual(false), ..key("width", &[]) };
    assert_ne!(child.segment(), descendant.segment());
    let bare = EntryKey {
        target: Target::Contextual { child: false, selector: "svg".into(), pseudo_element: None },
        ..key("width", &[])
    };
    assert_ne!(bare.segment(), descendant.segment());
}

#[test]
fn atoms_and_ordering() {
    let names = Names::default();
    let handle = handle(vec![
        set_op("color", &[":hover"], "red"),
        set_op("color", &[], "blue"),
        Op::Remove(key("opacity", &[])),
        Op::Set(EntryKey { property: Property::shorthand("padding"), ..key("padding", &[]) }, value("var(--x)")),
        set_op("padding-top", &[], "0"),
        set_op("padding-inline-start", &[], "0"),
    ]);
    let mut atoms = Atom::from_handle(&names, &handle);
    assert_eq!(atoms.len(), 5);
    atoms.sort_by(ladder_order);
    let order: Vec<_> = atoms.iter().map(|atom| atom.key.property.name.as_str()).collect();
    // `color` and `padding-top` tie up to the class name, whose property codes put box families first.
    assert_eq!(order, ["padding", "padding-inline-start", "padding-top", "color", "color"]);
    assert_eq!(atoms[4].key.conditions.canonical(), ":hover");
    // Same conditions and rank: condition text, then class name.
    let mut same = [
        Atom { class: "kb".into(), key: key("color", &["[a]"]), value: value("x") },
        Atom { class: "ka".into(), key: key("color", &["[a]"]), value: value("x") },
        Atom { class: "kc".into(), key: key("color", &["[b]"]), value: value("x") },
    ];
    same.sort_by(ladder_order);
    assert_eq!(same.iter().map(|atom| atom.class.as_str()).collect::<Vec<_>>(), ["ka", "kb", "kc"]);
}

#[test]
fn ambiguity() {
    let ambiguous = handle(vec![
        set_op("color", &["[data-state=\"open\"]"], "a"),
        set_op("color", &["[aria-expanded=\"true\"]"], "b"),
        set_op("color", &["[data-state=\"closed\"]"], "c"),
        set_op("color", &[":hover"], "d"),
        set_op("opacity", &["[data-x]"], "1"),
        // The same value under both conditions: either order renders the same.
        set_op("opacity", &["[data-y]"], "1"),
    ]);
    let pairs = ambiguous_pairs(&ambiguous, &[]);
    assert_eq!(
        pairs,
        [
            ("color".to_owned(), "[data-state=\"open\"]".to_owned(), "[aria-expanded=\"true\"]".to_owned()),
            ("color".to_owned(), "[aria-expanded=\"true\"]".to_owned(), "[data-state=\"closed\"]".to_owned()),
        ]
    );
    assert_eq!(set(vec![]).len(), 0);

    // Nesting one condition inside the other resolves the pair: the entry holding both wins.
    let nested = handle(vec![
        set_op("color", &["[data-checked]"], "a"),
        set_op("color", &["[aria-invalid=\"true\"]"], "b"),
        set_op("color", &["[aria-invalid=\"true\"]", "[data-checked]"], "a"),
    ]);
    assert_eq!(ambiguous_pairs(&nested, &[]), []);
    // A declared exclusive group resolves it too.
    let declared = handle(vec![set_op("opacity", &["[data-open]"], "1"), set_op("opacity", &["[data-closed]"], "0")]);
    assert_eq!(ambiguous_pairs(&declared, &[]).len(), 1);
    assert_eq!(ambiguous_pairs(&declared, &[vec!["[data-open]".to_owned(), "[data-closed]".to_owned()]]), []);
}

#[test]
fn deps() {
    let token = Dep::Token(Arc::new(TokenDef {
        variable: "--kvA".into(),
        value: TokenValue::Modes { light: "a".into(), dark: "b".into() },
        identity: "theme.x".into(),
        deps: vec![],
        registration: None,
    }));
    let frames = Dep::Keyframes(Arc::new(KeyframesDef { name: "kfA".into(), frames: vec![], deps: vec![] }));
    let mut deps = vec![];
    push_dep(&mut deps, token.clone());
    push_dep(&mut deps, token.clone());
    push_dep(&mut deps, frames);
    assert_eq!(deps.len(), 2);
}

/// Why the value segment is four characters and not three (E-04).
///
/// These two colours are ordinary design-system values, and at three characters they name the same
/// atom. Two values on one property that share a name are `class-name-collision`, which fails the
/// build with nothing the author can do about it but change a colour. Across the values one
/// property carries in this repository's applications, three characters left that at 1.5–3.1 % per
/// build; the fourth character makes it 0.02–0.05 %.
#[test]
fn the_value_segment_is_wide_enough_for_real_values() {
    use kirana_shared::{base62, hash_parts};

    let (first, second) = ("oklch(21% 0.12 250)", "oklch(27% 0.21 250)");
    assert_eq!(base62(hash_parts(&[first]), 3), base62(hash_parts(&[second]), 3), "the pair collides at three");
    assert_ne!(value_segment(&value(first)), value_segment(&value(second)), "and not at four");
}
