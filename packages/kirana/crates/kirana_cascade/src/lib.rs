//! Property and value semantics (tier 2): longhand expansion (KRN-CAS-001), value validation
//! and normalization (KRN-CAS-009), and the per-handle checks that need property knowledge.
//!
//! Lightning CSS (MPL-2.0, used unmodified as a dependency; D-025) supplies the typed parsers
//! that split shorthands. Kirana keeps the author's own text for longhands so colours are never
//! rewritten; only values produced by splitting a shorthand use Lightning CSS's serialization.

use std::sync::{OnceLock, RwLock};

use kirana_css_data::{accepts_number, is_known_property, physical_counterpart};
use kirana_ir::{ConditionSet, EntryKey, Handle, Op, Property, Target, number_to_string};
use kirana_shared::kebab_case;
use lightningcss::properties::{Property as LProperty, PropertyId};
use lightningcss::stylesheet::{ParserOptions, PrinterOptions};
use lightningcss::traits::Parse;
use lightningcss::values::color::CssColor;

/// A JavaScript primitive written as a property value.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RawValue<'a> {
    Str(&'a str),
    Number(f64),
}

/// Why a declaration was rejected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeclarationError {
    /// `unknown-property`, with a suggestion when the name is close to a real one.
    UnknownProperty { name: String },
    /// `invalid-value`.
    InvalidValue { property: String, reason: String },
    /// `unitless-length`: a number on a property whose grammar has no `<number>`.
    UnitlessLength { property: String, number: String },
}

/// A warning attached to an accepted declaration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeclarationWarning {
    /// `unsplittable-shorthand`.
    Unsplittable { property: String },
}

/// The longhands a declaration expands to.
#[derive(Debug, Clone, PartialEq)]
pub struct Expanded {
    pub declarations: Vec<(Property, String)>,
    pub warnings: Vec<DeclarationWarning>,
}

impl Expanded {
    /// How many longhands the authored declaration sets (ladder step 5).
    pub fn longhands(&self) -> u8 {
        let count = self
            .declarations
            .iter()
            .map(|(property, _)| {
                if property.rank == kirana_css_data::PropertyRank::Shorthand {
                    usize::from(breadth(&property.name))
                } else {
                    1
                }
            })
            .sum::<usize>();
        u8::try_from(count).unwrap_or(u8::MAX)
    }
}

/// The longhands a property name stands for, for `prop: null` and bridged values. Custom
/// properties and longhands stand for themselves; a shorthand stands for every longhand it
/// expands to.
pub fn longhands_of(name: &str) -> Result<Vec<Property>, DeclarationError> {
    let property = kebab_case(name);
    if property.starts_with("--") {
        return Ok(vec![Property::longhand(property)]);
    }
    if !is_known_property(&property) {
        return Err(DeclarationError::UnknownProperty { name: name.to_owned() });
    }
    // A box family's longhands come from the property table, which the private runtime also reads
    // (D-045); Lightning CSS does not split every family (`overscroll-behavior`).
    if let Some(members) = kirana_css_data::family_longhands(&property) {
        return Ok(members.iter().map(|member| Property::longhand(*member)).collect());
    }
    let mut out = Vec::new();
    collect_longhands(&PropertyId::from(property.as_str()), &mut out);
    Ok(out)
}

fn collect_longhands(id: &PropertyId<'_>, out: &mut Vec<Property>) {
    match id.longhands() {
        Some(longhands) => longhands.iter().for_each(|longhand| collect_longhands(longhand, out)),
        None => out.push(Property::longhand(id.name())),
    }
}

/// Whether `text` is one `var(...)` expression and nothing else.
fn single_var(text: &str) -> Option<&str> {
    let inner = text.strip_prefix("var(")?.strip_suffix(')')?;
    let mut depth = 0i32;
    for character in inner.chars() {
        match character {
            '(' => depth += 1,
            ')' if depth == 0 => return None,
            ')' => depth -= 1,
            _ => {}
        }
    }
    Some(inner.split(',').next().unwrap_or(inner).trim())
}

/// Whether a declared value is one component (no top-level spaces, commas or slashes).
pub fn is_single_component(value: &str) -> bool {
    let mut depth = 0i32;
    for character in value.trim().chars() {
        match character {
            '(' => depth += 1,
            ')' => depth -= 1,
            ' ' | ',' | '/' if depth == 0 => return false,
            _ => {}
        }
    }
    true
}

/// Validates, normalizes and expands one declaration written as `camelCaseName: value`.
///
/// `variable_value` returns the declared value of a custom property the project defines, so a
/// shorthand written as one such `var()` can be split when that value is a single component.
pub fn declare(name: &str, raw: RawValue<'_>) -> Result<Expanded, DeclarationError> {
    declare_with(name, raw, &|_| None)
}

/// [`declare`] with knowledge of project variables.
pub fn declare_with(
    name: &str,
    raw: RawValue<'_>,
    variable_value: &dyn Fn(&str) -> Option<Vec<String>>,
) -> Result<Expanded, DeclarationError> {
    let property = kebab_case(name);
    if property.starts_with("--") {
        let text = match raw {
            RawValue::Str(text) => normalize_text(text),
            RawValue::Number(number) => number_to_string(number),
        };
        return Ok(single(Property::longhand(property), text));
    }
    if !is_known_property(&property) {
        return Err(DeclarationError::UnknownProperty { name: name.to_owned() });
    }
    let text = match raw {
        RawValue::Number(number) if number == 0.0 || accepts_number(&property) => number_to_string(number),
        RawValue::Number(number) => {
            return Err(DeclarationError::UnitlessLength { property, number: number_to_string(number) });
        }
        RawValue::Str(text) => normalize_text(text),
    };
    if text.is_empty() {
        return Err(DeclarationError::InvalidValue { property, reason: "the value is empty".to_owned() });
    }
    if let Some(reason) = structural_problem(&text) {
        return Err(DeclarationError::InvalidValue { property, reason });
    }
    if let Some(reason) = grammar_problem(&property, &text, variable_value) {
        return Err(DeclarationError::InvalidValue { property, reason });
    }
    let parsed = LProperty::parse_string(PropertyId::from(property.as_str()), &text, ParserOptions::default())
        .expect("structurally valid values always parse, falling back to unparsed tokens");
    let family = kirana_css_data::family_longhands(&property).is_some();
    if parsed.property_id().longhands().is_none() && !family {
        return Ok(single(Property::longhand(property.clone()), text.clone()));
    }
    // One component sets every longhand of a box shorthand to itself, so the declaration stays one
    // shorthand atom (D-045). A bare `var()` could hold several components, so it qualifies only
    // when the project declares it with single-component values; a `var()` nested in a function
    // argument is always one component.
    let replicable = is_single_component(&text)
        && single_var(&text).is_none_or(|variable| {
            variable_value(variable).is_some_and(|values| values.iter().all(|value| is_single_component(value)))
        });
    if family && replicable {
        return Ok(single(Property::shorthand(property.clone()), text.clone()));
    }
    if matches!(parsed, LProperty::Unparsed(_)) || parsed.property_id().longhands().is_none() {
        return Ok(Expanded {
            declarations: vec![(Property::shorthand(property.clone()), text.clone())],
            warnings: vec![DeclarationWarning::Unsplittable { property: property.clone() }],
        });
    }
    let mut declarations = Vec::new();
    expand_into(&parsed, &mut declarations);
    Ok(Expanded { declarations, warnings: Vec::new() })
}

fn single(property: Property, text: String) -> Expanded {
    Expanded { declarations: vec![(property, text)], warnings: Vec::new() }
}

fn expand_into(property: &LProperty<'_>, out: &mut Vec<(Property, String)>) {
    let id = property.property_id();
    match id.longhands() {
        Some(longhands) => {
            for longhand in longhands {
                match property.longhand(&longhand) {
                    Some(value) => expand_into(&value, out),
                    // A component the typed value does not carry (for example
                    // `text-decoration-thickness` in `text-decoration: underline`) is reset, as the
                    // shorthand itself would reset it.
                    None => out.push((Property::longhand(longhand.name()), "initial".to_owned())),
                }
            }
        }
        None => out.push((
            Property::longhand(id.name()),
            property.value_to_css_string(PrinterOptions::default()).expect("typed values print"),
        )),
    }
}

/// Why a value does not fit its property's grammar (KRN-CAS-010), or `None` when it fits or cannot be
/// judged. A value that is one project token is judged by each value the token declares, so a
/// colour token on `padding` is caught.
fn grammar_problem(property: &str, text: &str, variable_value: &dyn Fn(&str) -> Option<Vec<String>>) -> Option<String> {
    use kirana_css_data::grammar::{Verdict, check};
    let token = single_var(text).and_then(variable_value);
    let values = token.clone().unwrap_or_else(|| vec![text.to_owned()]);
    values.iter().find_map(|value| match check(property, value) {
        Verdict::Rejected { expected } => Some(match &token {
            Some(_) => format!("the token's value `{value}` is not one it takes ({expected})"),
            None => format!("`{value}` is not a value it takes ({expected})"),
        }),
        Verdict::Accepted | Verdict::Unchecked => None,
    })
}

/// Collapses whitespace outside quoted strings and trims.
pub fn normalize_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut quote: Option<char> = None;
    let mut pending_space = false;
    for character in text.trim().chars() {
        match quote {
            Some(q) => {
                out.push(character);
                if character == q {
                    quote = None;
                }
            }
            None if character.is_whitespace() => pending_space = true,
            None => {
                if pending_space {
                    out.push(' ');
                    pending_space = false;
                }
                if character == '"' || character == '\'' {
                    quote = Some(character);
                }
                out.push(character);
            }
        }
    }
    out
}

/// Problems no CSS value can have: unbalanced brackets, declaration separators, `!important`.
fn structural_problem(text: &str) -> Option<String> {
    let mut stack = Vec::new();
    let mut quote: Option<char> = None;
    for character in text.chars() {
        if let Some(q) = quote {
            if character == q {
                quote = None;
            }
            continue;
        }
        match character {
            '"' | '\'' => quote = Some(character),
            '(' | '[' | '{' => stack.push(character),
            ')' | ']' | '}' => {
                let open = match character {
                    ')' => '(',
                    ']' => '[',
                    _ => '{',
                };
                if stack.pop() != Some(open) {
                    return Some(format!("unbalanced {character:?}"));
                }
            }
            ';' => return Some("a value cannot contain ';'".to_owned()),
            _ => {}
        }
    }
    if quote.is_some() {
        return Some("unterminated string".to_owned());
    }
    if !stack.is_empty() {
        return Some("unclosed bracket".to_owned());
    }
    if text.to_ascii_lowercase().contains("!important") {
        return Some("`!important` is not supported; the precedence ladder decides order".to_owned());
    }
    None
}

/// Whether a value is a colour (so a `{ light, dark }` token can use `light-dark()`).
pub fn is_color(text: &str) -> bool {
    CssColor::parse_string(text).is_ok()
}

/// Logical/physical pairs set on one element whose outcome the author could misread
/// (`mixed-logical-physical`, rule 7 of longhand expansion in doc 08). Ladder step 5 decides the
/// pair: the declaration that set fewer longhands wins, and physical wins at equal count. A pair is
/// reported when the counts are equal (the result then depends on the axis family, not on intent),
/// or when the winner was written before the loser, so a later write silently loses
/// (`padding: 0` after `paddingInlineStart`). A later, narrower write (`padding` then
/// `paddingInlineEnd`, Tailwind's `p-2 pe-8`) wins as written and is not reported.
pub fn mixed_logical_physical(handle: &Handle) -> Vec<MixedAxes> {
    // A shorthand atom takes part through its longhands.
    let covered: Vec<(&kirana_ir::Target, &kirana_ir::ConditionSet, String, usize, u8)> = handle
        .entries()
        .enumerate()
        .flat_map(|(order, (key, value))| {
            let names = match key.property.rank {
                kirana_css_data::PropertyRank::Shorthand => longhands_of(&key.property.name)
                    .map(|longhands| longhands.into_iter().map(|longhand| longhand.name).collect())
                    .unwrap_or_default(),
                _ => vec![key.property.name.clone()],
            };
            names.into_iter().map(move |name| (&key.target, &key.conditions, name, order, value.longhands))
        })
        .collect();
    let mut pairs = Vec::new();
    for (target, conditions, name, order, longhands) in &covered {
        let Some(physical) = physical_counterpart(name) else { continue };
        for (_, _, _, other_order, other_longhands) in
            covered.iter().filter(|(other_target, other_conditions, other, ..)| {
                other_target == target && other_conditions == conditions && other == physical
            })
        {
            let physical_wins = other_longhands <= longhands;
            let (winner_order, loser_order) = if physical_wins { (other_order, order) } else { (order, other_order) };
            let equal = other_longhands == longhands;
            if !equal && winner_order > loser_order {
                continue;
            }
            let pair = MixedAxes {
                logical: name.clone(),
                physical: physical.to_owned(),
                winner: if physical_wins { physical.to_owned() } else { name.clone() },
                equal,
            };
            if !pairs.contains(&pair) {
                pairs.push(pair);
            }
        }
    }
    pairs
}

/// Each inline-axis logical inset (kebab-case longhand) beside a `translate` or `transform` with a
/// non-zero inline component on the same target, as `(inset, translate property)` (KF-017).
/// `translate` and `transform` have no logical form: with `dir="rtl"` the inset moves to the other
/// side and the translate keeps pulling the same way. A target with a translate under a direction
/// condition (`:dir(…)`, `[dir…]`) has said what it does in each direction, and is left alone.
pub fn inset_beside_translate(handle: &Handle) -> Vec<(String, String)> {
    let mut pairs = Vec::new();
    let entries: Vec<_> = handle.entries().collect();
    for (key, _) in &entries {
        // A shorthand is reported once, as written (`inset-inline`).
        let inline = |name: &str| matches!(name, "inset-inline-start" | "inset-inline-end");
        let covers = match key.property.rank {
            kirana_css_data::PropertyRank::Shorthand => longhands_of(&key.property.name)
                .is_ok_and(|longhands| longhands.iter().any(|longhand| inline(&longhand.name))),
            _ => inline(&key.property.name),
        };
        if covers {
            let inset = key.property.name.clone();
            let same_target = entries.iter().filter(|(other, _)| other.target == key.target);
            let translates: Vec<_> = same_target
                .filter(|(other, _)| matches!(other.property.name.as_str(), "translate" | "transform"))
                .collect();
            if translates.iter().any(|(other, _)| other.conditions.conditions().iter().any(is_direction)) {
                continue;
            }
            for (other, value) in translates {
                let pair = (inset.clone(), other.property.name.clone());
                if moves_inline(&other.property.name, &value.css) && !pairs.contains(&pair) {
                    pairs.push(pair);
                }
            }
        }
    }
    pairs
}

/// Whether a condition depends on the writing direction.
fn is_direction(condition: &kirana_ir::Condition) -> bool {
    match condition {
        kirana_ir::Condition::Pseudo(text) => text.starts_with(":dir("),
        kirana_ir::Condition::Attribute(text) => text.starts_with("[dir"),
        _ => false,
    }
}

/// Whether a `translate` value, or a `transform`'s translate function, moves along the inline (x)
/// axis by an amount known at build time. One read from a custom property is left alone: it is set
/// at runtime, often from a pointer, whose movement is physical too.
fn moves_inline(property: &str, css: &str) -> bool {
    let zero = |text: &str| {
        let number = text.trim().trim_end_matches(|c: char| c.is_ascii_alphabetic() || c == '%');
        text.trim() == "none" || text.contains("var(") || number.parse::<f64>().is_ok_and(|value| value == 0.0)
    };
    if property == "translate" {
        return css.split_whitespace().next().is_some_and(|first| !zero(first));
    }
    let lower = css.to_ascii_lowercase();
    ["translatex(", "translate(", "translate3d("].iter().any(|function| {
        lower.match_indices(function).any(|(at, _)| {
            let rest = &lower[at + function.len()..];
            let first = rest.split([',', ')']).next().unwrap_or_default();
            !zero(first)
        })
    })
}

/// One reported logical/physical pair: the two longhand names, the one that wins, and whether both
/// set the same number of longhands.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MixedAxes {
    pub logical: String,
    pub physical: String,
    pub winner: String,
    pub equal: bool,
}

/// Every shorthand the engine can split, with its longhands; computed once.
fn shorthand_table() -> &'static [(Property, Vec<Property>)] {
    static TABLE: OnceLock<Vec<(Property, Vec<Property>)>> = OnceLock::new();
    TABLE.get_or_init(|| {
        kirana_css_data::shorthands()
            .iter()
            .filter_map(|name| {
                longhands_of(name)
                    .ok()
                    .filter(|longhands| longhands.len() > 1)
                    .map(|longhands| (Property::shorthand(*name), longhands))
            })
            .collect()
    })
}

/// Every shorthand's [`breadth`], computed once. The table is static, so these never change.
fn breadths() -> &'static kirana_shared::FxHashMap<String, u8> {
    static BREADTHS: OnceLock<kirana_shared::FxHashMap<String, u8>> = OnceLock::new();
    BREADTHS.get_or_init(|| {
        shorthand_table()
            .iter()
            .map(|(shorthand, _)| (shorthand.name.clone(), compute_breadth(&shorthand.name)))
            .collect()
    })
}

/// What writing one property does to shorthand atoms at the same target and conditions (D-045).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WritePlan {
    /// The longhands the property stands for: itself for a longhand.
    pub longhands: Vec<Property>,
    /// Shorthands whose longhands are all among `longhands`, the property itself included: a write
    /// replaces them entirely.
    pub covered: Vec<Property>,
    /// Shorthands that share only some longhands with the property, narrowest first: `(shorthand, the
    /// longhands it keeps, its breadth)`. A removal unfolds all of them; a set only the ones no broader than what
    /// it writes, because a broader shorthand atom already loses to it at ladder step 5.
    pub overlapping: Vec<(Property, Vec<Property>, u8)>,
}

/// The plan for writing `name` (camelCase or kebab-case).
///
/// Memoised: the plan depends on nothing but the name and the static shorthand table, and building
/// one walks every shorthand. A declaration asks for it on every transform of every module.
pub fn write_plan(name: &str) -> Result<WritePlan, DeclarationError> {
    static PLANS: OnceLock<RwLock<kirana_shared::FxHashMap<String, WritePlan>>> = OnceLock::new();
    let plans = PLANS.get_or_init(RwLock::default);
    if let Some(plan) = plans.read().expect("not poisoned").get(name) {
        return Ok(plan.clone());
    }
    let plan = build_plan(name)?;
    plans.write().expect("not poisoned").insert(name.to_owned(), plan.clone());
    Ok(plan)
}

fn build_plan(name: &str) -> Result<WritePlan, DeclarationError> {
    Ok(plan_of(longhands_of(name)?))
}

/// The plan for writing `longhands`: the shorthands they cover whole, and those they share some
/// longhands with.
fn plan_of(longhands: Vec<Property>) -> WritePlan {
    let mut covered = Vec::new();
    let mut overlapping = Vec::new();
    for (shorthand, members) in shorthand_table() {
        let shared = members.iter().filter(|member| longhands.contains(member)).count();
        if shared == members.len() {
            covered.push(shorthand.clone());
        } else if shared > 0 {
            let keep = members.iter().filter(|member| !longhands.contains(member)).cloned().collect();
            overlapping.push((shorthand.clone(), keep, breadth(&shorthand.name)));
        }
    }
    // Narrowest first. Two overlapping atoms that coexist were written narrow-after-broad (a broad
    // write removes or unfolds a narrower atom), so the narrower atom's longhands must be in place
    // before the broader one unfolds and finds them already owned.
    overlapping.sort_by_key(|(_, _, breadth)| *breadth);
    WritePlan { longhands, covered, overlapping }
}

/// Ops that come before setting a property at `conditions`: unfold every shorthand atom no broader
/// than it that shares some of its longhands, remove every shorthand it covers, and — when the
/// property is written as a shorthand atom — remove its longhands (D-045). The same ops travel as
/// class-string tokens so the private runtime merges exactly as the compiler does.
/// `atom` names the shorthand atom about to be set, if the write is one; `breadth` is what the
/// write ranks as at ladder step 5 (the atom's breadth, or 1 per longhand written).
pub fn prepare_set(
    handle: &mut Handle,
    plan: &WritePlan,
    target: &Target,
    conditions: &ConditionSet,
    atom: Option<&str>,
    breadth: u8,
) {
    let remove = |property: &Property| Op::Remove(EntryKey::new(target.clone(), property.clone(), conditions.clone()));
    for (shorthand, keep, other) in &plan.overlapping {
        if *other <= breadth {
            handle.apply(unfold(target, shorthand, keep, Some(conditions)));
        }
    }
    // The atom's own key is replaced by the set itself; a tombstone for it would only cost bytes.
    for shorthand in plan.covered.iter().filter(|shorthand| Some(shorthand.name.as_str()) != atom) {
        handle.apply(remove(shorthand));
    }
    // A family atom removes its longhands by itself: its code locates them (D-045).
    if atom.is_some_and(|name| kirana_css_data::family_longhands(name).is_none()) {
        plan.longhands.iter().for_each(|longhand| handle.apply(remove(longhand)));
    }
}

/// `prop: null` (every condition set when `every`) or `{ [condition]: null }`.
pub fn removal(plan: &WritePlan, target: &Target, conditions: &ConditionSet, every: bool) -> Handle {
    let mut handle = Handle::default();
    // A whole property removed removes the box it covers in logical sides too: `"*": null` on
    // `padding` drops an earlier `paddingInline`, which would otherwise outrank a later `padding`
    // (KF-064). A removal under conditions keeps to the property it names.
    let names: Vec<&str> = plan.longhands.iter().map(|property| property.name.as_str()).collect();
    let other = if every { kirana_css_data::logical_box(&names) } else { Vec::new() };
    let other = (!other.is_empty()).then(|| plan_of(other.into_iter().map(Property::longhand).collect()));
    for plan in std::iter::once(plan).chain(other.as_ref()) {
        for (shorthand, keep, _) in &plan.overlapping {
            handle.apply(unfold(target, shorthand, keep, (!every).then_some(conditions)));
        }
        for property in plan.covered.iter().chain(&plan.longhands) {
            handle.apply(if every {
                Op::RemoveProperty(target.clone(), property.clone())
            } else {
                Op::Remove(EntryKey::new(target.clone(), property.clone(), conditions.clone()))
            });
        }
    }
    handle
}

fn unfold(target: &Target, shorthand: &Property, keep: &[Property], conditions: Option<&ConditionSet>) -> Op {
    Op::Unfold {
        target: target.clone(),
        shorthand: shorthand.clone(),
        keep: keep.to_vec(),
        conditions: conditions.cloned(),
    }
}

/// What a shorthand atom ranks as at ladder step 5 (D-045): its number of longhands — except for a
/// *secondary* shorthand, one outside the box families that shares only some longhands with a
/// family (`border-top` with `border-width`), which ranks one above the largest such family. The
/// common family write (`borderWidth`) then needs no unfold token, a secondary write unfolds the
/// families instead, and a broader shorthand (`border`) still ranks below the secondary one.
pub fn breadth(name: &str) -> u8 {
    if let Some(breadth) = breadths().get(name) {
        return *breadth;
    }
    compute_breadth(name)
}

fn compute_breadth(name: &str) -> u8 {
    let longhands = longhands_of(name).unwrap_or_default();
    let kebab = kirana_shared::kebab_case(name);
    let overlapped = if kirana_css_data::family_longhands(&kebab).is_some() {
        0
    } else {
        shorthand_table()
            .iter()
            .filter(|(family, members)| {
                kirana_css_data::family_longhands(&family.name).is_some() && {
                    let shared = members.iter().filter(|member| longhands.contains(member)).count();
                    shared > 0 && shared < members.len() && shared < longhands.len()
                }
            })
            .map(|(_, members)| members.len() + 1)
            .max()
            .unwrap_or(0)
    };
    u8::try_from(longhands.len().max(overlapped)).unwrap_or(u8::MAX)
}
