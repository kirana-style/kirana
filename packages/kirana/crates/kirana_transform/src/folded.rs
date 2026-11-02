//! Imports the compiler folded away (D-118): when every read of an import's bindings is inside an
//! edit that writes none of it back, and the module it names does nothing when it loads, the import
//! goes too, so a bundler does not resolve and load a token module only to drop it.

use kirana_evaluator::Evaluator;
use oxc_ast::ast::Statement;
use oxc_span::GetSpan;

use crate::{Edit, Piece};

/// The package Kirana's API comes from: its import is removed by the rewriter.
const CORE: &str = "@kirana-style/core";

/// An edit removing each import whose bindings the compiler folded away, of a module that can be
/// left unimported. `edits` are the rewriter's, sorted as `finish_edits` sorts them.
pub(crate) fn folded_imports(evaluator: &Evaluator<'_, '_, '_>, edits: &[Edit]) -> Vec<Edit> {
    let parsed = evaluator.parsed();
    let scoping = parsed.semantic.scoping();
    let nodes = parsed.semantic.nodes();
    let mut removed = Vec::new();
    for statement in &parsed.program.body {
        let Statement::ImportDeclaration(import) = statement else { continue };
        // A side-effect import (`import "./reset.css"`) is there for loading the module.
        let Some(specifiers) = import.specifiers.as_ref().filter(|specifiers| !specifiers.is_empty()) else { continue };
        let Some(source) = import.source.value.as_str().filter(|source| *source != CORE) else { continue };
        if import.import_kind.is_type() {
            continue;
        }
        let mut reads = specifiers
            .iter()
            .filter_map(|specifier| specifier.local().symbol_id.get())
            .flat_map(|symbol| scoping.get_resolved_reference_ids(symbol))
            .map(|reference| nodes.kind(scoping.get_reference(*reference).node_id()).span().start);
        let mut any = false;
        let folded = reads.all(|at| {
            any = true;
            !kept(edits, at)
        });
        if any && folded && evaluator.import_droppable(source) {
            removed.push(Edit { start: import.span.start, end: import.span.end, ..Edit::default() });
        }
    }
    removed
}

/// Whether the source at `at` is still in the output: outside every edit, or inside a range the
/// edit around it copies from the source and that no edit within the range replaces.
fn kept(edits: &[Edit], at: u32) -> bool {
    // The outermost: edits are sorted by start, then by end descending.
    let Some(edit) = edits.iter().find(|edit| edit.start <= at && at < edit.end) else { return true };
    edit.pieces.iter().any(|piece| match piece {
        Piece::Source(start, end) if *start <= at && at < *end => {
            let inside: Vec<Edit> = edits
                .iter()
                .filter(|other| {
                    other.start >= *start && other.end <= *end && (other.start, other.end) != (*start, *end)
                })
                .cloned()
                .collect();
            kept(&inside, at)
        }
        _ => false,
    })
}
