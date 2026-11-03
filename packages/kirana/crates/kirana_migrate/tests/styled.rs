//! `kirana-style migrate styled-components` (D-120): the fixture project's styled-components and Emotion
//! files rewritten, the rewrite compiled, and each construct the codemod reads or reports.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use kirana_migrate::Migration;
use kirana_migrate::styled::migrate;
use kirana_migrate::tailwind::Environment;
use kirana_project::Project;
use kirana_shared::OsFs;

fn root() -> PathBuf {
    fs::canonicalize(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/migrate-styled")).unwrap()
}

/// Components imported from `@ui/…` stand for an installed package's, which do not read `sx`.
struct Packages;

impl Environment for Packages {
    fn export(&self, _: &str, _: &str) -> kirana_ir::Value {
        unreachable!("the codemod evaluates no import")
    }

    fn is_external(&self, specifier: &str) -> bool {
        specifier.starts_with("@ui/")
    }

    fn specifier(&self, _: &Path) -> String {
        unreachable!("the codemod writes no import of another file")
    }

    fn resolve(&self, _: &str) -> Option<PathBuf> {
        unreachable!("the codemod resolves no import")
    }

    fn token(&self, _: &str) -> Option<Arc<kirana_ir::TokenDef>> {
        unreachable!("the codemod reads no token")
    }
}

fn run(name: &str, source: &str) -> Migration {
    migrate(Path::new(name), source, &Packages)
}

fn rewritten(source: &str) -> String {
    run("input.tsx", source).source
}

fn notes(source: &str) -> Vec<String> {
    run("input.tsx", source).notes.into_iter().map(|note| note.message).collect()
}

/// Every file of the fixture, rewritten, with its report.
#[test]
fn the_fixture_project() {
    for name in ["button.tsx", "card.tsx", "plain.tsx"] {
        let source = fs::read_to_string(root().join(name)).unwrap();
        let migration = run(name, &source);
        insta::assert_snapshot!(format!("styled-{name}"), migration.source);
        insta::assert_debug_snapshot!(format!("styled-{name}-notes"), migration.notes);
        assert!(migration.changed(&source));
        assert!(migration.rename.is_none());
    }
}

/// What the codemod writes compiles: no file of the fixture has an error once rewritten.
#[test]
fn the_rewrite_compiles() {
    let root = root();
    let config = serde_json::json!({ "root": root.to_string_lossy() });
    let project = Project::new(&config.to_string(), Arc::new(OsFs)).unwrap();
    for name in ["button.tsx", "card.tsx", "plain.tsx"] {
        let source = fs::read_to_string(root.join(name)).unwrap();
        let migrated = run(name, &source).source;
        let transformed = project.transform(&root.join(name), &migrated);
        let errors: Vec<&str> = transformed
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.severity == kirana_diagnostics::Severity::Error)
            .map(|diagnostic| diagnostic.message.as_str())
            .collect();
        assert!(errors.is_empty(), "{name}: {errors:?}\n{migrated}");
    }
}

/// A file that imports none of the libraries, or does not parse, is left as it is.
#[test]
fn other_files_are_left_alone() {
    let source = "import { css } from \"@kirana-style/core\"\nconst a = css({})\n";
    let migration = run("a.tsx", source);
    assert_eq!(migration.source, source);
    assert!(migration.notes.is_empty());

    let broken = run("a.tsx", "import styled from \"styled-components\"\nconst = =\n");
    assert!(!broken.changed("import styled from \"styled-components\"\nconst = =\n"));
    assert!(broken.notes[0].message.contains("does not parse"), "{:?}", broken.notes);
}

/// A `.ts` file that gains a component is renamed `.tsx`; one that only gains handles is not, nor is
/// a JavaScript file, whose component is written without types.
#[test]
fn files_holding_a_component_become_tsx() {
    let component = "import styled from \"styled-components\"\nexport const A = styled.div`color: red;`\n";
    assert_eq!(run("a.ts", component).rename.as_deref(), Some("a.tsx"));
    let handle = "import { css } from \"styled-components\"\nexport const a = css`color: red;`\n";
    assert_eq!(run("a.ts", handle).rename, None);
    let javascript = run("a.jsx", component);
    assert_eq!(javascript.rename, None);
    assert!(
        javascript.source.contains("export const A = ({ sx, ...props }) => <div {...props} sx={[aStyle, sx]} />"),
        "{}",
        javascript.source
    );
    assert!(javascript.source.contains("import { css } from \"@kirana-style/core\"\n"), "{}", javascript.source);
}

/// What styled-components and Emotion call a component, in each spelling.
#[test]
fn every_spelling_of_a_styled_component() {
    let out = rewritten(
        "import styled from \"@emotion/styled\"\nimport { Menu } from \"@ui/menu\"\nimport { Local } from \"./local\"\nconst A = styled(\"span\")`color: red;`\nconst B = styled(Menu.Item)`color: red;`\nconst C = styled(Local).attrs({ type: \"button\", tabIndex: 0, 'data-x': \"a\\\"b\" })({ color: \"red\" })\nexport default styled.p`color: red;`\n",
    );
    assert!(out.contains("const A = ({ sx, ...props }: ComponentProps<\"span\"> & { sx?: Sx }) => <span {...props} sx={[aStyle, sx]} />"), "{out}");
    assert!(out.contains("<Menu.Item {...props} {...styleProps(bStyle, sx)} />"), "{out}");
    assert!(
        out.contains("<Local {...props} type=\"button\" tabIndex={0} data-x={\"a\\\"b\"} sx={[cStyle, sx]} />"),
        "{out}"
    );
    assert!(out.contains("const styledStyle = css({"), "{out}");
    assert!(out.contains("export default ({ sx, ...props }: ComponentProps<\"p\"> & { sx?: Sx }) => <p {...props} sx={[styledStyle, sx]} />"), "{out}");
    assert!(out.contains("props as styleProps"), "{out}");

    // An empty style applies the caller's `sx` alone; a name already bound is not reused.
    let out = rewritten(
        "import styled from \"styled-components\"\nconst aStyle = 1\nconst A = styled.div``\nconst B = styled.div`color: red;`\nconst b = 1\nconst bStyle = 2\n",
    );
    assert!(out.contains("<div {...props} sx={sx} />"), "{out}");
    assert!(out.contains("const bStyle2 = css({"), "{out}");
    // `styled` imported by name (styled-components 6).
    assert!(
        rewritten("import { styled } from \"styled-components\"\nconst A = styled.div`color: red;`\n")
            .contains("aStyle")
    );
}

/// What a styled component is left as, with the reason.
#[test]
fn unsupported_definitions_stay_with_their_import() {
    let source = "import styled, { ThemeProvider } from \"styled-components\"\nconst A = styled.div.withConfig({ shouldForwardProp: () => true })`color: red;`\nconst B = styled.div.attrs((p) => ({ x: p.y }))`color: red;`\nconst C = styled(\"div\", { label: \"c\" })`color: red;`\nconst D = styled.div.attrs({ ...rest })`color: red;`\nconst E = styled.div.attrs({ [key]: 1 })`color: red;`\nconst F = styled.div(() => { return {} })\nconst G = styled.div((p) => p.style)\nconst H = styled.div\nconst I = styled()`color: red;`\nconst J = styled.div(\"color: red\")\nconst K = styled.div({ color: \"red\" }, { margin: 0 })\n";
    let migration = run("input.tsx", source);
    let messages: Vec<&str> = migration.notes.iter().map(|note| note.message.as_str()).collect();
    assert!(
        migration.source.starts_with("import styled, { ThemeProvider } from \"styled-components\"\n"),
        "{}",
        migration.source
    );
    for expected in [
        "`.withConfig()` on a styled component",
        "`.attrs()` on a styled component",
        "styled()'s options on a styled component",
        "a style function that has a body",
        "a style function that does not return an object",
        "`ThemeProvider` from styled-components stays: a theme is tokens",
    ] {
        assert!(messages.iter().any(|message| message.contains(expected)), "{expected}: {messages:#?}");
    }
    assert_eq!(messages.iter().filter(|message| message.contains("`.attrs()`")).count(), 3, "{messages:#?}");
}

/// Wraps declarations in a styled component and returns the rewrite and its report.
fn styled(css: &str) -> (String, Vec<String>) {
    let source = format!("import styled, {{ css }} from \"styled-components\"\nconst A = styled.div`\n{css}\n`\n");
    let migration = run("input.tsx", &source);
    (migration.source, migration.notes.into_iter().map(|note| note.message).collect())
}

/// Each selector a nested block may have: a condition, a pseudo-element, a `select` target, or a
/// report.
#[test]
fn selectors_become_conditions_pseudo_elements_and_targets() {
    let (out, notes) = styled(
        ":hover { color: red; }\n&&& { margin: 0; }\n& { padding: 0; }\n&:hover::before, &:focus { content: 'x'; }\n&:after { content: \"\"; }\n::placeholder { color: gray; }\nli { list-style: none; }\n&>span { gap: 1px; }\n@supports (display: grid) { & svg { width: 1px; } }\n&[data-on] { opacity: 1; }",
    );
    assert!(notes.is_empty(), "{notes:?}");
    for expected in [
        "color: { \":hover\": \"red\" }",
        "margin: \"0\"",
        "padding: \"0\"",
        "\"::before\": {\n    content: { \":hover\": \"'x'\" },\n  }",
        "content: { \":focus\": \"'x'\" }",
        "\"::after\": {\n    content: \"\\\"\\\"\",\n  }",
        "\"::placeholder\": {\n    color: \"gray\",",
        "[select.descendant(\"li\")]: {\n    listStyle: \"none\",",
        "[select.child(\"span\")]: {\n    gap: \"1px\",",
        "[select.descendant(\"svg\")]: {\n    width: { \"@supports (display: grid)\": \"1px\" },",
        "opacity: { \"[data-on]\": 1 }",
    ] {
        assert!(out.contains(expected), "{expected}\n{out}");
    }

    let (out, notes) = styled(
        "${Other}:hover & { color: red; }\n@font-face { font-family: x; }\n&:nope { color: red; }\n&.active { color: red; }\n& + & { margin: 0; }\n&:hover svg { color: red; }\n&:hover { & svg { color: red; } }\n& svg { &::after { content: ''; } }\n& svg { & span { color: red; } }\n@media { color: red; }\n& > { color: red; }\n&::before { &:hover::after { color: red; } }\n&:hover:nope::before { color: red; }",
    );
    for expected in [
        "`${Other}:hover &` is a selector built from an interpolation (a component selector): port it by hand",
        "`@font-face` is not a condition Kirana takes",
        "`&:nope` is not a condition Kirana takes",
        "`&.active` styles the element itself by a class or a tag",
        "`& + &` is a selector Kirana takes no condition for",
        "`&:hover svg` is not a condition Kirana takes",
        "`& svg` reaches a descendant only in a state",
        "`&::after` is a pseudo-element inside another block",
        "`& span` is a descendant inside another block",
        "`@media` is not a condition Kirana takes",
        "`& >` is a selector Kirana takes no condition for",
        "`&:hover::after` is a pseudo-element inside another block",
        "`&:hover:nope::before` is not a condition Kirana takes",
    ] {
        assert!(notes.iter().any(|note| note.starts_with(expected)), "{expected}: {notes:#?}");
    }
    assert!(out.contains("/* not migrated: ${Other}:hover & { color: red; } */"), "{out}");
    assert!(out.contains("/* not migrated: & + & { margin: 0; } */"), "{out}");
}

/// Declarations: names, numbers, strings, interpolated values, and what is reported.
#[test]
fn declarations_are_read_as_kirana_writes_them() {
    let (out, notes) = styled(
        "/* a comment */\n// a line comment\n-webkit-line-clamp: 2;\n-ms-flex: 1;\nz-index: 10;\nmargin: -4px;\nline-height: 1.5 /* tall */;\ncontent: \"\\\\201C\";\nbackground: url(data:image/png;base64,AAA=);\ngrid-template-areas:\n  \"a b\"\n  \"c d\";\nborder: 1px solid ${color};\nbox-shadow: ${shadow};\nfont-family: 'A;B', ${font} \\`x\\`;\ncolor: red !important\n",
    );
    for expected in [
        "WebkitLineClamp: 2",
        "msFlex: \"1\"",
        "zIndex: 10",
        "margin: \"-4px\"",
        "lineHeight: 1.5",
        "content: \"\\\"\\\\201C\\\"\"",
        "background: \"url(data:image/png;base64,AAA=)\"",
        "gridTemplateAreas: \"\\\"a b\\\" \\\"c d\\\"\"",
        "border: `1px solid ${color}`",
        "boxShadow: shadow",
        "fontFamily: `'A;B', ${font} \\`x\\``",
        "color: \"red\"",
    ] {
        assert!(out.contains(expected), "{expected}\n{out}");
    }
    assert!(notes.iter().any(|note| note.starts_with("`!important` on color")), "{notes:?}");

    let (out, notes) = styled(
        "--gap: 4px;\nfoo-bar: 1;\n${name}: red;\nwidth: ${function () { return 1 }};\njust text;\nfont size: 1px;\nheight: ${(p) => { return p.h }};\n",
    );
    for expected in [
        "`--gap: 4px;` sets a custom property",
        "`foo-bar: 1;` is not a property Kirana knows",
        "`${name}: red;` has a property named by an interpolation",
        "`width: ${function () { return 1 }};` is a function with a body",
        "`just text` is not a declaration",
        "`font size: 1px` is not a declaration",
        "`height: ${(p) => { return p.h }};` has a body",
    ] {
        assert!(notes.iter().any(|note| note.starts_with(expected)), "{expected}: {notes:#?}");
    }
    assert!(out.contains("/* not migrated: --gap: 4px; */"), "{out}");
}

/// Interpolations between declarations: mixins before the style, functions of props after it, and
/// the order this changes reported.
#[test]
fn interpolations_become_entries_of_sx() {
    let (out, notes) = styled(
        "${base}\n${theme.mixin};\ncolor: red;\n${(p) => p.$on && css`color: blue;`}\n${({ $size, disabled }) => ($size === \"lg\" || disabled) && css`padding: 4px;`}\nmargin: 0;\n${(p) => p.$a ?? null}\n${() => false}\n${(p) => p.$b ? \"\" : base}",
    );
    assert!(out.contains("sx={[base, theme.mixin, aStyle, $on && aOn, ($size === \"lg\" || props.disabled) && aSize, $a ?? null, false, $b ? \"\" : base, sx]}"), "{out}");
    assert!(out.contains("const { $a, $b, $on, $size, ...rest } = props"), "{out}");
    assert!(out.contains("const aOn = css({\n  color: \"blue\",\n})"), "{out}");
    assert!(
        notes.iter().filter(|note| note.starts_with("declarations follow this interpolation")).count() == 2,
        "{notes:#?}"
    );

    let (out, notes) = styled(
        "&:hover { ${base} }\n${1 + 1}\n${(p) => \"color: red;\"}\n${(p) => p.theme.mixin}\n${({ theme }) => theme.x}\n${({ a: b }) => b}\n${({ a = 1 }) => a}\n${({ ...rest }) => rest}\n${([a]) => a}\n${(a, b) => a}\n${(...a) => a}\n${(p) => p.$on && css`${(q) => q.x}`}\n${(p) => new Thing()}\n${(p) => p.$x && 1}",
    );
    for expected in [
        "an interpolation that sits inside a nested block",
        "an interpolation that is not a mixin or a function of props",
        "an interpolation that returns CSS text rather than a css`…` block",
        "an interpolation that reads the theme",
        "an interpolation that renames a prop or gives it a default",
        "an interpolation that collects the rest of the props",
        "an interpolation that takes its props in a pattern",
        "an interpolation that takes more than props",
        "an interpolation that adds a style inside a style",
        "an interpolation that is an expression this codemod does not read",
    ] {
        assert!(notes.iter().any(|note| note.starts_with(expected)), "{expected}: {notes:#?}");
    }
    assert!(out.contains("/* not migrated: ${1 + 1} */"), "{out}");
}

/// A value read from props stays in the component, as a `css()` in its `sx`.
#[test]
fn values_read_from_props_stay_in_the_component() {
    let (out, notes) = styled(
        "width: ${(p) => p.$w}px;\nheight: ${({ h }) => h};\ncolor: ${(p) => p.tone[p.$i] ? f(p, `a${p.x}`, { k: 1, [p.y]: !p.z, h }) : -1};\n&::before { inset: ${(p) => p.$inset}; }\nmargin: ${() => 0};\ntop: ${(p) => size.lg};",
    );
    assert!(notes.is_empty(), "{notes:?}");
    assert!(
        out.contains("css({ width: `${$w}px`, height: props.h, color: props.tone[$i] ? f(props, `a${props.x}`, { k: 1, [props.y]: !props.z, h }) : -1, margin: 0, top: size.lg, \"::before\": { inset: $inset } })"),
        "{out}"
    );

    let (_, notes) = styled(
        "color: ${(p) => p.$on && css`color: red;`};\nwidth: ${(p) => f(...p.a)};\nheight: ${(p) => ({ ...p })};\ntop: ${(p) => p.a`x`};",
    );
    for expected in [
        "holds a css`…` block inside a value",
        "spreads arguments",
        "spreads an object",
        "is an expression this codemod does not read",
    ] {
        assert!(notes.iter().any(|note| note.contains(expected)), "{expected}: {notes:#?}");
    }
    // Outside a styled component there are no props to read.
    let notes = notes_of("import { css } from \"styled-components\"\nconst a = css`width: ${(p) => p.w};`\n");
    assert!(notes.iter().any(|note| note.contains("reads props outside a styled component")), "{notes:?}");
}

fn notes_of(source: &str) -> Vec<String> {
    notes(source)
}

/// Emotion's object styles: nested selectors, numbers, `!important`, a function of props, and
/// what it reports.
#[test]
fn emotion_object_styles() {
    let out = rewritten(
        "import styled from \"@emotion/styled\"\nconst A = styled.div((p) => ({\n  color: \"red !important\",\n  \"margin-top\": 4,\n  opacity: 0.5,\n  \"&:hover\": { color: p.hover },\n  \".x\": { color: \"red\" },\n  \"&.x\": { color: \"red\" },\n  ...p.extra,\n  [key]: 1,\n  \"--x\": 1,\n  bogus: 1,\n}))\n",
    );
    assert!(out.contains("color: \"red\""), "{out}");
    assert!(out.contains("marginTop: \"4px\""), "{out}");
    assert!(out.contains("opacity: 0.5"), "{out}");
    assert!(out.contains("css({ color: { \":hover\": props.hover } })"), "{out}");
    assert!(out.contains("[select.descendant(\".x\")]"), "{out}");
    for comment in ["\"&.x\": { color: \"red\" }", "...p.extra", "[key]: 1", "\"--x\": 1", "bogus: 1"] {
        assert!(out.contains(&format!("/* not migrated: {comment} */")), "{comment}\n{out}");
    }
}

/// `css` and `keyframes` outside a styled component, from either library.
#[test]
fn handles_and_keyframes() {
    let out = rewritten(
        "import { css, keyframes } from \"@emotion/react\"\nconst a = css`color: red; ${b}`\nconst c = css(a, { color: \"blue\" }, on ? { margin: 0 } : null, (({ padding: 1 })))\nconst d = css()\nconst e = keyframes`\n  0%, 50% { opacity: 0; }\n  to { opacity: 1; }\n  color: red;\n  ${x}\n  just text\n`\nconst f = keyframes({ from: { opacity: 0 }, to: 1, \"50%\": { opacity: 0.5 } })\nconst g = keyframes(frames)\n",
    );
    assert!(out.contains("const a = css({\n  color: \"red\",\n  /* not migrated: ${b} */\n})"), "{out}");
    assert!(out.contains("const c = [a, css({\n  color: \"blue\",\n}), on ? css({\n  margin: 0,\n}) : null, ((css({\n  padding: \"1px\",\n})))]"), "{out}");
    assert!(out.contains("const d = []"), "{out}");
    assert!(
        out.contains("\"0%, 50%\": {\n    opacity: 0,\n  },\n  to: {\n    opacity: 1,\n  },\n  /* not migrated: color: red; */\n  /* not migrated: ${x} */\n  /* not migrated: just text */\n})"),
        "{out}"
    );
    assert!(
        out.contains(
            "const f = keyframes({\n  from: {\n    opacity: 0,\n  },\n  \"50%\": {\n    opacity: 0.5,\n  },\n})"
        ),
        "{out}"
    );
    assert!(out.contains("const g = keyframes(frames)"), "{out}");
    assert!(
        notes("import { keyframes } from \"styled-components\"\nconst e = keyframes`color: red;`\n")
            .iter()
            .any(|note| note == "keyframes hold frames only: port this by hand")
    );
}

/// Emotion's `css` prop and `className={css…}` become `sx`, or compiled props on a component from
/// an installed package; `as` on a migrated component is reported.
#[test]
fn the_css_prop_and_class_names() {
    let migration = run(
        "input.tsx",
        "/** @jsxImportSource @emotion/react */\n/** @jsx jsx */\n/* a comment */\nimport { css } from \"@emotion/react\"\nimport { cx } from \"@emotion/css\"\nimport styled from \"@emotion/styled\"\nimport { Button } from \"@ui/button\"\nimport * as UI from \"@ui/all\"\nconst Box = styled.div({ color: \"red\" })\nconst c = cx(a, b)\nexport const X = () => (\n  <>\n    <div css={{ color: \"red\" }} />\n    <Button css={[a, { margin: 0 }]} />\n    <UI.Item css={a} />\n    <this.Item css={a} />\n    <ns:el css={a} />\n    <div css={(theme) => ({ color: theme.c })} />\n    <div css />\n    <div className={css`color: red;`} />\n    <Button className={css({ color: \"red\" })} />\n    <div className={cx(a, on && b)} />\n    <Button className={cx(a)} />\n    <div className={cx()} />\n    <div className=\"plain\" />\n    <div className={other(a)} />\n    <div css={{ color: f(1), content: t`x` }} />\n    <div {...rest} xlink:href=\"#a\" />\n    <Button as=\"span\" />\n    <Box as=\"span\" />\n    <div as=\"span\" />\n    <UI.Item as=\"span\" />\n  </>\n)\n",
    );
    let out = &migration.source;
    assert!(!out.contains("@jsxImportSource") && !out.contains("@jsx jsx") && out.contains("/* a comment */"), "{out}");
    for expected in [
        "import { css, cx, props as styleProps, type Sx } from \"@kirana-style/core\"",
        "const c = cx(a, b)",
        "<div sx={css({\n      color: \"red\",\n    })} />",
        "<Button {...styleProps([a, css({\n      margin: 0,\n    })])} />",
        "<UI.Item {...styleProps(a)} />",
        "<this.Item sx={a} />",
        "<ns:el sx={a} />",
        "<div css={(theme) => ({ color: theme.c })} />",
        "<div css />",
        "<div sx={css({\n      color: \"red\",\n    })} />",
        "<Button {...styleProps(css({\n      color: \"red\",\n    }))} />",
        "<div sx={[a, on && b]} />",
        "<Button {...styleProps(a)} />",
        "<div sx={[]} />",
        "<div className=\"plain\" />",
        "<div className={other(a)} />",
    ] {
        assert!(out.contains(expected), "{expected}\n{out}");
    }
    let messages: Vec<&str> = migration.notes.iter().map(|note| note.message.as_str()).collect();
    assert!(messages.contains(&"a `css` prop that reads the theme: port it by hand"), "{messages:#?}");
    assert!(messages.iter().any(|message| message.starts_with("`as` on Box")), "{messages:#?}");
    assert_eq!(messages.iter().filter(|message| message.starts_with("`as` on")).count(), 1, "{messages:#?}");
}

/// What is left of each library's imports, and the advice for the names Kirana has no counterpart
/// for.
#[test]
fn imports_keep_what_stays() {
    let migration = run(
        "input.tsx",
        "import styled, { css, createGlobalStyle, useTheme as theme } from \"styled-components\"\nimport { Global, ClassNames } from \"@emotion/react\"\nimport type { Theme } from \"@emotion/react\"\nimport * as emotion from \"@emotion/css\"\nconst a = css`color: red;`\n",
    );
    let out = &migration.source;
    assert!(out.starts_with("import { css } from \"@kirana-style/core\"\nimport { createGlobalStyle, useTheme as theme } from \"styled-components\"\nimport { Global, ClassNames } from \"@emotion/react\"\nimport type { Theme } from \"@emotion/react\"\nimport * as emotion from \"@emotion/css\"\n"), "{out}");
    let messages: Vec<&str> = migration.notes.iter().map(|note| note.message.as_str()).collect();
    for expected in [
        "`createGlobalStyle` from styled-components stays: global styles go in a stylesheet",
        "`theme` from styled-components stays: Kirana has no counterpart",
        "`Global` from @emotion/react stays: global styles go in a stylesheet",
        "`ClassNames` from @emotion/react stays: Kirana has no counterpart",
        "a namespace import of @emotion/css: port its uses by hand",
    ] {
        assert!(messages.iter().any(|message| message.starts_with(expected)), "{expected}: {messages:#?}");
    }
    // `ThemeProvider` and `useTheme` under their own names get the theme's advice.
    let messages = notes("import { ThemeProvider } from \"@emotion/react\"\nconst a = 1\n");
    assert!(messages[0].contains("a theme is tokens"), "{messages:?}");
    // A library imported only for its side effects is removed with its line.
    assert_eq!(
        rewritten("import \"styled-components\"\nimport { css } from \"@emotion/css\"\nconst a = css`color: red;`\n"),
        "import { css } from \"@kirana-style/core\"\nconst a = css({\n  color: \"red\",\n})\n"
    );
}

/// The parser's corners: a placeholder before a closing brace, a stray brace, an unclosed comment.
#[test]
fn the_template_parser() {
    let (out, _) = styled("${base}}\ncolor: red;;\n}\n&:hover { color: blue }\npadding: 1px /* open");
    assert!(out.contains("sx={[base, aStyle, sx]}"), "{out}");
    assert!(out.contains("color: { base: \"red\", \":hover\": \"blue\" }"), "{out}");
    assert!(out.contains("padding: \"1px\""), "{out}");
    let (out, _) = styled("color: red // a comment that runs to the end");
    assert!(out.contains("color: \"red // a comment that runs to the end\""), "{out}");
    let (out, _) = styled("&:hover { color: blue");
    assert!(out.contains("color: { \":hover\": \"blue\" }"), "{out}");
    let (out, _) = styled("// only a comment");
    assert!(out.contains("<div {...props} sx={sx} />"), "{out}");
}

/// A namespace import first takes Kirana's import's place; a file that ends up with no Kirana name
/// imports nothing from it.
#[test]
fn where_kirana_is_imported() {
    let out = rewritten(
        "import * as sc from \"styled-components\"\nimport { css } from \"@emotion/css\"\nconst a = css`color: red;`\n",
    );
    assert!(
        out.starts_with(
            "import { css } from \"@kirana-style/core\"\nimport * as sc from \"styled-components\"\nconst a"
        ),
        "{out}"
    );
    let out = rewritten("import { cx } from \"@emotion/css\"\nexport const A = () => <div className={cx(a, b)} />\n");
    assert_eq!(out, "\nexport const A = () => <div sx={[a, b]} />\n");
}

/// Expressions that only look like a styled component, and statements with nothing to name.
#[test]
fn lookalikes_are_left_alone() {
    let source = "import styled from \"styled-components\"\nlet later\nconst { a } = b\nconst c = a.b.c`x`\nconst d = f()`x`\nconst e = a.b()`x`\nconst f = g()(1)\nconst h = styled.div.attrs(fn)`color: red;`\n";
    let migration = run("input.tsx", source);
    assert!(migration.source.starts_with("import styled from \"styled-components\"\nlet later\nconst { a } = b\nconst c = a.b.c`x`\nconst d = f()`x`\nconst e = a.b()`x`\nconst f = g()(1)\n"), "{}", migration.source);
    assert_eq!(migration.notes.len(), 1, "{:?}", migration.notes);
}

/// `styled` stays imported, alone, while a component the codemod left still uses it.
#[test]
fn styled_stays_for_what_is_left() {
    let out = rewritten(
        "import styled from \"styled-components\"\nconst A = styled.div.withConfig({})`color: red;`\nconst B = styled.div`color: red;`\n",
    );
    assert!(
        out.starts_with("import { css, type Sx } from \"@kirana-style/core\"\nimport type { ComponentProps } from \"react\"\nimport styled from \"styled-components\"\n"),
        "{out}"
    );
}
