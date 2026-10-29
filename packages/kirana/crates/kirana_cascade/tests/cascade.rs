use kirana_cascade::*;
use kirana_ir::{AtomValue, ConditionSet, EntryKey, Handle, Op, Property, Target};

fn expand(name: &str, value: &str) -> Vec<String> {
    let expanded = declare(name, RawValue::Str(value)).unwrap();
    expanded.declarations.iter().map(|(property, css)| format!("{}={css}", property.name)).collect()
}

#[test]
fn longhands_keep_author_text() {
    assert_eq!(expand("color", " oklch(0.852  0.199 91.936) "), ["color=oklch(0.852 0.199 91.936)"]);
    assert_eq!(expand("marginInlineStart", "calc(0.25rem * -1)"), ["margin-inline-start=calc(0.25rem * -1)"]);
    assert_eq!(
        expand("fontFamily", "\"Inter  Variable\", sans-serif"),
        ["font-family=\"Inter  Variable\", sans-serif"]
    );
    assert_eq!(expand("textWrap", "pretty"), ["text-wrap=pretty"]);
    assert_eq!(expand("WebkitLineClamp", "2"), ["-webkit-line-clamp=2"]);
    assert_eq!(expand("--my-gap", "  1rem "), ["--my-gap=1rem"]);
}

#[test]
fn shorthands_expand() {
    // One component: a shorthand atom (D-045). Several components: the typed longhands.
    assert_eq!(expand("padding", "0"), ["padding=0"]);
    assert_eq!(expand("paddingInline", "1rem"), ["padding-inline=1rem"]);
    assert_eq!(
        expand("padding", "1px 2px"),
        ["padding-top=1px", "padding-right=2px", "padding-bottom=1px", "padding-left=2px"]
    );
    assert_eq!(expand("flex", "1"), ["flex-grow=1", "flex-shrink=1", "flex-basis=0%"]);
    assert_eq!(expand("border", "1px solid red").len(), 12);
    assert!(expand("textDecoration", "underline").contains(&"text-decoration-thickness=initial".to_owned()));
}

#[test]
fn unsplittable_shorthands_warn() {
    let expanded = declare("padding", RawValue::Str("var(--x)")).unwrap();
    assert_eq!(expanded.declarations, [(Property::shorthand("padding"), "var(--x)".to_owned())]);
    assert_eq!(expanded.warnings, [DeclarationWarning::Unsplittable { property: "padding".into() }]);
}

#[test]
fn longhand_names() {
    let names = |name: &str| longhands_of(name).unwrap().into_iter().map(|p| p.name).collect::<Vec<_>>();
    assert_eq!(names("padding"), ["padding-bottom", "padding-left", "padding-right", "padding-top"]);
    assert_eq!(names("overscrollBehavior"), ["overscroll-behavior-x", "overscroll-behavior-y"]);
    assert_eq!(names("border").len(), 12);
    assert_eq!(names("color"), ["color"]);
    assert_eq!(names("--x"), ["--x"]);
    assert_eq!(longhands_of("colour"), Err(DeclarationError::UnknownProperty { name: "colour".into() }));
}

#[test]
fn known_longhands_are_longhands_of() {
    // The table holds every shorthand; any other name is worked out as `longhands_of` does.
    let names = kirana_css_data::shorthands().iter().copied().chain(["color", "margin-top", "--x", "colour"]);
    for name in names {
        assert_eq!(known_longhands(name).map(|longhands| longhands.into_owned()), longhands_of(name).ok(), "{name}");
    }
}

#[test]
fn a_longhand_parses_as_its_own_property() {
    // `declare_with` skips Lightning CSS's parse for a longhand because the parse would only give
    // back the id the name already gives: so for every longhand a shorthand splits into.
    use lightningcss::properties::{Property as Parsed, PropertyId};
    use lightningcss::stylesheet::ParserOptions;
    let longhands = kirana_css_data::shorthands().iter().flat_map(|name| longhands_of(name).unwrap());
    let mut checked = 0;
    for longhand in longhands.chain([Property::longhand("--x")]) {
        let id = PropertyId::from(longhand.name.as_str());
        if id.longhands().is_some() || kirana_css_data::family_longhands(&longhand.name).is_some() {
            continue;
        }
        for value in ["inherit", "var(--x)"] {
            let parsed = Parsed::parse_string(id.clone(), value, ParserOptions::default()).unwrap();
            assert_eq!(parsed.property_id(), id, "{} with {value}", longhand.name);
        }
        checked += 1;
    }
    assert!(checked > 100, "{checked} longhands");
}

#[test]
fn single_component_shorthands_are_atoms() {
    let tokens = |variable: &str| match variable {
        "--one" => Some(vec!["1px".to_owned()]),
        "--modes" => Some(vec!["1px".to_owned(), "2px".to_owned()]),
        "--pair" => Some(vec!["1px 2px".to_owned()]),
        "--ink" => Some(vec!["red".to_owned()]),
        _ => None,
    };
    let names = |value: &str| {
        let expanded = declare_with("padding", RawValue::Str(value), &tokens).unwrap();
        (expanded.declarations.len(), expanded.warnings.len(), expanded.longhands())
    };
    assert_eq!(names("var(--one)"), (1, 0, 4));
    assert_eq!(names("var(--modes)"), (1, 0, 4));
    assert_eq!(names("var(--one, 3px)"), (1, 0, 4));
    assert_eq!(names("var(--pair)"), (1, 1, 4));
    assert_eq!(names("var(--library)"), (1, 1, 4));
    assert_eq!(names("min(var(--library), 10px)"), (1, 0, 4));
    assert_eq!(names("var(--a) var(--b)"), (1, 1, 4));
    assert_eq!(names("var(--a)x(var(--b))"), (1, 0, 4));
    assert_eq!(names("var(--a)px"), (1, 0, 4));
    assert_eq!(names("var(--a, var(--b))"), (1, 1, 4));
    assert!(is_single_component("calc(1px + 2px)"));
    assert!(!is_single_component("1px/2px"));
    assert!(!is_single_component("a, b"));
    let color = declare_with("color", RawValue::Str("var(--ink)"), &tokens).unwrap();
    assert_eq!(color.longhands(), 1);
}

#[test]
fn numbers() {
    assert_eq!(declare("opacity", RawValue::Number(0.5)).unwrap().declarations[0].1, "0.5");
    assert_eq!(declare("width", RawValue::Number(0.0)).unwrap().declarations[0].1, "0");
    assert_eq!(declare("--n", RawValue::Number(2.0)).unwrap().declarations[0].1, "2");
    assert_eq!(
        declare("width", RawValue::Number(5.0)),
        Err(DeclarationError::UnitlessLength { property: "width".into(), number: "5".into() })
    );
}

#[test]
fn rejections() {
    assert_eq!(
        declare("colour", RawValue::Str("red")),
        Err(DeclarationError::UnknownProperty { name: "colour".into() })
    );
    let invalid = |value: &str| match declare("color", RawValue::Str(value)) {
        Err(DeclarationError::InvalidValue { reason, .. }) => reason,
        other => panic!("{other:?}"),
    };
    assert_eq!(invalid("  "), "the value is empty");
    assert_eq!(invalid("rgb(1 2 3"), "unclosed bracket");
    assert_eq!(invalid("red)"), "unbalanced ')'");
    assert_eq!(invalid("a]"), "unbalanced ']'");
    assert_eq!(invalid("a}"), "unbalanced '}'");
    assert_eq!(invalid("[a}"), "unbalanced '}'");
    assert_eq!(invalid("red; color: blue"), "a value cannot contain ';'");
    assert_eq!(invalid("\"abc"), "unterminated string");
    assert!(invalid("red !important").contains("!important"));
    // Brackets inside strings do not count.
    assert_eq!(expand("content", "\")(\""), ["content=\")(\""]);
    assert_eq!(expand("gridTemplateAreas", "'a b' 'c d'"), ["grid-template-areas='a b' 'c d'"]);
}

#[test]
fn normalization_is_idempotent() {
    for text in ["  a   b ", "'x  y'  z", "\"a\"  'b  c'"] {
        let once = normalize_text(text);
        assert_eq!(normalize_text(&once), once);
    }
    assert_eq!(normalize_text("'x  y'  z"), "'x  y' z");
}

#[test]
fn colors() {
    assert!(is_color("oklch(0.5 0.1 20)"));
    assert!(is_color("light-dark(white, black)"));
    assert!(!is_color("darken"));
}

fn entry(target: Target, property: &str) -> Op {
    Op::Set(
        EntryKey::new(target, Property::longhand(property), ConditionSet::default()),
        AtomValue { css: "0".into(), deps: vec![], longhands: 1 },
    )
}

fn atom(shorthand: &str, longhands: u8) -> Op {
    Op::Set(
        EntryKey::new(Target::Element, Property::shorthand(shorthand), ConditionSet::default()),
        AtomValue { css: "0".into(), deps: vec![], longhands },
    )
}

fn mixed(logical: &str, physical: &str, winner: &str, equal: bool) -> MixedAxes {
    MixedAxes { logical: logical.into(), physical: physical.into(), winner: winner.into(), equal }
}

#[test]
fn mixed_logical_and_physical() {
    let mut handle = Handle::default();
    handle.apply(entry(Target::Element, "padding-inline-start"));
    handle.apply(entry(Target::Element, "padding-left"));
    handle.apply(entry(Target::PseudoElement("::after".into()), "margin-left"));
    handle.apply(entry(Target::Element, "margin-inline-start"));
    handle.apply(entry(Target::Element, "color"));
    // The same pair on another target is reported once.
    handle.apply(entry(Target::PseudoElement("::before".into()), "padding-inline-start"));
    handle.apply(entry(Target::PseudoElement("::before".into()), "padding-left"));
    assert_eq!(mixed_logical_physical(&handle), [mixed("padding-inline-start", "padding-left", "padding-left", true)]);

    // A later, narrower logical write wins as written: not reported.
    let mut narrower = Handle::default();
    narrower.apply(atom("padding", 4));
    narrower.apply(entry(Target::Element, "padding-inline-end"));
    assert_eq!(mixed_logical_physical(&narrower), []);

    // A later, broader physical write loses to the earlier logical longhand: reported.
    let mut broader = Handle::default();
    broader.apply(entry(Target::Element, "padding-inline-end"));
    broader.apply(atom("padding", 4));
    assert_eq!(
        mixed_logical_physical(&broader),
        [mixed("padding-inline-end", "padding-right", "padding-inline-end", false)]
    );

    // A later, broader logical write loses to the earlier physical longhand: reported.
    let mut logical_later = Handle::default();
    logical_later.apply(entry(Target::Element, "padding-top"));
    logical_later.apply(atom("padding-block", 2));
    assert_eq!(
        mixed_logical_physical(&logical_later),
        [mixed("padding-block-start", "padding-top", "padding-top", false)]
    );
}

proptest::proptest! {
    #[test]
    fn normalize_never_panics_and_is_idempotent(text in "\\PC{0,40}") {
        let once = normalize_text(&text);
        proptest::prop_assert_eq!(normalize_text(&once), once);
    }
}

/// Declarations across the box shorthand families: shorthands, logical shorthands and longhands.
const FAMILY: [&str; 24] = [
    "border",
    "borderTop",
    "borderInlineStart",
    "borderWidth",
    "borderColor",
    "borderTopWidth",
    "borderInlineWidth",
    "borderInlineStartWidth",
    "padding",
    "paddingTop",
    "paddingInline",
    "paddingLeft",
    "paddingInlineStart",
    "paddingBlock",
    "margin",
    "marginBlockEnd",
    "inset",
    "insetInline",
    "right",
    "borderRadius",
    "borderTopLeftRadius",
    "gap",
    "rowGap",
    "overflow",
];
/// Opaque single-component values: the families' members accept different values (`auto` is no
/// padding, `0` no colour), and what this models is how writes merge, not which values are valid.
const FAMILY_VALUES: [&str; 4] = ["first-value", "second-value", "third-value", "var(--v)"];

/// One author write in the property test: `(property, value or null, under :hover, null at the top)`.
type Write = (usize, Option<usize>, bool, bool);

/// A side shorthand (`borderTop`) splits typed values into unrelated longhand values, which the
/// intent model below does not describe; it takes the one value that stays a shorthand atom.
fn value_for(name: usize, value: usize) -> &'static str {
    if ["border", "borderTop", "borderInlineStart"].contains(&FAMILY[name]) { "var(--v)" } else { FAMILY_VALUES[value] }
}

/// The handle the compiler builds for one write, as the evaluator does (D-045).
fn compile(handle: &mut Handle, (name, value, hover, top): Write) {
    let conditions = if hover {
        ConditionSet::new(kirana_ir::parse_condition_key(":hover").unwrap())
    } else {
        ConditionSet::default()
    };
    let plan = write_plan(FAMILY[name]).unwrap();
    match value.map(|value| value_for(name, value)) {
        Some(value) => {
            let expanded = declare(FAMILY[name], RawValue::Str(value)).unwrap();
            let longhands = expanded.longhands();
            let atom = expanded
                .declarations
                .first()
                .filter(|(property, _)| property.rank == kirana_css_data::PropertyRank::Shorthand)
                .map(|(property, _)| property.name.clone());
            prepare_set(handle, &plan, &Target::Element, &conditions, atom.as_deref(), longhands);
            for (property, css) in expanded.declarations {
                let key = EntryKey::new(Target::Element, property, conditions.clone());
                handle.apply(Op::Set(key, AtomValue { css, deps: vec![], longhands }));
            }
        }
        None => handle.merge(&removal(&plan, &Target::Element, &conditions, top && !hover)),
    }
}

/// What the stylesheet makes of a handle for one longhand under one condition set: among the
/// longhand's own entries and the shorthand atoms that cover it, the one ladder step 5 ranks first —
/// the narrowest, with a longhand before a shorthand at equal breadth.
fn resolve(handle: &Handle, longhand: &str, hover: bool) -> Option<String> {
    handle
        .entries()
        .filter(|(key, _)| !key.conditions.is_empty() == hover)
        .filter(|(key, _)| {
            key.property.name == longhand
                || key.property.rank == kirana_css_data::PropertyRank::Shorthand
                    && longhands_of(&key.property.name).unwrap().iter().any(|member| member.name == longhand)
        })
        .min_by_key(|(key, value)| (value.longhands, key.property.rank == kirana_css_data::PropertyRank::Shorthand))
        .map(|(_, value)| value.css.clone())
}

proptest::proptest! {
    /// KRN-TEST-003 (3): merging the compiled handles — shorthand atoms, tombstones and unfolds — gives
    /// every longhand the value the author's intent gives it, where a shorthand assigns its value to
    /// each longhand it names and `null` removes them (at one condition set, or at all of them at the
    /// top, with the logical sides of a whole box it names, KF-064). Each write is merged as its own
    /// handle, as separate styles are.
    #[test]
    fn shorthand_atoms_merge_like_expanded_longhands(
        sequence in proptest::collection::vec(
            (0..FAMILY.len(), proptest::option::of(0..FAMILY_VALUES.len()), proptest::bool::ANY, proptest::bool::ANY),
            0..14,
        )
    ) {
        let mut merged = Handle::default();
        let mut intent: Vec<(String, bool, String)> = Vec::new();
        for write in sequence {
            let mut handle = Handle::default();
            compile(&mut handle, write);
            merged.merge(&handle);
            let (name, value, hover, top) = write;
            let mut longhands: Vec<String> = longhands_of(FAMILY[name]).unwrap().into_iter().map(|p| p.name).collect();
            if value.is_none() && top && !hover {
                let names: Vec<&str> = longhands.iter().map(String::as_str).collect();
                let logical: Vec<String> = kirana_css_data::logical_box(&names).into_iter().map(str::to_owned).collect();
                longhands.extend(logical);
            }
            for longhand in longhands.iter().map(|name| Property::longhand(name.clone())) {
                match value {
                    Some(value) => {
                        intent.retain(|(existing, at, _)| !(*existing == longhand.name && *at == hover));
                        intent.push((longhand.name.clone(), hover, value_for(name, value).to_owned()));
                    }
                    None => intent.retain(|(existing, at, _)| !(*existing == longhand.name && (*at == hover || top && !hover))),
                }
            }
        }
        let every: Vec<String> = FAMILY.iter().flat_map(|name| longhands_of(name).unwrap()).map(|p| p.name).collect();
        for longhand in every {
            for hover in [false, true] {
                let expected = intent.iter().find(|(name, at, _)| *name == longhand && *at == hover).map(|(_, _, value)| value.clone());
                proptest::prop_assert_eq!(resolve(&merged, &longhand, hover), expected, "{} hover={}", longhand, hover);
            }
        }
    }
}

#[test]
fn box_families_match_the_typed_longhands() {
    // The property table's families (from mdn-data) and Lightning CSS's longhands must agree, or a
    // family atom would replace the wrong keys (D-045).
    let mut families = 0;
    for shorthand in kirana_css_data::shorthands() {
        if let Some(members) = kirana_css_data::family_longhands(shorthand) {
            families += 1;
            let mut table: Vec<&str> = members.to_vec();
            let mut typed: Vec<String> = longhands_of(shorthand).unwrap().into_iter().map(|p| p.name).collect();
            table.sort_unstable();
            typed.sort_unstable();
            assert_eq!(table, typed, "{shorthand}");
        }
    }
    assert_eq!(families, 31);
    assert_eq!(breadth("padding"), 4);
    assert_eq!(breadth("borderTop"), 5);
    assert_eq!(breadth("borderInlineStart"), 3);
    assert_eq!(breadth("border"), 12);
    assert_eq!(breadth("color"), 1);
}

#[test]
fn write_plans_are_kept_up_to_a_bound() {
    // Custom properties typed in an editor, one plan each: past the bound the cache starts over,
    // and every plan is still built right.
    for index in 0..=PLANS_KEPT {
        let plan = write_plan(&format!("--typed-{index}")).unwrap();
        assert_eq!(plan.longhands.len(), 1);
    }
    assert_eq!(write_plan("padding").unwrap().longhands.len(), 4);
}
