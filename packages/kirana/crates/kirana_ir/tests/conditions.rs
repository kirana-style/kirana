use std::cmp::Ordering;

use kirana_ir::*;

fn parse(key: &str) -> Vec<Condition> {
    parse_condition_key(key).unwrap_or_else(|error| panic!("{error}"))
}

fn fail(key: &str) -> String {
    parse_condition_key(key).unwrap_err().reason
}

fn one(key: &str) -> ConditionSet {
    ConditionSet::new(parse(key))
}

#[test]
fn parses_at_rules() {
    assert_eq!(parse("@media  (width >= 48rem) "), [Condition::Media("(width >= 48rem)".into())]);
    assert_eq!(parse("@supports (display: grid)"), [Condition::Supports("(display: grid)".into())]);
    assert_eq!(
        parse("@container card (min-width: 24rem)"),
        [Condition::Container { name: Some("card".into()), query: "(min-width: 24rem)".into() }]
    );
    assert_eq!(
        parse("@container (min-width: 24rem)"),
        [Condition::Container { name: None, query: "(min-width: 24rem)".into() }]
    );
    assert_eq!(
        parse("@container not (min-width: 24rem)"),
        [Condition::Container { name: None, query: "not (min-width: 24rem)".into() }]
    );
    assert_eq!(parse("@container style"), [Condition::Container { name: None, query: "style".into() }]);
    assert_eq!(fail("@media"), "empty @media query");
    assert_eq!(fail("@supports "), "empty @supports condition");
    assert_eq!(fail("@container"), "empty @container query");
    assert!(fail("@layer x").contains("only @media"));
}

#[test]
fn parses_compound_selectors() {
    assert_eq!(
        parse("[aria-haspopup]:active"),
        [Condition::Attribute("[aria-haspopup]".into()), Condition::Pseudo(":active".into())]
    );
    assert_eq!(parse(":HOVER"), [Condition::Pseudo(":hover".into())]);
    assert_eq!(parse(":has(>  svg)"), [Condition::Pseudo(":has(> svg)".into())]);
    assert_eq!(parse("[data-x=\"a]b\"]"), [Condition::Attribute("[data-x=\"a]b\"]".into())]);
    assert_eq!(parse(":not([data-a='(x'])"), [Condition::Pseudo(":not([data-a='(x'])".into())]);
    assert_eq!(parse(":nth-child(2n + 1)"), [Condition::Pseudo(":nth-child(2n + 1)".into())]);
    assert_eq!(parse(":is(:not(x))"), [Condition::Pseudo(":is(:not(x))".into())]);
    assert_eq!(fail(""), "empty condition");
    assert_eq!(fail("[x"), "unclosed attribute selector");
    assert_eq!(fail("[ ]"), "empty attribute selector");
    assert_eq!(fail("::after"), "pseudo-elements are style keys, not conditions");
    assert_eq!(fail(":"), "missing pseudo-class name");
    assert_eq!(fail(":(x)"), "missing pseudo-class name");
    assert_eq!(fail(":bogus"), ":bogus is not a pseudo-class");
    assert_eq!(fail(":has(x"), "unclosed parenthesis");
    assert!(fail("hover").contains("expected a pseudo-class"));
    let error = parse_condition_key("hover").unwrap_err();
    assert!(error.to_string().starts_with("\"hover\": "));
}

/// One compound selector the target itself matches: an element name, classes, attributes and
/// pseudo-classes (D-061); a library's class is the only hook its markup offers (KF-079).
#[test]
fn contextual_targets_are_one_compound_selector() {
    for target in [
        "svg",
        "[data-slot=\"icon\"]",
        "span:last-child",
        ".ts-chart__grid",
        "svg.ts-chart",
        ".a.b:hover",
        "g.-x._y[data-z]",
        " .a:not(.b) ",
        "a[href$=\".pdf\"].c",
        "li:nth-child(2n).c",
    ] {
        assert!(is_contextual_target(target), "{target}");
    }
    for target in [
        "",
        ".",
        ".9a",
        ".-9a",
        ".-",
        "..a",
        ".a .b",
        ".a > b",
        ".a+b",
        ".a::before",
        "#id",
        ".a\\:b",
        "*.a",
        "9x.a",
        ".a[x",
        ".a:has(x",
        ".a:bogus",
    ] {
        assert!(!is_contextual_target(target), "{target}");
    }
}

#[test]
fn normal_form_sorts_and_deduplicates() {
    let a = ConditionSet::new(vec![Condition::Pseudo(":hover".into()), Condition::Media("(x)".into())]);
    let b = ConditionSet::new(vec![
        Condition::Media("(x)".into()),
        Condition::Pseudo(":hover".into()),
        Condition::Pseudo(":hover".into()),
    ]);
    assert_eq!(a, b);
    assert_eq!(a.len(), 2);
    assert!(!a.is_empty());
    assert_eq!(a.canonical(), ":hover & @media (x)");
    assert_eq!(ConditionSet::default().with(&[Condition::Supports("(a)".into())]).canonical(), "@supports (a)");
    assert!(Condition::Attribute("[a]".into()).is_selector());
    assert!(!Condition::Supports("(a)".into()).is_selector());
    let relation = Condition::Relation { marker: "krA".into(), kind: RelationKind::After, state: ":checked".into() };
    assert_eq!(relation.canonical(), "relation After .krA:checked");
    assert_eq!(relation.class(), ConditionClass::Relation);
    assert_eq!(Condition::Container { name: Some("c".into()), query: "(x)".into() }.canonical(), "@container c (x)");
    assert_eq!(Condition::Container { name: None, query: "(x)".into() }.canonical(), "@container (x)");
    assert_eq!(collapse_whitespace("  a \n b "), "a b");
}

#[test]
fn ladder_orders_condition_sets() {
    let base = ConditionSet::default();
    let hover = one(":hover");
    let md = one("@media (width >= 48rem)");
    let lg = one("@media (min-width: 64rem)");
    let max_md = one("@media (max-width: 48rem)");
    let max_sm = one("@media (width < 40rem)");
    let dark = one("@media (prefers-color-scheme: dark)");
    let open = one("[data-state=\"open\"]");
    let within = ConditionSet::new(vec![Condition::Relation {
        marker: "krA".into(),
        kind: RelationKind::Within,
        state: String::new(),
    }]);
    let container = one("@container (min-width: 20rem)");
    let supports = one("@supports (display: grid)");
    let md_hover = hover.with(md.conditions());

    // step 2: count
    assert_eq!(compare_sets(&base, &hover), Ordering::Less);
    assert_eq!(compare_sets(&md_hover, &hover), Ordering::Greater);
    // step 3: attribute > pseudo-class > relation > at-rule
    assert_eq!(compare_sets(&hover, &md), Ordering::Greater);
    assert_eq!(compare_sets(&open, &hover), Ordering::Greater);
    assert_eq!(compare_sets(&within, &md), Ordering::Greater);
    assert_eq!(compare_sets(&hover, &within), Ordering::Greater);
    // step 4
    assert_eq!(compare_sets(&lg, &md), Ordering::Greater);
    assert_eq!(compare_sets(&max_sm, &max_md), Ordering::Greater);
    assert_eq!(compare_sets(&dark, &lg), Ordering::Greater);
    assert_eq!(compare_sets(&container, &md), Ordering::Greater);
    assert_eq!(compare_sets(&md, &supports), Ordering::Greater);
    assert_eq!(compare_sets(&one(":disabled"), &one(":hover")), Ordering::Greater);
    assert_eq!(compare_sets(&one(":has(> svg)"), &one(":first-child")), Ordering::Greater);
    // two-condition sets compare from the strongest condition down
    assert_eq!(compare_sets(&open.with(hover.conditions()), &open.with(md.conditions())), Ordering::Greater);
    // ties reach the deterministic break
    assert_eq!(compare_sets(&open, &one("[aria-expanded=\"true\"]")), Ordering::Equal);
}

#[test]
fn query_ranks() {
    assert_eq!(query_rank("(min-width: 40rem)"), 640_000);
    assert_eq!(query_rank("(width>=40em)"), 640_000);
    assert_eq!(query_rank("(width > 100px)"), 100_000);
    assert_eq!(query_rank("(max-width: 10px)"), -10_000);
    assert_eq!(query_rank("(width <= 10px)"), -10_000);
    assert_eq!(query_rank("(hover: hover)"), 2_000_000_000);
    assert_eq!(query_rank("(min-width: calc(1px))"), 2_000_000_000);
    assert_eq!(query_rank("(min-width: 1rem"), 16_000);
    assert_eq!(query_rank("(min-width:"), 2_000_000_000);
}

#[test]
fn exclusivity() {
    let open = one("[data-state=\"open\"]");
    let closed = one("[data-state='closed']");
    let expanded = one("[aria-expanded=\"true\"]");
    assert!(mutually_exclusive(&open, &closed, Declared::default()));
    assert!(!mutually_exclusive(&open, &open, Declared::default()));
    assert!(!mutually_exclusive(&open, &expanded, Declared::default()));
    assert!(!mutually_exclusive(&open, &one("[data-state]"), Declared::default()));
    assert!(!mutually_exclusive(&open, &one("[data-state^=\"o\"]"), Declared::default()));
    assert!(!mutually_exclusive(&open, &one(":hover"), Declared::default()));
    let relation = |state: &str| {
        ConditionSet::new(vec![Condition::Relation {
            marker: "krA".into(),
            kind: RelationKind::Within,
            state: state.into(),
        }])
    };
    assert!(mutually_exclusive(
        &relation("[data-size=\"sm\"]:hover"),
        &relation("[data-size=\"lg\"]"),
        Declared::default()
    ));
    assert!(!mutually_exclusive(&relation(":hover"), &relation(":focus"), Declared::default()));
    // A selector and its negation, on the element or on one anchor.
    let vertical = "[data-orientation=\"vertical\"]";
    assert!(mutually_exclusive(&one(vertical), &one(&format!(":not({vertical})")), Declared::default()));
    assert!(mutually_exclusive(&one(":not(:disabled)"), &one(":disabled"), Declared::default()));
    assert!(mutually_exclusive(&relation(&format!(":not({vertical})")), &relation(vertical), Declared::default()));
    assert!(!mutually_exclusive(&one(":not([data-a])"), &one("[data-b]"), Declared::default()));
    assert!(!mutually_exclusive(&one(":not(:hover)"), &one(":focus"), Declared::default()));
    // Two fixed positions counted from the same end.
    assert!(mutually_exclusive(&one(":last-child"), &one(":nth-last-child(2)"), Declared::default()));
    assert!(mutually_exclusive(&one(":first-child"), &one(":nth-child(3)"), Declared::default()));
    assert!(mutually_exclusive(&one(":nth-child(2)"), &one(":nth-child(3)"), Declared::default()));
    assert!(!mutually_exclusive(&one(":first-child"), &one(":last-child"), Declared::default()));
    assert!(!mutually_exclusive(&one(":first-child"), &one(":nth-child(1)"), Declared::default()));
    assert!(!mutually_exclusive(&one(":nth-child(2n)"), &one(":nth-child(3)"), Declared::default()));
    let raw = |condition: Condition| ConditionSet::new(vec![condition]);
    assert!(!mutually_exclusive(
        &raw(Condition::Pseudo(":nth-child(2".into())),
        &one(":first-child"),
        Declared::default()
    ));
    assert!(!mutually_exclusive(
        &one(":not(:hover)"),
        &raw(Condition::Media("(width > 1px)".into())),
        Declared::default()
    ));
    // Groups the project declares (`conditions.exclusive`), on the element or on one anchor.
    let declared = vec![vec!["[data-starting-style]".to_owned(), "[data-ending-style]".to_owned()]];
    assert!(mutually_exclusive(
        &one("[data-starting-style]"),
        &one("[data-ending-style]"),
        Declared { groups: &declared, across: &[], own: &[] }
    ));
    assert!(mutually_exclusive(
        &relation("[data-starting-style]"),
        &relation("[data-ending-style]"),
        Declared { groups: &declared, across: &[], own: &[] }
    ));
    assert!(!mutually_exclusive(
        &one("[data-starting-style]"),
        &one("[data-starting-style]"),
        Declared { groups: &declared, across: &[], own: &[] }
    ));
    assert!(!mutually_exclusive(
        &one("[data-starting-style]"),
        &one("[data-open]"),
        Declared { groups: &declared, across: &[], own: &[] }
    ));
    assert!(!mutually_exclusive(&one("[data-starting-style]"), &one("[data-ending-style]"), Declared::default()));
}

/// A parent read ranks with the pseudo-classes (D-104); the other reads keep the relation class.
#[test]
fn a_parent_read_ranks_as_a_pseudo_class() {
    let read = |kind| Condition::Relation { marker: "kr".to_owned(), kind, state: String::new() };
    assert_eq!(read(RelationKind::Parent).class(), ConditionClass::PseudoClass);
    assert_eq!(read(RelationKind::Within).class(), ConditionClass::Relation);
}

/// Two conditions of one set that never meet make it unreachable (D-105).
#[test]
fn a_set_with_two_exclusive_conditions_is_unreachable() {
    let set =
        |keys: &[&str]| ConditionSet::new(keys.iter().flat_map(|key| parse_condition_key(key).unwrap()).collect());
    assert_eq!(
        unreachable_pair(&set(&["[data-side=\"top\"]", "[data-side=\"bottom\"]"]), Declared::default()),
        Some(("[data-side=\"bottom\"]".to_owned(), "[data-side=\"top\"]".to_owned()))
    );
    assert_eq!(unreachable_pair(&set(&["[data-open]", ":hover"]), Declared::default()), None);
    let across = [vec!["[data-starting-style]".to_owned()], vec!["[data-entering]".to_owned()]];
    assert!(
        unreachable_pair(
            &set(&["[data-starting-style]", "[data-entering]"]),
            Declared { groups: &[], across: &across, own: &[] }
        )
        .is_some()
    );
}

/// A sheet writes `data-side` itself, on Base UI and React Aria alike: with the attribute declared
/// the project's own, Base UI's vocabulary naming `[data-side="left"]` keeps nothing apart from
/// React Aria's `[data-entering]` (KF-042).
#[test]
fn an_own_attribute_is_no_vocabulary_key() {
    let set =
        |keys: &[&str]| ConditionSet::new(keys.iter().flat_map(|key| parse_condition_key(key).unwrap()).collect());
    let across = [vec!["[data-side=\"left\"]".to_owned()], vec!["[data-entering]".to_owned()]];
    let sheet = set(&["[data-side=\"left\"]", "[data-entering]"]);
    let apart = |set: &ConditionSet, own: &[String]| {
        unreachable_pair(set, Declared { groups: &[], across: &across, own }).is_some()
    };
    let (own, other) = (["data-side".to_owned()], ["data-align".to_owned()]);
    assert!(apart(&sheet, &[]));
    assert!(!apart(&sheet, &own));
    // Another attribute's keys stay the vocabularies', and two values of the own one still never meet.
    assert!(apart(&sheet, &other));
    assert!(apart(&set(&["[data-side=\"left\"]", "[data-side=\"top\"]"]), &own));
    assert!(!apart(&set(&[":hover", "[data-entering]"]), &own));
}
