//! Source frontends (tier 2): the prefilter (KRN-CMP-002), Oxc parsing (KRN-CMP-001), and the
//! component scanner the language server reads Vue, Svelte and Astro files with.

pub mod sfc;
pub mod templates;

use std::path::Path;

use kirana_diagnostics::{Code, Diagnostic, Span};
use oxc_allocator::Allocator;
use oxc_ast::ast::Program;
use oxc_parser::Parser;
use oxc_semantic::{Semantic, SemanticBuilder};
pub use oxc_span::SourceType;

/// Whether a module might be style-bearing and must be parsed.
///
/// A module needs rewriting only when it imports `@kirana-style/` or writes an `sx` attribute. A module
/// that merely uses an imported style value at runtime needs nothing: compiled style values are
/// ordinary strings and objects, so leaving it untouched is correct (D-023, simplified in D-039).
pub fn may_be_style_bearing(source: &str) -> bool {
    if source.contains("@kirana-style/") {
        return true;
    }
    let bytes = source.as_bytes();
    let mut from = 0;
    while let Some(offset) = source[from..].find("sx") {
        let start = from + offset;
        let before_ok = start == 0 || !is_identifier_byte(bytes[start - 1]);
        let rest = &source[start + 2..];
        let after = rest.trim_start_matches([' ', '\t', '\r', '\n']);
        if before_ok && (after.starts_with('=') && !after.starts_with("==") || after.starts_with(':')) {
            return true;
        }
        from = start + 2;
    }
    false
}

fn is_identifier_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$' || byte == b'-' || byte == b'.'
}

/// The source type for a module path; unknown extensions parse as TSX.
pub fn source_type(path: &Path) -> SourceType {
    SourceType::from_path(path).unwrap_or_else(|_| SourceType::tsx())
}

/// A parsed module with semantic analysis.
pub struct Parsed<'a> {
    pub source: &'a str,
    pub program: &'a Program<'a>,
    pub semantic: Semantic<'a>,
}

/// Parses `source` and runs `run` on the result, or returns `parse-error` diagnostics.
pub fn with_parsed<R>(
    path: &Path,
    file: &str,
    source: &str,
    run: impl FnOnce(&Parsed<'_>) -> R,
) -> Result<R, Vec<Diagnostic>> {
    with_parsed_as(source_type(path), file, source, run)
}

/// [`with_parsed`] with the source type given rather than read from the path: the language server
/// parses a component's script block with JSX, whatever its `lang`, to read its template's bindings.
pub fn with_parsed_as<R>(
    source_type: SourceType,
    file: &str,
    source: &str,
    run: impl FnOnce(&Parsed<'_>) -> R,
) -> Result<R, Vec<Diagnostic>> {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, source_type).parse();
    if parsed.fatal_error || parsed.diagnostics.has_errors() {
        return Err(parsed
            .diagnostics
            .errors()
            .map(|error| {
                let span = error
                    .labels
                    .first()
                    .map_or(Span::default(), |label| Span::new(label.offset(), label.offset() + label.len()));
                Diagnostic::new(Code::ParseError, file, span, error.message.to_string())
            })
            .collect());
    }
    let program = allocator.alloc(parsed.program);
    let semantic = SemanticBuilder::new().with_build_nodes(true).build(program).semantic;
    Ok(run(&Parsed { source, program, semantic }))
}
