//! The utility surface (KRN-API-012, `design-notes/utility-surface.md`): a string `sx` is lowered to
//! the style object a person would have written — scale values read through the same import
//! resolution a real `import` uses — and that object goes through the function `css()` uses, so
//! both forms produce the same atoms. The lowering itself is `kirana_utility`'s, shared with
//! `kirana-style migrate tailwind`; this renders its values as IR.

use std::sync::Arc;

use kirana_ir::{Key, Value};
use kirana_utility::{Expr, Scales, Tree};

use crate::ImportName;
use crate::eval::Evaluator;
use crate::ops;

impl Scales for Evaluator<'_, '_, '_> {
    fn export(&self, module: &str, export: &str) -> Value {
        self.host.import(self.ctx.path, module, &ImportName::Named(export.to_owned()))
    }
}

/// A declaration under its conditions, its value rendered.
type Lowered = (Vec<String>, String, Value);

/// An expression's value: the token itself, or CSS text around it.
fn value_of(expr: Expr) -> Value {
    // A scale value is a string or a token, whose CSS text always exists.
    let text = |expr: Expr| ops::to_string(&value_of(expr)).unwrap_or_default();
    match expr {
        Expr::Text(text) => Value::str(text),
        Expr::Token { value, .. } => value,
        Expr::Negate(inner) => Value::str(format!("calc({} * -1)", text(*inner))),
        Expr::Alpha(inner, percent) => {
            Value::str(format!("color-mix(in oklab, {} {percent}%, transparent)", text(*inner)))
        }
        Expr::Concat(parts) => Value::str(parts.into_iter().map(text).collect::<String>()),
        // A pair still here after `kirana_utility::settle_pairs` is its value.
        Expr::Paired(inner) => value_of(*inner),
    }
}

/// A property's tree as the object literal `css()` would receive.
fn tree_value(tree: Tree<Value>) -> Value {
    if tree.conditions.is_empty() {
        return tree.base.unwrap_or(Value::Undefined);
    }
    let mut entries: Vec<(Key, Value)> = Vec::new();
    if let Some(base) = tree.base {
        entries.push((Key::Str(Arc::from("base")), base));
    }
    for (condition, tree) in tree.conditions {
        entries.push((Key::Str(Arc::from(condition.as_str())), tree_value(tree)));
    }
    Value::Object(Arc::new(entries))
}

impl Evaluator<'_, '_, '_> {
    /// Lowers a utility string to the style object it stands for, reporting what cannot be lowered.
    /// `None` when no grammar is configured (the surface is disabled).
    pub(crate) fn utility_object(&self, text: &str, span: (u32, u32)) -> Option<Value> {
        let grammar = self.ctx.config.utilities.as_ref()?;
        // The element's own declarations, then each pseudo-element's, in first-seen order.
        let mut blocks: Vec<(Option<String>, Vec<Lowered>)> = vec![(None, Vec::new())];
        let mut declarations = Vec::new();
        for utility in kirana_utility::utilities(text) {
            match kirana_utility::lower(grammar, self, utility) {
                Ok(lowered) => declarations.extend(lowered),
                Err(failure) => self.report(failure.code, span, failure.message, failure.help.as_deref()),
            }
        }
        for entry in kirana_utility::settle_pairs(declarations) {
            let index = match blocks.iter().position(|(block, _)| *block == entry.block) {
                Some(index) => index,
                None => {
                    blocks.push((entry.block.clone(), Vec::new()));
                    blocks.len() - 1
                }
            };
            blocks[index].1.push((entry.conditions, entry.property, value_of(entry.value)));
        }
        // A property written `{scale.key}` is that token as the key: it sets the custom property.
        let key = |name: &str| match kirana_utility::property_token(grammar, self, name) {
            Some(Expr::Token { value: Value::Token(token), .. }) => Key::Token(token),
            _ => Key::Str(Arc::from(name)),
        };
        let object = |declarations: Vec<Lowered>| -> Vec<(Key, Value)> {
            kirana_utility::group(declarations).into_iter().map(|(name, tree)| (key(&name), tree_value(tree))).collect()
        };
        let mut blocks = blocks.into_iter();
        let (_, own) = blocks.next().expect("the element's own block is first");
        let mut entries = object(own);
        for (block, mut declarations) in blocks {
            let block = block.expect("only the first block is the element's own");
            if kirana_utility::needs_content(&block)
                && !declarations.iter().any(|(_, property, _)| property == "content")
            {
                // Under the conditions its declarations have, as Tailwind emits `content` with each
                // utility: `focus-visible:after:border-ring` makes the `::after` only when focused.
                let paths = kirana_utility::condition_paths(declarations.iter().map(|(conditions, _, _)| conditions));
                for conditions in paths.into_iter().rev() {
                    declarations.insert(0, (conditions, "content".to_owned(), Value::str("\"\"")));
                }
            }
            entries.push((Key::Str(Arc::from(block.as_str())), Value::Object(Arc::new(object(declarations)))));
        }
        Some(Value::Object(Arc::new(entries)))
    }
}
