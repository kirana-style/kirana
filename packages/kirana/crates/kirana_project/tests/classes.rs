//! The class map for server templates (D-069).

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use kirana_diagnostics::Code;
use kirana_project::Project;
use kirana_shared::OsFs;

fn temp_project(classes: &str, files: &[(&str, &str)]) -> (PathBuf, Project) {
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
    let root = std::env::temp_dir().join(format!("kirana-classes-{}-{nanos}", std::process::id()));
    for (name, contents) in files {
        let path = root.join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }
    let config = format!(r#"{{"root":{:?}{classes}}}"#, root.to_string_lossy());
    (root.clone(), Project::new(&config, Arc::new(OsFs)).unwrap())
}

const STYLES: &str = r#"import { css, defineTokens, media, recipe } from "@kirana-style/core"
export * from "./shared.styles"
export const space = defineTokens("space", { 1: "4px" })
export const card = css({ padding: space[1], color: "red" })
export const button = { base: css({ paddingInline: "1rem" }), primary: css({ color: "white" }), size: 2 }
export const label = "plain"
export const wide = { [media("(width >= 40rem)")]: css({ color: "red" }) }
export const pick = recipe({ base: { color: "red" }, variants: {} })
export const many = [css({ color: "blue" })]
"#;

const SHARED: &str = r#"import { css } from "@kirana-style/core"
export const card = css({ color: "green" })
export const link = css({ textDecorationLine: "underline" })
"#;

#[test]
fn lists_exported_handles_by_name() {
    let (root, project) = temp_project(
        r#","classes":{"modules":["styles","missing.ts"],"out":"public/classes.json"}"#,
        &[
            ("package.json", r#"{"name":"app"}"#),
            ("styles/app.styles.ts", STYLES),
            ("styles/shared.styles.ts", SHARED),
            ("styles/notes.md", "not a module"),
        ],
    );
    let map = project.class_map().unwrap();
    assert_eq!(map.out, root.join("public/classes.json"));
    let json: serde_json::Value = serde_json::from_str(&map.json).unwrap();
    assert_eq!(json["version"], 1);
    assert_eq!(json["prefix"], "k");
    assert_eq!(json["families"]["four"], 45);
    assert_eq!(json["families"]["two"], 111);
    let classes = json["classes"].as_object().unwrap();
    // Own exports, objects by dotted name, and `export *` ones; an own export shadows a re-exported
    // one, and a re-exporting module's names are listed under its own file too.
    let names: Vec<&str> = classes.keys().map(String::as_str).collect();
    assert_eq!(names, ["button.base", "button.primary", "card", "link"]);
    let card = classes["card"].as_str().unwrap();
    assert!(card.split(' ').all(|class| class.starts_with('k') && class.contains('_')), "{card}");
    assert_ne!(classes["card"], serde_json::Value::String(String::new()));
    // The modules were compiled: their atoms are in the stylesheet.
    let css = project.stylesheet(false);
    assert!(css.contains("padding-inline: 1rem") || css.contains("padding-inline:1rem"), "{css}");
    // A recipe and an array have no class string a template can use.
    let reported: Vec<&str> = map
        .diagnostics
        .iter()
        .filter(|diagnostic| diagnostic.code == Code::ClassesNotStatic)
        .map(|diagnostic| diagnostic.message.as_str())
        .collect();
    assert_eq!(
        reported,
        ["`many` has no class string a template can use", "`pick` has no class string a template can use"]
    );
    assert!(map.json.ends_with("}\n"));
}

#[test]
fn names_come_with_the_module_that_exports_them() {
    let (root, project) = temp_project(
        r#","classes":{"modules":["styles"],"out":"classes.json"}"#,
        &[("package.json", r#"{"name":"app"}"#), ("styles/app.styles.ts", STYLES), ("styles/shared.styles.ts", SHARED)],
    );
    let names = project.class_names();
    let app = root.join("styles/app.styles.ts").canonicalize().unwrap();
    assert!(names.contains(&("button.primary".to_owned(), app.clone())), "{names:?}");
    assert!(names.contains(&("link".to_owned(), app)), "{names:?}");
    let shared = root.join("styles/shared.styles.ts").canonicalize().unwrap();
    assert!(names.contains(&("link".to_owned(), shared)), "{names:?}");
    let (_, bare) = temp_project("", &[("package.json", r#"{"name":"app"}"#)]);
    assert!(bare.class_names().is_empty());
}

#[test]
fn absent_without_configuration() {
    let (_, project) = temp_project("", &[("package.json", r#"{"name":"app"}"#)]);
    assert_eq!(project.class_map(), None);
}

#[test]
fn star_cycles_and_unresolved_sources_end() {
    let (_, project) = temp_project(
        r#","classes":{"modules":["a.ts"],"out":"classes.json"}"#,
        &[
            ("package.json", r#"{"name":"app"}"#),
            (
                "a.ts",
                "import { css } from \"@kirana-style/core\"\nexport * from \"./b\"\nexport * from \"./gone\"\nexport const a = css({ color: \"red\" })\n",
            ),
            (
                "b.ts",
                "import { css } from \"@kirana-style/core\"\nexport * from \"./a\"\nexport const b = css({ color: \"blue\" })\n",
            ),
        ],
    );
    let map = project.class_map().unwrap();
    let json: serde_json::Value = serde_json::from_str(&map.json).unwrap();
    let names: Vec<&String> = json["classes"].as_object().unwrap().keys().collect();
    assert_eq!(names, ["a", "b"]);
}

#[test]
fn externals_are_runtime_values_without_a_warning() {
    // A style reads `accent`; `templateOnly()` is read by none, so it is quiet either way (KF-045).
    let source = "import templateOnly from \"@ember/component/template-only\"\nimport { accent } from \"@ember/-internals/theme\"\nimport { css } from \"@kirana-style/core\"\nexport const a = css({ color: accent })\nexport default templateOnly()\n";
    let codes = |classes: &str| {
        let (root, project) = temp_project(classes, &[("package.json", r#"{"name":"app"}"#), ("a.js", source)]);
        project.transform(&root.join("a.js"), source).diagnostics.iter().map(|d| d.code).collect::<Vec<_>>()
    };
    assert_eq!(codes(""), [Code::UnresolvedImport, Code::DynamicBridged]);
    assert_eq!(codes(r#","externals":["@glimmer/","@ember/"]"#), [Code::DynamicBridged]);
}
