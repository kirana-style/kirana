//! `firstThatWorks()`, `positionTry()` and `viewTransition()` (KRN-API-017 to KRN-API-019).

use std::sync::Arc;

use kirana_diagnostics::Code;
use kirana_ir::{
    Condition, Dep, Handle, Key, PositionTryDef, TransitionPart, TransitionRule, Value, ViewTransitionDef,
    parse_condition_key,
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
                Value::Str(_) | Value::Number(_) | Value::Token(_) | Value::Keyframes(_) | Value::PositionTry(_) => {
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
            Value::Str(_) | Value::Number(_) | Value::Token(_) | Value::Keyframes(_) | Value::PositionTry(_) => {
                match self.declare_value(name, value) {
                    Ok(expanded) => Some(expanded),
                    Err(error) => {
                        self.report_declaration(error, span);
                        None
                    }
                }
            }
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
