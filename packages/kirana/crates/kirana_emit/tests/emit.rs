use std::sync::Arc;

use kirana_emit::*;
use kirana_ir::*;
use lightningcss::targets::{Browsers, Targets};

fn atom(target: Target, property: &str, conditions: Vec<Condition>, css: &str, deps: Vec<Dep>) -> Atom {
    let names = Names::default();
    let op = Op::Set(
        EntryKey::new(target, Property::longhand(property), ConditionSet::new(conditions)),
        AtomValue { css: css.into(), deps, longhands: 1 },
    );
    let Op::Set(key, value) = op.clone() else { unreachable!() };
    Atom { class: names.class(&op), key, value }
}

fn cond(key: &str) -> Vec<Condition> {
    parse_condition_key(key).unwrap()
}

fn sample() -> (Vec<Atom>, Vec<Dep>) {
    let ring = Arc::new(TokenDef {
        variable: "--kvRing".into(),
        value: TokenValue::Plain("oklch(0.7 0 0)".into()),
        identity: "theme.ring".into(),
        deps: vec![],
        registration: None,
        runtime: false,
    });
    let blend = Arc::new(TokenDef {
        variable: "--kvBlend".into(),
        value: TokenValue::Modes { light: "darken".into(), dark: "lighten".into() },
        identity: "surface.blend".into(),
        deps: vec![Dep::Token(ring.clone())],
        registration: None,
        runtime: false,
    });
    let spin = Arc::new(KeyframesDef {
        name: "kfSpin".into(),
        frames: vec![("to".into(), vec![("transform".into(), "rotate(360deg)".into())])],
        deps: vec![],
    });
    let theme = Arc::new(ThemeDef {
        class: "ktBrand".into(),
        declarations: vec![
            ("--kvRing".into(), TokenValue::Plain("orange".into())),
            ("--kvBlend".into(), TokenValue::Modes { light: "multiply".into(), dark: "screen".into() }),
        ],
        deps: vec![Dep::Token(ring.clone())],
    });
    let plain_theme = Arc::new(ThemeDef {
        class: "ktPlain".into(),
        declarations: vec![("--kvRing".into(), TokenValue::Plain("red".into()))],
        deps: vec![],
    });
    let within =
        Condition::Relation { marker: "krField".into(), kind: RelationKind::Within, state: "[data-disabled]".into() };
    let after = Condition::Relation { marker: "krPeer".into(), kind: RelationKind::After, state: ":checked".into() };
    let before = Condition::Relation { marker: "krPeer".into(), kind: RelationKind::Before, state: String::new() };
    let atoms = vec![
        atom(Target::Element, "color", cond(":hover"), "var(--kvRing)", vec![Dep::Token(ring.clone())]),
        atom(Target::Element, "color", vec![], "black", vec![]),
        atom(Target::Element, "mix-blend-mode", vec![], "var(--kvBlend)", vec![Dep::Token(blend.clone())]),
        atom(
            Target::Element,
            "animation-name",
            vec![],
            "kfSpin",
            vec![Dep::Keyframes(spin.clone()), Dep::Keyframes(spin)],
        ),
        atom(Target::Element, "display", cond("@media (width >= 48rem)"), "block", vec![]),
        atom(Target::Element, "padding-top", cond("@media (width >= 48rem)"), "1rem", vec![]),
        atom(
            Target::Element,
            "padding-top",
            [
                cond("@supports (display: grid)"),
                cond("@media (width >= 64rem)"),
                cond("@container card (min-width: 20rem)"),
            ]
            .concat(),
            "2rem",
            vec![],
        ),
        atom(Target::Element, "opacity", vec![within], "0.5", vec![]),
        atom(Target::Element, "display", [vec![after], cond("[data-x]:focus")].concat(), "block", vec![]),
        atom(Target::Element, "display", vec![before], "none", vec![]),
        atom(Target::PseudoElement("::after".into()), "content", cond("[data-swipe=\"up\"]"), "''", vec![]),
        atom(
            Target::Contextual { child: false, selector: "svg".into(), pseudo_element: None },
            "width",
            vec![],
            "1rem",
            vec![],
        ),
        atom(
            Target::Contextual {
                child: true,
                selector: "[data-slot=\"icon\"]".into(),
                pseudo_element: Some("::before".into()),
            },
            "width",
            cond(":hover"),
            "2rem",
            vec![],
        ),
    ];
    let mut duplicated = atoms.clone();
    duplicated.push(atoms[1].clone());
    (duplicated, vec![Dep::Theme(theme), Dep::Theme(plain_theme.clone()), Dep::Theme(plain_theme)])
}

#[test]
fn pretty_stylesheet() {
    let (atoms, markers) = sample();
    let output = emit(
        &atoms,
        &markers,
        &EmitOptions {
            layers_before: vec!["reset".into(), "base".into()],
            prefix: "k".into(),
            ..EmitOptions::default()
        },
    );
    assert!(!output.lowered);
    insta::assert_snapshot!("pretty", output.css);
}

#[test]
fn minified_stylesheet() {
    let (atoms, markers) = sample();
    let output = emit(
        &atoms,
        &markers,
        &EmitOptions {
            layers_after: vec!["overrides".into()],
            minify: true,
            prefix: "k".into(),
            ..EmitOptions::default()
        },
    );
    insta::assert_snapshot!("minified", output.css);
}

#[test]
fn empty_stylesheet_has_only_the_layer_plan() {
    let output = emit(&[], &[], &EmitOptions { minify: true, ..EmitOptions::default() });
    assert_eq!(output.css, "@layer kirana;@layer kirana.tokens,kirana.themes,kirana.contextual,kirana.atoms;");
}

#[test]
fn only_keyframes_or_only_tokens() {
    let spin = Arc::new(KeyframesDef { name: "kfA".into(), frames: vec![], deps: vec![] });
    let with_frames = vec![atom(Target::Element, "animation-name", vec![], "kfA", vec![Dep::Keyframes(spin)])];
    let css = emit(&with_frames, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert!(css.contains("@layer kirana.tokens{@keyframes kfA{}}"), "{css}");
    let token = Arc::new(TokenDef {
        variable: "--kvA".into(),
        value: TokenValue::Plain("1".into()),
        identity: "a".into(),
        deps: vec![],
        registration: None,
        runtime: false,
    });
    let with_token = vec![atom(Target::Element, "opacity", vec![], "var(--kvA)", vec![Dep::Token(token)])];
    let css = emit(&with_token, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert!(css.contains("@layer kirana.tokens{:root{--kvA:1}}"), "{css}");
}

#[test]
fn registered_tokens_are_properties_not_root_declarations() {
    let token = Arc::new(TokenDef {
        variable: "--kvA".into(),
        value: TokenValue::Plain("0px".into()),
        identity: "a".into(),
        deps: vec![],
        registration: Some(Registration { syntax: "<length-percentage>".into(), inherits: false }),
        runtime: false,
    });
    let atoms = vec![atom(Target::Element, "width", vec![], "var(--kvA)", vec![Dep::Token(token)])];
    let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert!(css.contains(r#"@property --kvA{syntax:"<length-percentage>";inherits:false;initial-value:0px}"#), "{css}");
    assert!(!css.contains("kirana.tokens{"), "{css}");
}

#[test]
fn last_atom_inside_an_at_rule_and_nested_keyframe_deps() {
    let token = Arc::new(TokenDef {
        variable: "--kvA".into(),
        value: TokenValue::Plain("1".into()),
        identity: "a".into(),
        deps: vec![],
        registration: None,
        runtime: false,
    });
    let frames = Arc::new(KeyframesDef {
        name: "kfA".into(),
        frames: vec![("50%".into(), vec![("opacity".into(), "var(--kvA)".into())])],
        deps: vec![Dep::Token(token)],
    });
    let atoms = vec![atom(Target::Element, "animation-name", cond("@media (x)"), "kfA", vec![Dep::Keyframes(frames)])];
    let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert!(css.ends_with("@layer kirana.atoms{@media (x){.k3O-Lugw_TVCD{animation-name:kfA}}}"), "{css}");
    assert!(css.contains(":root{--kvA:1}"), "{css}");
}

/// Text Lightning CSS cannot parse comes back as it went in, rather than ending the build.
#[test]
fn lowering_that_fails_leaves_the_stylesheet_alone() {
    let targets =
        Targets { browsers: Some(Browsers { safari: Some(15 << 16), ..Browsers::default() }), ..Targets::default() };
    let output = lower("!!!".to_owned(), targets, true);
    assert_eq!(output, EmitOutput { css: "!!!".to_owned(), lowered: false, pruned: vec![] });
}

#[test]
fn lowering_runs_only_when_asked() {
    let atoms = vec![atom(Target::Element, "color", vec![], "light-dark(white, black)", vec![])];
    let targets =
        Targets { browsers: Some(Browsers { safari: Some(15 << 16), ..Browsers::default() }), ..Targets::default() };
    let output = emit(&atoms, &[], &EmitOptions { minify: true, lower_for: Some(targets), ..EmitOptions::default() });
    assert!(output.lowered);
    assert!(!output.css.contains("light-dark("), "{}", output.css);
}

#[test]
fn selectors_and_at_rules() {
    let (atoms, _) = sample();
    let contextual =
        atoms.iter().find(|atom| matches!(&atom.key.target, Target::Contextual { child: true, .. })).unwrap();
    assert!(selector(contextual).ends_with(":where(:hover) > :where([data-slot=\"icon\"])::before"));
    assert_eq!(
        at_rules(&atoms[6]),
        ["@supports (display: grid)", "@media (width >= 64rem)", "@container card (min-width: 20rem)"]
    );
}

#[test]
fn minification_keeps_meaning() {
    use kirana_emit::minify::{Kind, compact};
    assert_eq!(compact("oklch(0.5 0.2 30 / 0.5)", Kind::Value), "oklch(.5 .2 30/.5)");
    assert_eq!(compact("calc(1rem * -0.25)", Kind::Value), "calc(1rem*-.25)");
    assert_eq!(compact("calc(100% - 1rem)", Kind::Value), "calc(100% - 1rem)");
    assert_eq!(
        compact("color-mix(in oklab, var(--a) 30%, transparent)", Kind::Value),
        "color-mix(in oklab,var(--a) 30%,transparent)"
    );
    assert_eq!(compact("var(--a) var(--b)", Kind::Value), "var(--a) var(--b)");
    assert_eq!(compact("10.5px 1.05 a0.5", Kind::Value), "10.5px 1.05 a0.5");
    assert_eq!(compact("\"Inter  Variable\", sans-serif", Kind::Value), "\"Inter  Variable\",sans-serif");
    assert_eq!(compact("url(a , b.png) , x", Kind::Value), "url(a , b.png),x");
    assert_eq!(
        compact(".k:where([data-state=\"open\"][data-x=\"1a\"][aria-label=\"a b\"]) > :where(svg)", Kind::Selector),
        ".k:where([data-state=open][data-x=\"1a\"][aria-label=\"a b\"])>:where(svg)"
    );
    assert_eq!(compact(".k:where(.krA:hover *)", Kind::Selector), ".k:where(.krA:hover *)");
    assert_eq!(
        compact(".k:where(:has(~ .krA)):where(:nth-child(2n + 1))", Kind::Selector),
        ".k:where(:has(~.krA)):where(:nth-child(2n+1))"
    );
    assert_eq!(compact(".k:where([title=\"0.5\"])", Kind::Selector), ".k:where([title=\"0.5\"])");
    assert_eq!(
        compact("@media (min-width: 40rem) and (max-width: 63.999rem)", Kind::AtRule),
        "@media (width>=40rem) and (width<=63.999rem)"
    );
    assert_eq!(compact("@container card (width >= 28rem)", Kind::AtRule), "@container card (width>=28rem)");
    assert_eq!(compact("@media (prefers-color-scheme: dark)", Kind::AtRule), "@media (prefers-color-scheme:dark)");
    assert_eq!(compact("'unterminated", Kind::Value), "'unterminated");
    assert_eq!(compact("url(open", Kind::Value), "url(open");
}

/// A declaration written once, for every rule that carries it.
#[test]
fn rules_that_repeat_a_declaration_share_it() {
    let repeated = vec![
        atom(Target::Element, "display", vec![], "block", vec![]),
        atom(Target::Element, "display", cond(":hover"), "block", vec![]),
        atom(Target::Element, "display", cond(":focus"), "block", vec![]),
    ];
    let css = emit(&repeated, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert!(
        css.contains(".k5O_u3uh,.k5O-KFHz_u3uh:where(:hover),.k5O-Ikox_u3uh:where(:focus){display:block}"),
        "{css}"
    );
}

/// A rule only moves past declarations that cannot compete with it.
#[test]
fn a_competing_declaration_blocks_the_merge() {
    // `display:block`, then `display:flex`, then `display:block` again: merging the first and the
    // last would move `display:flex` after both, and the wrong one would win.
    let competing = vec![
        atom(Target::Element, "display", vec![], "block", vec![]),
        atom(Target::Element, "display", cond(":hover"), "flex", vec![]),
        atom(Target::Element, "display", cond(":focus"), "block", vec![]),
    ];
    let css = emit(&competing, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("display:block").count(), 2, "{css}");

    // A logical longhand competes with its physical counterpart, though the names differ.
    let axes = vec![
        atom(Target::Element, "margin-inline-start", vec![], "0px", vec![]),
        atom(Target::Element, "margin-left", cond(":hover"), "1px", vec![]),
        atom(Target::Element, "margin-inline-start", cond(":focus"), "0px", vec![]),
    ];
    let css = emit(&axes, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("margin-inline-start:0px").count(), 2, "{css}");

    // A shorthand covers longhands this pass does not enumerate, so nothing crosses it.
    let names = Names::default();
    let shorthand = Op::Set(
        EntryKey::new(Target::Element, Property::shorthand("border"), ConditionSet::new(cond(":hover"))),
        AtomValue { css: "1px solid red".into(), deps: vec![], longhands: 12 },
    );
    let Op::Set(key, value) = shorthand.clone() else { unreachable!() };
    let across = vec![
        atom(Target::Element, "border-top-width", vec![], "2px", vec![]),
        Atom { class: names.class(&shorthand), key, value },
        atom(Target::Element, "border-top-width", cond(":hover"), "2px", vec![]),
    ];
    let css = emit(&across, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert_eq!(css.matches("border-top-width:2px").count(), 2, "{css}");
}

/// A `firstThatWorks` run is one atom written as one declaration per member, the preferred last.
#[test]
fn fallback_runs_write_the_preferred_value_last() {
    let run = format!("100dvh{FALLBACK_SEPARATOR}100vh");
    let atoms = vec![atom(Target::Element, "min-height", vec![], &run, vec![])];
    let css = emit(&atoms, &[], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert!(css.ends_with("{min-height:100vh;min-height:100dvh}}"), "{css}");
    assert_eq!(fallback_values(&run).collect::<Vec<_>>(), ["100dvh", "100vh"]);
    assert_eq!(atom_rule(&atoms[0], false).matches("min-height").count(), 2);
}

/// Lowering for old targets keeps both members: each is a value some browser needs.
#[test]
fn lowering_keeps_fallback_runs() {
    let run = format!("100dvh{FALLBACK_SEPARATOR}100vh");
    let atoms = vec![atom(Target::Element, "min-height", vec![], &run, vec![])];
    let targets =
        Targets { browsers: Some(Browsers { safari: Some(15 << 16), ..Browsers::default() }), ..Targets::default() };
    let output = emit(&atoms, &[], &EmitOptions { minify: true, lower_for: Some(targets), ..EmitOptions::default() });
    assert!(output.css.contains("min-height:100vh;min-height:100dvh"), "{}", output.css);
}

#[test]
fn position_try_and_view_transition_definitions() {
    let token = Arc::new(TokenDef {
        variable: "--kvGap".into(),
        value: TokenValue::Plain("4px".into()),
        identity: "space.gap".into(),
        deps: vec![],
        registration: None,
        runtime: false,
    });
    let below = Arc::new(PositionTryDef {
        name: "--kpBelo".into(),
        declarations: vec![("position-area".into(), "bottom".into()), ("margin-top".into(), "var(--kvGap)".into())],
        deps: vec![Dep::Token(token)],
    });
    let fade = Arc::new(KeyframesDef { name: "kfFade".into(), frames: vec![], deps: vec![] });
    let slide = Arc::new(ViewTransitionDef {
        class: "kwSlid".into(),
        parts: vec![
            (TransitionPart::Old, vec![(vec![], vec![("animation-name".into(), "kfFade".into())])]),
            (
                TransitionPart::New,
                vec![(
                    vec!["@supports (x: y)".into(), "@media (prefers-reduced-motion: reduce)".into()],
                    vec![("animation-duration".into(), "0s".into())],
                )],
            ),
        ],
        deps: vec![Dep::Keyframes(fade)],
    });
    let atoms = vec![atom(
        Target::Element,
        "position-try-fallbacks",
        vec![],
        "--kpBelo",
        vec![Dep::PositionTry(below.clone())],
    )];
    let markers = [Dep::ViewTransition(slide.clone()), Dep::ViewTransition(slide), Dep::PositionTry(below)];
    let css = emit(&atoms, &markers, &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert!(
        css.contains(
            "@layer kirana.tokens{:root{--kvGap:4px}@keyframes kfFade{}@position-try --kpBelo{position-area:bottom;margin-top:var(--kvGap)}"
        ),
        "{css}"
    );
    assert!(
        css.contains(
            ".kwSlid{view-transition-class:kwSlid}::view-transition-old(*.kwSlid){animation-name:kfFade}@supports (x:y){@media (prefers-reduced-motion:reduce){::view-transition-new(*.kwSlid){animation-duration:0s}}}}"
        ),
        "{css}"
    );
    let only_transition = Arc::new(ViewTransitionDef { class: "kwNone".into(), parts: vec![], deps: vec![] });
    let css =
        emit(&[], &[Dep::ViewTransition(only_transition)], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert!(css.ends_with("@layer kirana.tokens{.kwNone{view-transition-class:kwNone}}"), "{css}");
    let only_fallback = Arc::new(PositionTryDef { name: "--kpNone".into(), declarations: vec![], deps: vec![] });
    let css =
        emit(&[], &[Dep::PositionTry(only_fallback)], &EmitOptions { minify: true, ..EmitOptions::default() }).css;
    assert!(css.ends_with("@layer kirana.tokens{@position-try --kpNone{}}"), "{css}");
}

#[test]
fn transition_parts_name_their_pseudo_elements() {
    let keys: Vec<_> = TransitionPart::ALL.iter().map(|part| (part.key(), part.pseudo_element())).collect();
    assert_eq!(
        keys,
        [
            ("group", "::view-transition-group"),
            ("imagePair", "::view-transition-image-pair"),
            ("old", "::view-transition-old"),
            ("new", "::view-transition-new"),
        ]
    );
}

/// D-086: a token only code names is written when the bundle names it or it is a runtime token;
/// one a rule reads always is, and so is one a kept token reads.
#[test]
fn a_token_only_code_names_needs_the_bundle_to_name_it() {
    let token = |name: &str, value: &str, runtime: bool, deps: Vec<Dep>| {
        Arc::new(TokenDef {
            variable: name.into(),
            value: TokenValue::Plain(value.into()),
            identity: name.into(),
            deps,
            registration: None,
            runtime,
        })
    };
    let read = token("--kvRead", "1px", false, vec![]);
    let base = token("--kvBase", "2px", false, vec![]);
    let alias = token("--kvAlias", "var(--kvBase)", false, vec![Dep::Token(base.clone())]);
    let named = token("--kvNamed", "3px", false, vec![]);
    let gone = token("--kvGone", "4px", false, vec![]);
    let runtime = token("--kvRun", "5px", true, vec![]);
    let atoms = vec![atom(Target::Element, "gap", vec![], "var(--kvRead)", vec![Dep::Token(read.clone())])];
    let marker = [&read, &base, &alias, &named, &gone, &runtime].map(|token| Dep::Token((*token).clone()));
    let write = |named: Option<&[&str]>| {
        emit(
            &atoms,
            &marker,
            &EmitOptions {
                minify: true,
                named: named.map(|names| names.iter().map(|name| (*name).to_owned()).collect()),
                ..EmitOptions::default()
            },
        )
    };

    // No bundle known: every token is written, as before.
    let all = write(None);
    for name in ["--kvRead", "--kvBase", "--kvAlias", "--kvNamed", "--kvGone", "--kvRun"] {
        assert!(all.css.contains(&format!("{name}:")), "{name} in {}", all.css);
    }
    assert!(all.pruned.is_empty());

    // The bundle names the alias and one token: the alias brings the token it reads.
    let finished = write(Some(&["--kvAlias", "--kvNamed"]));
    for name in ["--kvRead", "--kvAlias", "--kvBase", "--kvNamed", "--kvRun"] {
        assert!(finished.css.contains(&format!("{name}:")), "{name} in {}", finished.css);
    }
    assert!(!finished.css.contains("--kvGone"), "{}", finished.css);
    assert_eq!(finished.pruned, [("--kvGone".to_owned(), "--kvGone".to_owned())]);

    // Named by nothing: only what rules read, and the runtime token.
    let bare = write(Some(&[]));
    assert!(bare.css.contains("--kvRead:") && bare.css.contains("--kvRun:"), "{}", bare.css);
    let left: Vec<&str> = bare.pruned.iter().map(|(name, _)| name.as_str()).collect();
    assert_eq!(left, ["--kvAlias", "--kvBase", "--kvGone", "--kvNamed"]);
}

/// D-094: keyframes only code names (a library's exported animations) are written when the bundle
/// names them; ones a rule reads always are, and so are ones a kept view transition reads.
#[test]
fn keyframes_only_code_names_need_the_bundle_to_name_them() {
    let frames = |name: &str| {
        Arc::new(KeyframesDef {
            name: name.into(),
            frames: vec![("to".into(), vec![("opacity".into(), "0".into())])],
            deps: vec![],
        })
    };
    let read = frames("kfRead");
    let named = frames("kfNamed");
    let gone = frames("kfGone");
    let carried = frames("kfCarry");
    let transition = Arc::new(ViewTransitionDef {
        class: "kwSlide".into(),
        parts: vec![],
        deps: vec![Dep::Keyframes(carried.clone())],
    });
    let atoms = vec![atom(Target::Element, "animation-name", vec![], "kfRead", vec![Dep::Keyframes(read.clone())])];
    // The keyframes the transition carries come first, as left out, then the transition keeps them.
    let marker = [
        Dep::Keyframes(read.clone()),
        Dep::Keyframes(carried.clone()),
        Dep::Keyframes(named.clone()),
        Dep::Keyframes(gone.clone()),
        Dep::ViewTransition(transition),
    ];
    let write = |names: Option<&[&str]>| {
        emit(
            &atoms,
            &marker,
            &EmitOptions {
                minify: true,
                named: names.map(|names| names.iter().map(|name| (*name).to_owned()).collect()),
                ..EmitOptions::default()
            },
        )
    };

    // No bundle known: every keyframes rule is written.
    let all = write(None);
    for name in ["kfRead", "kfCarry", "kfNamed", "kfGone"] {
        assert!(all.css.contains(&format!("@keyframes {name}")), "{name} in {}", all.css);
    }
    assert!(all.pruned.is_empty());

    // The bundle names one: the rule's, the transition's and the named one stay.
    let finished = write(Some(&["kfNamed"]));
    for name in ["kfRead", "kfCarry", "kfNamed"] {
        assert!(finished.css.contains(&format!("@keyframes {name}")), "{name} in {}", finished.css);
    }
    assert!(!finished.css.contains("kfGone"), "{}", finished.css);
    assert_eq!(finished.pruned, [("kfGone".to_owned(), "@keyframes kfGone".to_owned())]);
}
