//! Components that hand `sx` to something that ignores it (`sx-on-external-component`, one module
//! away). A project component such as `function Trigger({ ...props }) { return <Menu.Trigger {...props} /> }`
//! accepts `sx` in its type (every element's attributes carry it) but spreads it, unread, onto a
//! component from an installed package, or onto a host element, where only a written `sx` attribute
//! compiles. Its callers' `sx` is silently dropped.

use kirana_ir::{Handle, Value};
use oxc_ast::ast::{
    ArrowFunctionBody, BindingPattern, Declaration, Expression, FormalParameters, FunctionBody, JSXAttributeItem,
    JSXAttributeName, JSXAttributeValue, JSXElementName, JSXMemberExpressionObject, JSXOpeningElement, PropertyKey,
    Statement,
};
use oxc_ast_visit::{Visit, walk};

use crate::eval::{Evaluator, export_name};

impl<'a> Evaluator<'_, 'a, '_> {
    /// Exported components that spread their rest props onto a component from an installed package,
    /// or onto a host element, without taking `sx` out of them first, as `(export name, target)`:
    /// the package specifier in quotes, or the element as `<form>`.
    pub fn sx_forwarding_exports(&self) -> Vec<(String, String)> {
        self.exported_functions()
            .into_iter()
            .filter_map(|(exported, params, body)| Some((exported, self.forwarded_to(params, &body)?)))
            .collect()
    }

    /// Exported components that write `sx={[…, sx]}` with their own `sx` prop on an element, and the
    /// handle of what comes before it there, when the build knows it: a caller's `sx` merges after it,
    /// on that element (KF-083).
    pub fn sx_root_exports(&self) -> Vec<(String, Handle)> {
        self.exported_functions()
            .into_iter()
            .filter_map(|(exported, params, body)| Some((exported, self.sx_root(params, &body)?)))
            .collect()
    }

    /// The handle a component's own styles give the element it applies its `sx` prop to.
    fn sx_root(&self, params: &FormalParameters<'a>, body: &Body<'_, 'a>) -> Option<Handle> {
        let BindingPattern::ObjectPattern(object) = &params.items.first()?.pattern else { return None };
        let sx = object.properties.iter().find_map(|property| match (&property.key, &property.value) {
            (PropertyKey::StaticIdentifier(key), BindingPattern::BindingIdentifier(local)) if key.name == "sx" => {
                Some(local.name.as_str())
            }
            _ => None,
        })?;
        let mut roots = SxRoots { evaluator: self, sx, root: None };
        match body {
            Body::Block(block) => roots.visit_function_body(block),
            Body::Expression(expression) => roots.visit_expression(expression),
        }
        roots.root.flatten()
    }

    /// Every exported function, by the name it is exported as, with its parameters and body.
    fn exported_functions(&self) -> Vec<(String, &FormalParameters<'a>, Body<'_, 'a>)> {
        let body = &self.parsed.program.body;
        let mut exports: Vec<(String, String)> = Vec::new();
        for statement in body {
            match statement {
                Statement::ExportNamedDeclaration(export) => exports.extend(
                    export
                        .specifiers
                        .iter()
                        .map(|specifier| (export_name(&specifier.local), export_name(&specifier.exported))),
                ),
                Statement::ExportDeclaration(export) => {
                    for name in declared_names(&export.declaration) {
                        exports.push((name.clone(), name));
                    }
                }
                _ => {}
            }
        }
        exports
            .into_iter()
            .filter_map(|(local, exported)| {
                let (params, body) = body.iter().find_map(|statement| function_named(statement, &local))?;
                Some((exported, params, body))
            })
            .collect()
    }

    /// What a component's rest props are spread into, when `sx` stays inside them.
    fn forwarded_to(&self, params: &FormalParameters<'a>, body: &Body<'_, 'a>) -> Option<String> {
        let BindingPattern::ObjectPattern(object) = &params.items.first()?.pattern else { return None };
        let reads_sx = object.properties.iter().any(|property| match &property.key {
            PropertyKey::StaticIdentifier(key) => key.name == "sx",
            PropertyKey::StringLiteral(key) => key.value == "sx",
            // A computed key may be `sx`; stay silent rather than guess.
            _ => true,
        });
        let rest = object.rest.as_ref().and_then(|rest| rest.argument.get_binding_identifier())?;
        if reads_sx {
            return None;
        }
        let mut spreads = Spreads { rest: rest.name.as_str(), roots: Vec::new() };
        match body {
            Body::Block(block) => spreads.visit_function_body(block),
            Body::Expression(expression) => spreads.visit_expression(expression),
        }
        spreads.roots.iter().find_map(|root| match root {
            Root::Host(tag) => Some(format!("<{tag}>")),
            Root::Component(name) => {
                let source = self.import_source_of_name(name)?;
                self.is_external(source).then(|| format!("{source:?}"))
            }
        })
    }
}

fn declared_names(declaration: &Declaration<'_>) -> Vec<String> {
    match declaration {
        Declaration::FunctionDeclaration(function) => function.id.iter().map(|id| id.name.to_string()).collect(),
        Declaration::VariableDeclaration(variables) => variables
            .declarations
            .iter()
            .flat_map(|declarator| declarator.id.get_binding_identifiers())
            .map(|id| id.name.to_string())
            .collect(),
        _ => Vec::new(),
    }
}

/// A function's body: a block, or a concise arrow's expression.
enum Body<'b, 'a> {
    Block(&'b FunctionBody<'a>),
    Expression(&'b Expression<'a>),
}

/// The parameters and body of a function declaration or a `const` function expression named `name`.
fn function_named<'b, 'a>(
    statement: &'b Statement<'a>,
    name: &str,
) -> Option<(&'b FormalParameters<'a>, Body<'b, 'a>)> {
    let declaration = match statement {
        Statement::ExportDeclaration(export) => &export.declaration,
        statement => statement.as_declaration()?,
    };
    match declaration {
        Declaration::FunctionDeclaration(function) if function.id.as_ref().is_some_and(|id| id.name == name) => {
            Some((&function.params, Body::Block(function.body.as_ref()?)))
        }
        Declaration::VariableDeclaration(variables) => variables.declarations.iter().find_map(|declarator| {
            let BindingPattern::BindingIdentifier(id) = &declarator.id else { return None };
            if id.name != name {
                return None;
            }
            match declarator.init.as_ref()? {
                Expression::ArrowFunctionExpression(arrow) => Some((
                    &*arrow.params,
                    match &arrow.body {
                        ArrowFunctionBody::FunctionBody(body) => Body::Block(body),
                        body => Body::Expression(body.to_expression()),
                    },
                )),
                Expression::FunctionExpression(function) => {
                    function.body.as_deref().map(|body| (&*function.params, Body::Block(body)))
                }
                _ => None,
            }
        }),
        _ => None,
    }
}

/// An element that receives `{...rest}`: a host element by tag, or a component by its root name
/// (`Menu` for `<Menu.Trigger {...rest} />`).
enum Root {
    Host(String),
    Component(String),
}

struct Spreads<'s> {
    rest: &'s str,
    roots: Vec<Root>,
}

impl<'a> Visit<'a> for Spreads<'_> {
    fn visit_jsx_opening_element(&mut self, element: &JSXOpeningElement<'a>) {
        let spreads_rest = element.attributes.iter().any(|attribute| {
            matches!(attribute, JSXAttributeItem::SpreadAttribute(spread)
                if matches!(&spread.argument, Expression::Identifier(identifier) if identifier.name == self.rest))
        });
        let root = match &element.name {
            JSXElementName::Identifier(tag) => Some(Root::Host(tag.name.to_string())),
            JSXElementName::IdentifierReference(identifier) => Some(Root::Component(identifier.name.to_string())),
            JSXElementName::MemberExpression(member) => {
                let mut object = &member.object;
                loop {
                    match object {
                        JSXMemberExpressionObject::IdentifierReference(identifier) => {
                            break Some(Root::Component(identifier.name.to_string()));
                        }
                        JSXMemberExpressionObject::MemberExpression(inner) => object = &inner.object,
                        JSXMemberExpressionObject::ThisExpression(_) => break None,
                    }
                }
            }
            _ => None,
        };
        if spreads_rest && let Some(root) = root {
            self.roots.push(root);
        }
        walk::walk_jsx_opening_element(self, element);
    }
}

/// The first element a component writes `sx={[…, sx]}` on, with its own `sx` last: the handle of
/// what comes before it, when the build knows it.
struct SxRoots<'e, 'p, 'a, 'c, 's> {
    evaluator: &'e Evaluator<'p, 'a, 'c>,
    sx: &'s str,
    root: Option<Option<Handle>>,
}

impl<'a> Visit<'a> for SxRoots<'_, '_, 'a, '_, '_> {
    fn visit_jsx_opening_element(&mut self, element: &JSXOpeningElement<'a>) {
        if self.root.is_none()
            && let Some(Expression::ArrayExpression(array)) = element.attributes.iter().find_map(|attribute| match attribute {
                JSXAttributeItem::Attribute(attribute) if matches!(&attribute.name, JSXAttributeName::Identifier(name) if name.name == "sx") => {
                    match &attribute.value {
                        Some(JSXAttributeValue::ExpressionContainer(container)) => container.expression.as_expression(),
                        _ => None,
                    }
                }
                _ => None,
            })
            && let Some((last, before)) = array.elements.split_last()
            && matches!(last.as_expression(), Some(Expression::Identifier(identifier)) if identifier.name == self.sx)
        {
            let values: Option<Vec<Value>> = before
                .iter()
                .map(|element| element.as_expression().map(|expression| self.evaluator.quietly(|| self.evaluator.eval(expression))))
                .collect();
            self.root = Some(values.and_then(|values| crate::style::static_handle(&Value::Array(std::sync::Arc::new(values)))));
        }
        walk::walk_jsx_opening_element(self, element);
    }
}
