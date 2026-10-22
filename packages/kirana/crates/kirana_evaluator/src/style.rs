//! Building handles from style objects (KRN-API-001, KRN-CAS-001, KRN-CAS-004) and style parts
//! from handle expressions (KRN-DYN-002, KRN-DYN-003).

use std::sync::Arc;

use kirana_cascade::{
    DeclarationError, DeclarationWarning, Expanded, RawValue, WritePlan, breadth, declare_with, longhands_of,
    mixed_logical_physical, prepare_set, removal, write_plan,
};
use kirana_css_data::PropertyRank::Shorthand;
use kirana_diagnostics::Code;
use kirana_ir::{
    AtomValue, Condition, ConditionSet, Dep, Dynamic, EntryKey, Handle, Key, Op, Property, StylePart, Target, Value,
    ambiguous_pairs, parse_condition_key, push_dep,
};

use crate::eval::Evaluator;

/// Style parts in merge order, with adjacent static handles merged at build time.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Parts(pub Vec<StylePart>);

impl Parts {
    fn push_static(&mut self, handle: &Handle) {
        if handle.is_empty() {
            return;
        }
        if let Some(StylePart::Static(last)) = self.0.last_mut() {
            last.merge(handle);
        } else {
            self.0.push(StylePart::Static(handle.clone()));
        }
    }

    fn push(&mut self, part: StylePart) {
        match part {
            StylePart::Static(handle) => self.push_static(&handle),
            other => self.0.push(other),
        }
    }

    /// The single static handle (empty when there are no parts), if the parts are static.
    pub fn static_handle(&self) -> Option<Handle> {
        match self.0.as_slice() {
            [] => Some(Handle::default()),
            [StylePart::Static(handle)] => Some(handle.clone()),
            _ => None,
        }
    }

    /// A handle value, or a dynamic style value.
    pub fn into_value(self) -> Value {
        match self.static_handle() {
            Some(handle) => Value::Handle(Arc::new(handle)),
            None => Value::Dynamic(Arc::new(Dynamic::Style(self.0))),
        }
    }
}

/// How strings are treated where handles are expected.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Strings {
    /// `sx`: a string is the reserved utility surface (KRN-API-012).
    Utility,
    /// `cx` / `props`: a string is a foreign class name passed through at runtime.
    ClassName,
}

impl<'a> Evaluator<'_, 'a, '_> {
    /// The style parts of an `sx` attribute value: strings are the reserved utility surface.
    pub fn sx_parts(&self, expression: &oxc_ast::ast::Expression<'a>) -> Parts {
        let mut parts = Parts::default();
        let span = crate::eval::sp(oxc_span::GetSpan::span(expression));
        if self.interpolated_utility(expression) {
            return parts;
        }
        self.push_handle_value(&self.eval(expression), span, &mut parts, Strings::Utility);
        parts
    }

    /// Reports a template literal with substitutions where `sx` takes a value: a utility string must
    /// be known at build time, and at run time it would pass through as meaningless class names.
    fn interpolated_utility(&self, expression: &oxc_ast::ast::Expression<'a>) -> bool {
        use oxc_ast::ast::{ArrayExpressionElement, Expression, LogicalOperator};
        match expression {
            Expression::TemplateLiteral(template) if !template.expressions.is_empty() => {
                self.report(
                    Code::UtilityNotStatic,
                    crate::eval::sp(template.span),
                    "a utility string must be written out: interpolated utilities cannot compile",
                    Some("write the values as an object — css({ paddingInline: n }) — or pick between whole strings"),
                );
                true
            }
            Expression::ParenthesizedExpression(inner) => self.interpolated_utility(&inner.expression),
            Expression::ArrayExpression(array) => {
                // Every element, not the first found: each interpolated string is its own report.
                let mut found = false;
                for element in array.elements.iter().filter_map(ArrayExpressionElement::as_expression) {
                    found |= self.interpolated_utility(element);
                }
                found
            }
            Expression::ConditionalExpression(conditional) => {
                self.interpolated_utility(&conditional.consequent) | self.interpolated_utility(&conditional.alternate)
            }
            Expression::LogicalExpression(logical) if logical.operator == LogicalOperator::And => {
                self.interpolated_utility(&logical.right)
            }
            _ => false,
        }
    }

    /// The style parts of a string `sx` (`sx="px-4"`): the utility surface (KRN-API-012).
    pub fn utility_parts(&self, text: &str, span: (u32, u32)) -> Parts {
        let mut parts = Parts::default();
        self.push_handle_value(&Value::str(text), span, &mut parts, Strings::Utility);
        parts
    }

    /// The style parts of `cx()` or `props()` arguments: strings pass through as class names.
    pub fn call_parts(&self, call: &oxc_ast::ast::CallExpression<'a>) -> Parts {
        let mut parts = Parts::default();
        for (value, span) in self.arguments(call) {
            self.push_handle_value(&value, span, &mut parts, Strings::ClassName);
        }
        parts
    }

    /// Converts a handle-position value (an `sx` value, a `cx` argument) into style parts.
    pub(crate) fn push_handle_value(&self, value: &Value, span: (u32, u32), parts: &mut Parts, strings: Strings) {
        match value {
            Value::Handle(handle) => parts.push_static(handle),
            Value::Null | Value::Undefined | Value::Bool(_) => {}
            Value::Array(items) => items.iter().for_each(|item| self.push_handle_value(item, span, parts, strings)),
            Value::Dynamic(dynamic) => match &**dynamic {
                Dynamic::Open(span) => parts.push(StylePart::Runtime(*span)),
                Dynamic::Spread(span) => parts.push(StylePart::Spread(*span)),
                Dynamic::Style(inner) => inner.iter().cloned().for_each(|part| parts.push(part)),
                Dynamic::Conditional { span, test, consequent, alternate } => {
                    let branch = |value: &Value| match value {
                        // `open && "bg-muted"`: a utility string in either branch is lowered too.
                        Value::Str(_) if strings == Strings::Utility => {
                            let mut lowered = Parts::default();
                            self.push_handle_value(value, *span, &mut lowered, strings);
                            lowered.static_handle()
                        }
                        other => static_handle(other),
                    };
                    match (branch(consequent), branch(alternate)) {
                        (Some(consequent), Some(alternate)) => {
                            parts.push(StylePart::Conditional { test: *test, consequent, alternate });
                        }
                        _ => parts.push(StylePart::Runtime(*span)),
                    }
                }
            },
            Value::Str(_) if strings == Strings::ClassName => parts.push(StylePart::Runtime(span)),
            Value::Str(text) => match self.utility_object(text, span) {
                Some(object) => self.push_css_argument(&object, span, parts),
                None => self.report(
                    Code::UtilitySurfaceDisabled,
                    span,
                    "string `sx` values need a utility grammar",
                    Some("add a preset that declares one — presets: [scales()] — or write css({ … })"),
                ),
            },
            Value::Object(_) => self.report(
                Code::UnsupportedSyntax,
                span,
                "a style object must be compiled with css() before it is applied",
                Some("wrap the object: css({ … })"),
            ),
            Value::Unknown(reason) => self.report_unknown(reason, span),
            _ => self.report(Code::UnsupportedSyntax, span, "this value is not a style handle", None),
        }
    }

    pub(crate) fn report_unknown(&self, reason: &str, span: (u32, u32)) {
        if reason == crate::helpers::REPORTED {
            return;
        }
        if reason.starts_with("dynamic spread") {
            self.report(
                Code::DynamicSpread,
                span,
                "a spread in a style must be known at build time",
                Some("declare the properties explicitly instead of spreading a runtime object"),
            );
        } else if reason.starts_with("dynamic key") {
            self.report(
                Code::DynamicKey,
                span,
                "a property or condition key must be known at build time",
                Some("use a fixed key, or move the choice into a conditional value"),
            );
        } else {
            self.report(
                Code::NotEvaluable,
                span,
                format!("this value cannot be evaluated at build time ({reason})"),
                None,
            );
        }
    }

    /// Builds a style from a `css()` argument.
    pub(crate) fn push_css_argument(&self, value: &Value, span: (u32, u32), parts: &mut Parts) {
        match value {
            Value::Object(entries) => {
                let mut built = Parts::default();
                self.style_object(entries, &Target::Element, &ConditionSet::default(), span, &mut built);
                for part in &built.0 {
                    if let StylePart::Static(handle) = part {
                        self.check_handle(handle, entries, span);
                    }
                }
                built.0.into_iter().for_each(|part| parts.push(part));
            }
            Value::Str(_) => self.report(
                Code::UnsupportedSyntax,
                span,
                "css() takes style objects and handles, not strings",
                Some("write the declarations as an object"),
            ),
            other => self.push_handle_value(other, span, parts, Strings::ClassName),
        }
    }

    /// Warnings that need a whole merged handle.
    pub(crate) fn check_handle(&self, handle: &Handle, entries: &[(Key, Value)], span: (u32, u32)) {
        for (property, first, second) in ambiguous_pairs(handle, &self.ctx.config.conditions.exclusive) {
            self.report(
                Code::AmbiguousPrecedence,
                self.written_span(entries, &property, span),
                format!("{property}: `{first}` and `{second}` have equal precedence and can match together"),
                Some("nest one condition inside the other to state which wins"),
            );
        }
        for pair in mixed_logical_physical(handle) {
            let message = if pair.equal {
                format!(
                    "{} and {} are both set with the same number of longhands; the physical property wins",
                    pair.logical, pair.physical
                )
            } else {
                let loser = if pair.winner == pair.logical { &pair.physical } else { &pair.logical };
                format!(
                    "{} and {} are both set; {loser} is written later but {} wins because it sets fewer longhands",
                    pair.logical, pair.physical, pair.winner
                )
            };
            // The side that loses is the one to look at; at equal counts that is the logical one.
            let loser = if pair.winner == pair.logical { &pair.physical } else { &pair.logical };
            let at = self.written_span(entries, loser, span);
            self.report(Code::MixedLogicalPhysical, at, message, Some("use one axis family on an element"));
        }
    }

    /// The span of the last top-level entry that writes `property` (kebab-case) itself or through a
    /// shorthand, or `fallback`.
    fn written_span(&self, entries: &[(Key, Value)], property: &str, fallback: (u32, u32)) -> (u32, u32) {
        entries
            .iter()
            .rev()
            .find(|(key, _)| {
                matches!(key, Key::Str(name) if kirana_shared::kebab_case(name) == property
                    || longhands_of(name).is_ok_and(|longhands| longhands.iter().any(|longhand| longhand.name == property)))
            })
            .map_or(fallback, |(key, _)| self.entry_span(key, fallback))
    }

    /// A static handle for a position that requires one (recipes, themes). Callers check that the
    /// definition is static, so every part is a static handle.
    pub(crate) fn static_style(&self, value: &Value, span: (u32, u32)) -> Handle {
        let mut parts = Parts::default();
        self.push_css_argument(value, span, &mut parts);
        parts.static_handle().unwrap_or_default()
    }

    fn style_object(
        &self,
        entries: &[(Key, Value)],
        target: &Target,
        conditions: &ConditionSet,
        span: (u32, u32),
        parts: &mut Parts,
    ) {
        let top = *target == Target::Element && conditions.is_empty();
        for (key, value) in entries {
            let span = self.entry_span(key, span);
            match key {
                Key::Str(name) if name.starts_with("::") => {
                    let pseudo = name.split('(').next().unwrap_or(name);
                    if !kirana_css_data::is_pseudo_element(pseudo) {
                        self.report(Code::UnknownCondition, span, format!("{name} is not a pseudo-element"), None);
                    } else if let Value::Object(inner) = value {
                        let inner_target = match target {
                            Target::Element => Target::PseudoElement(name.to_string()),
                            Target::Contextual { child, selector, pseudo_element: None } => Target::Contextual {
                                child: *child,
                                selector: selector.clone(),
                                pseudo_element: Some(name.to_string()),
                            },
                            _ => {
                                self.report(Code::UnsupportedSyntax, span, "pseudo-elements cannot nest", None);
                                continue;
                            }
                        };
                        self.style_object(inner, &inner_target, conditions, span, parts);
                    } else {
                        self.report(Code::InvalidValue, span, format!("{name} takes a style object"), None);
                    }
                }
                Key::Select(select) => match (value, top) {
                    (Value::Object(inner), true) => self.style_object(inner, select, conditions, span, parts),
                    _ => self.report(
                        Code::UnsupportedContextualTarget,
                        span,
                        "select.* keys are top-level style keys whose value is a style object",
                        None,
                    ),
                },
                Key::Token(token) => match &token.variable {
                    Some(variable) => self.property(variable, value, target, conditions, true, span, parts),
                    None => self.report(
                        Code::TokenNotVariable,
                        span,
                        format!("{} is not a variable token, so it cannot be assigned", token.identity),
                        Some("declare the token with `variable: true`"),
                    ),
                },
                Key::Str(name) if &**name == "base" || &**name == "*" => self.report(
                    Code::UnknownProperty,
                    span,
                    format!("{name:?} belongs inside a property's conditional value"),
                    Some("write `property: { base: value, [condition]: value }`"),
                ),
                Key::Str(name) if name.starts_with([':', '[', '@']) => self.report(
                    Code::UnknownCondition,
                    span,
                    format!("{name:?} is a condition, and conditions nest inside property values"),
                    Some("write `property: { [condition]: value }`"),
                ),
                Key::Conditions(_) => self.report(
                    Code::UnknownCondition,
                    span,
                    "conditions nest inside property values",
                    Some("write `property: { [condition]: value }`"),
                ),
                Key::Str(name) => self.property(name, value, target, conditions, true, span, parts),
            }
        }
    }

    /// One property's value. `top` is true for `prop: value` itself and false inside its conditional
    /// value object, where `null` removes a single entry rather than the whole property.
    #[allow(clippy::too_many_arguments)]
    fn property(
        &self,
        name: &str,
        value: &Value,
        target: &Target,
        conditions: &ConditionSet,
        top: bool,
        span: (u32, u32),
        parts: &mut Parts,
    ) {
        match value {
            Value::Undefined => {}
            Value::Null => {
                let Some(plan) = self.plan(name, span) else { return };
                let every = top && conditions.is_empty();
                parts.push_static(&removal(&plan, target, conditions, every));
            }
            Value::Object(entries) => {
                for (key, inner) in entries.iter() {
                    let span = self.entry_span(key, span);
                    match key {
                        Key::Str(key) if &**key == "base" => {
                            self.property(name, inner, target, conditions, false, span, parts)
                        }
                        Key::Str(key) if &**key == "*" => match inner {
                            Value::Null if conditions.is_empty() => {
                                if let Some(plan) = self.plan(name, span) {
                                    parts.push_static(&removal(&plan, target, conditions, true));
                                }
                            }
                            _ => self.report(
                                Code::InvalidValue,
                                span,
                                "`\"*\"` only accepts null, at the top of a property",
                                None,
                            ),
                        },
                        Key::Str(key) => match parse_condition_key(&key[..]) {
                            Ok(parsed) => {
                                self.property(name, inner, target, &conditions.with(&parsed), false, span, parts)
                            }
                            Err(error) => self.report(Code::UnknownCondition, span, error.to_string(), None),
                        },
                        Key::Conditions(parsed) => {
                            self.property(name, inner, target, &conditions.with(&parsed[..]), false, span, parts);
                        }
                        Key::Select(_) | Key::Token(_) => {
                            self.report(
                                Code::UnknownCondition,
                                span,
                                "only conditions may key a conditional value",
                                None,
                            );
                        }
                    }
                }
            }
            Value::Str(_)
            | Value::Number(_)
            | Value::Token(_)
            | Value::Keyframes(_)
            | Value::PositionTry(_)
            | Value::CounterStyle(_) => match self.declare_value(name, value) {
                Ok(expanded) => self.set_expanded(name, expanded, target, conditions, span, parts),
                Err(error) => self.report_declaration(error, span),
            },
            Value::Fallbacks(members) => {
                if let Some(expanded) = self.fallbacks(name, members, span) {
                    self.set_expanded(name, expanded, target, conditions, span, parts);
                }
            }
            Value::Dynamic(dynamic) => match &**dynamic {
                Dynamic::Conditional { span: whole, test, consequent, alternate } => {
                    let branch = |value: &Value| {
                        let mut inner = Parts::default();
                        self.property(name, value, target, conditions, top, span, &mut inner);
                        inner.static_handle()
                    };
                    match (branch(consequent), branch(alternate)) {
                        (Some(consequent), Some(alternate)) => {
                            parts.push(StylePart::Conditional { test: *test, consequent, alternate });
                        }
                        _ => self.bridge(name, *whole, target, conditions, parts),
                    }
                }
                Dynamic::Open(open) => self.bridge(name, *open, target, conditions, parts),
                Dynamic::Style(_) | Dynamic::Spread(_) => {
                    self.report(Code::InvalidValue, span, "a style handle is not a property value", None);
                }
            },
            Value::Unknown(reason) => self.report_unknown(reason, span),
            _ => self.report(Code::InvalidValue, span, format!("{name}: this value is not a CSS value"), None),
        }
    }

    /// Expands one CSS-bearing value of a property into its declarations.
    pub(crate) fn declare_value(&self, name: &str, value: &Value) -> Result<Expanded, DeclarationError> {
        let text = crate::ops::to_string(value).expect("css-bearing values print");
        let raw = match value {
            Value::Number(number) => RawValue::Number(*number),
            _ => RawValue::Str(&text),
        };
        declare_with(name, raw, &|variable| self.variable_values(variable))
    }

    /// Writes expanded declarations as one handle part.
    fn set_expanded(
        &self,
        name: &str,
        expanded: Expanded,
        target: &Target,
        conditions: &ConditionSet,
        span: (u32, u32),
        parts: &mut Parts,
    ) {
        let plan = write_plan(name).expect("a declared property has a plan");
        let mut handle = Handle::default();
        let longhands = expanded.longhands();
        let atom = expanded
            .declarations
            .first()
            .filter(|(property, _)| property.rank == Shorthand)
            .map(|(property, _)| property.name.as_str());
        prepare_set(&mut handle, &plan, target, conditions, atom, longhands);
        for (property, css) in expanded.declarations {
            let key = EntryKey { target: target.clone(), property, conditions: conditions.clone() };
            handle.apply(Op::Set(key, self.atom_value(css, longhands)));
        }
        for warning in expanded.warnings {
            let DeclarationWarning::Unsplittable { property } = warning;
            self.report_unsplittable(&property, span);
        }
        parts.push_static(&handle);
    }

    /// A `firstThatWorks` run (KRN-API-017): every member expands on its own, and each longhand
    /// carries all its members' values, preferred first. Members must expand to the same longhands,
    /// or the browser would keep a fallback for one longhand and the preferred value for another.
    pub(crate) fn fallbacks(&self, name: &str, members: &[Value], span: (u32, u32)) -> Option<Expanded> {
        if name.starts_with("--") {
            self.report(
                Code::FallbackOnVariable,
                span,
                format!("{name} accepts any value, so the browser keeps the preferred one and never falls back"),
                Some("put the fallback where the variable is read: var(--name, fallback)"),
            );
        }
        let mut runs: Vec<Expanded> = Vec::new();
        for member in members {
            match self.declare_value(name, member) {
                Ok(expanded) => runs.push(expanded),
                Err(error) => {
                    self.report_declaration(error, span);
                    return None;
                }
            }
        }
        let properties = |expanded: &Expanded| -> Vec<String> {
            expanded.declarations.iter().map(|(property, _)| property.name.clone()).collect()
        };
        let first = properties(&runs[0]);
        if runs.iter().any(|run| properties(run) != first) {
            self.report(
                Code::InvalidFallback,
                span,
                format!("the values of firstThatWorks() set different longhands of {name}"),
                Some("give every value the same shape, or write the longhands separately"),
            );
            return None;
        }
        let mut combined = runs.remove(0);
        for (index, (_, css)) in combined.declarations.iter_mut().enumerate() {
            for run in &runs {
                css.push(kirana_ir::FALLBACK_SEPARATOR);
                css.push_str(&run.declarations[index].1);
            }
        }
        // Runs of the same longhands carry the same warnings, so the first run's stand for all.
        Some(combined)
    }

    fn plan(&self, name: &str, span: (u32, u32)) -> Option<WritePlan> {
        write_plan(name).map_err(|error| self.report_declaration(error, span)).ok()
    }

    /// An open value: one atom reading a custom property. A shorthand stays one shorthand atom, so
    /// a runtime value with several components (`"1px 2px"`) is valid too (D-045).
    fn bridge(&self, name: &str, value: (u32, u32), target: &Target, conditions: &ConditionSet, parts: &mut Parts) {
        let Some(plan) = self.plan(name, value) else { return };
        let property = if plan.longhands.len() > 1 {
            Property::shorthand(kirana_shared::kebab_case(name))
        } else {
            plan.longhands[0].clone()
        };
        let key = EntryKey { target: target.clone(), property, conditions: conditions.clone() };
        let variable = self.ctx.names.bridge_variable(&key);
        let mut handle = Handle::default();
        let atom = (key.property.rank == Shorthand).then_some(key.property.name.as_str());
        let longhands = atom.map_or(1, breadth);
        prepare_set(&mut handle, &plan, target, conditions, atom, longhands);
        handle.apply(Op::Set(key, AtomValue { css: format!("var({variable})"), deps: Vec::new(), longhands }));
        self.report(Code::DynamicBridged, value, format!("{name} is set at runtime through {variable}"), None);
        parts.push(StylePart::Bridge { handle, variable, value });
    }

    fn report_unsplittable(&self, property: &str, span: (u32, u32)) {
        self.report(
            Code::UnsplittableShorthand,
            span,
            format!(
                "{property} cannot be split, so it stays one shorthand atom; if a later style removes one of its \
                 longhands, the remaining longhands receive this whole value, which is only valid for a single component"
            ),
            Some("write the longhands instead when a later style removes some of them"),
        );
    }

    pub(crate) fn report_declaration(&self, error: DeclarationError, span: (u32, u32)) {
        match error {
            DeclarationError::UnknownProperty { name } => {
                self.report(Code::UnknownProperty, span, format!("{name} is not a CSS property"), None);
            }
            DeclarationError::InvalidValue { property, reason } => {
                self.report(Code::InvalidValue, span, format!("{property}: {reason}"), None);
            }
            DeclarationError::UnitlessLength { property, number } => self.report(
                Code::UnitlessLength,
                span,
                format!("{property} does not accept a bare number ({number})"),
                Some(&format!("write the unit, for example \"{number}px\"")),
            ),
        }
    }

    /// An atom value with the tokens and keyframes its text refers to.
    pub(crate) fn atom_value(&self, css: String, longhands: u8) -> AtomValue {
        AtomValue { deps: self.deps_in(&css), css, longhands }
    }

    /// The declared values (one per mode) of a project variable token.
    pub(crate) fn variable_values(&self, variable: &str) -> Option<Vec<String>> {
        let Some(Dep::Token(token)) = self.deps_in(variable).into_iter().next() else { return None };
        Some(match &token.value {
            kirana_ir::TokenValue::Plain(value) => vec![value.clone()],
            kirana_ir::TokenValue::Modes { light, dark } => vec![light.clone(), dark.clone()],
        })
    }

    /// The variable tokens, keyframes, position-try fallbacks, view transitions and counter styles a
    /// piece of CSS text refers to.
    pub fn deps_in(&self, text: &str) -> Vec<Dep> {
        let prefix = &self.ctx.names.prefix;
        let mut deps = Vec::new();
        let markers = [
            (format!("--{prefix}v"), 'v'),
            (format!("{prefix}f"), 'f'),
            (format!("--{prefix}p"), 'p'),
            (format!("{prefix}w"), 'w'),
            (format!("{prefix}c"), 'c'),
        ];
        for (marker, kind) in markers {
            let mut from = 0;
            while let Some(offset) = text[from..].find(&marker) {
                let start = from + offset;
                let end = start + marker.len() + kirana_ir::NAME_HASH;
                from = start + marker.len();
                let boundary = start == 0 || !text.as_bytes()[start - 1].is_ascii_alphanumeric();
                if !boundary
                    || end > text.len()
                    || !text[start + marker.len()..end].bytes().all(|b| b.is_ascii_alphanumeric())
                {
                    continue;
                }
                let name = &text[start..end];
                let local = {
                    let definitions = self.definitions.borrow();
                    match kind {
                        'v' => definitions.tokens.iter().find(|token| token.variable == name).cloned().map(Dep::Token),
                        'f' => {
                            definitions.keyframes.iter().find(|frames| frames.name == name).cloned().map(Dep::Keyframes)
                        }
                        'p' => definitions
                            .position_tries
                            .iter()
                            .find(|fallback| fallback.name == name)
                            .cloned()
                            .map(Dep::PositionTry),
                        'c' => definitions
                            .counter_styles
                            .iter()
                            .find(|style| style.name == name)
                            .cloned()
                            .map(Dep::CounterStyle),
                        _ => definitions
                            .view_transitions
                            .iter()
                            .find(|transition| transition.class == name)
                            .cloned()
                            .map(Dep::ViewTransition),
                    }
                };
                if let Some(dep) = local.or_else(|| self.host.lookup_dep(name)) {
                    push_dep(&mut deps, dep);
                }
            }
        }
        deps
    }
}

fn static_handle(value: &Value) -> Option<Handle> {
    match value {
        Value::Handle(handle) => Some((**handle).clone()),
        Value::Null | Value::Undefined | Value::Bool(false) => Some(Handle::default()),
        Value::Array(items) => items.iter().try_fold(Handle::default(), |mut merged, item| {
            merged.merge(&static_handle(item)?);
            Some(merged)
        }),
        _ => None,
    }
}

/// The relation conditions (for validation) a handle reads.
pub fn relation_reads(handle: &Handle) -> Vec<(String, kirana_ir::RelationKind)> {
    let mut reads = Vec::new();
    for (key, _) in handle.entries() {
        for condition in key.conditions.conditions() {
            if let Condition::Relation { marker, kind, .. } = condition
                && !reads.contains(&(marker.clone(), *kind))
            {
                reads.push((marker.clone(), *kind));
            }
        }
    }
    reads
}
