//! `firstThatWorks()`, `positionTry()`, `viewTransition()`, `counterStyle()` and `fallback()`
//! (KRN-API-017 to KRN-API-020, KRN-API-022).

use std::sync::Arc;

use kirana_diagnostics::Code;
use kirana_ir::{
    Condition, CounterStyleDef, Dep, Handle, Key, PositionTryDef, TokenRef, TransitionPart, TransitionRule, Value,
    ViewTransitionDef, parse_condition_key,
};
use kirana_shared::kebab_case;

use crate::eval::Evaluator;

/// The reason of an unknown value whose problem has been reported where it arose, so a property
/// that receives it reports nothing more.
pub(crate) const REPORTED: &str = "reported where it arose";

/// Whether a property may appear in an `@position-try` block. The block accepts the properties
/// that place and size an anchored box and nothing else; a browser drops any other declaration
/// without a word, which is the failure Kirana reports instead.
fn position_try_accepts(property: &str) -> bool {
    matches!(
        property,
        "top"
            | "right"
            | "bottom"
            | "left"
            | "width"
            | "height"
            | "min-width"
            | "min-height"
            | "max-width"
            | "max-height"
            | "block-size"
            | "inline-size"
            | "min-block-size"
            | "min-inline-size"
            | "max-block-size"
            | "max-inline-size"
            | "align-self"
            | "justify-self"
            | "place-self"
            | "position-anchor"
            | "position-area"
    ) || property.starts_with("inset")
        || property.starts_with("margin")
}

/// The descriptors an `@counter-style` rule reads (CSS Counter Styles 3).
const COUNTER_STYLE_DESCRIPTORS: [&str; 10] =
    ["additive-symbols", "fallback", "negative", "pad", "prefix", "range", "speak-as", "suffix", "symbols", "system"];

/// Why a counter style draws nothing: its system (`symbolic` when unwritten) needs `symbols` or
/// `additive-symbols`, or extends another style and so may not define its own. A system Kirana does
/// not know is left to the browser.
fn missing_symbols(descriptors: &[(String, String)]) -> Option<String> {
    let has = |name: &str| descriptors.iter().any(|(descriptor, _)| descriptor == name);
    let system =
        descriptors.iter().find(|(descriptor, _)| descriptor == "system").map_or("symbolic", |(_, value)| value);
    let keyword = system.split_whitespace().next().unwrap_or_default().to_ascii_lowercase();
    match keyword.as_str() {
        "extends" if has("symbols") || has("additive-symbols") => {
            Some("a counter style that extends another takes no symbols of its own".to_owned())
        }
        "additive" if !has("additive-symbols") => Some("an additive counter style needs additiveSymbols".to_owned()),
        "cyclic" | "numeric" | "alphabetic" | "symbolic" | "fixed" if !has("symbols") => {
            Some(format!("a {keyword} counter style needs symbols"))
        }
        _ => None,
    }
}

impl Evaluator<'_, '_, '_> {
    /// `firstThatWorks(preferred, ...fallbacks)`: a run of static CSS values, preferred first. One
    /// value is that value.
    pub(crate) fn first_that_works(&self, arguments: &[(Value, (u32, u32))], span: (u32, u32)) -> Value {
        if arguments.is_empty() {
            return self.invalid(Code::InvalidFallback, span, "firstThatWorks() needs at least one value", None);
        }
        let mut members = Vec::new();
        for (value, at) in arguments {
            match value {
                Value::Str(_)
                | Value::Number(_)
                | Value::Token(_)
                | Value::Keyframes(_)
                | Value::PositionTry(_)
                | Value::CounterStyle(_) => {
                    members.push(value.clone());
                }
                Value::Fallbacks(_) => {
                    return self.invalid(Code::InvalidFallback, *at, "firstThatWorks() cannot be nested", None);
                }
                value if !value.is_static() => {
                    return self.invalid(
                        Code::InvalidFallback,
                        *at,
                        "every value of firstThatWorks() must be known at build time",
                        Some(
                            "for a value known only at runtime, read a variable with a fallback: var(--name, fallback)",
                        ),
                    );
                }
                _ => {
                    return self.invalid(
                        Code::InvalidFallback,
                        *at,
                        "this value of firstThatWorks() is not a CSS value",
                        None,
                    );
                }
            }
        }
        if members.len() == 1 {
            return members.remove(0);
        }
        Value::Fallbacks(Arc::new(members))
    }

    /// `fallback(token, ...rest)` (KRN-API-022, D-117): the first token an element sets, else the
    /// next, else the last value, as one `var()` chain read where it is used. Every argument but the
    /// last is a token an element may leave unset: a registered token of the universal syntax with no
    /// value, whose reference already falls back (`var(--k…,)`). A token with a value is never unset,
    /// so what follows it would never be read. The last is any token or static CSS value, a chain
    /// too. The result is a token whose CSS is the chain, so it is a value wherever a token is, and
    /// is written as its text outside a style; it is not a variable, and cannot be assigned.
    pub(crate) fn fallback(&self, arguments: &[(Value, (u32, u32))], span: (u32, u32)) -> Value {
        let Some(((last, last_at), tokens)) = arguments.split_last().filter(|(_, tokens)| !tokens.is_empty()) else {
            return self.invalid(
                Code::InvalidFallback,
                span,
                "fallback() takes a token and what to read when an element leaves it unset",
                Some("for example fallback(fade.edge, fade.size, \"2.5rem\")"),
            );
        };
        let mut read = Vec::new();
        for (value, at) in tokens {
            let Value::Token(token) = value else {
                return self.invalid(
                    Code::InvalidFallback,
                    *at,
                    "every value of fallback() but the last must be a token",
                    Some("put a plain value last: it is what the chain ends with"),
                );
            };
            match &token.variable {
                Some(variable) if token.css == format!("var({variable},)") => read.push((token, variable)),
                _ => {
                    return self.invalid(
                        Code::InvalidFallback,
                        *at,
                        format!(
                            "{} always has a value, so fallback() would never read what follows it",
                            token.identity
                        ),
                        Some("declare it { syntax: \"*\" } with no value, so an element may leave it unset"),
                    );
                }
            }
        }
        let end = match last {
            Value::Token(token) => token.css.clone(),
            Value::Str(_) | Value::Number(_) => crate::ops::to_string(last).expect("strings and numbers print"),
            value if !value.is_static() => {
                return self.invalid(
                    Code::InvalidFallback,
                    *last_at,
                    "the last value of fallback() must be known at build time",
                    None,
                );
            }
            _ => {
                return self.invalid(
                    Code::InvalidFallback,
                    *last_at,
                    "the last value of fallback() must be one CSS value",
                    Some("firstThatWorks() writes a declaration per value; a var() chain ends in one"),
                );
            }
        };
        let css = read.iter().rev().fold(end.clone(), |rest, (_, variable)| format!("var({variable}, {rest})"));
        let names = read.iter().map(|(token, _)| token.identity.as_str());
        let last_name = match last {
            Value::Token(token) => token.identity.clone(),
            Value::Str(_) => format!("\"{end}\""),
            _ => end,
        };
        Value::Token(Arc::new(TokenRef {
            identity: format!("fallback({}, {last_name})", names.collect::<Vec<_>>().join(", ")),
            deps: self.deps_in(&css),
            css,
            variable: None,
        }))
    }

    /// `positionTry({ ... })`: an `@position-try` rule of positioning declarations, named by a
    /// dashed ident (`--kp…`) that `positionTryFallbacks` lists.
    pub(crate) fn position_try(&self, argument: Option<&(Value, (u32, u32))>, span: (u32, u32)) -> Value {
        let Some((Value::Object(entries), _)) = argument else {
            return self.invalid(
                Code::NotEvaluable,
                span,
                "positionTry() takes an object of declarations",
                Some("for example positionTry({ positionArea: \"bottom\", marginTop: \"4px\" })"),
            );
        };
        let mut declarations = Vec::new();
        for (key, value) in entries.iter() {
            let Key::Str(name) = key else {
                return self.invalid(
                    Code::InvalidPositionTry,
                    span,
                    "a @position-try block takes property names as keys",
                    None,
                );
            };
            let property = kebab_case(name);
            if !position_try_accepts(&property) {
                return self.invalid(
                    Code::InvalidPositionTry,
                    span,
                    format!("{property} has no effect in @position-try"),
                    Some("a fallback position sets only inset, margin, size, self-alignment, position-anchor and position-area"),
                );
            }
            match self.plain_declarations(name, value, span, Code::InvalidPositionTry) {
                Some(more) => declarations.extend(more),
                None => return Value::unknown(REPORTED),
            }
        }
        let canonical = format!("{declarations:?}");
        let definition = Arc::new(PositionTryDef {
            name: format!("--{}", self.ctx.names.named('p', &[self.ctx.package, &canonical])),
            deps: self.deps_in(&canonical),
            declarations,
        });
        self.definitions.borrow_mut().position_tries.push(definition.clone());
        Value::PositionTry(definition)
    }

    /// `counterStyle({ ... })`: an `@counter-style` rule of descriptors, named by a hashed custom
    /// ident (`{prefix}c…`) that `listStyleType` and `counter()` name. A browser drops an unknown
    /// descriptor, a `var()` in one, and a rule its system cannot draw, all without a word; each is
    /// reported here instead.
    pub(crate) fn counter_style(&self, argument: Option<&(Value, (u32, u32))>, span: (u32, u32)) -> Value {
        let Some((Value::Object(entries), _)) = argument else {
            return self.invalid(
                Code::NotEvaluable,
                span,
                "counterStyle() takes an object of descriptors",
                Some("for example counterStyle({ system: \"cyclic\", symbols: '\"✓\"', suffix: '\" \"' })"),
            );
        };
        let mut descriptors: Vec<(String, String)> = Vec::new();
        for (key, value) in entries.iter() {
            let Key::Str(name) = key else {
                return self.invalid(
                    Code::InvalidCounterStyle,
                    span,
                    "a @counter-style block takes descriptor names as keys",
                    None,
                );
            };
            let descriptor = kebab_case(name);
            if !COUNTER_STYLE_DESCRIPTORS.contains(&descriptor.as_str()) {
                return self.invalid(
                    Code::InvalidCounterStyle,
                    span,
                    format!("{descriptor} is not a @counter-style descriptor"),
                    Some(
                        "the descriptors are system, symbols, additiveSymbols, negative, prefix, suffix, range, pad, fallback and speakAs",
                    ),
                );
            }
            let text = match value {
                Value::Unknown(reason) if &**reason == REPORTED => return Value::unknown(REPORTED),
                Value::Str(_) | Value::Number(_) | Value::Token(_) | Value::CounterStyle(_) => {
                    crate::ops::to_string(value).expect("css-bearing values print").trim().to_owned()
                }
                value if !value.is_static() => {
                    return self.invalid(
                        Code::InvalidCounterStyle,
                        span,
                        format!("{descriptor} must be known at build time"),
                        None,
                    );
                }
                _ => {
                    return self.invalid(
                        Code::InvalidCounterStyle,
                        span,
                        format!("the value of {descriptor} is not a CSS value"),
                        None,
                    );
                }
            };
            if text.is_empty() {
                return self.invalid(Code::InvalidCounterStyle, span, format!("{descriptor} is empty"), None);
            }
            if text.to_ascii_lowercase().contains("var(") {
                return self.invalid(
                    Code::InvalidCounterStyle,
                    span,
                    format!("{descriptor} reads a custom property, which a @counter-style descriptor cannot"),
                    Some("use an inlined token or a literal value"),
                );
            }
            descriptors.push((descriptor, text));
        }
        if let Some(reason) = missing_symbols(&descriptors) {
            return self.invalid(Code::InvalidCounterStyle, span, reason, None);
        }
        let canonical = format!("{descriptors:?}");
        let definition = Arc::new(CounterStyleDef {
            name: self.ctx.names.named('c', &[self.ctx.package, &canonical]),
            deps: self.deps_in(&canonical),
            descriptors,
        });
        self.definitions.borrow_mut().counter_styles.push(definition.clone());
        Value::CounterStyle(definition)
    }

    /// `viewTransition({ group, imagePair, old, new })`: a handle whose one class is also the
    /// element's `view-transition-class`, so the same value goes in `sx` and in a framework's
    /// transition-class prop.
    pub(crate) fn view_transition(&self, argument: Option<&(Value, (u32, u32))>, span: (u32, u32)) -> Value {
        let Some((Value::Object(entries), _)) = argument else {
            return self.invalid(
                Code::NotEvaluable,
                span,
                "viewTransition() takes an object of parts",
                Some("for example viewTransition({ old: { animationName: fadeOut } })"),
            );
        };
        let mut parts = Vec::new();
        for (key, style) in entries.iter() {
            let part = TransitionPart::ALL.into_iter().find(|part| key.as_str() == Some(part.key()));
            let (Some(part), Value::Object(style)) = (part, style) else {
                return self.invalid(
                    Code::InvalidViewTransition,
                    span,
                    "a view transition has four parts, group, imagePair, old and new, each a style object",
                    None,
                );
            };
            let mut rules: Vec<TransitionRule> = Vec::new();
            for (property, value) in style.iter() {
                let Key::Str(name) = property else {
                    return self.invalid(
                        Code::InvalidViewTransition,
                        span,
                        "a view-transition part takes property names as keys",
                        None,
                    );
                };
                let Some(values) = self.transition_values(value, span) else { return Value::unknown(REPORTED) };
                for (preludes, value) in values {
                    let Some(declarations) = self.plain_declarations(name, &value, span, Code::InvalidViewTransition)
                    else {
                        return Value::unknown(REPORTED);
                    };
                    match rules.iter_mut().find(|(existing, _)| *existing == preludes) {
                        Some((_, rule)) => rule.extend(declarations),
                        None => rules.push((preludes, declarations)),
                    }
                }
            }
            parts.push((part, rules));
        }
        parts.sort_by_key(|(part, _)| *part);
        let canonical = format!("{parts:?}");
        let definition = Arc::new(ViewTransitionDef {
            class: self.ctx.names.named('w', &[self.ctx.package, &canonical]),
            deps: self.deps_in(&canonical),
            parts,
        });
        self.definitions.borrow_mut().view_transitions.push(definition.clone());
        Value::Handle(Arc::new(Handle {
            markers: vec![definition.class.clone()],
            marker_deps: vec![Dep::ViewTransition(definition)],
            ..Handle::default()
        }))
    }

    /// The values of one view-transition property with the at-rules each applies under: a plain
    /// value, or a conditional value keyed by `media()` and `supports()` conditions. A pseudo-element
    /// of the transition has no hover or attribute state, so other conditions are an error.
    fn transition_values(&self, value: &Value, span: (u32, u32)) -> Option<Vec<(Vec<String>, Value)>> {
        let Value::Object(entries) = value else { return Some(vec![(Vec::new(), value.clone())]) };
        let mut out = Vec::new();
        for (key, inner) in entries.iter() {
            let conditions = match key {
                Key::Str(text) if &**text == "base" => Some(Vec::new()),
                Key::Str(text) => parse_condition_key(text).ok(),
                Key::Conditions(list) => Some(list.to_vec()),
                Key::Select(_) | Key::Token(_) => None,
            };
            let Some(conditions) = conditions.filter(|conditions| {
                conditions.iter().all(|condition| matches!(condition, Condition::Media(_) | Condition::Supports(_)))
            }) else {
                self.report(
                    Code::InvalidViewTransition,
                    span,
                    "a view-transition part applies under media() and supports() conditions only",
                    None,
                );
                return None;
            };
            let mut preludes: Vec<(bool, String)> = conditions
                .iter()
                .map(|condition| (matches!(condition, Condition::Media(_)), condition.canonical()))
                .collect();
            // `@supports` wraps `@media`, as it does around atoms.
            preludes.sort();
            out.push((preludes.into_iter().map(|(_, prelude)| prelude).collect(), inner.clone()));
        }
        Some(out)
    }

    /// The declarations of one property inside a definition block (`@position-try` or a
    /// view-transition part): a static CSS value or a `firstThatWorks` run, longhands expanded.
    fn plain_declarations(
        &self,
        name: &str,
        value: &Value,
        span: (u32, u32),
        code: Code,
    ) -> Option<Vec<(String, String)>> {
        let expanded = match value {
            Value::Str(_)
            | Value::Number(_)
            | Value::Token(_)
            | Value::Keyframes(_)
            | Value::PositionTry(_)
            | Value::CounterStyle(_) => match self.declare_value(name, value) {
                Ok(expanded) => Some(expanded),
                Err(error) => {
                    self.report_declaration(error, span);
                    None
                }
            },
            Value::Fallbacks(members) => self.fallbacks(name, members, span),
            value if !value.is_static() => {
                self.report(code, span, format!("{name}: a definition's values must be known at build time"), None);
                None
            }
            _ => {
                self.report(code, span, format!("{name}: this value is not a CSS value"), None);
                None
            }
        }?;
        Some(expanded.declarations.into_iter().map(|(property, css)| (property.name, css)).collect())
    }

    /// Reports `code` and returns a value that is already explained.
    fn invalid(&self, code: Code, span: (u32, u32), message: impl Into<String>, help: Option<&str>) -> Value {
        self.report(code, span, message, help);
        Value::unknown(REPORTED)
    }
}
