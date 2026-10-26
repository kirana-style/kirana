//! The walk that finds style sites and records edits.

use std::borrow::Cow;

use kirana_diagnostics::{Code as DiagnosticCode, Diagnostic, Span};
use kirana_evaluator::Evaluator;
use kirana_ir::{Api, Value};
use kirana_shared::FxHashSet;
use oxc_ast::ast::{
    Argument, BindingPattern, BindingProperty, CallExpression, Expression, IdentifierReference, JSXAttribute,
    JSXAttributeItem, JSXAttributeName, JSXAttributeValue, JSXElementName, JSXOpeningElement, ObjectExpression,
    ObjectProperty, ObjectPropertyKind, PropertyKey, Statement, StringLiteral,
};
use oxc_ast_visit::{Visit, walk};
use oxc_span::GetSpan;

use crate::codegen::Code;
use crate::{Edit, Piece};

pub(crate) struct Rewriter<'e, 'p, 'a, 'c> {
    evaluator: &'e Evaluator<'p, 'a, 'c>,
    edits: Vec<Edit>,
    callee_identifiers: FxHashSet<u32>,
    pub runtime_needed: bool,
    pub anchors: Vec<String>,
    pub diagnostics: Vec<Diagnostic>,
}

fn sp(span: oxc_span::Span) -> (u32, u32) {
    (span.start, span.end)
}

impl<'e, 'p, 'a, 'c> Rewriter<'e, 'p, 'a, 'c> {
    pub fn new(evaluator: &'e Evaluator<'p, 'a, 'c>) -> Self {
        Self {
            evaluator,
            edits: Vec::new(),
            callee_identifiers: FxHashSet::default(),
            runtime_needed: false,
            anchors: Vec::new(),
            diagnostics: Vec::new(),
        }
    }

    pub fn run(&mut self) {
        let program = self.evaluator.parsed().program;
        for statement in &program.body {
            if let Statement::ImportDeclaration(import) = statement
                && import.source.value == "@kirana-style/core"
                && !import.import_kind.is_type()
            {
                self.edits.push(Edit { start: import.span.start, end: import.span.end, ..Edit::default() });
                for specifier in import.specifiers.iter().flatten() {
                    let problem = match specifier {
                        oxc_ast::ast::ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => {
                            Some("@kirana-style/core has no default export".to_owned())
                        }
                        oxc_ast::ast::ImportDeclarationSpecifier::ImportSpecifier(named)
                            if !named.import_kind.is_type() =>
                        {
                            let name = named.imported.name();
                            (Api::from_export(name.as_str()).is_none() && !TYPE_EXPORTS.contains(&name.as_str()))
                                .then(|| format!("@kirana-style/core has no export {name:?}"))
                        }
                        _ => None,
                    };
                    if let Some(message) = problem {
                        let span = oxc_span::GetSpan::span(specifier);
                        self.report(DiagnosticCode::UnsupportedSyntax, (span.start, span.end), &message, None);
                    }
                }
            }
        }
        self.visit_program(program);
    }

    /// Edits sorted so an enclosing edit precedes the edits inside it; duplicates removed.
    pub fn finish_edits(&mut self) -> Vec<Edit> {
        let mut edits = std::mem::take(&mut self.edits);
        edits.sort_by(|a, b| a.start.cmp(&b.start).then(b.end.cmp(&a.end)));
        edits.dedup_by_key(|edit| (edit.start, edit.end));
        edits
    }

    fn push(&mut self, span: (u32, u32), code: Code) {
        self.runtime_needed |= code.runtime;
        let mut marker_deps = code.marker_deps;
        // Variable tokens that reach runtime values (a token object, a token passed to a bridged
        // value) must be declared even when no atom names them.
        for piece in &code.pieces {
            if let crate::Piece::Text(text) = piece {
                for dep in self.evaluator.deps_in(text) {
                    kirana_ir::push_dep(&mut marker_deps, dep);
                }
            }
        }
        for handle in &code.handles {
            for marker in &handle.markers {
                if !self.anchors.contains(marker) && is_relation_marker(marker, &self.evaluator.context().names.prefix)
                {
                    self.anchors.push(marker.clone());
                }
            }
        }
        let handles = code.handles.into_iter().map(|handle| (span, handle)).collect();
        let recipes = code.recipes.into_iter().map(|recipe| (span, recipe)).collect();
        self.edits.push(Edit { start: span.0, end: span.1, pieces: code.pieces, handles, recipes, marker_deps });
    }

    fn report(&mut self, code: DiagnosticCode, span: (u32, u32), message: &str, help: Option<&str>) {
        let mut diagnostic = Diagnostic::new(code, self.evaluator.context().file, Span::new(span.0, span.1), message);
        if let Some(help) = help {
            diagnostic = diagnostic.with_help(help);
        }
        self.diagnostics.push(diagnostic);
    }

    fn kirana_callee(&self, callee: &Expression<'a>) -> Option<Value> {
        let value = self.evaluator.eval(callee);
        matches!(value, Value::Api(_) | Value::Method(_) | Value::Recipe(_)).then_some(value)
    }

    fn host_sx(&mut self, element: &JSXOpeningElement<'a>, sx: &JSXAttribute<'a>) {
        let names = self.evaluator.context().names;
        let class = self.evaluator.context().config.jsx.class_attribute();
        let parts = match &sx.value {
            Some(JSXAttributeValue::ExpressionContainer(container)) => {
                self.evaluator.sx_parts(container.expression.as_expression().expect("`sx={}` does not parse"))
            }
            // `sx="px-4"`: the utility surface; a bare `sx` has no value to lower. Without a grammar
            // the diagnostic is all there is, and the attribute is left as written.
            Some(JSXAttributeValue::StringLiteral(literal)) => {
                let parts = self.evaluator.utility_parts(&utility_text(literal), sp(literal.span));
                if self.evaluator.context().config.utilities.is_none() {
                    return;
                }
                parts
            }
            _ => self.evaluator.utility_parts("", sx_span(sx)),
        };
        let mut class_sources: Vec<Vec<Piece>> = Vec::new();
        let mut style_sources: Vec<Vec<Piece>> = Vec::new();
        let mut kept: Vec<(u32, u32)> = Vec::new();
        for item in &element.attributes {
            match item {
                JSXAttributeItem::SpreadAttribute(spread) => {
                    kept.push(sp(spread.span));
                    let (start, end) = sp(spread.argument.span());
                    class_sources.push(vec![
                        Piece::Text("(".into()),
                        Piece::Source(start, end),
                        Piece::Text(format!(")?.{class}")),
                    ]);
                    style_sources.push(vec![
                        Piece::Text("(".into()),
                        Piece::Source(start, end),
                        Piece::Text(")?.style".into()),
                    ]);
                }
                JSXAttributeItem::Attribute(attribute) => match (attribute_name(attribute), &attribute.value) {
                    (Some("sx"), _) => {}
                    (Some(name), Some(JSXAttributeValue::StringLiteral(literal))) if carries(name, class) => {
                        let target = if name == "style" { &mut style_sources } else { &mut class_sources };
                        target.push(vec![Piece::Source(literal.span.start, literal.span.end)]);
                    }
                    (Some(name), Some(JSXAttributeValue::ExpressionContainer(container))) if carries(name, class) => {
                        let target = if name == "style" { &mut style_sources } else { &mut class_sources };
                        let (start, end) = sp(container.expression.span());
                        target.push(vec![Piece::Text("(".into()), Piece::Source(start, end), Piece::Text(")".into())]);
                    }
                    _ => kept.push(sp(attribute.span)),
                },
            }
        }
        let mut code = Code::default();
        if class_sources.is_empty()
            && style_sources.is_empty()
            && let Some(handle) = parts.static_handle()
        {
            if !names.dom_class_string(&handle).is_empty() {
                code.text(format!("{class}="));
                code.dom_handle(names, &handle);
            } else {
                code.record(&handle);
            }
            self.push(sx_span(sx), code);
            return;
        }
        let first = element.attributes.first().expect("sx is an attribute").span().start;
        let last = element.attributes.last().expect("sx is an attribute").span().end;
        for span in kept {
            code.source(span);
            code.text(" ");
        }
        code.runtime = true;
        code.text("{...__k.sx([");
        code.parts(names, &parts.0);
        code.text("], [");
        join(&mut code, class_sources);
        code.text("], [");
        join(&mut code, style_sources);
        code.text("])}");
        self.push((first, last), code);
    }

    /// A JSX runtime's element call (`jsx("p", { sx })` and `jsxs`, `jsxDEV`): JSX compiled before
    /// Kirana sees the module, as a host that only hands over compiled JavaScript does (Remix's
    /// asset server and `node-tsx`). The `sx` property is rewritten as the attribute would be.
    fn compiled_element(&mut self, call: &CallExpression<'a>) {
        let (Some(Argument::ObjectExpression(object)), Some(kind)) = (call.arguments.get(1), call.arguments.first())
        else {
            return;
        };
        let Some(sx) = object.properties.iter().find_map(|item| match item {
            ObjectPropertyKind::ObjectProperty(property) if property_name(&property.key) == Some("sx") => {
                Some(&**property)
            }
            _ => None,
        }) else {
            return;
        };
        match kind {
            Argument::StringLiteral(_) => self.compiled_host_sx(object, sx),
            Argument::Identifier(_) | Argument::StaticMemberExpression(_) => {
                let root = compiled_root(kind.to_expression());
                if let Expression::StringLiteral(literal) = &sx.value {
                    // A component receives the compiled handle, as it would from `sx={css(…)}`.
                    let parts = self.evaluator.utility_parts(&utility_text(literal), sp(literal.span));
                    if self.evaluator.context().config.utilities.is_some()
                        && let Some(handle) = parts.static_handle()
                    {
                        let mut code = Code::default();
                        code.handle(self.evaluator.context().names, &handle);
                        self.push(sp(literal.span), code);
                    }
                } else if let Some(source) = root.and_then(|root| self.evaluator.import_source(root))
                    && self.evaluator.is_external(source)
                {
                    self.report(
                        DiagnosticCode::SxOnExternalComponent,
                        sp(sx.span),
                        &format!("a component from {source:?} receives `sx`, which it does not read"),
                        Some("spread the compiled props instead: {...props(styles.root, sx)}"),
                    );
                }
            }
            _ => {}
        }
    }

    /// `sx` on a host element's props object, as `host_sx` does for the attribute: a static class
    /// property in place of `sx` when nothing else sets the class or style, else every property kept
    /// and the class and style merged at runtime.
    fn compiled_host_sx(&mut self, object: &ObjectExpression<'a>, sx: &ObjectProperty<'a>) {
        let names = self.evaluator.context().names;
        let class = self.evaluator.context().config.jsx.class_attribute();
        let parts = match &sx.value {
            Expression::StringLiteral(literal) => {
                let parts = self.evaluator.utility_parts(&utility_text(literal), sp(literal.span));
                if self.evaluator.context().config.utilities.is_none() {
                    return;
                }
                parts
            }
            value => self.evaluator.sx_parts(value),
        };
        let mut class_sources: Vec<Vec<Piece>> = Vec::new();
        let mut style_sources: Vec<Vec<Piece>> = Vec::new();
        let mut kept: Vec<(u32, u32)> = Vec::new();
        for item in &object.properties {
            match item {
                ObjectPropertyKind::SpreadProperty(spread) => {
                    kept.push(sp(spread.span));
                    let (start, end) = sp(spread.argument.span());
                    class_sources.push(vec![
                        Piece::Text("(".into()),
                        Piece::Source(start, end),
                        Piece::Text(format!(")?.{class}")),
                    ]);
                    style_sources.push(vec![
                        Piece::Text("(".into()),
                        Piece::Source(start, end),
                        Piece::Text(")?.style".into()),
                    ]);
                }
                ObjectPropertyKind::ObjectProperty(property) => match property_name(&property.key) {
                    Some("sx") => {}
                    Some(name) if !property.computed && carries(name, class) => {
                        let target = if name == "style" { &mut style_sources } else { &mut class_sources };
                        let (start, end) = sp(property.value.span());
                        target.push(vec![Piece::Text("(".into()), Piece::Source(start, end), Piece::Text(")".into())]);
                    }
                    _ => kept.push(sp(property.span)),
                },
            }
        }
        let mut code = Code::default();
        if class_sources.is_empty()
            && style_sources.is_empty()
            && let Some(handle) = parts.static_handle()
        {
            code.text(format!("{class}: "));
            if names.dom_class_string(&handle).is_empty() {
                // The property stays, so the object keeps its commas; an element with no class.
                code.text("undefined");
                code.record(&handle);
            } else {
                code.dom_handle(names, &handle);
            }
            self.push(sp(sx.span), code);
            return;
        }
        code.text("{ ");
        for span in kept {
            code.source(span);
            code.text(", ");
        }
        code.runtime = true;
        code.text("...__k.sx([");
        code.parts(names, &parts.0);
        code.text("], [");
        join(&mut code, class_sources);
        code.text("], [");
        join(&mut code, style_sources);
        code.text("]) }");
        self.push(sp(object.span), code);
    }

    /// Whether a call is a JSX runtime's element factory: `jsx`, `jsxs` or `jsxDEV` imported from a
    /// `…/jsx-runtime` or `…/jsx-dev-runtime` module, whatever the local name.
    fn is_jsx_factory(&self, call: &CallExpression<'a>) -> bool {
        let Expression::Identifier(callee) = &call.callee else {
            return false;
        };
        self.evaluator.import_of(callee).is_some_and(|(source, name)| {
            (source.ends_with("/jsx-runtime") || source.ends_with("/jsx-dev-runtime"))
                && matches!(name.as_str(), "jsx" | "jsxs" | "jsxDEV")
        })
    }

    fn props_call(&mut self, call: &CallExpression<'a>) {
        let names = self.evaluator.context().names;
        let class = self.evaluator.context().config.jsx.class_attribute();
        let parts = self.evaluator.call_parts(call);
        let mut code = Code::default();
        match parts.static_handle() {
            Some(handle) if !names.dom_class_string(&handle).is_empty() => {
                code.text(format!("{{{class:?}: "));
                code.dom_handle(names, &handle);
                code.text("}");
            }
            Some(_) => code.text("{}"),
            None => {
                code.runtime = true;
                code.text(crate::codegen::PURE);
                code.text("__k.sx([");
                code.parts(names, &parts.0);
                code.text("], [], [])");
            }
        }
        self.push(sp(call.span), code);
    }

    fn mode_object(&mut self, span: (u32, u32)) {
        let names = self.evaluator.context().names;
        let mut code = Code::default();
        code.text("{");
        for (index, mode) in ["system", "light", "dark"].into_iter().enumerate() {
            if index > 0 {
                code.text(", ");
            }
            code.text(format!("{mode:?}: "));
            let value = self.evaluator.eval_mode(mode);
            code.value(names, &value);
        }
        code.text("}");
        self.push(span, code);
    }
}

/// Whether a host element attribute holds classes or styles that `sx` merges with its own: `style`,
/// and the mode's class attribute — under `class` modes also `className`, which Preact users still
/// write and which ends up in the one `class` the element gets.
fn carries(name: &str, class: &str) -> bool {
    name == "style" || name == class || (class == "class" && name == "className")
}

/// Type-only exports of `@kirana-style/core`, which may be imported without `type`.
const TYPE_EXPORTS: &[&str] = &[
    "Sx",
    "StyleHandle",
    "Condition",
    "SelectTarget",
    "Token",
    "Keyframes",
    "PositionTry",
    "PositionTryBlock",
    "Fallbacks",
    "CounterStyle",
    "CounterStyleDescriptors",
    "ViewTransition",
    "TransitionStyle",
    "StyleValue",
    "ConditionalValue",
    "Style",
    "RecipeConfig",
    "RecipeOptions",
    "Recipe",
    "Relation",
    "RelationOptions",
    "TokenValues",
    "Tokens",
];

fn join(code: &mut Code, sources: Vec<Vec<Piece>>) {
    for (index, pieces) in sources.into_iter().enumerate() {
        if index > 0 {
            code.text(", ");
        }
        for piece in pieces {
            match piece {
                Piece::Text(text) => code.text(text),
                Piece::Source(start, end) => code.source((start, end)),
            }
        }
    }
}

fn is_relation_marker(marker: &str, prefix: &str) -> bool {
    // The kind letter and the definition hash; the width lives in `kirana_ir`.
    marker.strip_prefix(prefix).is_some_and(|rest| rest.starts_with('r') && rest.len() == 1 + kirana_ir::NAME_HASH)
}

fn attribute_name<'b>(attribute: &'b oxc_ast::ast::JSXAttribute<'_>) -> Option<&'b str> {
    match &attribute.name {
        JSXAttributeName::Identifier(identifier) => Some(identifier.name.as_str()),
        JSXAttributeName::NamespacedName(_) => None,
    }
}

/// An `sx` string's utilities as text. A lone surrogate, which oxc keeps as written, becomes U+FFFD:
/// no utility has one, so the class is reported as unknown, as any misspelt one is.
fn utility_text<'b>(literal: &'b StringLiteral<'_>) -> Cow<'b, str> {
    literal.value.as_str().map_or_else(|| Cow::Owned(literal.value.display().to_string()), Cow::Borrowed)
}

/// An object property's name, when it is written out: `sx`, `"sx"`.
fn property_name<'b>(key: &'b PropertyKey<'_>) -> Option<&'b str> {
    match key {
        PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.as_str()),
        PropertyKey::StringLiteral(literal) => literal.value.as_str(),
        _ => None,
    }
}

/// The identifier a compiled element's type starts with (`Dialog` in `Dialog.Popup`).
fn compiled_root<'b, 'a>(kind: &'b Expression<'a>) -> Option<&'b IdentifierReference<'a>> {
    let mut expression = kind;
    loop {
        match expression {
            Expression::Identifier(identifier) => return Some(identifier),
            Expression::StaticMemberExpression(member) => expression = &member.object,
            _ => return None,
        }
    }
}

fn sx_span(attribute: &oxc_ast::ast::JSXAttribute<'_>) -> (u32, u32) {
    sp(attribute.span)
}

/// The identifier a JSX element name starts with (`Dialog` in `Dialog.Popup`).
fn element_root<'b, 'a>(name: &'b JSXElementName<'a>) -> Option<&'b IdentifierReference<'a>> {
    match name {
        JSXElementName::IdentifierReference(identifier) => Some(identifier),
        JSXElementName::MemberExpression(member) => {
            let mut object = &member.object;
            loop {
                match object {
                    oxc_ast::ast::JSXMemberExpressionObject::IdentifierReference(identifier) => {
                        return Some(identifier);
                    }
                    oxc_ast::ast::JSXMemberExpressionObject::MemberExpression(inner) => object = &inner.object,
                    oxc_ast::ast::JSXMemberExpressionObject::ThisExpression(_) => return None,
                }
            }
        }
        _ => None,
    }
}

/// A lowercase intrinsic element (`div`, `svg`), which receives the class attribute.
fn is_host(name: &JSXElementName<'_>) -> bool {
    match name {
        JSXElementName::Identifier(identifier) => identifier.name.starts_with(|first: char| first.is_ascii_lowercase()),
        JSXElementName::NamespacedName(_) => true,
        _ => false,
    }
}

impl<'a> Visit<'a> for Rewriter<'_, '_, 'a, '_> {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        match &call.callee {
            Expression::Identifier(identifier) => {
                self.callee_identifiers.insert(identifier.span.start);
            }
            Expression::StaticMemberExpression(member) => {
                if let Expression::Identifier(identifier) = &member.object {
                    self.callee_identifiers.insert(identifier.span.start);
                }
            }
            _ => {}
        }
        if self.is_jsx_factory(call) {
            self.compiled_element(call);
        }
        if let Some(callee) = self.kirana_callee(&call.callee) {
            if callee == Value::Api(Api::Props) {
                self.props_call(call);
            } else {
                let value = self.evaluator.eval_call(call);
                let mut code = Code::default();
                if code.value(self.evaluator.context().names, &value) {
                    self.push(sp(call.span), code);
                }
            }
        }
        walk::walk_call_expression(self, call);
    }

    fn visit_jsx_opening_element(&mut self, element: &JSXOpeningElement<'a>) {
        let sx = element.attributes.iter().find_map(|item| match item {
            JSXAttributeItem::Attribute(attribute) if attribute_name(attribute) == Some("sx") => Some(&**attribute),
            _ => None,
        });
        if let Some(attribute) = sx {
            if is_host(&element.name) {
                self.host_sx(element, attribute);
            } else if let Some(JSXAttributeValue::StringLiteral(literal)) = &attribute.value {
                // A component receives the compiled handle, as it would from `sx={css(…)}`.
                let parts = self.evaluator.utility_parts(&utility_text(literal), sp(literal.span));
                if self.evaluator.context().config.utilities.is_some()
                    && let Some(handle) = parts.static_handle()
                {
                    let mut code = Code::default();
                    code.text("{");
                    code.handle(self.evaluator.context().names, &handle);
                    code.text("}");
                    self.push(sp(literal.span), code);
                }
            } else if let Some(source) = element_root(&element.name).and_then(|root| self.evaluator.import_source(root))
                && self.evaluator.is_external(source)
            {
                self.report(
                    DiagnosticCode::SxOnExternalComponent,
                    sx_span(attribute),
                    &format!("a component from {source:?} receives `sx`, which it does not read"),
                    Some("spread the compiled props instead: {...props(styles.root, sx)}"),
                );
            } else if let Some((component, package)) =
                element_root(&element.name).and_then(|root| self.evaluator.sx_forwarded_by(root))
            {
                self.report(
                    DiagnosticCode::SxOnExternalComponent,
                    sx_span(attribute),
                    &format!("{component} passes its props, `sx` included, to {package}, which does not read it"),
                    Some(
                        "take `sx` out of that component's props and pass it on: sx={[styles.root, sx]} on an element, {...props(styles.root, sx)} on an installed component",
                    ),
                );
            }
        }
        walk::walk_jsx_opening_element(self, element);
    }

    fn visit_identifier_reference(&mut self, identifier: &IdentifierReference<'a>) {
        if self.callee_identifiers.contains(&identifier.span.start) {
            return;
        }
        if let Value::Api(api) = self.evaluator.eval_identifier(identifier) {
            if api == Api::Mode {
                self.mode_object(sp(identifier.span));
            } else {
                self.report(
                    DiagnosticCode::UnsupportedSyntax,
                    sp(identifier.span),
                    &format!("{} must be called where it is used", api.export()),
                    None,
                );
            }
        }
    }

    fn visit_static_member_expression(&mut self, member: &oxc_ast::ast::StaticMemberExpression<'a>) {
        // Any reference to `relation.anchor` applies the anchor somewhere: through `sx` on a
        // component, `mergeSx()`, or a render prop (KRN-CAS-005, rule R1).
        if member.property.name.as_str() == "anchor"
            && let Value::Relation(relation) = self.evaluator.eval(&member.object)
            && !self.anchors.contains(&relation.marker)
        {
            self.anchors.push(relation.marker.clone());
        }
        walk::walk_static_member_expression(self, member);
    }

    fn visit_binding_property(&mut self, property: &BindingProperty<'a>) {
        if let (PropertyKey::StaticIdentifier(key), BindingPattern::BindingIdentifier(binding)) =
            (&property.key, &property.value)
            && key.name.as_str() == "sx"
            // A component's script block: its template reads the binding (`const { sx } = useSx()`).
            && !kirana_frontend::sfc::is_block_id(self.evaluator.context().path)
            && let Some(symbol) = binding.symbol_id.get()
            && self.evaluator.parsed().semantic.scoping().get_resolved_reference_ids(symbol).is_empty()
        {
            self.report(
                DiagnosticCode::UnusedSx,
                sp(property.span),
                "the component takes `sx` but never applies it",
                Some("pass it last in the root element's sx array: sx={[styles.root, sx]}"),
            );
        }
        walk::walk_binding_property(self, property);
    }
}

#[cfg(test)]
mod tests {
    use super::TYPE_EXPORTS;

    /// Every type `@kirana-style/core` exports may be imported without `type`, so the list follows
    /// the package's own declarations.
    #[test]
    fn type_exports_follow_the_core_package() {
        let source = include_str!("../../../npm/core/src/index.ts");
        let declared: Vec<&str> = source
            .lines()
            .filter_map(|line| line.strip_prefix("export type ").or_else(|| line.strip_prefix("export declare type ")))
            .filter_map(|rest| rest.split(|c: char| !c.is_ascii_alphanumeric()).next())
            .collect();
        assert!(declared.len() > 10, "{declared:?}");
        for name in &declared {
            assert!(TYPE_EXPORTS.contains(name), "{name} is exported by @kirana-style/core but missing here");
        }
        for name in TYPE_EXPORTS {
            assert!(declared.contains(name), "{name} is listed here but not exported by @kirana-style/core");
        }
    }
}
