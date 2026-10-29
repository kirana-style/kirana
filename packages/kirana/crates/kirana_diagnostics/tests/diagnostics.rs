use kirana_diagnostics::*;

#[test]
fn catalogue_is_unique_and_round_trips() {
    let mut codes = std::collections::HashSet::new();
    let mut names = std::collections::HashSet::new();
    for code in Code::ALL {
        assert!(codes.insert(code.code()), "duplicate {}", code.code());
        assert!(names.insert(code.name()), "duplicate {}", code.name());
        assert_eq!(Code::from_name(code.name()), Some(*code));
    }
    assert_eq!(Code::from_name("nope"), None);
    assert_eq!(Code::RelationPlacement.code(), "KRN1403");
    assert_eq!(Code::DynamicBridged.default_severity(), Severity::Info);
}

#[test]
fn levels_and_overrides() {
    let diagnostic = Diagnostic::new(Code::RelationUnused, "a.ts", Span::new(0, 1), "unused");
    assert!(apply_level(diagnostic.clone(), Some(Level::Off)).is_none());
    assert_eq!(apply_level(diagnostic.clone(), None).unwrap().severity, Severity::Warning);
    assert_eq!(apply_level(diagnostic.clone(), Some(Level::Info)).unwrap().severity, Severity::Info);
    assert_eq!(apply_level(diagnostic.clone(), Some(Level::Warning)).unwrap().severity, Severity::Warning);
    assert_eq!(apply_level(diagnostic, Some(Level::Error)).unwrap().severity, Severity::Error);

    assert_eq!(validate_override("relation-unused"), Ok(Code::RelationUnused));
    assert_eq!(validate_override("bogus"), Err(OverrideError::UnknownName("bogus".into())));
    assert_eq!(validate_override("parse-error"), Err(OverrideError::ErrorNotAdjustable("parse-error".into())));
}

#[test]
fn line_column_counts_characters() {
    let source = "ab\ncdé\nf";
    assert_eq!(line_column(source, 0), (1, 1));
    assert_eq!(line_column(source, 4), (2, 2));
    assert_eq!(line_column(source, 99), (3, 2));
}

/// The index places every offset as `line_column` does, and gives each line as `lines()` does:
/// characters of two, three and four bytes, a CRLF, empty lines, a final newline and offsets past
/// the end.
#[test]
fn a_line_index_places_offsets_as_walking_the_text_does() {
    for text in ["ab\ncdé\nf", "a\r\n\n€ 😀x\n\nend\n", "", "\n"] {
        let lines = LineIndex::new(text);
        for offset in (0..=text.len() + 2).filter(|at| text.is_char_boundary(*at) || *at > text.len()) {
            assert_eq!(
                lines.line_column(text, offset as u32),
                line_column(text, offset as u32),
                "{text:?} at {offset}"
            );
            assert_eq!(lines.line(offset as u32), line_column(text, offset as u32).0, "{text:?} at {offset}");
        }
        for line in 0..text.lines().count() + 3 {
            let expected = line.checked_sub(1).and_then(|at| text.lines().nth(at)).unwrap_or_default();
            assert_eq!(lines.line_text(text, line), expected, "{text:?} line {line}");
        }
    }
}

#[test]
fn renders_human_and_json() {
    let source = "const a = 1\n<label sx={label}>\n";
    let diagnostic =
        Diagnostic::new(Code::RelationPlacement, "src/field.tsx", Span::new(23, 28), "reads field.within(…)")
            .with_help("move the anchor");
    insta::assert_snapshot!(render_human(&diagnostic, Some((source, &LineIndex::new(source)))), @r"
    error[KRN1403] relation-placement: reads field.within(…)
      --> src/field.tsx:2:12
      |
    2 | <label sx={label}>
      |            ^^^^^
    help: move the anchor
    ");
    insta::assert_snapshot!(render_human(&diagnostic, None), @r"
    error[KRN1403] relation-placement: reads field.within(…)
      --> src/field.tsx
    help: move the anchor
    ");
    let project = Diagnostic::new(Code::RelationUnused, "", Span::default(), "never read");
    insta::assert_snapshot!(render_human(&project, Some(("", &LineIndex::new("")))), @"warning[KRN1402] relation-unused: never read");
    let info = Diagnostic::new(Code::DynamicBridged, "", Span::default(), "bridged");
    insta::assert_snapshot!(render_human(&info, None), @"info[KRN1601] dynamic-bridged: bridged");
    insta::assert_snapshot!(render_json(&[project]), @r#"[{"code":"KRN1402","name":"relation-unused","severity":"warning","file":"","span":{"start":0,"end":0},"message":"never read","help":[]}]"#);
}

#[test]
fn renders_github_workflow_commands() {
    let source = "const a = 1\n<label sx={label}>\n";
    let diagnostic = Diagnostic::new(Code::RelationPlacement, "src/a,b:c.tsx", Span::new(23, 28), "100% of\r\nit")
        .with_help("move the anchor");
    assert_eq!(
        render_github(&diagnostic, Some((source, &LineIndex::new(source)))),
        "::error file=src/a%2Cb%3Ac.tsx,line=2,col=12,title=KRN1403 relation-placement::100%25 of%0D%0Ait%0Ahelp: move the anchor"
    );
    // Without the source, the file alone; without a file, only the title.
    assert_eq!(
        render_github(&diagnostic, None),
        "::error file=src/a%2Cb%3Ac.tsx,title=KRN1403 relation-placement::100%25 of%0D%0Ait%0Ahelp: move the anchor"
    );
    let project = Diagnostic::new(Code::RelationUnused, "", Span::default(), "never read");
    assert_eq!(
        render_github(&project, Some(("", &LineIndex::new("")))),
        "::warning title=KRN1402 relation-unused::never read"
    );
    let info = Diagnostic::new(Code::DynamicBridged, "a.ts", Span::default(), "bridged");
    assert_eq!(
        render_github(&info, Some(("x", &LineIndex::new("x")))),
        "::notice file=a.ts,title=KRN1601 dynamic-bridged::bridged"
    );
}
