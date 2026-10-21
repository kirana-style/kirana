//! CSS knowledge the engine needs without parsing values (tier 1).
//!
//! The lists in [`generated`] come from MDN's `mdn-data` (CC0-1.0) through
//! `scripts/gen-css-data.ts`; the rankings below are Kirana's own
//! ([08-conditions-and-cascade](../../../../spec/08-conditions-and-cascade.md#the-precedence-ladder)).

// Written by scripts/gen-css-data.ts; CI regenerates it and diffs, so rustfmt must leave it as written.
#[rustfmt::skip]
pub mod generated;
pub mod grammar;

use generated::{
    COLOUR_KEYWORDS, FAMILY_2_END, FAMILY_4_END, KEYWORDS, NUMERIC, PROPERTIES, PROPERTY_INDEX, PSEUDO_CLASSES,
    PSEUDO_ELEMENTS, SHORTHANDS,
};

/// Every shorthand property in the data, sorted.
pub fn shorthands() -> &'static [&'static str] {
    SHORTHANDS
}

/// The position of a property in [`PROPERTIES`]: its code in class names (D-037).
pub fn property_index(kebab: &str) -> Option<usize> {
    PROPERTY_INDEX.binary_search_by(|(name, _)| name.cmp(&kebab)).ok().map(|found| usize::from(PROPERTY_INDEX[found].1))
}

/// The longhands of a box shorthand family (`padding`, `gap`, `border-inline-width`, …): the
/// properties a single component sets to itself (D-045). The table places them right after the
/// shorthand, which is what lets the private runtime find them from the code alone.
pub fn family_longhands(kebab: &str) -> Option<&'static [&'static str]> {
    let index = property_index(kebab)?;
    let size = if index < FAMILY_4_END {
        index.is_multiple_of(5).then_some(4)
    } else if index < FAMILY_2_END {
        (index - FAMILY_4_END).is_multiple_of(3).then_some(2)
    } else {
        None
    }?;
    Some(&PROPERTIES[index + 1..=index + size])
}

/// What a declaration of a property sets, for telling which declarations can decide the same thing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sets {
    /// The property itself: a longhand, or a custom property.
    Itself,
    /// These longhands and nothing else: a shorthand, or a legacy alias.
    Longhands(&'static [&'static str]),
    /// A shorthand whose longhands are not all known, which may set any property.
    Unknown,
}

/// What a declaration of `kebab` sets.
///
/// A box family's longhands come from the property table ([`family_longhands`]). The others listed
/// here are the shorthands and aliases whose longhands are complete per their specifications: MDN's
/// lists leave out the properties a shorthand only resets (`border` resets `border-image`, `font`
/// resets `font-kerning`), and call `white-space` a longhand though CSS Text 4 made it a shorthand.
/// Every other shorthand is [`Sets::Unknown`].
pub fn sets(kebab: &str) -> Sets {
    if let Some(longhands) = family_longhands(kebab) {
        return Sets::Longhands(longhands);
    }
    let listed: &'static [&'static str] = match kebab {
        "animation-range" => &["animation-range-start", "animation-range-end"],
        "columns" => &["column-width", "column-count", "column-height"],
        "contain-intrinsic-size" => &["contain-intrinsic-width", "contain-intrinsic-height"],
        "corner-shape" => &[
            "corner-top-left-shape",
            "corner-top-right-shape",
            "corner-bottom-left-shape",
            "corner-bottom-right-shape",
        ],
        "interest-delay" => &["interest-delay-start", "interest-delay-end"],
        "text-wrap" => &["text-wrap-mode", "text-wrap-style"],
        "white-space" => &["white-space-collapse", "text-wrap-mode"],
        "grid-gap" => &["row-gap", "column-gap"],
        "grid-row-gap" => &["row-gap"],
        "grid-column-gap" => &["column-gap"],
        "word-wrap" => &["overflow-wrap"],
        "page-break-after" => &["break-after"],
        "page-break-before" => &["break-before"],
        "page-break-inside" => &["break-inside"],
        _ if is_shorthand(kebab) => return Sets::Unknown,
        _ => return Sets::Itself,
    };
    Sets::Longhands(listed)
}

/// Whether the property is known: documented by MDN, or vendor-prefixed (`-webkit-box-orient`
/// is still required for `-webkit-line-clamp` and is not in `mdn-data`).
pub fn is_known_property(kebab: &str) -> bool {
    property_index(kebab).is_some() || ["-webkit-", "-moz-", "-ms-"].iter().any(|prefix| kebab.starts_with(prefix))
}

/// Whether the property's grammar accepts a bare number (`opacity: 0.5`, `zIndex: 10`).
pub fn accepts_number(kebab: &str) -> bool {
    NUMERIC.binary_search(&kebab).is_ok()
}

/// Whether MDN documents the property as a shorthand.
pub fn is_shorthand(kebab: &str) -> bool {
    SHORTHANDS.binary_search(&kebab).is_ok()
}

fn is_vendor(name: &str, colons: &str) -> bool {
    ["-webkit-", "-moz-", "-ms-"]
        .iter()
        .any(|prefix| name.strip_prefix(colons).is_some_and(|rest| rest.starts_with(prefix)))
}

/// The keyword values a property's grammar names (`display` → `block`, `flex`, `grid`, …), for
/// editor completion. Colours and the CSS-wide keywords are not included.
pub fn keywords(kebab: &str) -> &'static [&'static str] {
    KEYWORDS.binary_search_by(|(name, _)| name.cmp(&kebab)).map_or(&[], |found| KEYWORDS[found].1)
}

/// Every pseudo-class (with its colon) and pseudo-element (with both), for editor completion.
pub fn pseudo_selectors() -> impl Iterator<Item = &'static str> {
    PSEUDO_CLASSES.iter().chain(PSEUDO_ELEMENTS).copied()
}

/// Whether `:name` (without arguments) is a pseudo-class. Vendor-prefixed names are accepted.
pub fn is_pseudo_class(name: &str) -> bool {
    PSEUDO_CLASSES.binary_search(&name).is_ok() || is_vendor(name, ":")
}

/// Whether `::name` (without arguments) is a pseudo-element. Vendor-prefixed names are accepted.
pub fn is_pseudo_element(name: &str) -> bool {
    PSEUDO_ELEMENTS.binary_search(&name).is_ok() || is_vendor(name, "::")
}

/// The pseudo-class order of ladder step 4, low to high. Pseudo-classes not in the table share
/// the functional group's rank; the deterministic tie-break orders them.
pub fn pseudo_class_rank(name: &str) -> u8 {
    match name {
        ":first-child" | ":last-child" | ":only-child" | ":nth-child" | ":nth-last-child" | ":nth-of-type"
        | ":nth-last-of-type" | ":first-of-type" | ":last-of-type" | ":only-of-type" | ":empty" => 0,
        ":link" => 2,
        ":visited" => 3,
        ":target" => 4,
        ":hover" => 5,
        ":focus-within" => 6,
        ":focus" => 7,
        ":focus-visible" => 8,
        ":active" => 9,
        ":enabled" => 10,
        ":checked" => 11,
        ":indeterminate" => 12,
        ":placeholder-shown" => 13,
        ":autofill" => 14,
        ":required" => 15,
        ":invalid" => 16,
        ":disabled" => 17,
        _ => 1,
    }
}

/// Which box-model axis family a longhand belongs to (ladder step 5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum PropertyRank {
    /// A shorthand atom: one declaration that covers its longhands (D-045).
    Shorthand,
    /// A flow-relative longhand (`padding-inline-start`, `inline-size`).
    Logical,
    /// A physical longhand or any other property.
    Physical,
}

/// Whether a longhand is flow-relative.
pub fn is_logical(kebab: &str) -> bool {
    let bare = kebab.trim_start_matches('-');
    bare.contains("inline") && !bare.starts_with("display")
        || bare.contains("block") && !bare.starts_with("display")
        || bare.ends_with("-start-radius")
        || bare.ends_with("-end-radius")
}

/// The physical longhand a logical one conflicts with in horizontal-tb, left-to-right writing,
/// used only to report `mixed-logical-physical`.
pub fn physical_counterpart(kebab: &str) -> Option<&'static str> {
    Some(match kebab {
        "margin-inline-start" => "margin-left",
        "margin-inline-end" => "margin-right",
        "margin-block-start" => "margin-top",
        "margin-block-end" => "margin-bottom",
        "padding-inline-start" => "padding-left",
        "padding-inline-end" => "padding-right",
        "padding-block-start" => "padding-top",
        "padding-block-end" => "padding-bottom",
        "inset-inline-start" => "left",
        "inset-inline-end" => "right",
        "inset-block-start" => "top",
        "inset-block-end" => "bottom",
        "inline-size" => "width",
        "block-size" => "height",
        "min-inline-size" => "min-width",
        "min-block-size" => "min-height",
        "max-inline-size" => "max-width",
        "max-block-size" => "max-height",
        "border-inline-start-width" => "border-left-width",
        "border-inline-end-width" => "border-right-width",
        "border-block-start-width" => "border-top-width",
        "border-block-end-width" => "border-bottom-width",
        "border-inline-start-color" => "border-left-color",
        "border-inline-end-color" => "border-right-color",
        "border-block-start-color" => "border-top-color",
        "border-block-end-color" => "border-bottom-color",
        "border-inline-start-style" => "border-left-style",
        "border-inline-end-style" => "border-right-style",
        "border-block-start-style" => "border-top-style",
        "border-block-end-style" => "border-bottom-style",
        "border-start-start-radius" => "border-top-left-radius",
        "border-start-end-radius" => "border-top-right-radius",
        "border-end-start-radius" => "border-bottom-left-radius",
        "border-end-end-radius" => "border-bottom-right-radius",
        _ => return None,
    })
}

/// The group of longhands that can set the same thing on some element as `kebab`, whatever its
/// writing mode, and whether `kebab` is the flow-relative member: `margin-inline-start` and all four
/// physical margins share `margin`, `inline-size` and `height` share `size`.
///
/// Two longhands compete when they are the same property, or share a group and one of them is
/// flow-relative: `margin-inline-start` is `margin-right` in right-to-left text and `margin-top` in
/// vertical writing, while `margin-left` never sets the top margin. A group may hold properties that
/// never meet, which only costs the stylesheet writer a merge.
pub fn flow_group(kebab: &str) -> (String, bool) {
    if kebab.starts_with("--") {
        return (kebab.to_owned(), false);
    }
    let tokens: Vec<&str> = kebab.split('-').collect();
    let mut kept: Vec<&str> = Vec::with_capacity(tokens.len());
    let (mut logical, mut sided) = (false, false);
    let mut index = 0;
    while index < tokens.len() {
        let token = tokens[index];
        let next = tokens.get(index + 1).copied();
        let pair = matches!(next, Some("start" | "end"));
        match token {
            "inline" | "block" => {
                logical = true;
                index += usize::from(pair);
            }
            "start" | "end" if pair => {
                logical = true;
                index += 1;
            }
            "top" | "bottom" if matches!(next, Some("left" | "right")) => {
                sided = true;
                index += 1;
            }
            "top" | "right" | "bottom" | "left" | "x" | "y" => sided = true,
            _ => kept.push(token),
        }
        index += 1;
    }
    if let Some(last) = kept.last_mut().filter(|last| matches!(**last, "width" | "height") && !sided && !logical) {
        *last = "size";
    }
    let group = if kept.iter().all(|token| token.is_empty()) { "inset".to_owned() } else { kept.join("-") };
    (group, logical)
}

/// Whether a declaration of `a` and one of `b` can decide the same thing on one element ([`flow_group`]).
/// A vendor-prefixed property competes with everything: `-webkit-margin-start` is an alias of
/// `margin-inline-start` that its name does not spell.
pub fn competes(a: &str, b: &str) -> bool {
    let vendor = |name: &str| name.starts_with('-') && !name.starts_with("--");
    if a == b || vendor(a) || vendor(b) {
        return true;
    }
    let ((first, first_logical), (second, second_logical)) = (flow_group(a), flow_group(b));
    first == second && (first_logical || second_logical)
}

/// Whether a value is a colour keyword: a named colour or a system colour (`CanvasText`), in any case.
pub fn is_colour_keyword(value: &str) -> bool {
    COLOUR_KEYWORDS.binary_search(&value.to_ascii_lowercase().as_str()).is_ok()
}
