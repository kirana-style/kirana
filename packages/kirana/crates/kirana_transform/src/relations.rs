//! Relation placement in one JSX tree (KRN-CAS-005, rules R3 and R4).

use kirana_diagnostics::{Code, Diagnostic, Span};
use kirana_evaluator::{Evaluator, relation_reads};
use kirana_ir::{Handle, RelationKind};
use oxc_ast::ast::{JSXAttributeItem, JSXAttributeName, JSXAttributeValue, JSXChild, JSXElement, JSXExpression};
use oxc_ast_visit::{Visit, walk};

/// What one element statically carries: marker classes and relation reads.
#[derive(Default, Clone)]
struct Info {
    markers: Vec<String>,
    reads: Vec<(String, RelationKind)>,
    span: (u32, u32),
}

fn info<'a>(evaluator: &Evaluator<'_, 'a, '_>, element: &JSXElement<'a>) -> Info {
    let opening = &element.opening_element;
    let mut result = Info { span: (opening.span.start, opening.span.end), ..Info::default() };
    for item in &opening.attributes {
        let JSXAttributeItem::Attribute(attribute) = item else { continue };
        let JSXAttributeName::Identifier(name) = &attribute.name else { continue };
        let Some(JSXAttributeValue::ExpressionContainer(container)) = &attribute.value else { continue };
        if name.name.as_str() != "sx" || matches!(container.expression, JSXExpression::EmptyExpression(_)) {
            continue;
        }
        for part in evaluator.sx_parts(container.expression.to_expression()).0 {
            let handles: Vec<Handle> = match part {
                kirana_ir::StylePart::Static(handle) => vec![handle],
                kirana_ir::StylePart::Conditional { consequent, alternate, .. } => vec![consequent, alternate],
                kirana_ir::StylePart::Bridge { handle, .. } => vec![handle],
                kirana_ir::StylePart::Runtime(_) | kirana_ir::StylePart::Spread(_) => Vec::new(),
            };
            for handle in handles {
                result.markers.extend(handle.markers.iter().cloned());
                result.reads.extend(relation_reads(&handle));
            }
        }
    }
    result
}

struct Tree {
    /// Each element's info, its parent index and its index among its parent's element children.
    nodes: Vec<(Info, Option<usize>)>,
    children: Vec<Vec<usize>>,
}

fn build<'a>(evaluator: &Evaluator<'_, 'a, '_>, element: &JSXElement<'a>, parent: Option<usize>, tree: &mut Tree) {
    let index = tree.nodes.len();
    tree.nodes.push((info(evaluator, element), parent));
    tree.children.push(Vec::new());
    if let Some(parent) = parent {
        tree.children[parent].push(index);
    }
    collect_children(evaluator, &element.children, index, tree);
}

fn collect_children<'a>(evaluator: &Evaluator<'_, 'a, '_>, children: &[JSXChild<'a>], parent: usize, tree: &mut Tree) {
    for child in children {
        match child {
            JSXChild::Element(element) => build(evaluator, element, Some(parent), tree),
            JSXChild::Fragment(fragment) => collect_children(evaluator, &fragment.children, parent, tree),
            _ => {}
        }
    }
}

fn has(tree: &Tree, index: usize, marker: &str) -> bool {
    tree.nodes[index].0.markers.iter().any(|candidate| candidate == marker)
}

fn check_tree(tree: &Tree, file: &str, out: &mut Vec<Diagnostic>) {
    for (index, (node, parent)) in tree.nodes.iter().enumerate() {
        for (marker, kind) in &node.reads {
            let anywhere = (0..tree.nodes.len()).any(|other| has(tree, other, marker));
            if !anywhere {
                continue;
            }
            let siblings: &[usize] = parent.map_or(&[], |parent| &tree.children[parent]);
            let position = siblings.iter().position(|sibling| *sibling == index).unwrap_or(0);
            let (ok, message, help) = match kind {
                RelationKind::Within => {
                    let mut ancestor = *parent;
                    let mut found = false;
                    while let Some(current) = ancestor {
                        found |= has(tree, current, marker);
                        ancestor = tree.nodes[current].1;
                    }
                    (
                        found,
                        "reads a relation `within` its anchor, but no ancestor in this tree carries the anchor",
                        "move the anchor to an element that wraps this one, or read it with `after`",
                    )
                }
                RelationKind::After => (
                    siblings[..position].iter().any(|sibling| has(tree, *sibling, marker)),
                    "reads a relation `after` its anchor, but no earlier sibling carries the anchor",
                    "put the anchor on an earlier sibling, or read it with `within`",
                ),
                RelationKind::Before => (
                    siblings.iter().skip(position + 1).any(|sibling| has(tree, *sibling, marker)),
                    "reads a relation `before` its anchor, but no later sibling carries the anchor",
                    "put the anchor on a later sibling",
                ),
            };
            if !ok {
                out.push(
                    Diagnostic::new(Code::RelationPlacement, file, Span::new(node.span.0, node.span.1), message)
                        .with_help(help),
                );
            }
        }
    }
}

struct Roots<'e, 'p, 'a, 'c> {
    evaluator: &'e Evaluator<'p, 'a, 'c>,
    out: Vec<Diagnostic>,
}

impl<'a> Visit<'a> for Roots<'_, '_, 'a, '_> {
    fn visit_jsx_element(&mut self, element: &JSXElement<'a>) {
        let mut tree = Tree { nodes: Vec::new(), children: Vec::new() };
        build(self.evaluator, element, None, &mut tree);
        if tree.nodes.iter().any(|(node, _)| !node.reads.is_empty()) {
            check_tree(&tree, self.evaluator.context().file, &mut self.out);
        }
        // Nested trees inside attribute values (`render={<… />}`) are separate trees.
        for item in &element.opening_element.attributes {
            walk::walk_jsx_attribute_item(self, item);
        }
    }
}

/// Placement diagnostics for every JSX tree in the module.
pub(crate) fn check(evaluator: &Evaluator<'_, '_, '_>) -> Vec<Diagnostic> {
    let mut roots = Roots { evaluator, out: Vec::new() };
    roots.visit_program(evaluator.parsed().program);
    roots.out
}
