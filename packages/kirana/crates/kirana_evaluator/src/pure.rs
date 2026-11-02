//! What loading a module does (D-118): a module whose top level only declares values and loads
//! modules like it can go unloaded once the compiler folded away every read of it.

use oxc_ast::ast::{
    ArrayExpressionElement, Declaration, ExportDefaultDeclarationKind, Expression, ObjectPropertyKind, PropertyKey,
    Statement,
};
use oxc_syntax::operator::UnaryOperator;

use crate::eval::Evaluator;
use kirana_ir::Value;

/// The package every Kirana module imports its API from: compiled away, it is never loaded.
const CORE: &str = "@kirana-style/core";

impl<'a> Evaluator<'_, 'a, '_> {
    /// The modules loading this one loads, when that is all it does beyond declaring its values:
    /// every top-level statement is an import or re-export, a declaration whose initializers call
    /// nothing but Kirana's own API, a function, or a type. `None` when a statement may act as the
    /// module loads. The specifiers are its value imports' and re-exports', `@kirana-style/core` left
    /// out; whether those modules act too is the host's to judge.
    pub fn top_level_loads(&self) -> Option<Vec<String>> {
        let mut loads = Vec::new();
        for statement in &self.parsed().program.body {
            if !self.declares_only(statement, &mut loads) {
                return None;
            }
        }
        Some(loads)
    }

    /// Whether the module `specifier` names, imported here, can go unloaded once nothing reads it at
    /// runtime ([`Host::droppable`](crate::Host::droppable)).
    pub fn import_droppable(&self, specifier: &str) -> bool {
        self.host.droppable(self.context().path, specifier)
    }

    /// Whether `statement` only declares values or loads a module, which it adds to `loads`.
    fn declares_only(&self, statement: &Statement<'a>, loads: &mut Vec<String>) -> bool {
        let source = match statement {
            Statement::ImportDeclaration(import) if !import.import_kind.is_type() => &import.source,
            Statement::ExportFromDeclaration(export) if !export.export_kind.is_type() => &export.source,
            Statement::ExportAllDeclaration(export) if !export.export_kind.is_type() => &export.source,
            Statement::ImportDeclaration(_)
            | Statement::ExportFromDeclaration(_)
            | Statement::ExportAllDeclaration(_)
            | Statement::ExportNamedDeclaration(_)
            | Statement::EmptyStatement(_) => return true,
            Statement::ExportDeclaration(export) => return self.pure_declaration(&export.declaration),
            Statement::ExportDefaultDeclaration(export) => {
                return match &export.declaration {
                    ExportDefaultDeclarationKind::FunctionDeclaration(_) => true,
                    declaration => {
                        declaration.as_expression().is_some_and(|expression| self.pure_expression(expression))
                    }
                };
            }
            statement => {
                return statement.as_declaration().is_some_and(|declaration| self.pure_declaration(declaration));
            }
        };
        let Some(source) = source.value.as_str() else { return false };
        if source != CORE {
            loads.push(source.to_owned());
        }
        true
    }

    fn pure_declaration(&self, declaration: &Declaration<'a>) -> bool {
        match declaration {
            Declaration::VariableDeclaration(variables) => variables
                .declarations
                .iter()
                .all(|declarator| declarator.init.as_ref().is_none_or(|init| self.pure_expression(init))),
            Declaration::FunctionDeclaration(_)
            | Declaration::TSTypeAliasDeclaration(_)
            | Declaration::TSInterfaceDeclaration(_) => true,
            _ => false,
        }
    }

    fn pure_expression(&self, expression: &Expression<'a>) -> bool {
        match expression {
            Expression::BooleanLiteral(_)
            | Expression::NullLiteral(_)
            | Expression::NumericLiteral(_)
            | Expression::BigIntLiteral(_)
            | Expression::StringLiteral(_)
            | Expression::RegExpLiteral(_)
            | Expression::Identifier(_)
            | Expression::ArrowFunctionExpression(_)
            | Expression::FunctionExpression(_) => true,
            Expression::TemplateLiteral(template) => {
                template.expressions.iter().all(|inner| self.pure_expression(inner))
            }
            Expression::ArrayExpression(array) => array.elements.iter().all(|element| match element {
                ArrayExpressionElement::SpreadElement(spread) => self.pure_expression(&spread.argument),
                ArrayExpressionElement::Elision(_) => true,
                element => self.pure_expression(element.to_expression()),
            }),
            Expression::ObjectExpression(object) => object.properties.iter().all(|property| match property {
                ObjectPropertyKind::ObjectProperty(property) => {
                    self.pure_key(&property.key) && self.pure_expression(&property.value)
                }
                ObjectPropertyKind::SpreadProperty(spread) => self.pure_expression(&spread.argument),
            }),
            Expression::UnaryExpression(unary) => {
                unary.operator != UnaryOperator::Delete && self.pure_expression(&unary.argument)
            }
            Expression::BinaryExpression(binary) => {
                self.pure_expression(&binary.left) && self.pure_expression(&binary.right)
            }
            Expression::LogicalExpression(logical) => {
                self.pure_expression(&logical.left) && self.pure_expression(&logical.right)
            }
            Expression::ConditionalExpression(conditional) => {
                self.pure_expression(&conditional.test)
                    && self.pure_expression(&conditional.consequent)
                    && self.pure_expression(&conditional.alternate)
            }
            Expression::StaticMemberExpression(member) => self.pure_expression(&member.object),
            Expression::ComputedMemberExpression(member) => {
                self.pure_expression(&member.object) && self.pure_expression(&member.expression)
            }
            Expression::ParenthesizedExpression(inner) => self.pure_expression(&inner.expression),
            Expression::TSAsExpression(inner) => self.pure_expression(&inner.expression),
            Expression::TSSatisfiesExpression(inner) => self.pure_expression(&inner.expression),
            Expression::TSNonNullExpression(inner) => self.pure_expression(&inner.expression),
            // Kirana's own calls (`defineTokens`, `css`, a recipe or relation method) are compiled.
            Expression::CallExpression(call) => {
                matches!(self.quietly(|| self.eval(&call.callee)), Value::Api(_) | Value::Method(_) | Value::Recipe(_))
                    && call.arguments.iter().all(|argument| match argument.as_expression() {
                        Some(argument) => self.pure_expression(argument),
                        None => false,
                    })
            }
            _ => false,
        }
    }

    fn pure_key(&self, key: &PropertyKey<'a>) -> bool {
        key.as_expression().is_none_or(|key| self.pure_expression(key))
    }
}
