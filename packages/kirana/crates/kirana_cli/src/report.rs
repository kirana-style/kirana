//! `kirana-style report`: the engine's half of `kirana-style doctor --report` (KRN-DX-008). It compiles the
//! project and prints what a bug report needs from the engine, as JSON: the engine version, how
//! much work it did, the stylesheet's size, and every diagnostic code with how often it occurred
//! and where first. It never prints source text; locations are project-relative.

use std::collections::BTreeMap;

use kirana_diagnostics::Diagnostic;
use kirana_project::{Analysis, Work};
use serde_json::{Value, json};

/// The report for diagnostics from a compile, the work it took and the analysis of the result.
pub fn report(diagnostics: &[Diagnostic], sources: &[(String, String)], work: &Work, analysis: &Analysis) -> Value {
    let mut codes: BTreeMap<&str, (&Diagnostic, usize)> = BTreeMap::new();
    for diagnostic in diagnostics {
        codes.entry(diagnostic.code.code()).or_insert((diagnostic, 0)).1 += 1;
    }
    let diagnostics: Vec<Value> = codes
        .into_values()
        .map(|(first, count)| {
            let source = sources.iter().find(|(file, _)| *file == first.file).map_or("", |(_, text)| text.as_str());
            let (line, column) = kirana_diagnostics::line_column(source, first.span.start);
            json!({
                "code": first.code.code(),
                "name": first.code.name(),
                "severity": first.severity,
                "count": count,
                "first": format!("{}:{line}:{column}", first.file),
            })
        })
        .collect();
    json!({
        "engine": env!("CARGO_PKG_VERSION"),
        "work": {
            "seen": work.seen,
            "prefiltered": work.prefiltered,
            "parsed": work.parsed,
            "resolved": work.resolved,
        },
        "stylesheet": {
            "modules": analysis.modules,
            "sites": analysis.sites,
            "atoms": analysis.atoms,
            "bytes": analysis.bytes,
        },
        "diagnostics": diagnostics,
    })
}
