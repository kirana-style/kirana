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

/// The index places every offset as `line_column` does: characters of two, three and four bytes, a
/// CRLF, empty lines, a final newline and offsets past the end.
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
    }
}

/// Oxc's graphical report, as oxlint prints it (D-116): the span underlined in a frame with the
/// lines around it (a span over several lines marked at its ends), then every help line. Without the source, or a span that does not lie in it,
/// the file is named after the message; a project-wide diagnostic names nothing.
#[test]
fn renders_human_and_json() {
    let source = "const a = 1\n<label sx={label}>\nconst b = 2\n";
    let diagnostic =
        Diagnostic::new(Code::RelationPlacement, "src/field.tsx", Span::new(23, 28), "reads field.within(…)")
            .with_help("move the anchor")
            .with_help("or read field.after(…)");
    insta::assert_snapshot!(render_human(std::slice::from_ref(&diagnostic), &|_| Some(source), false).concat(), @"

     × KRN1403 relation-placement: reads field.within(…)
      ╭─[src/field.tsx:2:12]
    1 │ const a = 1
    2 │ <label sx={label}>
      ·            ─────
    3 │ const b = 2
      ╰────
     help: move the anchor
           or read field.after(…)
    ");
    insta::assert_snapshot!(render_human(std::slice::from_ref(&diagnostic), &|_| None, false).concat(), @"

    × KRN1403 relation-placement: reads field.within(…) (src/field.tsx)
    help: move the anchor
          or read field.after(…)
    ");
    let cycle = Diagnostic::new(Code::ImportCycle, "src/field.tsx", Span::new(23, 37), "a.ts imports itself");
    insta::assert_snapshot!(render_human(&[cycle], &|_| Some(source), false).concat(), @"

     ⚠ KRN1104 import-cycle: a.ts imports itself
      ╭─[src/field.tsx:2:12]
    1 │     const a = 1
    2 │ ╭─▶ <label sx={label}>
    3 │ ╰─▶ const b = 2
      ╰────
    ");
    let project = Diagnostic::new(Code::RelationUnused, "", Span::default(), "never read");
    insta::assert_snapshot!(render_human(std::slice::from_ref(&project), &|_| Some(""), false).concat(), @"

    ⚠ KRN1402 relation-unused: never read
    ");
    let info = Diagnostic::new(Code::DynamicBridged, "src/a.tsx", Span::default(), "bridged");
    insta::assert_snapshot!(render_human(&[info], &|_| Some(source), false).concat(), @"

    ☞ KRN1601 dynamic-bridged: bridged (src/a.tsx)
    ");
    insta::assert_snapshot!(render_json(&[project]), @r#"[{"code":"KRN1402","name":"relation-unused","severity":"warning","file":"","span":{"start":0,"end":0},"message":"never read","help":[]}]"#);
}

/// What `render_json` writes reads back as the same diagnostics; an unknown name is refused.
#[test]
fn diagnostics_read_back_from_json() {
    let diagnostics = vec![
        Diagnostic::new(Code::RelationPlacement, "a.tsx", Span::new(1, 2), "x").with_help("y"),
        Diagnostic { severity: Severity::Info, ..Diagnostic::new(Code::ImportCycle, "", Span::default(), "z") },
    ];
    let read: Vec<Diagnostic> = serde_json::from_str(&render_json(&diagnostics)).unwrap();
    assert_eq!(read, diagnostics);
    let unknown =
        r#"[{"name":"no-such","severity":"error","file":"","span":{"start":0,"end":0},"message":"","help":[]}]"#;
    let error = serde_json::from_str::<Vec<Diagnostic>>(unknown).unwrap_err();
    assert!(error.to_string().starts_with("unknown diagnostic `no-such`"), "{error}");
    let partial = serde_json::from_str::<Vec<Diagnostic>>(r#"[{"name":"import-cycle"}]"#).unwrap_err();
    assert!(partial.to_string().starts_with("missing field"), "{partial}");
}

/// A span past the end of its text, inside a character, or reversed, is drawn without the source
/// rather than failing the report; one that ends the text, or is empty there, is drawn.
#[test]
fn a_span_outside_its_text_names_the_file_only() {
    let source = "a\né\n";
    let at = |start, end| Diagnostic::new(Code::UnknownProperty, "a.tsx", Span::new(start, end), "x");
    let reports = render_human(&[at(2, 9), at(3, 4), at(2, 1), at(2, 5), at(5, 5)], &|_| Some(source), false);
    assert_eq!(reports.len(), 5);
    for report in &reports[..3] {
        assert_eq!(report, "\n  × KRN1201 unknown-property: x (a.tsx)\n");
    }
    assert!(reports[3].contains("╭─[a.tsx:2:1]"), "{}", reports[3]);
    assert!(reports[4].contains("╭─[a.tsx:3:1]"), "{}", reports[4]);
}

/// The frame's column counts characters, as every other location Kirana prints does and as an
/// editor opens it; the handler alone would count bytes.
#[test]
fn the_frame_counts_columns_in_characters() {
    let source = "ab\n\u{e9}cd\n";
    let at = Diagnostic::new(Code::UnknownProperty, "a.tsx", Span::new(5, 6), "x");
    let report = render_human(&[at], &|_| Some(source), false).concat();
    assert!(report.contains("╭─[a.tsx:2:2]"), "{report}");
    let coloured =
        render_human(&[Diagnostic::new(Code::UnknownProperty, "a.tsx", Span::new(5, 6), "x")], &|_| Some(source), true);
    assert!(coloured[0].contains("\u{1b}[0m:2:2]"), "{coloured:?}");
}

/// A line the frame would print whole that is longer than a thousand bytes, the span's own or one
/// beside it, leaves the frame out and puts the location after the message; a span over more than
/// six lines is underlined on its first line. A module that is one long line costs each of thousands
/// of diagnostics no more than a short one.
#[test]
fn long_lines_and_long_spans_keep_a_frame_short() {
    let long = "x".repeat(1_200);
    let at = |source: &str, start: usize, end: usize| {
        let diagnostic = Diagnostic::new(Code::UnknownProperty, "a.tsx", Span::new(start as u32, end as u32), "x");
        render_human(&[diagnostic], &|_| Some(source), false).concat()
    };
    // The span's own line, before and after the span, and the lines beside it.
    let own = format!("a\n{long} b\nc\n");
    let report = at(&own, own.find(" b").unwrap() + 1, own.find(" b").unwrap() + 2);
    assert_eq!(report, "\n  × KRN1201 unknown-property: x (a.tsx:2:1202)\n");
    let after = format!("a\nb {long}\nc\n");
    assert_eq!(at(&after, 2, 3), "\n  × KRN1201 unknown-property: x (a.tsx:2:1)\n");
    let above = format!("{long}\nb\nc\n");
    assert_eq!(at(&above, 1_201, 1_202), "\n  × KRN1201 unknown-property: x (a.tsx:2:1)\n");
    let below = format!("a\nb\n{long}\n");
    assert_eq!(at(&below, 2, 3), "\n  × KRN1201 unknown-property: x (a.tsx:2:1)\n");
    // A span that ends early in a long line.
    let ends = format!("a\nb: {{\n  c: \"{long}\"\n}}\n");
    assert_eq!(at(&ends, 2, 12), "\n  × KRN1201 unknown-property: x (a.tsx:2:1)\n");
    // Within the limit, all three lines are drawn.
    let short = format!("a\nb {}\nc\n", "x".repeat(900));
    assert!(at(&short, 2, 3).contains("╭─[a.tsx:2:1]"));
    // More than six lines, or more than a thousand bytes, are underlined on the first line.
    let block = "a: {\n  b,\n  c,\n  d,\n  e,\n  f,\n}\n";
    let report = at(block, 0, block.len() - 1);
    assert!(report.contains(" 1 │ a: {\n   · ────\n"), "{report}");
    assert!(!report.contains("╭─▶"), "{report}");
    let wide = format!("a: {{\n  b: \"{}\",\n}}\n", "y".repeat(990));
    let report = at(&wide, 0, wide.len() - 1);
    assert!(report.contains(" 1 │ a: {\n   · ────\n"), "{report}");
    let five = "a: {\n  b,\n  c,\n  d,\n  e,\n}\n";
    assert!(at(five, 0, five.len() - 1).contains("╭─▶"));
    // One line of 6 MB with 3,000 diagnostics on it.
    let minified = "a;".repeat(3_000_000);
    let diagnostics: Vec<Diagnostic> = (0..3_000)
        .map(|index| Diagnostic::new(Code::UnknownProperty, "big.js", Span::new(index * 2_000, index * 2_000 + 1), "x"))
        .collect();
    let started = std::time::Instant::now();
    let reports = render_human(&diagnostics, &|_| Some(minified.as_str()), false);
    assert_eq!(reports[2_999], "\n  × KRN1201 unknown-property: x (big.js:1:5998001)\n");
    // Generous, for a debug build under coverage.
    assert!(started.elapsed() < std::time::Duration::from_secs(20), "{:?}", started.elapsed());
}

/// Colours are ANSI escapes around the severity, the title, the file and the underline; without
/// them the report is the same text.
#[test]
fn colours_wrap_the_same_report() {
    let source = "const a = 1\n";
    let diagnostic = Diagnostic::new(Code::UnknownProperty, "a.tsx", Span::new(6, 7), "x").with_help("y");
    let plain = render_human(std::slice::from_ref(&diagnostic), &|_| Some(source), false);
    let coloured = render_human(&[diagnostic], &|_| Some(source), true);
    assert!(!plain[0].contains('\u{1b}'));
    assert!(coloured[0].contains("\u{1b}[38;2;225;80;80;1m×\u{1b}[0m"), "{coloured:?}");
    let stripped = coloured[0].split('\u{1b}').enumerate().fold(String::new(), |mut text, (index, part)| {
        text.push_str(if index == 0 { part } else { &part[part.find('m').unwrap() + 1..] });
        text
    });
    assert_eq!(stripped, plain[0]);
}

/// `FORCE_COLOR` wins unless it is `0` or `false`, then a non-empty `NO_COLOR`, then the terminal.
#[test]
fn colour_follows_the_terminal_and_the_environment() {
    assert!(colour(true, None, None));
    assert!(!colour(false, None, None));
    assert!(!colour(true, None, Some("1")));
    assert!(colour(true, None, Some("")));
    assert!(colour(false, Some("1"), Some("1")));
    assert!(colour(false, Some(""), None));
    assert!(!colour(true, Some("0"), None));
    assert!(!colour(true, Some("false"), None));
}

/// One file's reports share its line index (KF-028): 3,000 diagnostics in a 6 MB module, each at
/// its own line, drawn as a walk from the file's start per report would take minutes.
#[test]
fn reports_of_one_file_read_it_once() {
    let line = format!("const a = css({{ color: \"red\" }}) // {}\n", "x".repeat(60));
    let source = line.repeat(60_000);
    let diagnostics: Vec<Diagnostic> = (0..3_000)
        .map(|index| {
            let start = (index * 20 * line.len() + 16) as u32;
            Diagnostic::new(Code::UnknownProperty, "big.tsx", Span::new(start, start + 5), "x")
        })
        .collect();
    let started = std::time::Instant::now();
    let reports = render_human(&diagnostics, &|_| Some(source.as_str()), false);
    let took = started.elapsed();
    assert_eq!(reports.len(), 3_000);
    assert!(reports[2_999].contains("╭─[big.tsx:59981:17]"), "{}", reports[2_999]);
    // Generous, for a debug build under coverage.
    assert!(took < std::time::Duration::from_secs(20), "{took:?}");
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
