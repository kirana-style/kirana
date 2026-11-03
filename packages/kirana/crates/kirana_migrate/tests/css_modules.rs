//! `kirana-style migrate css-modules` (D-121): the fixture project's modules and the script importing
//! them rewritten, the rewrite compiled, and each construct the codemod reads or reports.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use kirana_migrate::Migration;
use kirana_migrate::css_modules::{Modules, convert, is_module, migrate};
use kirana_migrate::tailwind::Environment;
use kirana_project::Project;
use kirana_shared::OsFs;

fn root() -> PathBuf {
    fs::canonicalize(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/migrate-css-modules")).unwrap()
}

/// Resolves `@/x` to `/app/x`, as a project's alias would.
struct Aliases;

impl Environment for Aliases {
    fn export(&self, _: &str, _: &str) -> kirana_ir::Value {
        unreachable!("the codemod evaluates no import")
    }

    fn is_external(&self, _: &str) -> bool {
        unreachable!("the codemod asks about no package")
    }

    fn specifier(&self, _: &Path) -> String {
        unreachable!("the codemod writes no import of another file")
    }

    fn resolve(&self, specifier: &str) -> Option<PathBuf> {
        specifier.strip_prefix("@/").map(|rest| Path::new("/app").join(rest))
    }

    fn token(&self, _: &str) -> Option<Arc<kirana_ir::TokenDef>> {
        unreachable!("the codemod reads no token")
    }
}

/// Every module of `files` converted, and the scripts migrated against them.
fn run(directory: &Path, files: &[(&str, &str)]) -> Vec<(String, Migration)> {
    let mut modules = Modules::new();
    let mut out = Vec::new();
    for (name, source) in files.iter().filter(|(name, _)| is_module(Path::new(name))) {
        let (migration, module) = convert(&directory.join(name), source, true);
        modules.insert(directory.join(name), module);
        out.push(((*name).to_owned(), migration));
    }
    for (name, source) in files.iter().filter(|(name, _)| !is_module(Path::new(name))) {
        out.push(((*name).to_owned(), migrate(&directory.join(name), source, &modules, &Aliases)));
    }
    out
}

/// One module converted.
fn module(css: &str) -> Migration {
    convert(Path::new("/app/a.module.css"), css, true).0
}

fn notes(migration: &Migration) -> Vec<String> {
    migration.notes.iter().map(|note| note.message.clone()).collect()
}

/// A script beside `a.module.css` (whose CSS is `css`), migrated.
fn script(css: &str, source: &str) -> Migration {
    run(Path::new("/app"), &[("a.module.css", css), ("a.tsx", source)]).remove(1).1
}

#[test]
fn the_fixture_project() {
    let root = root();
    let files: Vec<(String, String)> = ["base.module.css", "Button.module.css", "Button.tsx"]
        .iter()
        .map(|name| ((*name).to_owned(), fs::read_to_string(root.join(name)).unwrap()))
        .collect();
    let borrowed: Vec<(&str, &str)> = files.iter().map(|(name, source)| (name.as_str(), source.as_str())).collect();
    for (name, migration) in run(&root, &borrowed) {
        insta::assert_snapshot!(format!("css-modules-{name}"), migration.source);
        insta::assert_debug_snapshot!(format!("css-modules-{name}-notes"), migration.notes);
    }
}

/// The rewrite compiles: the fixture written out with its modules of handles, then each file
/// compiled with no error.
#[test]
fn the_rewrite_compiles() {
    let root = root();
    let target = std::env::temp_dir().join(format!("kirana-css-modules-{}", std::process::id()));
    fs::create_dir_all(&target).unwrap();
    for name in ["package.json", "kirana.json", "Icon.tsx"] {
        fs::copy(root.join(name), target.join(name)).unwrap();
    }
    let files: Vec<(String, String)> = ["base.module.css", "Button.module.css", "Button.tsx"]
        .iter()
        .map(|name| ((*name).to_owned(), fs::read_to_string(root.join(name)).unwrap()))
        .collect();
    let borrowed: Vec<(&str, &str)> = files.iter().map(|(name, source)| (name.as_str(), source.as_str())).collect();
    let mut written = Vec::new();
    for (name, migration) in run(&target, &borrowed) {
        let name = migration.rename.clone().unwrap_or(name);
        fs::write(target.join(&name), &migration.source).unwrap();
        written.push(name);
    }
    let config = serde_json::json!({ "root": target.to_string_lossy() });
    let project = Project::new(&config.to_string(), Arc::new(OsFs)).unwrap();
    for name in &written {
        let source = fs::read_to_string(target.join(name)).unwrap();
        let transformed = project.transform(&target.join(name), &source);
        let errors: Vec<&str> = transformed
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.severity == kirana_diagnostics::Severity::Error)
            .map(|diagnostic| diagnostic.message.as_str())
            .collect();
        assert!(errors.is_empty(), "{name}: {errors:?}\n{source}");
    }
    fs::remove_dir_all(target).unwrap();
}

/// Each selector a rule may have: the class with conditions, a pseudo-element, a `select` target,
/// nesting, or a report.
#[test]
fn selectors() {
    let migration = module(
        ".a:hover:not(:first-child), .a[data-on] { color: red; }\n.a:before { content: 'x'; }\n.a::after { content: 'y'; }\n.a svg { width: 1px; }\n.a > li { margin: 0; }\n.n { color: red; &:focus { color: blue; } span { gap: 1px; } }\n.p, .q { &:hover { color: green; } }\n",
    );
    let out = &migration.source;
    assert!(notes(&migration).is_empty(), "{:?}", migration.notes);
    for expected in [
        "color: { \":hover:not(:first-child)\": \"red\", \"[data-on]\": \"red\" }",
        "\"::before\": {\n    content: \"'x'\",\n  }",
        "\"::after\": {\n    content: \"'y'\",\n  }",
        "[select.descendant(\"svg\")]: {\n    width: \"1px\",\n  }",
        "[select.child(\"li\")]: {\n    margin: \"0\",\n  }",
        "export const n = css({\n  color: { base: \"red\", \":focus\": \"blue\" },\n  [select.descendant(\"span\")]",
        "export const p = css({\n  color: { \":hover\": \"green\" },\n})",
        "export const q = css({\n  color: { \":hover\": \"green\" },\n})",
    ] {
        assert!(out.contains(expected), "{expected}\n{out}");
    }

    let migration = module(
        "h1 { color: red; }\n#x { color: red; }\n.a.b { color: red; }\n.a:nope { color: red; }\n.a .b { color: red; }\n.a svg::before { color: red; }\n.a:hover svg { color: red; }\n.a + .c { color: red; }\n.a > { color: red; }\n.a span b { color: red; }\n:global(.dark) .a { color: red; }\n:local(.a) { color: red; }\n.a::before span { color: red; }\n",
    );
    let messages = notes(&migration);
    for expected in [
        "`h1 { … }` styles an element by its tag or id",
        "`#x { … }` styles an element by its tag or id",
        "`.a.b { … }` joins two classes on one element",
        "`.a:nope { … }` is not a condition Kirana takes",
        "`.a .b { … }` styles another class of the module inside this one",
        "`.a svg::before { … }` styles a pseudo-element of a descendant",
        "`.a:hover svg { … }` reaches a descendant only in a state",
        "`.a + .c { … }` is a selector Kirana takes no condition for",
        "`.a > { … }` is a selector Kirana takes no condition for",
        "`.a span b { … }` is a selector Kirana takes no condition for",
        "`:global(.dark) .a { … }` uses `:global()`",
        "`:local(.a) { … }` uses `:local()`",
        "`.a::before span { … }` is a selector Kirana takes no condition for",
    ] {
        assert!(messages.iter().any(|message| message.starts_with(expected)), "{expected}: {messages:#?}");
    }
    assert!(migration.source.contains("/* not migrated: h1 { … } */"), "{}", migration.source);
}

/// At-rules: conditions, keyframes, and what stays global.
#[test]
fn at_rules_and_keyframes() {
    let migration = module(
        "@media (min-width: 40rem) { .a { color: red; } }\n@supports (display: grid) { .a { display: grid; } }\n@-webkit-keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; bogus: 1; .x { color: red; } junk; } color: red; }\n@keyframes other { from { opacity: 0; \u{FDD0}0\u{FDD1}\n } \u{FDD0}0\u{FDD1}\n junk2; }\n.a { animation: pulse 1s, fade 2s; animation-name: pulse; transition: `x` 1s; }\n@font-face { font-family: X; }\n@import url(\"x.css\");\n@media (min-width: 1px) { @keyframes inner { from { opacity: 0; } } }\n.b { @keyframes nested { from { opacity: 0; } } }\ncolor: red;\n\u{FDD0}0\u{FDD1}\nnothing here\n",
    );
    let out = &migration.source;
    for expected in [
        "color: { \"@media (min-width: 40rem)\": \"red\" }",
        "display: { \"@supports (display: grid)\": \"grid\" }",
        "export const pulse = keyframes({\n  \"0%, 100%\": {\n    opacity: 1,\n  },\n  \"50%\": {\n    opacity: 0.5,\n  },\n})",
        "animation: `${pulse} 1s, fade 2s`",
        "animationName: `${pulse}`",
        "transition: \"`x` 1s\"",
    ] {
        assert!(out.contains(expected), "{expected}\n{out}");
    }
    let messages = notes(&migration);
    for expected in [
        "`bogus: 1;` is not a property Kirana knows",
        "`color: red; }` is not a frame",
        "`.x { color: red; }` is a block inside a frame",
        "`junk; } color: red; }` is not a declaration",
        "`junk2; }` is not a frame",
        "`@font-face { font-family: X; }` is not a condition Kirana takes",
        "`@import url(\"x.css\");` is not a rule",
        "`@keyframes inner { from { opacity: 0; } }` is a @keyframes inside another rule",
        "`@keyframes nested { from { opacity: 0; } }` is a @keyframes inside another rule",
        "`color: red;` is outside any rule",
        "`nothing here` is not a rule",
    ] {
        assert!(messages.iter().any(|message| message.starts_with(expected)), "{expected}: {messages:#?}");
    }
    assert_eq!(
        messages.iter().filter(|message| message.ends_with("is not a rule: port it by hand")).count(),
        3,
        "{messages:#?}"
    );
}

/// Values: numbers, `!important`, custom properties, unknown properties, relative URLs.
#[test]
fn values() {
    let migration = module(
        ".a { z-index: 2; opacity: .5; color: red !important; --gap: 4px; bogus: 1; background: url(./a.png); mask: url(data:image/png;base64,AA); cursor: url(https://x.dev/c.png), auto; animation: x 1s; }\n[data-x] { color: red; }\n.b:not(:nth-child(2)) { color: red; }\n",
    );
    let out = &migration.source;
    for expected in [
        "animation: \"x 1s\"",
        "color: { \":not(:nth-child(2))\": \"red\" }",
        "zIndex: 2",
        "opacity: 0.5",
        "color: \"red\"",
        "background: \"url(./a.png)\"",
        "/* not migrated: --gap: 4px; */",
        "/* not migrated: bogus: 1; */",
    ] {
        assert!(out.contains(expected), "{expected}\n{out}");
    }
    let messages = notes(&migration);
    for expected in [
        "`[data-x] { … }` names no class of the module",
        "`!important` on color",
        "`--gap: 4px;` sets a custom property",
        "a relative url() in background",
    ] {
        assert!(messages.iter().any(|message| message.starts_with(expected)), "{expected}: {messages:#?}");
    }
    assert_eq!(messages.iter().filter(|message| message.starts_with("a relative url()")).count(), 1, "{messages:#?}");
}

/// `composes`, from this file, another module, a global class or another file; a class with a
/// reserved name; the order the handles must be declared in.
#[test]
fn composition() {
    let migration = module(
        ".b { composes: a c; color: red; }\n.a { color: blue; }\n.x1 { composes: x2; }\n.x2 { composes: x1; }\n.c { composes: x y from \"./other.module.css\"; }\n.d { composes: g from global; }\n.e { composes: h from \"./plain.css\"; }\n.f:hover { composes: a; }\n.default { color: red; }\n.only { composes: c; }\n",
    );
    let out = &migration.source;
    assert!(
        out.starts_with("import { css } from \"@kirana-style/core\"\nimport { x, y } from \"./other.styles\"\n"),
        "{out}"
    );
    for expected in [
        "export const c = css(x, y)",
        "export const b = css(a, c, {",
        "export const a = css({\n  color: \"blue\",\n})\n\nexport const c = css(x, y)\n\nexport const b = css(a, c, {",
        "export const defaultStyle = css({",
        "export const only = css(c)",
        "export const d = css({})",
    ] {
        assert!(out.contains(expected), "{expected}\n{out}");
    }
    let messages = notes(&migration);
    for expected in [
        "`composes: g from global;` composes a global class",
        "`composes: h from \"./plain.css\";` composes from a file that is not a CSS module",
        "`composes: a;` is not in a rule of the class alone",
    ] {
        assert!(messages.iter().any(|message| message.starts_with(expected)), "{expected}: {messages:#?}");
    }
    // A module with only global rules imports nothing; a JavaScript project gets `.js`.
    let (migration, module) = convert(Path::new("/app/g.module.css"), "body { margin: 0; }\n", false);
    assert!(migration.source.starts_with("\n/* not migrated: body { … } */"), "{}", migration.source);
    assert_eq!(migration.rename.as_deref(), Some("g.styles.js"));
    assert!(module.classes.is_empty());
}

const CSS: &str = ".root { color: red; }\n.open { color: blue; }\n.is-active { gap: 1px; }\n.wide { width: 1px; }\n";

/// The imports of a module, in every spelling, read its module of handles.
#[test]
fn imports() {
    let out = script(CSS, "import styles from \"./a.module.css\"\nconst a = styles.root\n").source;
    assert!(
        out.starts_with(
            "import { props as styleProps } from \"@kirana-style/core\"\nimport * as styles from \"./a.styles\"\n"
        ),
        "{out}"
    );
    let out = script(CSS, "import * as s from \"./a.module.css\"\nimport { root, \"is-active\" as active, open as o } from \"./a.module.css\"\nimport x, { wide } from \"./a.module.css\"\nimport { missing } from \"./sub/../a.module.css\"\nexport const v = [s.root, root, active, o, x.wide, wide]\n").source;
    for expected in [
        "import * as s from \"./a.styles\"",
        "import { root, isActive as active, open as o } from \"./a.styles\"",
        "import * as x from \"./a.styles\"\nimport { wide } from \"./a.styles\"",
        "import { missing } from \"./sub/../a.styles\"",
        "styleProps(s.root).className, styleProps(root).className, styleProps(active).className",
    ] {
        assert!(out.contains(expected), "{expected}\n{out}");
    }
    // Through an alias the project resolves; a module not among the files; Sass.
    let migrated = run(Path::new("/app/src"), &[("x.module.css", CSS), ("a.tsx", "import s from \"@/src/x.module.css\"\nimport t from \"./missing.module.css\"\nimport u from \"./a.module.scss\"\nimport v from \"~/x.module.css\"\nconst c = <p className={s.root} />\n")]).remove(1).1;
    assert!(migrated.source.contains("import * as s from \"@/src/x.styles\""), "{}", migrated.source);
    assert!(migrated.source.contains("<p sx={s.root} />"), "{}", migrated.source);
    let messages = notes(&migrated);
    for expected in [
        "./missing.module.css is not among the files migrated",
        "./a.module.scss is not CSS",
        "~/x.module.css is not among the files migrated",
    ] {
        assert!(messages.iter().any(|message| message.starts_with(expected)), "{expected}: {messages:#?}");
    }
    // A file that imports no module, or does not parse.
    let plain = script(CSS, "import x from \"./x.css\"\n");
    assert_eq!(plain.source, "import x from \"./x.css\"\n");
    let broken = script(CSS, "const = =\n");
    assert!(notes(&broken)[0].contains("does not parse"));
}

/// `className` with the module's classes: on an element `sx`, beside the plain class names; on a
/// component compiled props.
#[test]
fn class_names() {
    let out = script(
        CSS,
        "import s from \"./a.module.css\"\nimport clsx from \"clsx\"\nimport { cn } from \"./cn\"\nexport const A = ({ on, className }) => (\n  <>\n    <p className={s.root} />\n    <p className={s[\"is-active\"]} />\n    <p className={`x ${s.root} y ${on ? s.open : \"\"} ${className}`} />\n    <p className={clsx(\"x\", s.root, on && s.open, { [s.wide]: on }, className, props.c)} />\n    <p className={cn(s.root, (on && s.open), s.open || null, s.wide ?? undefined, on ? s.open : false)} />\n    <p className={[s.root, on && s.open].join(\" \")} />\n    <Comp className={clsx(\"x\", s.root, className)} />\n    <Comp className={s.root} />\n    <p className={className} />\n    <p className=\"plain\" />\n  </>\n)\n",
    )
    .source;
    for expected in [
        "<p sx={s.root} />",
        "<p sx={s.isActive} />",
        "<p className={[\"x y\", className].filter(Boolean).join(\" \")} sx={[s.root, on ? s.open : null]} />",
        "<p className={[\"x\", className, props.c].filter(Boolean).join(\" \")} sx={[s.root, on && s.open, on && s.wide]} />",
        "<p sx={[s.root, (on && s.open), s.open || null, s.wide ?? undefined, on ? s.open : false]} />",
        "<p sx={[s.root, on && s.open]} />",
        "<Comp {...styleProps(\"x\", s.root, className)} />",
        "<Comp {...styleProps(s.root)} />",
        "<p className={className} />",
        "<p className=\"plain\" />",
    ] {
        assert!(out.contains(expected), "{expected}\n{out}");
    }
    assert!(!out.contains("import clsx"), "{out}");
    assert!(!out.contains("import { cn }"), "{out}");

    // A list this cannot read keeps its class strings, through `styleProps`.
    let out = script(
        CSS,
        "import s from \"./a.module.css\"\nimport clsx from \"clsx\"\nexport const A = ({ on, k }) => (\n  <>\n    <p className={clsx(s.root, { plain: on })} />\n    <p className={clsx(s.root, { [k]: on })} />\n    <p className={clsx(s.root, { ...k })} />\n    <p className={clsx(s.root, { [s.open]: on, x: 1 })} />\n    <p className={clsx(...k, s.root)} />\n    <p className={[...k, s.root].join(\" \")} />\n    <p className={k.join(s.root)} />\n    <p className={on ? s.root : \"plain\"} />\n    <p className={s[k] + s.root} />\n    <p className={f(s.root)} />\n    <p className={`${on ? \"a\" : s.root}`} />\n    <p className={clsx(\"x\" || s.root)} />\n    <p className={clsx(on && f(s.root))} />\n  </>\n)\nconst keep = clsx(\"a\")\nconst all = s\nconst one = s.missing\nconst m = x.clsx(\"a\")\n",
    );
    let messages = notes(&out);
    let out = out.source;
    assert!(out.contains("<p className={clsx(styleProps(s.root).className, { plain: on })} />"), "{out}");
    assert!(out.contains("<p className={on ? styleProps(s.root).className : \"plain\"} />"), "{out}");
    assert!(out.contains("import clsx from \"clsx\""), "{out}");
    for expected in ["`s`, the whole module, is used as a value", "a.module.css has no class `.missing`"] {
        assert!(messages.iter().any(|message| message.starts_with(expected)), "{expected}: {messages:#?}");
    }
}

/// Two classes on one element whose order in the file chose the winner, listed the other way.
#[test]
fn order_is_reported() {
    let migrated = run(
        Path::new("/app"),
        &[
            ("a.module.css", CSS),
            ("b.module.css", ".root { color: green; }\n"),
            ("a.tsx", "import s from \"./a.module.css\"\nimport t from \"./b.module.css\"\nexport const A = () => <p className={`${s.open} ${s.root} ${t.root} ${s.wide}`} />\nexport const B = () => <p className={`${s.root} ${s.open}`} />\n"),
        ],
    )
    .remove(2)
    .1;
    let messages = notes(&migrated);
    assert_eq!(messages.len(), 1, "{messages:#?}");
    assert!(
        messages[0].starts_with("`.open` comes after `.root` in a.module.css, so it won where both set color"),
        "{messages:#?}"
    );
}
