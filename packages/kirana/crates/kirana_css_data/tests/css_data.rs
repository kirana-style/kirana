use kirana_css_data::generated::{
    FAMILY_2_END, FAMILY_4_END, NUMERIC, PROPERTIES, PROPERTY_INDEX, PSEUDO_CLASSES, PSEUDO_ELEMENTS, SHORTHANDS,
};
use kirana_css_data::*;

#[test]
fn generated_lists_are_sorted_and_unique() {
    for list in [NUMERIC, SHORTHANDS, PSEUDO_CLASSES, PSEUDO_ELEMENTS] {
        assert!(list.windows(2).all(|pair| pair[0] < pair[1]), "unsorted or duplicate list");
    }
    assert!(PROPERTY_INDEX.windows(2).all(|pair| pair[0].0 < pair[1].0), "unsorted property index");
    assert_eq!(PROPERTY_INDEX.len(), PROPERTIES.len());
    assert!(PROPERTY_INDEX.iter().all(|(name, index)| PROPERTIES[usize::from(*index)] == *name));
}

#[test]
fn box_families_lead_the_property_table() {
    assert_eq!(
        family_longhands("padding"),
        Some(&["padding-bottom", "padding-left", "padding-right", "padding-top"][..])
    );
    assert_eq!(property_index("padding"), Some(0));
    assert_eq!(family_longhands("gap"), Some(&["row-gap", "column-gap"][..]));
    assert_eq!(property_index("gap"), Some(FAMILY_4_END));
    assert_eq!(family_longhands("scroll-padding-block"), Some(&PROPERTIES[FAMILY_2_END - 2..FAMILY_2_END]));
    assert_eq!(family_longhands("padding-top"), None);
    assert_eq!(family_longhands("column-gap"), None);
    assert_eq!(family_longhands("border"), None);
    assert_eq!(family_longhands("unknown"), None);
}

#[test]
fn properties() {
    assert!(is_known_property("text-wrap"));
    assert!(is_known_property("-webkit-line-clamp"));
    assert!(!is_known_property("colour"));
    assert!(is_known_property("-webkit-box-orient"));
    assert_eq!(property_index("-webkit-box-orient"), None);
    assert_eq!(property_index("align-content").map(|index| PROPERTIES[index]), Some("align-content"));
    assert!(accepts_number("line-height"));
    assert!(accepts_number("z-index"));
    assert!(!accepts_number("width"));
    assert!(is_shorthand("padding"));
    assert!(!is_shorthand("padding-top"));
}

#[test]
fn selectors() {
    assert!(is_pseudo_class(":hover"));
    assert!(is_pseudo_class(":nth-child"));
    assert!(is_pseudo_class(":-webkit-autofill"));
    assert!(!is_pseudo_class(":bogus"));
    assert!(is_pseudo_element("::after"));
    assert!(is_pseudo_element("::-webkit-scrollbar"));
    assert!(!is_pseudo_element("::bogus"));
    assert!(!is_pseudo_element("after"));
}

#[test]
fn pseudo_class_ranks_follow_the_ladder_table() {
    let order = [
        ":nth-child",
        ":has",
        ":link",
        ":visited",
        ":target",
        ":hover",
        ":focus-within",
        ":focus",
        ":focus-visible",
        ":active",
        ":enabled",
        ":checked",
        ":indeterminate",
        ":placeholder-shown",
        ":autofill",
        ":required",
        ":invalid",
        ":disabled",
    ];
    for pair in order.windows(2) {
        assert!(pseudo_class_rank(pair[0]) < pseudo_class_rank(pair[1]), "{pair:?}");
    }
    for structural in [
        ":first-child",
        ":last-child",
        ":only-child",
        ":nth-last-child",
        ":nth-of-type",
        ":nth-last-of-type",
        ":first-of-type",
        ":last-of-type",
        ":only-of-type",
        ":empty",
    ] {
        assert_eq!(pseudo_class_rank(structural), 0);
    }
    assert_eq!(pseudo_class_rank(":open"), pseudo_class_rank(":is"));
}

#[test]
fn logical_and_physical() {
    assert!(is_logical("padding-inline-start"));
    assert!(is_logical("inline-size"));
    assert!(is_logical("border-start-end-radius"));
    assert!(is_logical("border-end-start-radius"));
    assert!(!is_logical("display"));
    assert!(!is_logical("padding-left"));
    assert!(PropertyRank::Shorthand < PropertyRank::Logical);
    assert!(PropertyRank::Logical < PropertyRank::Physical);
    let logical = [
        "margin-inline-start",
        "margin-inline-end",
        "margin-block-start",
        "margin-block-end",
        "padding-inline-start",
        "padding-inline-end",
        "padding-block-start",
        "padding-block-end",
        "inset-inline-start",
        "inset-inline-end",
        "inset-block-start",
        "inset-block-end",
        "inline-size",
        "block-size",
        "min-inline-size",
        "min-block-size",
        "max-inline-size",
        "max-block-size",
        "border-inline-start-width",
        "border-inline-end-width",
        "border-block-start-width",
        "border-block-end-width",
        "border-inline-start-color",
        "border-inline-end-color",
        "border-block-start-color",
        "border-block-end-color",
        "border-inline-start-style",
        "border-inline-end-style",
        "border-block-start-style",
        "border-block-end-style",
        "border-start-start-radius",
        "border-start-end-radius",
        "border-end-start-radius",
        "border-end-end-radius",
    ];
    for name in logical {
        let physical = physical_counterpart(name).unwrap();
        assert!(is_known_property(physical) && is_logical(name) && !is_logical(physical), "{name}");
    }
    assert_eq!(physical_counterpart("color"), None);
}

#[test]
fn colour_keywords_are_named_and_system_colours_in_any_case() {
    assert!(kirana_css_data::is_colour_keyword("red"));
    assert!(kirana_css_data::is_colour_keyword("CanvasText"));
    assert!(kirana_css_data::is_colour_keyword("ButtonHighlight"));
    assert!(!kirana_css_data::is_colour_keyword("sm"));
}

#[test]
fn keywords_follow_the_grammar() {
    use kirana_css_data::{keywords, pseudo_selectors};
    assert!(keywords("display").contains(&"grid"));
    assert!(keywords("align-items").contains(&"center"));
    assert!(keywords("color").is_empty());
    assert!(keywords("not-a-property").is_empty());
    assert!(pseudo_selectors().any(|name| name == ":hover"));
    assert!(pseudo_selectors().any(|name| name == "::before"));
}
