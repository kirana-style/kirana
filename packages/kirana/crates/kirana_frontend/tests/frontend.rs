use std::path::Path;

use kirana_frontend::*;

#[test]
fn prefilter_accepts_style_bearing_modules() {
    assert!(may_be_style_bearing("import { css } from \"@kirana-style/core\""));
    assert!(may_be_style_bearing("<div sx={a} />"));
    assert!(may_be_style_bearing("<div\n  sx = {a} />"));
    assert!(may_be_style_bearing("sx={a}"));
    assert!(may_be_style_bearing("<Comp sx:x />"));
    // A relation imported from another style module, read here (KF-051).
    assert!(may_be_style_bearing("const focused = scope.within(\":focus\")"));
    assert!(may_be_style_bearing("scope.parent()"));
    assert!(may_be_style_bearing("scope.after ()"));
    assert!(may_be_style_bearing("scope\n  .before(\":hover\")"));
}

#[test]
fn prefilter_rejects_everything_else() {
    assert!(!may_be_style_bearing("const x = 1"));
    assert!(!may_be_style_bearing("const sxy = 1; a.sx = 2; data-sx=1"));
    assert!(!may_be_style_bearing("if (sx == 1) {}"));
    assert!(!may_be_style_bearing("sx"));
    assert!(!may_be_style_bearing("const box = sx"));
    assert!(!may_be_style_bearing("scope.within; scope.afterwards(); node.parentNode"));
}

#[test]
fn source_types() {
    assert!(source_type(Path::new("a.tsx")).is_jsx());
    assert!(source_type(Path::new("a.ts")).is_typescript());
    assert!(source_type(Path::new("a.vue")).is_jsx());
}

#[test]
fn parses_with_semantic_analysis() {
    let result = with_parsed(Path::new("a.tsx"), "a.tsx", "const a = 1; export const b = <div>{a}</div>", |parsed| {
        (parsed.program.body.len(), parsed.semantic.scoping().symbols_len(), parsed.source.len())
    })
    .unwrap();
    assert_eq!(result, (2, 2, 44));
}

#[test]
fn reports_parse_errors() {
    let errors = with_parsed(Path::new("a.ts"), "src/a.ts", "const = ;", |_| ()).unwrap_err();
    assert_eq!(errors[0].code, kirana_diagnostics::Code::ParseError);
    assert_eq!(errors[0].file, "src/a.ts");
    assert!(errors[0].span.end > errors[0].span.start);
}

proptest::proptest! {
    /// A module the full parse finds style-bearing (an `sx` JSX attribute) is never rejected.
    #[test]
    fn prefilter_never_rejects_an_sx_attribute(spaces in "[ \t\n]{0,3}", name in "[a-z]{1,8}") {
        let source = format!("<{name} sx{spaces}={{x}} />");
        proptest::prop_assert!(may_be_style_bearing(&source));
    }
}
