//! Expression evaluation over the Oxc AST.

use std::cell::{Cell, RefCell};
use std::sync::Arc;

use kirana_diagnostics::{Code, Diagnostic, Span};
use kirana_frontend::Parsed;
use kirana_ir::{
    Api, BinaryOp, Descriptor, Dynamic, Expr, ExprKey, Key, LogicalOp, Method, UnaryOp, Value, number_to_string,
};
use kirana_shared::FxHashMap;
use oxc_ast::AstKind;
use oxc_ast::ast::{
    Argument, ArrayExpressionElement, ArrowFunctionBody, BindingPattern, ChainElement, Expression, Function,
    FunctionBody, IdentifierReference, ModuleExportName, ObjectPropertyKind, PropertyKey, PropertyKind, Statement,
};
use oxc_semantic::SymbolId;
use oxc_span::GetSpan;
use oxc_syntax::operator::{BinaryOperator, LogicalOperator, UnaryOperator};

use crate::{Context, Definitions, Host, ImportName, ops};

const MAX_DEPTH: u32 = 64;

/// A byte span as the IR stores it.
pub(crate) fn sp(span: oxc_span::Span) -> (u32, u32) {
    (span.start, span.end)
}

/// Key address → (the key, kept alive so the address stays its own; its span).
type KeySpans = FxHashMap<usize, (Arc<str>, (u32, u32))>;

/// Evaluates expressions of one parsed module.
pub struct Evaluator<'p, 'a, 'c> {
    pub(crate) parsed: &'p Parsed<'a>,
    pub(crate) ctx: Context<'c>,
    pub(crate) host: &'c dyn Host,
    symbols: RefCell<FxHashMap<SymbolId, Option<Value>>>,
    calls: RefCell<FxHashMap<(u32, u32), Value>>,
    /// Calls that can only return a plain object at runtime (`Object.fromEntries()`), by span, with
    /// the callee's name. Such a value is a runtime value like any other, except where a style
    /// handle is expected: no merge can apply an object, so it is reported there (KF-010).
    pub(crate) plain_objects: RefCell<FxHashMap<(u32, u32), &'static str>>,
    diagnostics: RefCell<Vec<Diagnostic>>,
    pub(crate) definitions: RefCell<Definitions>,
    depth: Cell<u32>,
    /// Where each style-object key of this module was written, by the address of its `Arc<str>`.
    /// A key keeps its `Arc` however its object travels (`const styles = {…}`, `css(styles.a)`), so
    /// a diagnostic can point at the property instead of the whole `css()` argument. The entry holds
    /// a clone, so an address is never reused while the table lives.
    key_spans: RefCell<KeySpans>,
}

impl<'p, 'a, 'c> Evaluator<'p, 'a, 'c> {
    pub fn new(parsed: &'p Parsed<'a>, ctx: Context<'c>, host: &'c dyn Host) -> Self {
        Self {
            parsed,
            ctx,
            host,
            symbols: RefCell::default(),
            calls: RefCell::default(),
            plain_objects: RefCell::default(),
            diagnostics: RefCell::default(),
            definitions: RefCell::default(),
            depth: Cell::new(0),
            key_spans: RefCell::default(),
        }
    }

    /// The parsed module.
    pub fn parsed(&self) -> &'p Parsed<'a> {
        self.parsed
    }

    /// The compilation context.
    pub fn context(&self) -> Context<'c> {
        self.ctx
    }

    /// Reports a diagnostic once per code and span.
    pub fn report(&self, code: Code, span: (u32, u32), message: impl Into<String>, help: Option<&str>) {
        let mut diagnostic = Diagnostic::new(code, self.ctx.file, Span::new(span.0, span.1), message);
        if let Some(help) = help {
            diagnostic = diagnostic.with_help(help);
        }
        let mut diagnostics = self.diagnostics.borrow_mut();
        if !diagnostics.iter().any(|existing| {
            existing.code == code && existing.span == diagnostic.span && existing.message == diagnostic.message
        }) {
            diagnostics.push(diagnostic);
        }
    }

    /// Records where a freshly created key was written. Keys shared through a binding (`[hover]`)
    /// are not recorded: one `Arc` would stand for several places.
    pub(crate) fn record_key(&self, key: &Arc<str>, span: (u32, u32)) {
        self.key_spans.borrow_mut().entry(Arc::as_ptr(key).cast::<u8>() as usize).or_insert((key.clone(), span));
    }

    /// The span of the property `key` was written in, or `fallback` when it was not recorded here.
    pub(crate) fn entry_span(&self, key: &Key, fallback: (u32, u32)) -> (u32, u32) {
        let Key::Str(name) = key else { return fallback };
        self.key_spans.borrow().get(&(Arc::as_ptr(name).cast::<u8>() as usize)).map_or(fallback, |(_, span)| *span)
    }

    /// Diagnostics and definitions collected so far.
    pub fn finish(self) -> (Vec<Diagnostic>, Definitions) {
        (self.diagnostics.into_inner(), self.definitions.into_inner())
    }

    /// Evaluates one expression.
    pub fn eval(&self, expression: &Expression<'a>) -> Value {
        let span = sp(expression.span());
        if self.depth.get() >= MAX_DEPTH {
            return Value::Dynamic(Arc::new(Dynamic::Open(span)));
        }
        self.depth.set(self.depth.get() + 1);
        let value = self.eval_inner(expression, span);
        self.depth.set(self.depth.get() - 1);
        value
    }

    fn eval_inner(&self, expression: &Expression<'a>, span: (u32, u32)) -> Value {
        let open = || Value::Dynamic(Arc::new(Dynamic::Open(span)));
        match expression {
            Expression::BooleanLiteral(literal) => Value::Bool(literal.value),
            Expression::NullLiteral(_) => Value::Null,
            Expression::NumericLiteral(literal) => Value::Number(literal.value),
            Expression::StringLiteral(literal) => Value::str(literal.value.as_str()),
            Expression::TemplateLiteral(template) => {
                let mut text = String::new();
                for (index, quasi) in template.quasis.iter().enumerate() {
                    text.push_str(quasi.value.cooked.as_ref().unwrap_or(&quasi.value.raw).as_str());
                    if let Some(inner) = template.expressions.get(index) {
                        match ops::to_string(&self.eval(inner)) {
                            Some(part) => text.push_str(&part),
                            None => return open(),
                        }
                    }
                }
                Value::str(text)
            }
            Expression::Identifier(identifier) => self.identifier(identifier),
            Expression::ArrayExpression(array) => {
                let mut items = Vec::new();
                for element in &array.elements {
                    match element {
                        ArrayExpressionElement::SpreadElement(spread) => match self.eval(&spread.argument) {
                            Value::Array(inner) => items.extend(inner.iter().cloned()),
                            _ => return open(),
                        },
                        ArrayExpressionElement::Elision(_) => items.push(Value::Undefined),
                        other => items.push(self.eval(other.to_expression())),
                    }
                }
                Value::Array(Arc::new(items))
            }
            Expression::ObjectExpression(object) => {
                let mut entries: Vec<(Key, Value)> = Vec::new();
                for property in &object.properties {
                    match property {
                        ObjectPropertyKind::SpreadProperty(spread) => match self.eval(&spread.argument) {
                            Value::Object(inner) => entries.extend(inner.iter().cloned()),
                            Value::Null | Value::Undefined => {}
                            _ => return Value::unknown(format!("dynamic spread@{}:{}", span.0, span.1)),
                        },
                        ObjectPropertyKind::ObjectProperty(property) => {
                            if property.kind != PropertyKind::Init || property.method {
                                return Value::unknown("object with methods or accessors");
                            }
                            let key = match &property.key {
                                PropertyKey::StaticIdentifier(name) => Key::Str(Arc::from(name.name.as_str())),
                                key if property.computed => match to_key(&self.eval(key.to_expression())) {
                                    Some(key) => key,
                                    None => return Value::unknown(format!("dynamic key@{}:{}", span.0, span.1)),
                                },
                                key => match key.as_expression() {
                                    Some(Expression::StringLiteral(literal)) => {
                                        Key::Str(Arc::from(literal.value.as_str()))
                                    }
                                    Some(Expression::NumericLiteral(literal)) => {
                                        Key::Str(Arc::from(number_to_string(literal.value)))
                                    }
                                    _ => return Value::unknown("unsupported key"),
                                },
                            };
                            let value = self.eval(&property.value);
                            if let Key::Str(name) = &key
                                && (!property.computed || literal_key(&property.key))
                            {
                                self.record_key(name, property_span(property, &value));
                            }
                            entries.push((key, value));
                        }
                    }
                }
                Value::Object(Arc::new(entries))
            }
            Expression::ParenthesizedExpression(inner) => self.eval(&inner.expression),
            Expression::TSAsExpression(inner) => self.eval(&inner.expression),
            Expression::TSSatisfiesExpression(inner) => self.eval(&inner.expression),
            Expression::TSNonNullExpression(inner) => self.eval(&inner.expression),
            Expression::TSTypeAssertion(inner) => self.eval(&inner.expression),
            Expression::TSInstantiationExpression(inner) => self.eval(&inner.expression),
            Expression::UnaryExpression(unary) => {
                let operator = match unary.operator {
                    UnaryOperator::LogicalNot => UnaryOp::Not,
                    UnaryOperator::UnaryNegation => UnaryOp::Minus,
                    UnaryOperator::UnaryPlus => UnaryOp::Plus,
                    UnaryOperator::Typeof => UnaryOp::TypeOf,
                    _ => return open(),
                };
                ops::unary(operator, &self.eval(&unary.argument)).unwrap_or_else(open)
            }
            Expression::BinaryExpression(binary) => {
                let Some(operator) = binary_op(binary.operator) else { return open() };
                let (left, right) = (self.eval(&binary.left), self.eval(&binary.right));
                if !left.is_static() || !right.is_static() {
                    return open();
                }
                ops::binary(operator, &left, &right).unwrap_or_else(open)
            }
            Expression::LogicalExpression(logical) => {
                let operator = match logical.operator {
                    LogicalOperator::And => LogicalOp::And,
                    LogicalOperator::Or => LogicalOp::Or,
                    LogicalOperator::Coalesce => LogicalOp::Coalesce,
                };
                let left = self.eval(&logical.left);
                if left.is_static() {
                    return match ops::logical_pick_left(operator, &left) {
                        Some(true) => left,
                        _ => self.eval(&logical.right),
                    };
                }
                if operator == LogicalOp::And {
                    return Value::Dynamic(Arc::new(Dynamic::Conditional {
                        span,
                        test: sp(logical.left.span()),
                        consequent: self.eval(&logical.right),
                        alternate: Value::Bool(false),
                    }));
                }
                open()
            }
            Expression::ConditionalExpression(conditional) => {
                let test = self.eval(&conditional.test);
                match test.truthy() {
                    Some(true) => self.eval(&conditional.consequent),
                    Some(false) => self.eval(&conditional.alternate),
                    None => Value::Dynamic(Arc::new(Dynamic::Conditional {
                        span,
                        test: sp(conditional.test.span()),
                        consequent: self.eval(&conditional.consequent),
                        alternate: self.eval(&conditional.alternate),
                    })),
                }
            }
            Expression::StaticMemberExpression(member) => {
                let object = self.eval(&member.object);
                self.member(&object, member.property.name.as_str(), span)
            }
            Expression::ComputedMemberExpression(member) => {
                let object = self.eval(&member.object);
                match ops::to_string(&self.eval(&member.expression)) {
                    Some(key) if !matches!(object, Value::Token(_)) => self.member(&object, &key, span),
                    _ => open(),
                }
            }
            Expression::ChainExpression(chain) => match &chain.expression {
                ChainElement::CallExpression(call) => self.call(call),
                ChainElement::TSNonNullExpression(inner) => self.eval(&inner.expression),
                element => self.eval_member_element(element, span),
            },
            Expression::CallExpression(call) => self.call(call),
            Expression::ArrowFunctionExpression(arrow) => {
                let body = match &arrow.body {
                    ArrowFunctionBody::FunctionBody(body) => single_return(body),
                    body => Some(body.to_expression()),
                };
                self.lower_function(&arrow.params.items, arrow.params.rest.is_some(), body)
            }
            Expression::FunctionExpression(function) => self.lower_declared_function(function),
            _ => open(),
        }
    }

    fn eval_member_element(&self, element: &ChainElement<'a>, span: (u32, u32)) -> Value {
        match element.as_member_expression() {
            Some(oxc_ast::ast::MemberExpression::StaticMemberExpression(member)) => {
                let object = self.eval(&member.object);
                if matches!(object, Value::Undefined | Value::Null) {
                    return Value::Undefined;
                }
                self.member(&object, member.property.name.as_str(), span)
            }
            _ => Value::Dynamic(Arc::new(Dynamic::Open(span))),
        }
    }

    /// Evaluates a call expression (memoized per span).
    pub fn eval_call(&self, call: &oxc_ast::ast::CallExpression<'a>) -> Value {
        self.call(call)
    }

    /// Evaluates an identifier reference.
    pub fn eval_identifier(&self, identifier: &IdentifierReference<'a>) -> Value {
        self.identifier(identifier)
    }

    /// The binding an identifier refers to; `None` for a global.
    fn symbol_of(&self, identifier: &IdentifierReference<'a>) -> Option<SymbolId> {
        let scoping = self.parsed.semantic.scoping();
        identifier.reference_id.get().and_then(|reference| scoping.get_reference(reference).symbol_id())
    }

    /// The import source of the binding an identifier refers to, when it is an import.
    pub fn import_source(&self, identifier: &IdentifierReference<'a>) -> Option<&'a str> {
        let scoping = self.parsed.semantic.scoping();
        let symbol = self.symbol_of(identifier)?;
        match self.parsed.semantic.nodes().parent_kind(scoping.symbol_declaration(symbol)) {
            AstKind::ImportDeclaration(import) => Some(import.source.value.as_str()),
            _ => None,
        }
    }

    /// The module an identifier is imported from and the name it is imported as (`default` for a
    /// default import), or nothing for a local binding.
    pub fn import_of(&self, identifier: &IdentifierReference<'a>) -> Option<(&'a str, String)> {
        let scoping = self.parsed.semantic.scoping();
        let declaration = scoping.symbol_declaration(self.symbol_of(identifier)?);
        let AstKind::ImportDeclaration(import) = self.parsed.semantic.nodes().parent_kind(declaration) else {
            return None;
        };
        let name = match self.parsed.semantic.nodes().kind(declaration) {
            AstKind::ImportSpecifier(specifier) => export_name(&specifier.imported),
            _ => "default".to_owned(),
        };
        Some((import.source.value.as_str(), name))
    }

    /// For an element named by a component imported from project source: the component's name and
    /// the installed package it hands `sx` to without reading it.
    pub fn sx_forwarded_by(&self, identifier: &IdentifierReference<'a>) -> Option<(String, String)> {
        let scoping = self.parsed.semantic.scoping();
        let symbol = self.symbol_of(identifier)?;
        let declaration = scoping.symbol_declaration(symbol);
        let AstKind::ImportDeclaration(import) = self.parsed.semantic.nodes().parent_kind(declaration) else {
            return None;
        };
        let name = match self.parsed.semantic.nodes().kind(declaration) {
            AstKind::ImportSpecifier(specifier) => export_name(&specifier.imported),
            _ => "default".to_owned(),
        };
        let package = self.host.sx_forwarded(self.ctx.path, import.source.value.as_str(), &name)?;
        Some((identifier.name.to_string(), package))
    }

    /// The import source of a module-scope binding, by name.
    pub(crate) fn import_source_of_name(&self, name: &str) -> Option<&'a str> {
        let scoping = self.parsed.semantic.scoping();
        let symbol = scoping.get_root_binding(name.into())?;
        match self.parsed.semantic.nodes().parent_kind(scoping.symbol_declaration(symbol)) {
            AstKind::ImportDeclaration(import) => Some(import.source.value.as_str()),
            _ => None,
        }
    }

    /// Whether an import specifier resolves to an installed package.
    pub fn is_external(&self, specifier: &str) -> bool {
        self.host.is_external(self.ctx.path, specifier)
    }

    /// The handle of `mode.system`, `mode.light` or `mode.dark`.
    pub fn eval_mode(&self, name: &str) -> Value {
        self.mode(name).unwrap_or(Value::Undefined)
    }

    fn identifier(&self, identifier: &IdentifierReference<'a>) -> Value {
        let span = sp(identifier.span);
        let value = match self.symbol_of(identifier) {
            None => match identifier.name.as_str() {
                "undefined" => Value::Undefined,
                "NaN" => Value::Number(f64::NAN),
                "Infinity" => Value::Number(f64::INFINITY),
                _ => Value::unknown("global"),
            },
            Some(symbol) => self.symbol_value(symbol),
        };
        if value.is_static() {
            return value;
        }
        if let Some(import) = value.unresolved_import() {
            self.report_unresolved(identifier.name.as_str(), import, span);
        }
        // A binding of a plain object (`const s = Object.fromEntries(…)`) is one as well.
        if let Value::Dynamic(dynamic) = &value
            && let Dynamic::Open(bound) = &**dynamic
        {
            let builder = self.plain_objects.borrow().get(bound).copied();
            if let Some(builder) = builder {
                self.plain_objects.borrow_mut().insert(span, builder);
            }
        }
        Value::Dynamic(Arc::new(Dynamic::Open(span)))
    }

    /// Reports an unresolved import once per module: every value that depends on it compiles as a
    /// runtime value, which is rarely what the author meant.
    fn report_unresolved(&self, name: &str, import: &str, span: (u32, u32)) {
        let reported = self
            .diagnostics
            .borrow()
            .iter()
            .any(|existing| existing.code == Code::UnresolvedImport && existing.message.contains(import));
        if !reported {
            self.report(
                Code::UnresolvedImport,
                span,
                format!("`{name}` depends on {import}, which cannot be resolved, so it compiles as a runtime value"),
                Some("install the project's dependencies, or check the specifier and the tsconfig paths"),
            );
        }
    }

    /// The value a module-scope or local binding holds, or unknown.
    pub fn symbol_value(&self, symbol: SymbolId) -> Value {
        if let Some(slot) = self.symbols.borrow().get(&symbol) {
            return slot.clone().unwrap_or_else(|| Value::unknown("cycle"));
        }
        self.symbols.borrow_mut().insert(symbol, None);
        let value = self.compute_symbol(symbol);
        self.symbols.borrow_mut().insert(symbol, Some(value.clone()));
        value
    }

    fn compute_symbol(&self, symbol: SymbolId) -> Value {
        let semantic = &self.parsed.semantic;
        let scoping = semantic.scoping();
        let declaration = scoping.symbol_declaration(symbol);
        match semantic.nodes().kind(declaration) {
            AstKind::VariableDeclarator(declarator) => {
                if scoping.symbol_is_mutated(symbol) {
                    return Value::unknown("reassigned");
                }
                let value = declarator.init.as_ref().map_or(Value::Undefined, |init| self.eval(init));
                self.destructure(&declarator.id, value, symbol).unwrap_or_else(|| Value::unknown("pattern"))
            }
            AstKind::ImportSpecifier(specifier) => {
                self.import(declaration, ImportName::Named(export_name(&specifier.imported)))
            }
            AstKind::ImportDefaultSpecifier(_) => self.import(declaration, ImportName::Default),
            AstKind::ImportNamespaceSpecifier(_) => self.import(declaration, ImportName::Namespace),
            AstKind::Function(function) => self.lower_declared_function(function),
            AstKind::TSEnumDeclaration(declaration) => self.enumeration(declaration),
            _ => Value::unknown("not a constant"),
        }
    }

    /// A TypeScript `enum` whose members have literal (or omitted numeric) initializers.
    fn enumeration(&self, declaration: &oxc_ast::ast::TSEnumDeclaration<'a>) -> Value {
        let mut entries = Vec::new();
        let mut next = 0.0;
        for member in &declaration.body.members {
            let name = match &member.id {
                oxc_ast::ast::TSEnumMemberName::Identifier(identifier) => identifier.name.to_string(),
                oxc_ast::ast::TSEnumMemberName::String(literal)
                | oxc_ast::ast::TSEnumMemberName::ComputedString(literal) => literal.value.to_string(),
                oxc_ast::ast::TSEnumMemberName::ComputedTemplateString(_) => return Value::unknown("enum"),
            };
            let value = match &member.initializer {
                None => Value::Number(next),
                Some(initializer) => match self.eval(initializer) {
                    value @ (Value::Str(_) | Value::Number(_)) => value,
                    _ => return Value::unknown("enum"),
                },
            };
            if let Value::Number(number) = value {
                next = number + 1.0;
            }
            entries.push((Key::Str(Arc::from(name.as_str())), value));
        }
        Value::Object(Arc::new(entries))
    }

    fn destructure(&self, pattern: &BindingPattern<'a>, value: Value, symbol: SymbolId) -> Option<Value> {
        match pattern {
            BindingPattern::BindingIdentifier(identifier) => {
                (identifier.symbol_id.get() == Some(symbol)).then_some(value)
            }
            BindingPattern::AssignmentPattern(assignment) => {
                let value = if value == Value::Undefined { self.eval(&assignment.right) } else { value };
                self.destructure(&assignment.left, value, symbol)
            }
            BindingPattern::ObjectPattern(object) => object.properties.iter().find_map(|property| {
                let inner = match (&property.key, &value) {
                    (PropertyKey::StaticIdentifier(name), Value::Object(_)) => {
                        value.get(name.name.as_str()).cloned().unwrap_or(Value::Undefined)
                    }
                    _ => Value::unknown("pattern"),
                };
                self.destructure(&property.value, inner, symbol)
            }),
            BindingPattern::ArrayPattern(array) => array.elements.iter().enumerate().find_map(|(index, element)| {
                let inner = match &value {
                    Value::Array(items) => items.get(index).cloned().unwrap_or(Value::Undefined),
                    _ => Value::unknown("pattern"),
                };
                element.as_ref().and_then(|element| self.destructure(element, inner, symbol))
            }),
        }
    }

    fn import(&self, declaration: oxc_semantic::NodeId, name: ImportName) -> Value {
        // A specifier's parent is always its import declaration.
        let parent = self.parsed.semantic.nodes().parent_kind(declaration);
        let source = parent.as_import_declaration().map_or("", |import| import.source.value.as_str());
        if source == "@kirana-style/core" {
            return match name {
                ImportName::Named(name) => {
                    Api::from_export(&name).map_or_else(|| Value::unknown("not a Kirana API"), Value::Api)
                }
                ImportName::Namespace => Value::Object(Arc::new(
                    ALL_APIS.iter().map(|api| (Key::Str(Arc::from(api.export())), Value::Api(*api))).collect(),
                )),
                ImportName::Default => Value::unknown("@kirana-style/core has no default export"),
            };
        }
        self.host.import(self.ctx.path, source, &name)
    }

    fn member(&self, object: &Value, key: &str, span: (u32, u32)) -> Value {
        match object {
            Value::Object(entries) => match object.get(key) {
                Some(value) => value.clone(),
                None if entries.iter().any(|(_, value)| matches!(value, Value::Token(_))) => {
                    self.report(Code::UnknownToken, span, format!("the token group has no token {key:?}"), None);
                    Value::Undefined
                }
                None => Value::Undefined,
            },
            Value::Array(items) => match key {
                "length" => Value::Number(items.len() as f64),
                _ => key.parse::<usize>().ok().and_then(|index| items.get(index).cloned()).unwrap_or(Value::Undefined),
            },
            Value::Str(text) if key == "length" => Value::Number(text.encode_utf16().count() as f64),
            Value::Relation(relation) => match key {
                "anchor" => Value::Handle(Arc::new(kirana_ir::Handle {
                    markers: vec![relation.marker.clone()],
                    ..kirana_ir::Handle::default()
                })),
                "name" => Value::str(&relation.name),
                "within" => {
                    Value::Method(Arc::new(Method::RelationRead(relation.clone(), kirana_ir::RelationKind::Within)))
                }
                "after" => {
                    Value::Method(Arc::new(Method::RelationRead(relation.clone(), kirana_ir::RelationKind::After)))
                }
                "before" => {
                    Value::Method(Arc::new(Method::RelationRead(relation.clone(), kirana_ir::RelationKind::Before)))
                }
                _ => Value::Undefined,
            },
            Value::Api(Api::Select) => match key {
                "descendant" => Value::Method(Arc::new(Method::Select { child: false })),
                "child" => Value::Method(Arc::new(Method::Select { child: true })),
                _ => Value::Undefined,
            },
            Value::Api(Api::Mode) => self.mode(key).unwrap_or(Value::Undefined),
            _ => Value::Dynamic(Arc::new(Dynamic::Open(span))),
        }
    }

    fn call(&self, call: &oxc_ast::ast::CallExpression<'a>) -> Value {
        let span = sp(call.span);
        if let Some(value) = self.calls.borrow().get(&span) {
            return value.clone();
        }
        let callee = self.eval(&call.callee);
        let value = match &callee {
            Value::Api(api) => self.api_call(*api, call),
            Value::Method(method) => self.method_call(method, call),
            Value::Recipe(recipe) => self.recipe_call(recipe, call),
            Value::Function(descriptor) => {
                let arguments: Option<Vec<Value>> = call
                    .arguments
                    .iter()
                    .map(|argument| match argument {
                        Argument::SpreadElement(_) => None,
                        argument => Some(self.eval(argument.to_expression())).filter(Value::is_static),
                    })
                    .collect();
                arguments
                    .and_then(|arguments| apply(descriptor, &arguments, self))
                    .unwrap_or_else(|| Value::Dynamic(Arc::new(Dynamic::Open(span))))
            }
            _ => {
                if let Some(name) = self.plain_object_builder(&call.callee) {
                    self.plain_objects.borrow_mut().insert(span, name);
                }
                Value::Dynamic(Arc::new(Dynamic::Open(span)))
            }
        };
        self.calls.borrow_mut().insert(span, value.clone());
        value
    }

    /// The name of a global that only ever builds a plain object (`Object.fromEntries`,
    /// `Object.assign`, `Object.create`, `JSON.parse`, `structuredClone`), when `callee` is one and no
    /// binding of the module shadows it.
    fn plain_object_builder(&self, callee: &Expression<'a>) -> Option<&'static str> {
        match callee.without_parentheses() {
            Expression::StaticMemberExpression(member) => {
                let Expression::Identifier(object) = &member.object else { return None };
                if self.symbol_of(object).is_some() {
                    return None;
                }
                match (object.name.as_str(), member.property.name.as_str()) {
                    ("Object", "fromEntries") => Some("Object.fromEntries()"),
                    ("Object", "assign") => Some("Object.assign()"),
                    ("Object", "create") => Some("Object.create()"),
                    ("JSON", "parse") => Some("JSON.parse()"),
                    _ => None,
                }
            }
            Expression::Identifier(identifier)
                if identifier.name == "structuredClone" && self.symbol_of(identifier).is_none() =>
            {
                Some("structuredClone()")
            }
            _ => None,
        }
    }

    /// Evaluates call arguments; a spread of a static array is flattened.
    pub(crate) fn arguments(&self, call: &oxc_ast::ast::CallExpression<'a>) -> Vec<(Value, (u32, u32))> {
        let mut values = Vec::new();
        for argument in &call.arguments {
            let span = sp(argument.span());
            match argument {
                Argument::SpreadElement(spread) => match self.eval(&spread.argument) {
                    Value::Array(items) => values.extend(items.iter().map(|item| (item.clone(), span))),
                    _ => values.push((Value::Dynamic(Arc::new(Dynamic::Spread(sp(spread.argument.span())))), span)),
                },
                argument => values.push((self.eval(argument.to_expression()), span)),
            }
        }
        values
    }

    fn lower_declared_function(&self, function: &Function<'a>) -> Value {
        if function.generator || function.r#async {
            return Value::unknown("function");
        }
        let body = function.body.as_deref().and_then(single_return);
        self.lower_function(&function.params.items, function.params.rest.is_some(), body)
    }

    fn lower_function(
        &self,
        params: &[oxc_ast::ast::FormalParameter<'a>],
        has_rest: bool,
        body: Option<&Expression<'a>>,
    ) -> Value {
        let Some(body) = body else { return Value::unknown("function") };
        let mut symbols = Vec::new();
        for param in params {
            match (&param.pattern, &param.initializer) {
                (BindingPattern::BindingIdentifier(identifier), None) => symbols.push(identifier.symbol_id.get()),
                _ => return Value::unknown("function"),
            }
        }
        if has_rest {
            return Value::unknown("function");
        }
        match self.lower(body, &symbols) {
            Some(body) => Value::Function(Arc::new(Descriptor { params: symbols.len(), body })),
            None => Value::unknown("function"),
        }
    }

    fn lower(&self, expression: &Expression<'a>, params: &[Option<SymbolId>]) -> Option<Expr> {
        let lower = |inner: &Expression<'a>| self.lower(inner, params).map(Box::new);
        Some(match expression {
            Expression::Identifier(identifier) => {
                match self
                    .symbol_of(identifier)
                    .and_then(|symbol| params.iter().position(|param| *param == Some(symbol)))
                {
                    Some(index) => Expr::Param(index),
                    None => Expr::Value(Some(self.identifier(identifier)).filter(Value::is_static)?),
                }
            }
            Expression::TemplateLiteral(template) => Expr::Template {
                quasis: template
                    .quasis
                    .iter()
                    // Only a tagged template leaves `cooked` unset.
                    .map(|quasi| Arc::from(quasi.value.cooked.as_ref().unwrap_or(&quasi.value.raw).as_str()))
                    .collect(),
                expressions: template
                    .expressions
                    .iter()
                    .map(|inner| self.lower(inner, params))
                    .collect::<Option<_>>()?,
            },
            Expression::StaticMemberExpression(member) => Expr::Member {
                object: lower(&member.object)?,
                property: Box::new(Expr::Value(Value::str(member.property.name.as_str()))),
            },
            Expression::ComputedMemberExpression(member) => {
                Expr::Member { object: lower(&member.object)?, property: lower(&member.expression)? }
            }
            Expression::BinaryExpression(binary) => Expr::Binary {
                operator: binary_op(binary.operator)?,
                left: lower(&binary.left)?,
                right: lower(&binary.right)?,
            },
            Expression::LogicalExpression(logical) => Expr::Logical {
                operator: match logical.operator {
                    LogicalOperator::And => LogicalOp::And,
                    LogicalOperator::Or => LogicalOp::Or,
                    LogicalOperator::Coalesce => LogicalOp::Coalesce,
                },
                left: lower(&logical.left)?,
                right: lower(&logical.right)?,
            },
            Expression::ConditionalExpression(conditional) => Expr::Conditional {
                test: lower(&conditional.test)?,
                consequent: lower(&conditional.consequent)?,
                alternate: lower(&conditional.alternate)?,
            },
            Expression::UnaryExpression(unary) => Expr::Unary {
                operator: match unary.operator {
                    UnaryOperator::LogicalNot => UnaryOp::Not,
                    UnaryOperator::UnaryNegation => UnaryOp::Minus,
                    UnaryOperator::UnaryPlus => UnaryOp::Plus,
                    UnaryOperator::Typeof => UnaryOp::TypeOf,
                    _ => return None,
                },
                argument: lower(&unary.argument)?,
            },
            Expression::ParenthesizedExpression(inner) => self.lower(&inner.expression, params)?,
            Expression::TSAsExpression(inner) => self.lower(&inner.expression, params)?,
            Expression::TSSatisfiesExpression(inner) => self.lower(&inner.expression, params)?,
            Expression::ArrayExpression(array) => Expr::Array(
                array
                    .elements
                    .iter()
                    .map(|element| match element {
                        ArrayExpressionElement::SpreadElement(_) | ArrayExpressionElement::Elision(_) => None,
                        element => self.lower(element.to_expression(), params),
                    })
                    .collect::<Option<_>>()?,
            ),
            Expression::ObjectExpression(object) => Expr::Object(
                object
                    .properties
                    .iter()
                    .map(|property| match property {
                        ObjectPropertyKind::SpreadProperty(spread) => {
                            Some((ExprKey::Spread, self.lower(&spread.argument, params)?))
                        }
                        ObjectPropertyKind::ObjectProperty(property) => {
                            if property.kind != PropertyKind::Init || property.method {
                                return None;
                            }
                            let key = match &property.key {
                                PropertyKey::StaticIdentifier(name) => {
                                    let name: Arc<str> = Arc::from(name.name.as_str());
                                    self.record_key(&name, sp(property.span));
                                    ExprKey::Static(name)
                                }
                                key if property.computed => ExprKey::Computed(self.lower(key.to_expression(), params)?),
                                key => match key.to_expression() {
                                    Expression::StringLiteral(literal) => {
                                        let name: Arc<str> = Arc::from(literal.value.as_str());
                                        self.record_key(&name, sp(property.span));
                                        ExprKey::Static(name)
                                    }
                                    _ => return None,
                                },
                            };
                            Some((key, self.lower(&property.value, params)?))
                        }
                    })
                    .collect::<Option<_>>()?,
            ),
            Expression::CallExpression(call) => Expr::Call {
                callee: lower(&call.callee)?,
                arguments: call
                    .arguments
                    .iter()
                    .map(|argument| match argument {
                        Argument::SpreadElement(_) => None,
                        argument => self.lower(argument.to_expression(), params),
                    })
                    .collect::<Option<_>>()?,
            },
            other => Expr::Value(Some(self.eval(other)).filter(Value::is_static)?),
        })
    }

    /// Names every export of the module, in source order.
    pub fn export_names(&self) -> Vec<String> {
        let mut names = Vec::new();
        for statement in &self.parsed.program.body {
            match statement {
                Statement::ExportDeclaration(export) => match &export.declaration {
                    oxc_ast::ast::Declaration::VariableDeclaration(declaration) => {
                        for declarator in &declaration.declarations {
                            names.extend(declarator.id.get_binding_identifiers().iter().map(|id| id.name.to_string()));
                        }
                    }
                    oxc_ast::ast::Declaration::FunctionDeclaration(function) => {
                        names.extend(function.id.as_ref().map(|id| id.name.to_string()));
                    }
                    _ => {}
                },
                Statement::ExportNamedDeclaration(export) => {
                    names.extend(export.specifiers.iter().map(|specifier| export_name(&specifier.exported)));
                }
                Statement::ExportFromDeclaration(export) => {
                    names.extend(export.specifiers.iter().map(|specifier| export_name(&specifier.exported)));
                }
                Statement::ExportDefaultDeclaration(_) => names.push("default".to_owned()),
                Statement::ExportAllDeclaration(export) => names.extend(export.exported.as_ref().map(export_name)),
                _ => {}
            }
        }
        names
    }

    /// The value of one export; `export *` re-exports are followed through the host.
    pub fn export(&self, name: &str) -> Value {
        let scoping = self.parsed.semantic.scoping();
        let found = |statement: &Statement<'a>| -> Option<Value> {
            match statement {
                Statement::ExportDeclaration(export) => match &export.declaration {
                    oxc_ast::ast::Declaration::VariableDeclaration(declaration) => declaration
                        .declarations
                        .iter()
                        .flat_map(|declarator| declarator.id.get_binding_identifiers())
                        .find_map(|identifier| {
                            (identifier.name.as_str() == name).then(|| {
                                identifier.symbol_id.get().map_or(Value::Undefined, |symbol| self.symbol_value(symbol))
                            })
                        }),
                    oxc_ast::ast::Declaration::FunctionDeclaration(function) => function
                        .id
                        .as_ref()
                        .is_some_and(|id| id.name.as_str() == name)
                        .then(|| self.lower_declared_function(function)),
                    _ => None,
                },
                Statement::ExportNamedDeclaration(export) => export.specifiers.iter().find_map(|specifier| {
                    (export_name(&specifier.exported) == name).then(|| {
                        let local = export_name(&specifier.local);
                        scoping
                            .get_root_binding(local.as_str().into())
                            .map_or(Value::Undefined, |symbol| self.symbol_value(symbol))
                    })
                }),
                Statement::ExportFromDeclaration(export) => export.specifiers.iter().find_map(|specifier| {
                    (export_name(&specifier.exported) == name).then(|| {
                        let local = export_name(&specifier.local);
                        let import = if local == "default" { ImportName::Default } else { ImportName::Named(local) };
                        self.host.import(self.ctx.path, export.source.value.as_str(), &import)
                    })
                }),
                Statement::ExportDefaultDeclaration(export) if name == "default" => Some(match &export.declaration {
                    oxc_ast::ast::ExportDefaultDeclarationKind::FunctionDeclaration(function) => {
                        self.lower_declared_function(function)
                    }
                    declaration => declaration.as_expression().map_or_else(
                        || Value::unknown("default export"),
                        |expression| crate::portable(&self.eval(expression)),
                    ),
                }),
                Statement::ExportAllDeclaration(export) => export
                    .exported
                    .as_ref()
                    .is_some_and(|exported| export_name(exported) == name)
                    .then(|| self.host.import(self.ctx.path, export.source.value.as_str(), &ImportName::Namespace)),
                _ => None,
            }
        };
        self.parsed.program.body.iter().find_map(found).unwrap_or(Value::Undefined)
    }

    /// The sources of `export * from "…"` re-exports, searched for names the module does not
    /// declare itself.
    pub fn star_exports(&self) -> Vec<String> {
        self.parsed
            .program
            .body
            .iter()
            .filter_map(|statement| match statement {
                Statement::ExportAllDeclaration(export) if export.exported.is_none() => {
                    Some(export.source.value.to_string())
                }
                _ => None,
            })
            .collect()
    }
}

const ALL_APIS: [Api; 17] = [
    Api::Css,
    Api::Cx,
    Api::Props,
    Api::Recipe,
    Api::Relation,
    Api::Select,
    Api::Keyframes,
    Api::DefineTokens,
    Api::DefineTheme,
    Api::Mode,
    Api::Media,
    Api::Container,
    Api::Supports,
    Api::FirstThatWorks,
    Api::PositionTry,
    Api::ViewTransition,
    Api::CounterStyle,
];

fn single_return<'a, 'b>(body: &'b FunctionBody<'a>) -> Option<&'b Expression<'a>> {
    match body.statements.as_slice() {
        [Statement::ReturnStatement(statement)] => statement.argument.as_ref(),
        _ => None,
    }
}

pub(crate) fn export_name(name: &ModuleExportName<'_>) -> String {
    match name {
        ModuleExportName::IdentifierName(name) => name.name.to_string(),
        ModuleExportName::IdentifierReference(name) => name.name.to_string(),
        ModuleExportName::StringLiteral(literal) => literal.value.to_string(),
    }
}

fn binary_op(operator: BinaryOperator) -> Option<BinaryOp> {
    Some(match operator {
        BinaryOperator::Addition => BinaryOp::Add,
        BinaryOperator::Subtraction => BinaryOp::Sub,
        BinaryOperator::Multiplication => BinaryOp::Mul,
        BinaryOperator::Division => BinaryOp::Div,
        BinaryOperator::Remainder => BinaryOp::Rem,
        BinaryOperator::Equality => BinaryOp::Eq,
        BinaryOperator::Inequality => BinaryOp::NotEq,
        BinaryOperator::StrictEquality => BinaryOp::StrictEq,
        BinaryOperator::StrictInequality => BinaryOp::StrictNotEq,
        BinaryOperator::LessThan => BinaryOp::Lt,
        BinaryOperator::LessEqualThan => BinaryOp::LtEq,
        BinaryOperator::GreaterThan => BinaryOp::Gt,
        BinaryOperator::GreaterEqualThan => BinaryOp::GtEq,
        _ => return None,
    })
}

/// A computed key written as a literal (`[":hover"]`), whose evaluated `Arc` is its own.
fn literal_key(key: &PropertyKey<'_>) -> bool {
    match key.as_expression() {
        Some(Expression::StringLiteral(_) | Expression::NumericLiteral(_)) => true,
        Some(Expression::TemplateLiteral(template)) => template.expressions.is_empty(),
        _ => false,
    }
}

/// The span a property's diagnostics point at: the whole `key: value`, or only the key when the
/// value is a nested object, whose own keys are recorded too.
fn property_span(property: &oxc_ast::ast::ObjectProperty<'_>, value: &Value) -> (u32, u32) {
    match value {
        Value::Object(_) => sp(property.key.span()),
        _ => sp(property.span),
    }
}

/// A computed key from a static value.
pub(crate) fn to_key(value: &Value) -> Option<Key> {
    Some(match value {
        Value::Str(text) => Key::Str(text.clone()),
        Value::Number(number) => Key::Str(Arc::from(number_to_string(*number))),
        Value::Conditions(conditions) => Key::Conditions(conditions.clone()),
        Value::Select(target) => Key::Select(target.clone()),
        Value::Token(token) => Key::Token(token.clone()),
        _ => return None,
    })
}

/// Arguments are static, and so is every value `run` produces from them, so truthiness is known.
const STATIC: &str = "applied values are static";

/// Applies a pure-function descriptor to static arguments.
pub(crate) fn apply(descriptor: &Descriptor, arguments: &[Value], evaluator: &Evaluator<'_, '_, '_>) -> Option<Value> {
    fn run(expr: &Expr, arguments: &[Value], evaluator: &Evaluator<'_, '_, '_>) -> Option<Value> {
        Some(match expr {
            Expr::Value(value) => value.clone(),
            Expr::Param(index) => arguments.get(*index).cloned().unwrap_or(Value::Undefined),
            Expr::Template { quasis, expressions } => {
                let mut text = String::new();
                for (index, quasi) in quasis.iter().enumerate() {
                    text.push_str(quasi);
                    if let Some(inner) = expressions.get(index) {
                        text.push_str(&ops::to_string(&run(inner, arguments, evaluator)?)?);
                    }
                }
                Value::str(text)
            }
            Expr::Member { object, property } => {
                let object = run(object, arguments, evaluator)?;
                let key = ops::to_string(&run(property, arguments, evaluator)?)?;
                Some(evaluator.member(&object, &key, (0, 0))).filter(Value::is_static)?
            }
            Expr::Binary { operator, left, right } => {
                ops::binary(*operator, &run(left, arguments, evaluator)?, &run(right, arguments, evaluator)?)?
            }
            Expr::Unary { operator, argument } => ops::unary(*operator, &run(argument, arguments, evaluator)?)?,
            Expr::Logical { operator, left, right } => {
                let left = run(left, arguments, evaluator)?;
                if ops::logical_pick_left(*operator, &left).expect(STATIC) {
                    left
                } else {
                    run(right, arguments, evaluator)?
                }
            }
            Expr::Conditional { test, consequent, alternate } => {
                if run(test, arguments, evaluator)?.truthy().expect(STATIC) {
                    run(consequent, arguments, evaluator)?
                } else {
                    run(alternate, arguments, evaluator)?
                }
            }
            Expr::Object(properties) => {
                let mut entries = Vec::new();
                for (key, value) in properties {
                    let value = run(value, arguments, evaluator)?;
                    match key {
                        ExprKey::Static(name) => entries.push((Key::Str(name.clone()), value)),
                        ExprKey::Computed(key) => entries.push((to_key(&run(key, arguments, evaluator)?)?, value)),
                        ExprKey::Spread => match value {
                            Value::Object(inner) => entries.extend(inner.iter().cloned()),
                            _ => return None,
                        },
                    }
                }
                Value::Object(Arc::new(entries))
            }
            Expr::Array(items) => {
                Value::Array(Arc::new(items.iter().map(|item| run(item, arguments, evaluator)).collect::<Option<_>>()?))
            }
            Expr::Call { callee, arguments: call_arguments } => {
                let Value::Function(inner) = run(callee, arguments, evaluator)? else { return None };
                let values = call_arguments
                    .iter()
                    .map(|argument| run(argument, arguments, evaluator))
                    .collect::<Option<Vec<_>>>()?;
                apply(&inner, &values, evaluator)?
            }
        })
    }
    (arguments.len() <= descriptor.params).then(|| run(&descriptor.body, arguments, evaluator)).flatten()
}
