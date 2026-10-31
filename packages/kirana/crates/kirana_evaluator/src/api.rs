//! The `@kirana-style/core` API calls.

use std::fmt::Write as _;
use std::sync::Arc;

use kirana_cascade::{RawValue, declare, is_color};
use kirana_diagnostics::Code;
use kirana_ir::{
    Api, AtomValue, Condition, ConditionSet, Dynamic, EntryKey, Handle, Key, KeyframesDef, Method, Op, Property,
    Recipe, Registration, RelationValue, Target, ThemeDef, TokenDef, TokenRef, TokenValue, Value, collapse_whitespace,
    parse_simple_selectors,
};
use oxc_ast::ast::CallExpression;

use crate::eval::{Evaluator, sp};
use crate::ops;
use crate::style::{Parts, Strings};

impl<'a> Evaluator<'_, 'a, '_> {
    pub(crate) fn api_call(&self, api: Api, call: &CallExpression<'a>) -> Value {
        let span = sp(call.span);
        let arguments = self.arguments(call);
        match api {
            Api::Css => self.literal_style(call, || {
                // A handle an argument passes claims its attributes for every style object of the
                // call (KF-044); the call's own handle carries them on.
                let mut claims = Vec::new();
                for (value, _) in &arguments {
                    claimed_by(value, &mut claims);
                }
                let outer = std::mem::replace(&mut *self.claimed.borrow_mut(), claims);
                let mut parts = Parts::default();
                for (value, span) in &arguments {
                    self.push_css_argument(value, *span, &mut parts);
                }
                *self.claimed.borrow_mut() = outer;
                self.check_budget(&parts, span);
                parts.into_value()
            }),
            Api::Cx => {
                let mut parts = Parts::default();
                for (value, span) in &arguments {
                    self.push_handle_value(value, *span, &mut parts, Strings::ClassName);
                }
                parts.into_value()
            }
            Api::Props => Value::Dynamic(Arc::new(Dynamic::Open(span))),
            Api::Own => self.own(&arguments, span),
            Api::Recipe => self.recipe(&arguments, span),
            Api::Relation => match arguments.as_slice() {
                [(Value::Str(name), _), rest @ ..] => {
                    // `{ optional: true }`: a reader may be installed without the anchor's component,
                    // where the read never matches (KF-037, D-112).
                    let optional = match rest {
                        [] => false,
                        [(Value::Object(options), _)]
                            if options.iter().all(|(key, value)| {
                                key.as_str() == Some("optional") && matches!(value, Value::Bool(_))
                            }) =>
                        {
                            options.iter().any(|(_, value)| *value == Value::Bool(true))
                        }
                        _ => {
                            return self.not_evaluable(
                                span,
                                "relation() takes a string name, then `{ optional: true }` at most",
                            );
                        }
                    };
                    let marker = self.ctx.names.named('r', &[self.ctx.package, name]);
                    self.definitions.borrow_mut().relations.push((name.to_string(), marker.clone(), optional));
                    Value::Relation(Arc::new(RelationValue { name: name.to_string(), marker }))
                }
                _ => self.not_evaluable(span, "relation() takes a string name"),
            },
            Api::Keyframes => self.keyframes(arguments.first(), span),
            Api::DefineTokens => self.define_tokens(&arguments, span),
            Api::DefineTheme => self.define_theme(&arguments, span),
            Api::Media | Api::Supports => match arguments.first() {
                Some((Value::Str(query), _)) if !query.trim().is_empty() => {
                    let query = collapse_whitespace(query);
                    Value::Conditions(Arc::new(vec![if api == Api::Media {
                        Condition::Media(query)
                    } else {
                        Condition::Supports(query)
                    }]))
                }
                _ => self.not_evaluable(span, "condition constructors take a query string"),
            },
            Api::Container => match arguments.as_slice() {
                [(Value::Str(query), _), rest @ ..] if !query.trim().is_empty() => {
                    let name = match rest.first() {
                        Some((Value::Str(name), _)) => Some(name.to_string()),
                        _ => None,
                    };
                    Value::Conditions(Arc::new(vec![Condition::Container { name, query: collapse_whitespace(query) }]))
                }
                _ => self.not_evaluable(span, "container() takes a query string and an optional name"),
            },
            Api::FirstThatWorks => self.first_that_works(&arguments, span),
            Api::Fallback => self.fallback(&arguments, span),
            Api::PositionTry => self.position_try(arguments.first(), span),
            Api::ViewTransition => self.view_transition(arguments.first(), span),
            Api::CounterStyle => self.counter_style(arguments.first(), span),
            Api::Select | Api::Mode => {
                self.report(Code::UnsupportedSyntax, span, format!("{} is not a function", api.export()), None);
                Value::unknown("not callable")
            }
        }
    }

    fn not_evaluable(&self, span: (u32, u32), message: &str) -> Value {
        self.report(Code::NotEvaluable, span, message, None);
        Value::unknown(message)
    }

    fn check_budget(&self, parts: &Parts, span: (u32, u32)) {
        let alternatives =
            parts.0.iter().filter(|part| matches!(part, kirana_ir::StylePart::Conditional { .. })).count();
        let budget = self.ctx.config.dynamic.branch_budget as usize;
        if alternatives > budget {
            self.report(
                Code::BranchBudgetExceeded,
                span,
                format!("{alternatives} conditional values exceed the branch budget of {budget}"),
                Some("split the conditionals into separate handles, or raise dynamic.branchBudget"),
            );
        }
    }

    pub(crate) fn method_call(&self, method: &Method, call: &CallExpression<'a>) -> Value {
        let span = sp(call.span);
        let arguments = self.arguments(call);
        match method {
            Method::RelationRead(relation, kind) => {
                let state = match arguments.first() {
                    None => Some(String::new()),
                    Some((Value::Str(text), _)) => match parse_simple_selectors(text.trim()) {
                        Ok(conditions) => Some(conditions.iter().map(Condition::canonical).collect()),
                        Err(reason) => {
                            self.report(Code::UnknownCondition, span, format!("{text:?}: {reason}"), None);
                            None
                        }
                    },
                    Some(_) => {
                        self.report(Code::NotEvaluable, span, "a relation state must be a selector string", None);
                        None
                    }
                };
                match state {
                    Some(state) => Value::Conditions(Arc::new(vec![Condition::Relation {
                        marker: relation.marker.clone(),
                        kind: *kind,
                        state,
                    }])),
                    // Reported here, so the key it becomes is not a `dynamic-key` too, as a refused
                    // contextual target is not (KF-079).
                    None => Value::unknown(crate::helpers::REPORTED),
                }
            }
            Method::Select { child } => match arguments.first() {
                Some((Value::Str(selector), _)) if kirana_ir::is_contextual_target(selector) => {
                    Value::Select(Arc::new(Target::Contextual {
                        child: *child,
                        selector: collapse_whitespace(selector),
                        pseudo_element: None,
                    }))
                }
                _ => {
                    self.report(
                        Code::UnsupportedContextualTarget,
                        span,
                        "a contextual target is one compound selector: an element name, classes, attribute selectors and pseudo-classes, with no combinator or pseudo-element",
                        Some("for example select.descendant('svg'), select.descendant('.ts-chart__grid') or select.child('[data-slot=\"icon\"]:hover'); a pseudo-element is a key inside the target's style"),
                    );
                    // Reported here, so the key it becomes is not a `dynamic-key` too (KF-079).
                    Value::unknown(crate::helpers::REPORTED)
                }
            },
        }
    }

    pub(crate) fn mode(&self, name: &str) -> Option<Value> {
        let (scheme, marker) = match name {
            "system" => ("light dark", None),
            "light" => ("light", Some(self.ctx.names.mode_marker("light"))),
            "dark" => ("dark", Some(self.ctx.names.mode_marker("dark"))),
            _ => return None,
        };
        let mut handle = Handle { markers: marker.into_iter().collect(), ..Handle::default() };
        handle.apply(Op::Set(
            EntryKey::new(Target::Element, Property::longhand("color-scheme"), ConditionSet::default()),
            AtomValue::longhand(scheme),
        ));
        Some(Value::Handle(Arc::new(handle)))
    }

    fn keyframes(&self, argument: Option<&(Value, (u32, u32))>, span: (u32, u32)) -> Value {
        let Some((Value::Object(frames), _)) = argument else {
            return self.not_evaluable(span, "keyframes() takes an object of frames");
        };
        let mut list = Vec::new();
        let mut canonical = String::new();
        for (key, style) in frames.iter() {
            let (Key::Str(selector), Value::Object(declarations)) = (key, style) else {
                return self.not_evaluable(span, "each keyframe is a selector string with a style object");
            };
            let mut out = Vec::new();
            for (property, value) in declarations.iter() {
                // A variable token as a key animates its custom property (a registered one interpolates).
                let property: &str = match property {
                    Key::Str(name) => name,
                    Key::Token(token) if token.variable.is_some() => token.variable.as_deref().expect("checked"),
                    _ => return self.not_evaluable(span, "keyframe declarations must be static"),
                };
                if let Value::Fallbacks(members) = value {
                    if let Some(expanded) = self.fallbacks(property, members, span) {
                        out.extend(expanded.declarations.into_iter().map(|(p, css)| (p.name, css)));
                    }
                    continue;
                }
                let Some(text) = ops::to_string(value).filter(|_| value.is_static()) else {
                    return self.not_evaluable(span, "keyframe declarations must be static");
                };
                let raw = match value {
                    Value::Number(number) => RawValue::Number(*number),
                    _ => RawValue::Str(&text),
                };
                match declare(property, raw) {
                    Ok(expanded) => out.extend(expanded.declarations.into_iter().map(|(p, css)| (p.name, css))),
                    Err(_) => {
                        self.report(
                            Code::InvalidValue,
                            span,
                            format!("keyframe declaration {property}: {text:?} is invalid"),
                            None,
                        );
                    }
                }
            }
            let _ = write!(canonical, "{selector}{{{out:?}}}");
            list.push((collapse_whitespace(selector), out));
        }
        let deps = self.deps_in(&canonical);
        let definition = Arc::new(KeyframesDef {
            name: self.ctx.names.named('f', &[self.ctx.package, &canonical]),
            frames: list,
            deps,
        });
        self.definitions.borrow_mut().keyframes.push(definition.clone());
        Value::Keyframes(definition)
    }

    fn define_tokens(&self, arguments: &[(Value, (u32, u32))], span: (u32, u32)) -> Value {
        let [(Value::Str(namespace), _), (Value::Object(values), _), ..] = arguments else {
            if arguments.iter().any(|(value, _)| !value.is_static()) {
                self.report(Code::DynamicToken, span, "token values must be known at build time", None);
                return Value::unknown("tokens");
            }
            return self.not_evaluable(span, "defineTokens(namespace, values) takes a string and an object");
        };
        self.definitions.borrow_mut().namespaces.push((namespace.to_string(), span));
        let option = |name: &str| matches!(arguments.get(2), Some((options, _)) if matches!(options.get(name), Some(Value::Bool(true))));
        // A runtime token is read through its custom property, so it is a variable too (D-086).
        let runtime = option("runtime");
        self.token_group(namespace, &[], values, span, option("variable") || runtime, runtime)
    }

    fn token_group(
        &self,
        namespace: &str,
        path: &[String],
        values: &[(Key, Value)],
        span: (u32, u32),
        group_variable: bool,
        group_runtime: bool,
    ) -> Value {
        let mut entries = Vec::new();
        for (key, value) in values {
            // Diagnostics about one token point at its entry; the catalogue keeps where it is written.
            let at = self.entry_span(key, span);
            let Key::Str(name) = key else {
                self.report(Code::NotEvaluable, span, "token names must be static strings", None);
                continue;
            };
            let mut inner_path = path.to_vec();
            inner_path.push(name.to_string());
            let token = match value {
                Value::Str(_) | Value::Number(_) | Value::Token(_) => self.token(
                    at,
                    namespace,
                    &inner_path,
                    TokenValue::Plain(ops::to_string(value).expect("printable")),
                    group_variable,
                    group_runtime,
                    None,
                ),
                Value::Object(inner) => {
                    let get = |field: &str| value.get(field);
                    let identity = || format!("{namespace}.{}", inner_path.join("."));
                    let registration = match get("syntax") {
                        None => None,
                        Some(Value::Str(syntax))
                            if !syntax.trim().is_empty() && !syntax.contains(['"', '\\', ';', '{', '}']) =>
                        {
                            Some(Registration {
                                syntax: collapse_whitespace(syntax),
                                inherits: !matches!(get("inherits"), Some(Value::Bool(false))),
                            })
                        }
                        Some(_) => {
                            self.report(
                                Code::InvalidValue,
                                at,
                                format!("token {} has an invalid syntax; write a CSS syntax string", identity()),
                                Some("for example { value: \"0px\", syntax: \"<length-percentage>\" }"),
                            );
                            continue;
                        }
                    };
                    let runtime = group_runtime || matches!(get("runtime"), Some(Value::Bool(true)));
                    let variable = group_variable
                        || runtime
                        || registration.is_some()
                        || matches!(get("variable"), Some(Value::Bool(true)));
                    match (
                        get("light").and_then(css_text),
                        get("dark").and_then(css_text),
                        get("value").and_then(css_text),
                    ) {
                        (_, _, plain) if registration.is_some() => {
                            // The universal syntax may start unset: no initial value, and a reference
                            // falls back to nothing (`var(--k…,)`), as Tailwind's `--tw-blur` does.
                            let universal =
                                registration.as_ref().is_some_and(|registration| registration.syntax == "*");
                            let Some(plain) = plain.or_else(|| universal.then(String::new)) else {
                                self.report(
                                    Code::InvalidValue,
                                    at,
                                    format!("registered token {} takes one `value`, its initial value", identity()),
                                    Some("an @property initial value cannot differ per mode; only syntax \"*\" may leave it out"),
                                );
                                continue;
                            };
                            self.token(
                                at,
                                namespace,
                                &inner_path,
                                TokenValue::Plain(plain),
                                true,
                                runtime,
                                registration,
                            )
                        }
                        (Some(light), Some(dark), _) => {
                            let token_value = if is_color(&light) && is_color(&dark) {
                                TokenValue::Plain(format!("light-dark({light}, {dark})"))
                            } else {
                                TokenValue::Modes { light, dark }
                            };
                            self.token(at, namespace, &inner_path, token_value, variable, runtime, None)
                        }
                        (_, _, Some(plain)) => {
                            self.token(at, namespace, &inner_path, TokenValue::Plain(plain), variable, runtime, None)
                        }
                        _ if inner.iter().any(|(_, value)| !value.is_static()) => {
                            self.report(Code::DynamicToken, span, "token values must be known at build time", None);
                            continue;
                        }
                        _ => self.token_group(namespace, &inner_path, inner, span, group_variable, group_runtime),
                    }
                }
                _ if !value.is_static() => {
                    self.report(
                        Code::DynamicToken,
                        at,
                        format!("token {namespace}.{} is not known at build time", inner_path.join(".")),
                        None,
                    );
                    continue;
                }
                _ => {
                    self.report(
                        Code::InvalidValue,
                        at,
                        format!("token {namespace}.{} is not a CSS value", inner_path.join(".")),
                        None,
                    );
                    continue;
                }
            };
            entries.push((Key::Str(name.clone()), token));
        }
        Value::Object(Arc::new(entries))
    }

    #[allow(clippy::too_many_arguments)]
    fn token(
        &self,
        at: (u32, u32),
        namespace: &str,
        path: &[String],
        value: TokenValue,
        variable: bool,
        runtime: bool,
        registration: Option<Registration>,
    ) -> Value {
        let identity = format!("{namespace}.{}", path.join("."));
        self.definitions.borrow_mut().catalogue.push(crate::TokenEntry {
            identity: identity.clone(),
            value: value.clone(),
            variable: variable || matches!(value, TokenValue::Modes { .. }),
            span: at,
        });
        // Modes always need a variable.
        let value = match value {
            TokenValue::Plain(css) if !variable => {
                return Value::Token(Arc::new(TokenRef { css, variable: None, identity, deps: Vec::new() }));
            }
            value => value,
        };
        let mut parts: Vec<&str> = vec![self.ctx.package, namespace];
        parts.extend(path.iter().map(String::as_str));
        let name = self.ctx.names.token_variable(&parts);
        let text = match &value {
            TokenValue::Plain(css) => css.clone(),
            TokenValue::Modes { light, dark } => format!("{light} {dark}"),
        };
        let definition = Arc::new(TokenDef {
            variable: name.clone(),
            value,
            identity: identity.clone(),
            deps: self.deps_in(&text),
            registration,
            runtime,
        });
        let unset = matches!(&definition.value, TokenValue::Plain(css) if css.is_empty());
        self.definitions.borrow_mut().tokens.push(definition);
        Value::Token(Arc::new(TokenRef {
            css: if unset { format!("var({name},)") } else { format!("var({name})") },
            variable: Some(name),
            identity,
            deps: Vec::new(),
        }))
    }

    fn define_theme(&self, arguments: &[(Value, (u32, u32))], span: (u32, u32)) -> Value {
        let [(group @ Value::Object(_), _), (Value::Object(overrides), _), ..] = arguments else {
            return self.not_evaluable(span, "defineTheme(tokens, overrides) takes a token group and an object");
        };
        let mut declarations = Vec::new();
        self.theme_overrides(group, overrides, span, &mut declarations);
        let canonical = format!("{declarations:?}");
        let class = self.ctx.names.named('t', &[self.ctx.package, &canonical]);
        let deps = self.deps_in(&canonical);
        let definition = Arc::new(ThemeDef { class: class.clone(), declarations, deps });
        Value::Handle(Arc::new(Handle {
            markers: vec![class],
            marker_deps: vec![kirana_ir::Dep::Theme(definition)],
            ..Handle::default()
        }))
    }

    fn theme_overrides(
        &self,
        group: &Value,
        overrides: &[(Key, Value)],
        span: (u32, u32),
        out: &mut Vec<(String, TokenValue)>,
    ) {
        for (key, value) in overrides {
            let Key::Str(name) = key else { continue };
            match group.get(name) {
                Some(Value::Token(token)) => {
                    let Some(variable) = &token.variable else {
                        self.report(
                            Code::TokenNotVariable,
                            span,
                            format!("{} is not a variable token, so a theme cannot override it", token.identity),
                            Some("declare the token with `variable: true`"),
                        );
                        continue;
                    };
                    let token_value = match (
                        value.get("light").and_then(css_text),
                        value.get("dark").and_then(css_text),
                        css_text(value),
                    ) {
                        (Some(light), Some(dark), _) if is_color(&light) && is_color(&dark) => {
                            TokenValue::Plain(format!("light-dark({light}, {dark})"))
                        }
                        (Some(light), Some(dark), _) => TokenValue::Modes { light, dark },
                        (_, _, Some(plain)) => TokenValue::Plain(plain),
                        _ => {
                            self.report(
                                Code::InvalidValue,
                                span,
                                format!("theme value for {} is not a CSS value", token.identity),
                                None,
                            );
                            continue;
                        }
                    };
                    out.push((variable.clone(), token_value));
                }
                Some(inner @ Value::Object(_)) => match value {
                    Value::Object(nested) => self.theme_overrides(inner, nested, span, out),
                    _ => self.report(
                        Code::InvalidValue,
                        span,
                        format!("{name} is a token group; override its tokens"),
                        None,
                    ),
                },
                _ => self.report(Code::UnknownToken, span, format!("the token group has no token {name:?}"), None),
            }
        }
    }

    fn recipe(&self, arguments: &[(Value, (u32, u32))], span: (u32, u32)) -> Value {
        let Some((config @ Value::Object(_), _)) = arguments.first() else {
            return self.not_evaluable(span, "recipe() takes a configuration object");
        };
        if !config.is_static() {
            return self.not_evaluable(span, "a recipe definition must be static");
        }
        let slots: Option<Vec<String>> = match config.get("slots") {
            Some(Value::Array(items)) => Some(items.iter().filter_map(ops::to_string).collect()),
            _ => None,
        };
        let slot_styles = |value: Option<&Value>| -> Vec<Handle> {
            match (&slots, value) {
                (None, value) => vec![value.map_or_else(Handle::default, |value| self.static_style(value, span))],
                (Some(names), Some(Value::Object(entries))) => {
                    for (key, _) in entries.iter() {
                        if let Key::Str(key) = key
                            && !names.iter().any(|name| name == &**key)
                        {
                            self.report(Code::UnknownSlot, span, format!("the recipe has no slot {key:?}"), None);
                        }
                    }
                    names
                        .iter()
                        .map(|name| {
                            value
                                .and_then(|value| value.get(name))
                                .map_or_else(Handle::default, |value| self.static_style(value, span))
                        })
                        .collect()
                }
                (Some(names), _) => vec![Handle::default(); names.len()],
            }
        };
        let base = slot_styles(config.get("base"));
        let mut variants = Vec::new();
        if let Some(Value::Object(groups)) = config.get("variants") {
            for (group, options) in groups.iter() {
                let (Key::Str(group), Value::Object(options)) = (group, options) else { continue };
                let options = options
                    .iter()
                    .filter_map(|(option, style)| match option {
                        Key::Str(option) => Some((option.to_string(), slot_styles(Some(style)))),
                        _ => None,
                    })
                    .collect();
                variants.push((group.to_string(), options));
            }
        }
        let known = |group: &str, option: &str| {
            variants.iter().any(|(name, options): &(String, Vec<(String, Vec<Handle>)>)| {
                name == group && options.iter().any(|(candidate, _)| candidate == option)
            })
        };
        let selections = |value: &Value| -> Vec<(String, String)> {
            let Value::Object(entries) = value else { return Vec::new() };
            entries
                .iter()
                .filter_map(|(key, value)| match (key, ops::to_string(value)) {
                    (Key::Str(key), _) if &**key == "css" => None,
                    (Key::Str(key), Some(option)) if !matches!(value, Value::Undefined) => {
                        if !known(key, &option) {
                            self.report(
                                Code::UnknownVariant,
                                span,
                                format!("variant {key:?} has no option {option:?}"),
                                None,
                            );
                        }
                        Some((key.to_string(), option))
                    }
                    _ => None,
                })
                .collect()
        };
        let compounds = match config.get("compoundVariants") {
            Some(Value::Array(items)) => {
                items.iter().map(|item| (selections(item), slot_styles(item.get("css")))).collect()
            }
            _ => Vec::new(),
        };
        let defaults = config.get("defaultVariants").map(selections).unwrap_or_default();
        Value::Recipe(Arc::new(Recipe { slots, base, variants, compounds, defaults }))
    }

    pub(crate) fn recipe_call(&self, recipe: &Recipe, call: &CallExpression<'a>) -> Value {
        let span = sp(call.span);
        let arguments = self.arguments(call);
        let options = match arguments.first() {
            None => Some(Vec::new()),
            Some((value @ Value::Object(entries), _)) if value.is_static() => Some(
                entries
                    .iter()
                    .filter_map(|(key, value)| match (key, value) {
                        (_, Value::Undefined) => None,
                        (Key::Str(key), value) => ops::to_string(value).map(|option| (key.to_string(), option)),
                        _ => None,
                    })
                    .collect(),
            ),
            _ => None,
        };
        let Some(options) = options else {
            self.report(
                Code::DynamicVariant,
                span,
                "variant options are chosen at runtime from the recipe's table",
                None,
            );
            return Value::Dynamic(Arc::new(Dynamic::Open(span)));
        };
        match recipe.resolve(&options) {
            Ok(handles) => match &recipe.slots {
                None => Value::Handle(Arc::new(handles.into_iter().next().expect("one slot"))),
                Some(names) => Value::Object(Arc::new(
                    names
                        .iter()
                        .zip(handles)
                        .map(|(name, handle)| (Key::Str(Arc::from(name.as_str())), Value::Handle(Arc::new(handle))))
                        .collect(),
                )),
            },
            Err(message) => {
                self.report(Code::UnknownVariant, span, message, None);
                Value::unknown("variant")
            }
        }
    }
}

fn css_text(value: &Value) -> Option<String> {
    match value {
        Value::Str(_) | Value::Number(_) | Value::Token(_) => ops::to_string(value),
        _ => None,
    }
}

/// The attributes the handles in `value` claim (`own()`, KF-044), each once.
fn claimed_by(value: &Value, claims: &mut Vec<String>) {
    match value {
        Value::Handle(handle) => {
            for attribute in &handle.own {
                if !claims.contains(attribute) {
                    claims.push(attribute.clone());
                }
            }
        }
        Value::Array(items) => items.iter().for_each(|item| claimed_by(item, claims)),
        _ => {}
    }
}

impl Evaluator<'_, '_, '_> {
    /// `own("data-side", …)`: a handle with no styles that claims the attributes its component writes
    /// itself (KF-044). A style built on it treats a key on one as the component's, though a
    /// library's vocabulary names it too, as `conditions.ownAttributes` does for the whole project.
    fn own(&self, arguments: &[(Value, (u32, u32))], span: (u32, u32)) -> Value {
        let mut handle = Handle::default();
        for (value, at) in arguments {
            match value {
                Value::Str(name) if kirana_ir::is_attribute_name(name) => {
                    if !handle.own.iter().any(|own| own == &**name) {
                        handle.own.push(name.to_string());
                    }
                }
                _ => self.report(
                    Code::InvalidValue,
                    *at,
                    "own() takes attribute names, such as \"data-side\"",
                    Some("name the attribute, not a selector: own(\"data-side\")"),
                ),
            }
        }
        if arguments.is_empty() {
            self.report(Code::InvalidValue, span, "own() needs at least one attribute name", None);
        }
        Value::Handle(Arc::new(handle))
    }
}
