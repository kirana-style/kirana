use std::fs;
use std::path::PathBuf;

fn temp(files: &[(&str, &[u8])]) -> PathBuf {
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let root = std::env::temp_dir().join(format!("kirana-cli-{}-{stamp}", std::process::id()));
    for (name, contents) in files {
        let path = root.join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }
    root
}

fn run(args: &[&str]) -> (i32, String) {
    let mut out = Vec::new();
    let mut all = vec!["kirana".to_owned()];
    all.extend(args.iter().map(|arg| (*arg).to_owned()));
    let code = kirana_cli::run(&all, &mut out);
    (code, String::from_utf8(out).unwrap())
}

const STYLE: &[u8] = b"import { css } from \"@kirana-style/core\"\nexport const box = css({\n  color: { base: \"black\", \":hover\": \"red\" },\n})\n";
const BROKEN: &[u8] = b"import { css } from \"@kirana-style/core\"\nexport const box = css({ colour: \"red\" })\n";

#[test]
fn verbatim_windows_paths_become_plain() {
    use kirana_cli::plain_path;
    assert_eq!(plain_path(PathBuf::from(r"\\?\D:\a\app.tsx")), PathBuf::from(r"D:\a\app.tsx"));
    assert_eq!(plain_path(PathBuf::from(r"\\?\UNC\server\share")), PathBuf::from(r"\\?\UNC\server\share"));
    assert_eq!(plain_path(PathBuf::from("/home/app.tsx")), PathBuf::from("/home/app.tsx"));
}

#[test]
fn a_module_named_through_dot_dot_is_the_module_its_importers_resolve() {
    let root = temp(&[
        ("app/src/a.tsx", b"import { css } from \"@kirana-style/core\"\nimport { space } from \"../../lib/tokens\"\nexport const box = css({ padding: space.x })\n"),
        ("lib/tokens.ts", b"import { defineTokens } from \"@kirana-style/core\"\nexport const space = defineTokens(\"space\", { x: \"1rem\" }, { variable: true })\n"),
    ]);
    let config = format!(r#"{{"root":{:?}}}"#, root.join("app").to_string_lossy());
    let lib = root.join("app/../lib").to_string_lossy().into_owned();
    let src = root.join("app/src").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "check", &src, &lib, "--format", "json"]);
    assert_eq!((code, output.trim()), (0, "[]"));
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn builds_checks_and_traces() {
    let root = temp(&[
        ("src/a.tsx", STYLE),
        ("src/types.d.ts", b"export {}"),
        ("src/readme.md", b"# not a script"),
        ("src/node_modules/dep/index.js", b"export const x = 1"),
        ("src/dist/out.js", b"export const x = 1"),
        ("src/.hidden/x.js", b"export const x = 1"),
    ]);
    let config = format!(r#"{{"root":{:?}}}"#, root.to_string_lossy());
    let src = root.join("src").to_string_lossy().into_owned();
    let out = root.join("out.css").to_string_lossy().into_owned();

    let (code, output) = run(&["--config-json", &config, "build", &src, "--out", &out, "--minify"]);
    assert_eq!(code, 0, "{output}");
    assert!(fs::read_to_string(&out).unwrap().contains("color:black"));
    assert!(output.contains("0 diagnostic(s)"));

    let (code, output) = run(&["--config-json", &config, "check", &src, "--format", "json"]);
    assert_eq!((code, output.trim()), (0, "[]"));

    let file = root.join("src/a.tsx").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "trace", &format!("{file}:3"), "color"]);
    assert_eq!(code, 0, "{output}");
    assert!(output.contains("✓ red"));
    let (code, output) = run(&["--config-json", &config, "trace", &format!("{file}:1"), "maxWidth"]);
    assert_eq!(code, 1);
    assert!(output.contains("no maxWidth declarations"));
    let (code, output) = run(&["--config-json", &config, "trace", "no-line-number", "color"]);
    assert_eq!(code, 2);
    assert!(output.contains("expected <file>:<line>"));
    let (code, output) = run(&["--config-json", &config, "trace", "file.tsx:x", "color"]);
    assert_eq!(code, 2);
    assert!(output.contains("expected <file>:<line>"));
    let (code, _) =
        run(&["--config-json", &config, "trace", &format!("{}:1", root.join("missing.tsx").display()), "color"]);
    assert_eq!(code, 2);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn reports_errors_with_source_excerpts() {
    let root = temp(&[("broken.ts", BROKEN), ("binary.ts", &[0xff, 0xfe, 0x00])]);
    let config = format!(r#"{{"root":{:?}}}"#, root.to_string_lossy());
    let broken = root.join("broken.ts").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "check", &broken]);
    assert_eq!(code, 1);
    assert!(output.contains("error[KRN1201] unknown-property"), "{output}");
    assert!(output.contains("--> broken.ts:2:"), "{output}");
    let binary = root.join("binary.ts").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "check", &binary]);
    assert_eq!(code, 1, "{output}");
    // A file stands where the folder would be created.
    let out = root.join("broken.ts/out.css").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "build", &broken, "--out", &out]);
    assert_eq!(code, 1);
    assert!(output.contains("cannot write"));
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn builds_write_the_class_map() {
    let styles = b"import { css, recipe } from \"@kirana-style/core\"\nexport const card = css({ color: \"red\" })\nexport const pick = recipe({ base: { color: \"red\" }, variants: {} })\nexport const bad = css({ width: 5 })\n";
    let root = temp(&[("styles/app.styles.ts", styles), ("src/a.tsx", STYLE)]);
    let config = format!(
        r#"{{"root":{:?},"classes":{{"modules":["styles"],"out":"public/kirana/classes.json"}}}}"#,
        root.to_string_lossy()
    );
    let paths = [root.join("src").to_string_lossy().into_owned(), root.join("styles").to_string_lossy().into_owned()];
    let out = root.join("public/kirana/app.css").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "build", &paths[0], &paths[1], "--out", &out]);
    assert_eq!(code, 1, "{output}");
    // Reported once, though the module is both a path and a class-map module.
    assert_eq!(output.matches("classes-not-static").count(), 1, "{output}");
    assert_eq!(output.matches("unitless-length").count(), 1, "{output}");
    let map: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(root.join("public/kirana/classes.json")).unwrap()).unwrap();
    assert!(map["classes"]["card"].as_str().unwrap().starts_with('k'));
    assert!(fs::read_to_string(&out).unwrap().contains("color: red"));
    // The class map cannot be written where a file stands in for its folder.
    fs::write(root.join("public/kirana/blocked"), "").unwrap();
    let blocked = config.replace("public/kirana/classes.json", "public/kirana/blocked/classes.json");
    let (code, output) = run(&["--config-json", &blocked, "build", &paths[0], "--out", &out]);
    assert_eq!(code, 1);
    assert!(output.contains("cannot write"), "{output}");
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn the_binary_runs_the_same_command_line() {
    let output = std::process::Command::new(env!("CARGO_BIN_EXE_kirana")).arg("--version").output().unwrap();
    assert!(output.status.success());
    assert!(String::from_utf8_lossy(&output.stdout).contains("kirana"));
}

#[test]
fn rejects_bad_invocations() {
    let (code, output) = run(&["--bogus"]);
    assert_eq!(code, 2);
    assert!(output.contains("unexpected argument"));
    let (code, output) = run(&["--version"]);
    assert_eq!(code, 0);
    assert!(output.contains("kirana"));
    let (code, output) = run(&["--config-json", "{", "check"]);
    assert_eq!(code, 2);
    assert!(output.contains("invalid --config-json"));
    let (code, output) = run(&["--config-json", r#"{"names":{"prefix":"X"}}"#, "check"]);
    assert_eq!(code, 2);
    assert!(output.contains("invalid-config"));
    // Without a root in the configuration, the working directory is the root.
    let (code, output) = run(&["check"]);
    assert_eq!(code, 0, "{output}");
}

/// `kirana migrate stylex`: shows the rewrite, then applies it.
#[test]
fn migrates_stylex_sources() {
    let source = b"import * as stylex from \"@stylexjs/stylex\"\nexport const t = stylex.defineVars({ a: \"1px\" })\nconst el = <div {...stylex.props(stylex.defaultMarker())} />\n";
    let root = temp(&[("src/tokens.stylex.tsx", source), ("src/readme.md", b"# not a source")]);
    let src = root.join("src").to_string_lossy().into_owned();

    // Without `--write` the file is untouched and the diff and report are printed.
    let (code, output) = run(&["migrate", "stylex", &src]);
    assert_eq!(code, 0, "{output}");
    assert!(output.contains("- export const t = stylex.defineVars"), "{output}");
    assert!(output.contains("+ export const t = defineTokens(\"t\", { a: \"1px\" }, { variable: true })"), "{output}");
    assert!(output.contains("1 file(s), 1 to rewrite, 1 report item(s)"), "{output}");
    assert!(output.contains("default marker"), "{output}");
    assert_eq!(fs::read(root.join("src/tokens.stylex.tsx")).unwrap(), source);

    // With it, the file is rewritten and the report is written where asked.
    let report = root.join("report.txt").to_string_lossy().into_owned();
    let (code, output) = run(&["migrate", "stylex", &src, "--write", "--report", &report]);
    assert_eq!(code, 0, "{output}");
    assert!(output.contains("1 rewritten"), "{output}");
    let rewritten = fs::read_to_string(root.join("src/tokens.stylex.tsx")).unwrap();
    assert!(rewritten.contains("defineTokens"), "{rewritten}");
    assert!(fs::read_to_string(&report).unwrap().contains("default marker"));

    // A second run has nothing left to do.
    let (_, output) = run(&["migrate", "stylex", &src]);
    assert!(output.contains("1 file(s), 0 to rewrite"), "{output}");
    fs::remove_dir_all(root).unwrap();
}

/// `kirana migrate tailwind`: needs a grammar, reads the CSS's custom variants, rewrites.
#[test]
fn migrates_tailwind_sources() {
    let root = temp(&[
        ("scales.ts", b"import { defineTokens } from \"@kirana-style/core\"\nexport const space = defineTokens(\"space\", { \"2\": \"0.5rem\" })\n"),
        ("src/a.tsx", b"import { Thing } from \"./thing\"\nexport const A = () => <p className=\"p-2 data-open:block no-scrollbar\" />\nexport const B = () => <Thing className=\"p-2\" />\n"),
        ("src/theme.css", b"@custom-variant data-open (&[data-state=open]);\n@utility no-scrollbar {\n  scrollbar-width: none;\n}\n@utility {\n}\n"),
    ]);
    let src = root.join("src").to_string_lossy().into_owned();

    let (code, output) = run(&["migrate", "tailwind", &src]);
    assert_eq!(code, 2, "{output}");
    assert!(output.contains("needs a utility grammar"), "{output}");

    let config = serde_json::json!({
        "root": root.to_string_lossy(),
        "utilities": {
            "scales": { "space": [{ "module": "./scales.ts", "export": "space" }] },
            "utilities": { "p": [{ "properties": ["padding"], "scale": "space" }] }
        }
    })
    .to_string();
    let (code, output) = run(&["--config-json", &config, "migrate", "tailwind", &src]);
    assert_eq!(code, 0, "{output}");
    assert!(output.contains("+ const styles = {"), "{output}");
    assert!(output.contains("`data-open:` is a custom variant in your CSS"), "{output}");
    assert!(output.contains("`no-scrollbar` is a custom utility in your CSS"), "{output}");

    let (code, output) = run(&["--config-json", &config, "migrate", "tailwind", &src, "--write"]);
    assert_eq!(code, 0, "{output}");
    let rewritten = fs::read_to_string(root.join("src/a.tsx")).unwrap();
    assert!(rewritten.contains("import { space } from \"../scales\""), "{rewritten}");
    assert!(rewritten.contains("<p sx={styles.aP} />"), "{rewritten}");
    fs::remove_dir_all(root).unwrap();
}

/// A relation anchored in a package is imported by the files that read it, the way each would
/// import any module: through the package's `exports`, or relatively.
#[test]
fn migrated_relations_are_imported_where_they_are_read() {
    let root = temp(&[
        ("scales.ts", b"import { defineTokens } from \"@kirana-style/core\"\nexport const space = defineTokens(\"space\", { \"2\": \"0.5rem\" })\n"),
        ("ui/package.json", br#"{"name":"@w/ui","exports":{".":{"import":"./src/index.ts"},"./x":"./src/x.tsx","./components/*":"./src/components/*.tsx"}}"#),
        ("ui/src/components/card.tsx", b"export const Card = () => <div className=\"group/card\" />\n"),
        ("ui/src/x.tsx", b"export const X = () => <div className=\"group/x\" />\n"),
        ("ui/src/hidden.tsx", b"export const H = () => <div className=\"group/h\" />\n"),
        ("ui/src/components/reader.tsx", b"export const R = () => <p className=\"group-hover/card:p-2\" />\n"),
        ("loose/z.tsx", b"export const Z = () => <div className=\"group/z\" />\n"),
        ("app/package.json", br#"{"name":"app"}"#),
        (
            "app/src/page.tsx",
            b"export const P = () => <p className=\"group-hover/card:p-2 group-hover/x:p-2 group-hover/h:p-2 group-hover/z:p-2\" />\n",
        ),
    ]);
    let config = serde_json::json!({
        "root": root.to_string_lossy(),
        "utilities": {
            "scales": { "space": [{ "module": "./scales.ts", "export": "space" }] },
            "utilities": { "p": [{ "properties": ["padding"], "scale": "space" }] },
            "variants": { "hover": ":hover" }
        }
    })
    .to_string();
    let paths = ["ui", "loose", "app"].map(|dir| root.join(dir).to_string_lossy().into_owned());
    let (code, output) =
        run(&["--config-json", &config, "migrate", "tailwind", &paths[0], &paths[1], &paths[2], "--write"]);
    assert_eq!(code, 0, "{output}");
    let page = fs::read_to_string(root.join("app/src/page.tsx")).unwrap();
    assert!(page.contains("import { cardGroup } from \"@w/ui/components/card\""), "{page}");
    assert!(page.contains("import { xGroup } from \"@w/ui/x\""), "{page}");
    assert!(page.contains("import { hGroup } from \"../../ui/src/hidden\""), "{page}");
    assert!(page.contains("import { zGroup } from \"../../loose/z\""), "{page}");
    let reader = fs::read_to_string(root.join("ui/src/components/reader.tsx")).unwrap();
    assert!(reader.contains("import { cardGroup } from \"./card\""), "{reader}");
    let card = fs::read_to_string(root.join("ui/src/components/card.tsx")).unwrap();
    assert!(card.contains("export const cardGroup = relation(\"card\")"), "{card}");
    fs::remove_dir_all(root).unwrap();
}

/// A `.stylex.ts` file is renamed when the rewrite is applied.
#[test]
fn migrating_renames_token_files() {
    let root = temp(&[(
        "theme.stylex.ts",
        b"import * as stylex from \"@stylexjs/stylex\"\nexport const t = stylex.defineVars({ a: \"1px\" })\n",
    )]);
    let path = root.join("theme.stylex.ts").to_string_lossy().into_owned();
    let (_, output) = run(&["migrate", "stylex", &path]);
    assert!(output.contains("rename to"), "{output}");
    let (code, _) = run(&["migrate", "stylex", &path, "--write"]);
    assert_eq!(code, 0);
    assert!(root.join("theme.ts").exists());
    assert!(!root.join("theme.stylex.ts").exists());
    fs::remove_dir_all(root).unwrap();
}

/// Every way the command can fail to do what it was asked.
#[test]
fn migration_reports_what_it_cannot_do() {
    let root = temp(&[("a.ts", b"export const a = 1\n")]);

    // A report it cannot write.
    let missing = root.join("nowhere/report.txt").to_string_lossy().into_owned();
    let path = root.join("a.ts").to_string_lossy().into_owned();
    let (code, output) = run(&["migrate", "stylex", &path, "--report", &missing]);
    assert_eq!(code, 1, "{output}");
    assert!(output.contains("cannot write"), "{output}");

    // A source it cannot read.
    let absent = root.join("absent.ts").to_string_lossy().into_owned();
    let (code, output) = run(&["migrate", "stylex", &absent]);
    assert_eq!(code, 0, "{output}");
    assert!(output.contains("cannot read"), "{output}");

    // A source it cannot rewrite, because the file is read-only.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let locked = root.join("locked.ts");
        fs::write(&locked, "import * as stylex from \"@stylexjs/stylex\"\nconst a = stylex.props(x)\n").unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o444)).unwrap();
        let (code, output) = run(&["migrate", "stylex", &locked.to_string_lossy(), "--write"]);
        assert_eq!(code, 1, "{output}");
        assert!(output.contains("cannot write"), "{output}");
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o644)).unwrap();
    }
    fs::remove_dir_all(root).unwrap();
}

/// `check --stats`: what the engine did, for E-02 and KRN-PERF-002.
#[test]
fn check_reports_how_much_work_it_did() {
    let root = temp(&[
        ("src/styled.tsx", STYLE),
        ("src/plain.ts", b"export const value = 1\n"),
        ("src/also-plain.ts", b"export const other = 2\n"),
    ]);
    let config = format!(r#"{{"root":{:?}}}"#, root.to_string_lossy());
    let src = root.join("src").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "check", &src, "--stats"]);
    assert_eq!(code, 0, "{output}");
    assert!(output.contains("3 module(s) seen"), "{output}");
    assert!(output.contains("2 rejected by the prefilter (66.7 %)"), "{output}");
    assert!(output.contains("1 parsed"), "{output}");

    // Nothing to compile: no division by a module count of zero.
    let empty = root.join("empty").to_string_lossy().into_owned();
    fs::create_dir_all(&empty).unwrap();
    let (code, output) = run(&["--config-json", &config, "check", &empty, "--stats"]);
    assert_eq!(code, 0, "{output}");
    assert!(output.contains("0 module(s) seen, 0 rejected by the prefilter (0.0 %)"), "{output}");
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn lsp_serves_over_stdio_and_fails_without_a_client() {
    use std::io::{Read, Write};
    use std::process::{Command, Stdio};
    let frame = |body: &str| format!("Content-Length: {}\r\n\r\n{body}", body.len());
    let root = temp(&[("a.tsx", STYLE)]);
    let mut child = Command::new(env!("CARGO_BIN_EXE_kirana"))
        .args(["--config-json", "{}", "lsp"])
        .current_dir(&root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let mut stdin = child.stdin.take().unwrap();
    for body in [
        r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}"#,
        r#"{"jsonrpc":"2.0","method":"initialized","params":{}}"#,
        r#"{"jsonrpc":"2.0","id":2,"method":"shutdown"}"#,
        r#"{"jsonrpc":"2.0","method":"exit"}"#,
    ] {
        stdin.write_all(frame(body).as_bytes()).unwrap();
    }
    drop(stdin);
    let mut output = String::new();
    child.stdout.take().unwrap().read_to_string(&mut output).unwrap();
    assert!(child.wait().unwrap().success());
    assert!(output.contains("\"hoverProvider\":true"), "{output}");
    fs::remove_dir_all(&root).unwrap();
    // Without an `initialize`, the server stops with an error.
    let status = Command::new(env!("CARGO_BIN_EXE_kirana"))
        .args(["--config-json", r#"{"root":"/nonexistent-kirana-root"}"#, "lsp"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .unwrap();
    assert_eq!(status.code(), Some(1));
}

#[test]
fn analyzes_a_project_as_a_summary_json_and_a_page() {
    let mut tokens = String::from(
        "import { defineTokens } from \"@kirana-style/core\"\nexport const color = defineTokens(\"color\", {\n",
    );
    for index in 0..22 {
        tokens.push_str(&format!("  t{index}: {{ value: \"#00000{}\", variable: true }},\n", index % 10));
    }
    tokens.push_str("})\n");
    let mut app = String::from(
        "import { css, defineTheme, recipe, relation } from \"@kirana-style/core\"\nimport { color } from \"./tokens\"\n\
         const card = relation(\"card\")\nconst dark = defineTheme(color, { t0: \"white\" })\n\
         const button = recipe({ variants: { tone: { a: { color: \"blue\" }, b: { color: \"gray\" } } } })\n\
         export const read = css({ color: color.t0, opacity: { [card.within(\":hover\")]: 0.5 } })\n",
    );
    for index in 0..30 {
        app.push_str(&format!("export const c{index} = css({{ display: \"grid\", zIndex: {index} }})\n"));
    }
    app.push_str(
        "export function App({ w, tone }: { w: string; tone: \"a\" | \"b\" }) {\n  return <div sx={[dark, read]}>\n",
    );
    for _ in 0..21 {
        app.push_str("    <p sx={css({ width: w })} />\n");
    }
    app.push_str("    <button sx={button({ tone })} />\n  </div>\n}\n");
    let root = temp(&[("src/tokens.ts", tokens.as_bytes()), ("src/app.tsx", app.as_bytes())]);
    let config = format!(r#"{{"root":{:?}}}"#, root.to_string_lossy());
    let src = root.join("src").to_string_lossy().into_owned();

    // A relation read without its anchor is an error, so the exit code says so, as `check`'s does.
    let (code, summary) = run(&["--config-json", &config, "analyze", &src]);
    assert_eq!(code, 1, "{summary}");
    for expected in [
        "kB stylesheet",
        "Stylesheet by layer",
        "kirana.themes",
        "10+",
        "Most reused",
        "display: grid",
        "src/app.tsx",
        "Values bridged to runtime (dynamic-bridged) (21)",
        "… and 1 more (--json or --html for all)",
        "Recipes resolved at runtime (dynamic-variant) (1)",
        "Themes (1)",
        "overrides color.t0",
        "Relation reads without an anchor (1)",
        "card  read in src/app.tsx",
        "Tokens nothing reads (21)",
        "color.t1  src/tokens.ts",
    ] {
        assert!(summary.contains(expected), "{expected:?} in\n{summary}");
    }

    let (_, json) = run(&["--config-json", &config, "analyze", &src, "--json"]);
    let value: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(value["bridged"].as_array().unwrap().len(), 21);
    assert_eq!(value["unused_tokens"].as_array().unwrap().len(), 21);

    let page = root.join("report.html");
    let (code, output) = run(&["--config-json", &config, "analyze", &src, "--html", &page.to_string_lossy()]);
    assert_eq!((code, output.trim()), (1, format!("wrote {}", page.display()).as_str()));
    let html = fs::read_to_string(&page).unwrap();
    let name = root.file_name().unwrap().to_string_lossy().into_owned();
    assert!(html.starts_with("<!doctype html>") && html.contains(&format!("<h1>{name}</h1>")));
    assert!(html.contains("<code>color.t21</code>") && html.contains("Declared or applied in"));
    assert!(!html.contains("http"), "the page makes no requests");

    // Nothing to report: every section says so; a page that cannot be written fails.
    let empty = r#"{"root":"/"}"#;
    let nothing = root.join("nothing").to_string_lossy().into_owned();
    fs::create_dir_all(&nothing).unwrap();
    let (code, output) = run(&["--config-json", empty, "analyze", &nothing]);
    assert_eq!(code, 0);
    assert!(output.starts_with("0 module(s), 0 site(s), 0 atom(s)") && !output.contains("Most reused"), "{output}");
    let (_, _) = run(&["--config-json", empty, "analyze", &nothing, "--html", &page.to_string_lossy()]);
    let html = fs::read_to_string(&page).unwrap();
    assert!(html.contains("<h1>Project</h1>") && html.contains("None."));
    let unwritable = root.join("missing/report.html").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "analyze", &src, "--html", &unwritable]);
    assert_eq!(code, 1);
    assert!(output.starts_with("cannot write"));
    let (code, _) = run(&["--config-json", &config, "analyze", &src, "--json", "--html", "x.html"]);
    assert_eq!(code, 2, "--json and --html are one or the other");
    fs::remove_dir_all(root).unwrap();
}

/// `kirana report`: the engine's half of `kirana doctor --report`, without any source text.
#[test]
fn reports_what_a_bug_report_needs_from_the_engine() {
    let root = temp(&[
        ("src/a.tsx", STYLE),
        ("src/broken.tsx", BROKEN),
        (
            "src/twice.tsx",
            b"import { css } from \"@kirana-style/core\"\nexport const a = css({ colour: \"red\", fill: \"x\", widht: 1 })\n",
        ),
    ]);
    let config = format!(r#"{{"root":{:?}}}"#, root.to_string_lossy());
    // With no paths, the whole project.
    let (code, json) = run(&["--config-json", &config, "report"]);
    assert_eq!(code, 0, "{json}");
    let value: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(value["engine"], env!("CARGO_PKG_VERSION"));
    assert_eq!(value["work"]["seen"], 3);
    assert!(value["stylesheet"]["atoms"].as_u64().unwrap() >= 2, "{value}");
    let unknown = &value["diagnostics"][0];
    assert_eq!(unknown["code"], "KRN1201");
    assert_eq!(unknown["name"], "unknown-property");
    assert_eq!(unknown["severity"], "error");
    assert_eq!(unknown["count"], 3);
    assert_eq!(unknown["first"], "src/broken.tsx:2:26");
    assert!(!json.contains("colour: \\\"red\\\""), "no source text: {json}");

    // Given paths, only those.
    let one = root.join("src/a.tsx").to_string_lossy().into_owned();
    let (_, json) = run(&["--config-json", &config, "report", &one]);
    let value: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(value["work"]["seen"], 1);
    assert_eq!(value["diagnostics"], serde_json::json!([]));
    // A hidden command: the help does not list it.
    let (_, help) = run(&["--help"]);
    assert!(!help.contains("report"), "{help}");
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn check_annotates_github_and_caps_warnings() {
    let root = temp(&[(
        "warn.ts",
        b"import { css, firstThatWorks } from \"@kirana-style/core\"\nexport const a = css({ \"--gap\": firstThatWorks(\"1dvh\", \"1vh\") })\n",
    )]);
    let config = format!(r#"{{"root":{:?}}}"#, root.to_string_lossy());
    let file = root.join("warn.ts").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "check", &file, "--format", "github"]);
    assert_eq!(code, 0, "{output}");
    assert!(output.starts_with("::warning file=warn.ts,line=2,col="), "{output}");
    assert!(output.contains(",title=KRN1207 fallback-on-variable::"), "{output}");

    // One warning: within a cap of one, over a cap of none.
    let (code, _) = run(&["--config-json", &config, "check", &file, "--max-warnings", "1"]);
    assert_eq!(code, 0);
    let (code, output) = run(&["--config-json", &config, "check", &file, "--max-warnings", "0"]);
    assert_eq!(code, 1);
    assert!(output.ends_with("1 warning(s), more than --max-warnings 0\n"), "{output}");
    let (code, output) = run(&["--config-json", &config, "check", &file, "--max-warnings", "0", "--format", "json"]);
    assert_eq!(code, 1);
    assert!(output.trim_end().ends_with(']'), "{output}");

    let (code, output) = run(&["--config-json", &config, "check", &file, "--format", "sarif"]);
    assert_eq!(code, 2);
    assert!(output.contains("invalid value 'sarif'"), "{output}");
    fs::remove_dir_all(root).unwrap();
}

const DESIGN_TOKENS: &[u8] = br##"import { defineTokens } from "@kirana-style/core"
export const color = defineTokens("color", { brand: "light-dark(#000, #fff)", muted: "#888" }, { variable: true })
export const space = defineTokens("space", { x: "1rem" })
"##;
const DESIGN: &[u8] =
    br#"import { css, defineTheme, keyframes, positionTry, recipe, relation, viewTransition } from "@kirana-style/core"
import { color } from "./tokens"
export const ocean = defineTheme(color, { brand: "navy" })
export const button = recipe({
  base: { color: color.brand },
  variants: { size: { sm: { height: "1rem" }, md: { height: "2rem" } }, tone: { quiet: {} } },
  compoundVariants: [{ size: "sm", tone: "quiet", css: { opacity: 0.5 } }],
  defaultVariants: { size: "md" },
})
export const card = recipe({ slots: ["root", "title"], base: { root: {}, title: {} } })
export const spin = keyframes({ to: { transform: "rotate(1turn)" } })
export const below = positionTry({ positionArea: "bottom" })
export const slide = viewTransition({ old: { animationDuration: "1s" } })
export const field = relation("field")
export const plain = css({ color: "red" })
export const count = 3
export { spin as rotate }
"#;

#[test]
fn exports_the_design_system() {
    let root = temp(&[("src/tokens.ts", DESIGN_TOKENS), ("src/design.ts", DESIGN)]);
    let config = format!(r#"{{"root":{:?}}}"#, root.to_string_lossy());
    let (code, output) = run(&["--config-json", &config, "export"]);
    assert_eq!(code, 0, "{output}");
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    let mut shown = json.clone();
    shown["engine"] = "[version]".into();
    insta::assert_snapshot!(serde_json::to_string_pretty(&shown).unwrap());

    let out = root.join("design-system.json").to_string_lossy().into_owned();
    let src = root.join("src").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "export", &src, "--out", &out]);
    assert_eq!((code, output.trim()), (0, format!("wrote {out}").as_str()));
    assert_eq!(serde_json::from_str::<serde_json::Value>(&fs::read_to_string(&out).unwrap()).unwrap(), json);
    let blocked = root.join("src/tokens.ts/x.json").to_string_lossy().into_owned();
    let (code, output) = run(&["--config-json", &config, "export", "--out", &blocked]);
    assert_eq!(code, 1);
    assert!(output.starts_with("cannot write"));
    fs::remove_dir_all(root).unwrap();

    // A file that cannot be read exports nothing; the exit code says the project has an error.
    let root = temp(&[("binary.ts", &[0xff, 0xfe, 0x00])]);
    let config = format!(r#"{{"root":{:?}}}"#, root.to_string_lossy());
    let (code, output) = run(&["--config-json", &config, "export"]);
    assert_eq!(code, 1);
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert_eq!(json["tokens"], serde_json::json!([]));
    fs::remove_dir_all(root).unwrap();
}
