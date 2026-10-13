//! The source rewrite (KRN-CMP-007). One walk over a style-bearing module collects edits; the
//! edits are rendered once into a `MagicString`, which produces the code and its source map.
//!
//! Compiled style values are plain runtime values (class strings, objects, recipe tables), so any
//! expression the evaluator cannot fold is left as JavaScript and merged by the private runtime.

mod codegen;
mod relations;
mod visit;

use std::sync::Arc;

use kirana_diagnostics::Diagnostic;
use kirana_evaluator::Evaluator;
use kirana_ir::{Dep, Handle};
use string_wizard::{Hires, MagicString, SourceMapOptions};

/// The rewrite of one module.
#[derive(Debug, Clone, PartialEq)]
pub struct TransformOutput {
    /// `None` when the module needs no change.
    pub code: Option<String>,
    /// The source map JSON when the code changed.
    pub map: Option<String>,
    /// Every handle written into the output with the span of the site that wrote it: the atoms
    /// and markers this module contributes.
    pub handles: Vec<((u32, u32), Arc<Handle>)>,
    /// Marker dependencies (themes) written into the output.
    pub marker_deps: Vec<Dep>,
    /// Relation markers applied as anchors in the output.
    pub anchors: Vec<String>,
    pub diagnostics: Vec<Diagnostic>,
}

/// A piece of generated code: literal text or a slice of the original source (rendered with any
/// edits nested inside it).
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Piece {
    Text(String),
    Source(u32, u32),
}

#[derive(Debug, Clone, Default)]
pub(crate) struct Edit {
    pub start: u32,
    pub end: u32,
    pub pieces: Vec<Piece>,
    /// Handles this edit writes; they count only when the edit is rendered.
    pub handles: Vec<((u32, u32), Arc<Handle>)>,
    pub marker_deps: Vec<Dep>,
}

/// Rewrites a module whose evaluator has been created over the parsed source.
pub fn transform(evaluator: &Evaluator<'_, '_, '_>) -> TransformOutput {
    let mut visitor = visit::Rewriter::new(evaluator);
    visitor.run();
    let parsed = evaluator.parsed();
    let source = parsed.source;
    let mut diagnostics = std::mem::take(&mut visitor.diagnostics);
    let edits = visitor.finish_edits();
    let runtime_needed = visitor.runtime_needed;
    let anchors = std::mem::take(&mut visitor.anchors);
    diagnostics.extend(relations::check(evaluator));

    if edits.is_empty() && !runtime_needed {
        return TransformOutput {
            code: None,
            map: None,
            handles: Vec::new(),
            marker_deps: Vec::new(),
            anchors,
            diagnostics,
        };
    }
    let mut magic = MagicString::new(source);
    let top = top_level(&edits);
    let rendered = std::cell::RefCell::new(Vec::new());
    for edit in &top {
        rendered.borrow_mut().push((edit.start, edit.end));
        let text = render_pieces(source, &edit.pieces, &edits, &rendered);
        magic.update(edit.start, edit.end, text).expect("edits replace non-empty, non-overlapping ranges");
    }
    if runtime_needed {
        let prefix = &evaluator.context().names.prefix;
        let class = evaluator.context().config.jsx.class_attribute();
        let import = format!(
            "import {{ runtime as __kirana_runtime }} from \"@kirana-style/core/internal\";\nconst __k = __kirana_runtime({prefix:?}, {class:?});\n"
        );
        let position = insertion_point(parsed);
        if position == 0 {
            magic.prepend(import);
        } else {
            magic.append_left(position, format!("\n{import}")).expect("insertion inside the source");
        }
    }
    let rendered = rendered.into_inner();
    let mut handles = Vec::new();
    let mut marker_deps: Vec<Dep> = Vec::new();
    for edit in edits.iter().filter(|edit| rendered.contains(&(edit.start, edit.end))) {
        handles.extend(edit.handles.iter().cloned());
        for dep in &edit.marker_deps {
            if !marker_deps.contains(dep) {
                marker_deps.push(dep.clone());
            }
        }
    }
    let map = magic
        .source_map(SourceMapOptions {
            include_content: true,
            // The module path itself, so bundlers and coverage tools resolve the map to the same file.
            source: Arc::from(evaluator.context().path.to_string_lossy().as_ref()),
            hires: Hires::Boundary,
        })
        .to_json_string();
    TransformOutput { code: Some(magic.to_string()), map: Some(map), handles, marker_deps, anchors, diagnostics }
}

/// After the directive prologue (`"use client"`) and any hashbang.
fn insertion_point(parsed: &kirana_frontend::Parsed<'_>) -> u32 {
    let program = parsed.program;
    program
        .directives
        .last()
        .map(|directive| directive.span.end)
        .or_else(|| program.hashbang.as_ref().map(|hashbang| hashbang.span.end))
        .unwrap_or(0)
}

/// Edits not contained in another edit, in source order.
fn top_level(edits: &[Edit]) -> Vec<&Edit> {
    let mut top: Vec<&Edit> = Vec::new();
    for edit in edits {
        if top.last().is_none_or(|last| edit.start >= last.end) {
            top.push(edit);
        }
    }
    top
}

type Rendered = std::cell::RefCell<Vec<(u32, u32)>>;

/// Renders pieces, applying edits nested inside copied source ranges.
fn render_pieces(source: &str, pieces: &[Piece], edits: &[Edit], rendered: &Rendered) -> String {
    let mut out = String::new();
    for piece in pieces {
        match piece {
            Piece::Text(text) => out.push_str(text),
            Piece::Source(start, end) => out.push_str(&render_range(source, *start, *end, edits, rendered)),
        }
    }
    out
}

fn render_range(source: &str, start: u32, end: u32, edits: &[Edit], rendered: &Rendered) -> String {
    let inside: Vec<Edit> = edits
        .iter()
        .filter(|edit| edit.start >= start && edit.end <= end && !(edit.start == start && edit.end == end))
        .cloned()
        .collect();
    let mut out = String::new();
    let mut cursor = start;
    for edit in top_level(&inside) {
        rendered.borrow_mut().push((edit.start, edit.end));
        out.push_str(&source[cursor as usize..edit.start as usize]);
        out.push_str(&render_pieces(source, &edit.pieces, &inside, rendered));
        cursor = edit.end;
    }
    out.push_str(&source[cursor as usize..end as usize]);
    out
}
