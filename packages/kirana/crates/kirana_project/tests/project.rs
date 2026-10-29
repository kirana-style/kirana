use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use kirana_diagnostics::Code;
use kirana_project::Project;
use kirana_shared::{MemoryFs, OsFs};

fn temp_project(files: &[(&str, &str)]) -> (PathBuf, Project) {
    let root = std::env::temp_dir().join(format!("kirana-project-{}-{}", std::process::id(), rand_suffix()));
    for (name, contents) in files {
        let path = root.join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }
    let config = format!(r#"{{"root":{:?}}}"#, root.to_string_lossy());
    let project = Project::new(&config, Arc::new(OsFs)).unwrap();
    (root, project)
}

fn rand_suffix() -> u128 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
}

/// The grammar check remembers its verdicts (KRN-CAS-010), and a variable token's value is judged
/// through what the token declares now: editing the token file changes the verdict, both ways.
#[test]
fn a_token_edit_is_judged_afresh() {
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const theme = defineTokens(\"theme\", { brand: \"red\" }, { variable: true })\n";
    let input = "import { css } from \"@kirana-style/core\"\nimport { theme } from \"./tokens\"\nexport const box = css({ padding: theme.brand })\n";
    let (root, project) =
        temp_project(&[("package.json", "{\"name\":\"app\"}"), ("tokens.ts", tokens), ("input.ts", input)]);
    let input_path = root.join("input.ts");
    let invalid = |project: &Project| {
        project.transform(&input_path, input).diagnostics.iter().any(|diagnostic| diagnostic.code == Code::InvalidValue)
    };
    let edit = |value: &str| {
        fs::write(root.join("tokens.ts"), tokens.replace("red", value)).unwrap();
        project.invalidate(&root.join("tokens.ts"));
    };
    // A colour on `padding`, judged twice: the second verdict is the remembered one.
    assert!(invalid(&project));
    assert!(invalid(&project));
    edit("4px");
    assert!(!invalid(&project));
    // Back to the colour: rejected again, not left on the length's verdict.
    edit("red");
    assert!(invalid(&project));
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn incremental_updates_follow_importers() {
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const space = defineTokens(\"space\", { 1: \"1px\" })\n";
    let barrel = "export { space } from \"./tokens\"\n";
    let input = "import { css } from \"@kirana-style/core\"\nimport { space } from \"./barrel\"\nexport const box = css({ gap: space[1] })\n";
    let (root, project) = temp_project(&[
        ("package.json", "{\"name\":\"app\"}"),
        ("tokens.ts", tokens),
        ("barrel.ts", barrel),
        ("input.ts", input),
    ]);
    assert_eq!(project.config().names.prefix, "k");
    let input_path = root.join("input.ts");
    let first = project.transform(&input_path, input);
    assert!(first.css_changed);
    assert_eq!(first.dependencies, [root.join("barrel.ts"), root.join("tokens.ts")]);
    // The same source again changes nothing.
    assert!(!project.transform(&input_path, input).css_changed);
    // A cached export is reused while its provenance holds.
    assert!(!project.transform(&input_path, input).css_changed);
    // Editing the token file invalidates the barrel and the input, transitively.
    fs::write(root.join("tokens.ts"), tokens.replace("1px", "2px")).unwrap();
    assert_eq!(project.invalidate(&root.join("tokens.ts")), std::slice::from_ref(&input_path));
    let updated = project.transform(&input_path, input);
    assert!(updated.css_changed);
    assert!(project.stylesheet(false).contains("gap") || project.stylesheet(false).contains("row-gap: 2px"));
    // A manifest that changes can rename the package a module belongs to, so the cache of
    // package lookups — which remembers every directory walked — is dropped with it.
    fs::write(root.join("package.json"), "{\"name\":\"renamed\"}").unwrap();
    assert!(project.invalidate(&root.join("package.json")).is_empty());
    assert!(project.transform(&input_path, input).css_changed || project.stylesheet(false).contains("gap"));
    // Removing a module removes its atoms; removing it twice changes nothing.
    assert!(project.remove(&input_path));
    assert!(!project.remove(&input_path));
    assert!(!project.stylesheet(true).contains("2px"));
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn stale_provenance_is_recomputed() {
    let (root, project) = temp_project(&[
        ("a.ts", "export const value = \"1px\"\n"),
        ("b.ts", "export { value } from \"./a\"\n"),
        (
            "input.ts",
            "import { css } from \"@kirana-style/core\"\nimport { value } from \"./b\"\nexport const box = css({ width: value })\n",
        ),
    ]);
    let input = fs::read_to_string(root.join("input.ts")).unwrap();
    project.transform(&root.join("input.ts"), &input);
    // A dependency changes through the host without an invalidate call.
    project.transform(&root.join("a.ts"), "export const value = \"3px\"\n");
    fs::write(root.join("a.ts"), "export const value = \"3px\"\n").unwrap();
    project.transform(&root.join("input.ts"), &input);
    assert!(project.stylesheet(false).contains("width: 3px"), "{}", project.stylesheet(false));
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_deleted_dependency_is_recomputed() {
    let (root, project) = temp_project(&[
        ("a.ts", "export const value = \"1px\"\n"),
        ("b.ts", "export { value } from \"./a\"\n"),
        (
            "input.ts",
            "import { css } from \"@kirana-style/core\"\nimport { value } from \"./b\"\nexport const box = css({ width: value })\n",
        ),
    ]);
    let input = fs::read_to_string(root.join("input.ts")).unwrap();
    project.transform(&root.join("input.ts"), &input);
    assert!(project.stylesheet(false).contains("width: 1px"));
    // `b.ts` stays cached (only transformed modules are importers), but the file its value came
    // from is gone.
    fs::remove_file(root.join("a.ts")).unwrap();
    assert_eq!(project.invalidate(&root.join("a.ts")), [root.join("input.ts")]);
    project.transform(&root.join("input.ts"), &input);
    assert!(!project.stylesheet(false).contains("width: 1px"), "{}", project.stylesheet(false));
    fs::remove_dir_all(root).unwrap();
}

/// A file created during a session is found by the imports that named it before it existed, and by
/// one it now comes before in the resolution order.
#[test]
fn a_file_created_during_the_session_is_resolved() {
    let space = "import { defineTokens } from \"@kirana-style/core\"\nexport const space = defineTokens(\"space\", { 1: \"1px\" })\n";
    let direct = "import { css } from \"@kirana-style/core\"\nimport { space } from \"./tokens\"\nexport const box = css({ gap: space[1] })\n";
    let nested = "import { css } from \"@kirana-style/core\"\nimport { space } from \"./scale\"\nexport const row = css({ rowGap: space[1] })\n";
    let starred = "import { css } from \"@kirana-style/core\"\nimport { space } from \"./all\"\nexport const col = css({ columnGap: space[1] })\n";
    let found = "import { css } from \"@kirana-style/core\"\nimport { space } from \"./scale\"\nexport const pad = css({ padding: space[1] })\n";
    let (root, project) = temp_project(&[
        ("package.json", "{\"name\":\"app\"}"),
        ("scale.ts", "export { space } from \"./tokens\"\n"),
        ("all.ts", "export * from \"./tokens\"\n"),
        ("direct.ts", direct),
        ("nested.ts", nested),
        ("starred.ts", starred),
        ("found.ts", found),
        ("theme/index.ts", "export const width = \"1px\"\n"),
        (
            "width.ts",
            "import { css } from \"@kirana-style/core\"\nimport { width } from \"./theme\"\nexport const line = css({ width })\n",
        ),
    ]);
    let unresolved = |name: &str, source: &str| {
        project.transform(&root.join(name), source).diagnostics.iter().any(|d| d.code == Code::UnresolvedImport)
    };
    assert!(unresolved("direct.ts", direct));
    assert!(unresolved("nested.ts", nested));
    assert!(unresolved("starred.ts", starred));
    // Answered from `scale.ts`'s cached exports, which remember their miss.
    assert!(unresolved("found.ts", found));
    let width = fs::read_to_string(root.join("width.ts")).unwrap();
    project.transform(&root.join("width.ts"), &width);
    let all = |names: &[&str]| names.iter().map(|name| root.join(name)).collect::<Vec<_>>();

    // A file the session has not read: every module whose compile missed an import is returned,
    // again at each change until it compiles.
    fs::write(root.join("notes.md"), "").unwrap();
    assert_eq!(project.invalidate(&root.join("notes.md")), all(&["direct.ts", "found.ts", "nested.ts", "starred.ts"]));
    fs::write(root.join("tokens.ts"), space).unwrap();
    assert_eq!(project.invalidate(&root.join("tokens.ts")), all(&["direct.ts", "found.ts", "nested.ts", "starred.ts"]));
    assert!(!unresolved("direct.ts", direct));
    assert!(!unresolved("nested.ts", nested));
    assert!(!unresolved("found.ts", found));
    project.transform(&root.join("starred.ts"), starred);
    let sheet = project.stylesheet(false);
    for property in ["gap: 1px", "row-gap: 1px", "column-gap: 1px", "padding: 1px"] {
        assert!(sheet.contains(property), "{property} in {sheet}");
    }
    // Compiled since: a later file returns none of them.
    fs::write(root.join("theme.ts"), "export const width = \"2px\"\n").unwrap();
    assert_eq!(project.invalidate(&root.join("theme.ts")), Vec::<PathBuf>::new());
    // `./theme` now names `theme.ts`, before `theme/index.ts`.
    project.transform(&root.join("width.ts"), &width);
    assert!(project.stylesheet(false).contains("width: 2px"), "{}", project.stylesheet(false));
    // An edit of a file the session read is not a new file: the import is not resolved again.
    project.remove(&root.join("direct.ts"));
    fs::write(root.join("scale.ts"), "export { space } from \"./tokens\"\n\n").unwrap();
    assert_eq!(project.invalidate(&root.join("scale.ts")), all(&["found.ts", "nested.ts"]));
    // A file reported changed, then deleted with nothing said: the cached exports that read it see
    // it gone.
    fs::write(root.join("c.ts"), "export const top = \"3px\"\n").unwrap();
    fs::write(root.join("d.ts"), "export { top } from \"./c\"\n").unwrap();
    let user =
        "import { css } from \"@kirana-style/core\"\nimport { top } from \"./d\"\nexport const at = css({ top })\n";
    project.transform(&root.join("user.ts"), user);
    assert!(project.stylesheet(false).contains("top: 3px"));
    assert_eq!(project.invalidate(&root.join("c.ts")), all(&["user.ts"]));
    fs::remove_file(root.join("c.ts")).unwrap();
    project.transform(&root.join("user.ts"), user);
    assert!(!project.stylesheet(false).contains("top: 3px"), "{}", project.stylesheet(false));
    fs::remove_dir_all(root).unwrap();
}

/// A spread of a state from `states.ts`, which re-exports it from `kirana.ts` (KF-038).
const SEPARATOR: &str = "import { css } from \"@kirana-style/core\"\nimport { orientation } from \"./states\"\nexport const separator = css({ width: { base: \"1px\", ...{ [orientation.vertical]: \"100%\" } } })\n";
const STATES: &str =
    "export type Keys = string\nexport const side = \"[data-side]\"\nexport { orientation } from \"./kirana\"\n";

/// Whether the separator compiles statically after `kirana.ts` was compiled first, and what
/// compiling `kirana.ts` reported.
fn separator_after_kirana(kirana: &str) -> (bool, Vec<Code>) {
    let (root, project) = temp_project(&[
        ("package.json", "{\"name\":\"app\"}"),
        ("kirana.ts", kirana),
        ("states.ts", STATES),
        ("separator.ts", SEPARATOR),
    ]);
    let kirana_codes = project
        .transform(&root.join("kirana.ts"), kirana)
        .diagnostics
        .iter()
        .map(|diagnostic| diagnostic.code)
        .collect();
    let separator = project.transform(&root.join("separator.ts"), SEPARATOR);
    let spread = separator.diagnostics.iter().any(|diagnostic| diagnostic.code == Code::DynamicSpread);
    fs::remove_dir_all(root).unwrap();
    (!spread, kirana_codes)
}

/// A type-only import erases at runtime, so it closes no cycle: compiling the module that has it
/// first, which reads the type in an annotation, leaves every other module's values whole.
#[test]
fn a_type_only_import_closes_no_cycle() {
    for import in ["import type { Keys } from \"./states\"", "import { type Keys } from \"./states\""] {
        let kirana = format!(
            "{import}\nimport {{ css }} from \"@kirana-style/core\"\nexport const orientation = {{ vertical: '[data-orientation=\"vertical\"]' }} as const satisfies Record<string, Keys>\nexport const line = css({{ width: \"1px\" }})\n"
        );
        assert_eq!(separator_after_kirana(&kirana), (true, vec![]));
    }
}

/// A module whose exports a cycle cut short, evaluated from inside that cycle, is not cached:
/// starting from the separator, the states are whole, whichever module was compiled before it.
#[test]
fn exports_a_cycle_cut_short_are_not_cached() {
    let kirana = "import { css } from \"@kirana-style/core\"\nimport { side } from \"./states\"\nexport const orientation = { vertical: '[data-orientation=\"vertical\"]' }\nexport const sided = css({ width: { base: \"1px\", [side]: \"2px\" } })\n";
    assert_eq!(separator_after_kirana(kirana), (true, vec![]));
}

/// A component imported from the module being compiled names that module, still being evaluated:
/// a cycle of one, said once, and what the component forwards `sx` to is not known.
#[test]
fn a_component_imported_from_its_own_module() {
    let card = "import { css } from \"@kirana-style/core\"\nimport { Card as Same } from \"./card\"\nexport function Card(props) { return <div {...props} /> }\nexport const page = <Same sx={css({ color: \"red\" })} />\n";
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("card.tsx", card)]);
    let codes: Vec<Code> =
        project.transform(&root.join("card.tsx"), card).diagnostics.iter().map(|diagnostic| diagnostic.code).collect();
    // `Same` closes the cycle, but it names a component: no style reads it (KF-045).
    assert_eq!(codes, []);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn parallel_builds_are_deterministic() {
    let files: Vec<(String, String)> = (0..24)
        .map(|index| {
            (format!("src/m{index}.tsx"), format!("import {{ css }} from \"@kirana-style/core\"\nexport const s = css({{ width: \"{index}px\", color: {{ \":hover\": \"red\" }} }})\n"))
        })
        .collect();
    let borrowed: Vec<(&str, &str)> = files.iter().map(|(a, b)| (a.as_str(), b.as_str())).collect();
    let (root, project) = temp_project(&borrowed);
    let mut paths: Vec<PathBuf> = files.iter().map(|(name, _)| root.join(name)).collect();
    paths.push(root.join("missing.tsx"));
    paths.push(root.join("src/m0.tsx"));
    let results = project.build(&paths);
    assert_eq!(results.len(), 25);
    assert!(results.iter().any(|(_, result)| result.is_err()));
    let first = project.stylesheet(true);
    let (_, again) = temp_project(&borrowed);
    let pool = rayon::ThreadPoolBuilder::new().num_threads(1).build().unwrap();
    pool.install(|| again.build(&paths));
    assert_eq!(first, again.stylesheet(true));
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn packages_without_manifest_and_memory_file_systems() {
    let memory = MemoryFs::new();
    memory.write("/app/input.ts", "import { css, relation } from \"@kirana-style/core\"\nexport const r = relation(\"x\")\nexport const s = css({ color: \"red\" })\n");
    let project = Project::new(r#"{"root":"/app"}"#, Arc::new(memory)).unwrap();
    let source = "import { css, relation } from \"@kirana-style/core\"\nexport const r = relation(\"x\")\nexport const s = css({ color: \"red\" })\n";
    let result = project.transform(Path::new("/app/input.ts"), source);
    assert!(result.code.unwrap().contains("\"name\": \"x\""));
    assert_eq!(project.display_name(Path::new("/elsewhere/file.ts")), "/elsewhere/file.ts");
    assert!(Project::new("{\"names\":{\"prefix\":\"\"}}", Arc::new(OsFs)).is_err());
}

#[test]
fn traces_explain_every_ladder_step() {
    let source = r#"import { css, firstThatWorks, select } from "@kirana-style/core"
export const box = css({
  width: {
    base: "1px",
    ":hover": "2px",
    "[data-b]": "3px",
    "[data-a]": "4px",
    "@media (min-width: 10rem)": "5px",
    "@media (min-width: 20rem)": { ":hover": "6px" },
    "@media (min-width: 30rem)": { ":hover": "7px" },
  },
  [select.descendant("svg")]: { width: "8px" },
})
export const pad = [css({ padding: "1px" }), css({ paddingTop: "2px" })]
export const border = [css({ border: "red" }), css({ borderColor: "blue" })]
export const tall = css({ minHeight: firstThatWorks("100dvh", "100vh") })
"#;
    let (root, project) = temp_project(&[("input.ts", source)]);
    let path = root.join("input.ts");
    project.transform(&path, source);
    let lines = project.trace(&path, source, 3, "width");
    let reasons: Vec<&str> = lines.iter().map(|line| line.reason.as_str()).collect();
    assert_eq!(lines[0].value, "7px");
    assert!(reasons.iter().any(|reason| reason.starts_with("step 2")), "{reasons:?}");
    assert!(reasons.iter().any(|reason| reason.starts_with("step 3")), "{reasons:?}");
    assert!(reasons.iter().any(|reason| reason.starts_with("step 4")), "{reasons:?}");
    assert!(reasons.iter().any(|reason| reason.starts_with("step 6")), "{reasons:?}");
    assert!(reasons.iter().any(|reason| reason.starts_with("step 1")), "{reasons:?}");
    assert_eq!(lines.last().unwrap().layer, "kirana.contextual");
    assert_eq!(lines.last().unwrap().reason, "");
    assert!(lines.iter().any(|line| line.condition_text == "base" && line.conditions.is_empty()));
    let padding = project.trace(&path, source, 14, "padding-top");
    assert_eq!((padding[0].value.as_str(), padding[0].reason.as_str()), ("2px", "step 5 (set 1 longhand < 4)"));
    let border = project.trace(&path, source, 15, "border-top-color");
    assert_eq!((border[0].value.as_str(), border[0].reason.as_str()), ("blue", "step 5 (set 4 longhands < 12)"));
    let tall = project.trace(&path, source, 16, "min-height");
    assert_eq!(tall[0].value, "firstThatWorks(100dvh, 100vh)");
    assert!(project.trace(&path, source, 99, "width").is_empty());
    assert!(project.trace(&root.join("other.ts"), source, 3, "width").is_empty());
    fs::remove_dir_all(root).unwrap();
}

/// On a recipe's line, two parts of one slot that set the same entry are ordered by the merge, the
/// later part first, and each names its part.
#[test]
fn a_recipe_trace_orders_merged_parts() {
    let source = "import { recipe } from \"@kirana-style/core\"\nexport const chip = recipe({ base: { width: \"1rem\" }, variants: { size: { sm: { width: \"2rem\" } } } })\n";
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("chip.ts", source)]);
    let path = root.join("chip.ts");
    project.transform(&path, source);
    let lines = project.trace(&path, source, 2, "width");
    let shown: Vec<(String, String, Option<u8>)> =
        lines.iter().map(|line| (line.value.clone(), line.context(), line.step)).collect();
    assert_eq!(
        shown,
        [
            ("2rem".to_owned(), "base [size: sm]".to_owned(), Some(0)),
            ("1rem".to_owned(), "base [base]".to_owned(), None)
        ]
    );
    assert_eq!(lines[0].reason, "merge (size: sm replaces base)");
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn project_diagnostics_catch_collisions_and_levels() {
    let source = "import { css } from \"@kirana-style/core\"\nexport const a = css({ color: \"red\" })\n";
    let (root, project) = temp_project(&[("input.ts", source)]);
    project.transform(&root.join("input.ts"), source);
    project.debug_force_collision(&root.join("input.ts"));
    let codes: Vec<Code> = project.diagnostics().iter().map(|diagnostic| diagnostic.code).collect();
    // Two atoms with one class, two keys with one segment, two definitions with one name.
    assert_eq!(codes.iter().filter(|code| **code == Code::ClassNameCollision).count(), 3, "{codes:?}");
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn shared_importers_atoms_and_themes_are_counted_once() {
    let theme = "import { defineTheme, defineTokens } from \"@kirana-style/core\"\nexport const colors = defineTokens(\"colors\", { ink: \"black\" }, { variable: true })\nexport const brand = defineTheme(colors, { ink: \"navy\" })\n";
    let module = |name: &str| {
        format!(
            "import {{ css }} from \"@kirana-style/core\"\nimport {{ brand }} from \"./theme\"\nexport const {name} = css({{ color: \"red\", paddingTop: null }})\nexport const {name}Again = css({{ paddingTop: null }})\nexport const {name}Element = <div sx={{[{name}, brand]}} />\n"
        )
    };
    let input = "import { cx } from \"@kirana-style/core\"\nimport { a } from \"./a\"\nimport { b } from \"./b\"\nexport const both = cx(a, b)\n";
    let (a, b) = (module("a"), module("b"));
    let (root, project) = temp_project(&[("theme.ts", theme), ("a.tsx", &a), ("b.tsx", &b), ("input.ts", input)]);
    for (name, source) in [("theme.ts", theme), ("a.tsx", a.as_str()), ("b.tsx", b.as_str()), ("input.ts", input)] {
        assert!(project.transform(&root.join(name), source).code.is_some());
    }
    // Two modules with the same atom and theme: no collision, one theme rule.
    let codes: Vec<Code> = project.diagnostics().iter().map(|diagnostic| diagnostic.code).collect();
    assert!(!codes.contains(&Code::ClassNameCollision), "{codes:?}");
    let stylesheet = project.stylesheet(false);
    assert_eq!(stylesheet.matches("navy").count(), 1, "{stylesheet}");
    // `theme.ts` reaches `input.ts` through both `a.tsx` and `b.tsx`.
    let mut affected = project.invalidate(&root.join("theme.ts"));
    affected.sort();
    assert_eq!(affected, [root.join("a.tsx"), root.join("b.tsx"), root.join("input.ts")]);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn unreadable_and_missing_components_forward_nothing() {
    let input = "import { css } from \"@kirana-style/core\"\nimport Logo from \"./logo.png\"\nimport { Missing } from \"./missing\"\nconst s = css({ color: \"red\" })\nexport const a = <Logo sx={s} />\nexport const b = <Missing sx={s} />\n";
    let (root, project) = temp_project(&[("input.tsx", input)]);
    fs::write(root.join("logo.png"), [0xff, 0xfe, 0x00]).unwrap();
    let result = project.transform(&root.join("input.tsx"), input);
    assert!(result.code.is_some());
    let codes: Vec<Code> = result.diagnostics.iter().map(|diagnostic| diagnostic.code).collect();
    assert!(!codes.contains(&Code::SxOnExternalComponent), "{codes:?}");
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn an_edited_or_removed_module_forgets_its_declarations() {
    let relation = "import { relation } from \"@kirana-style/core\"\nexport const card = relation(\"card\")\n";
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const t = defineTokens(\"shared\", { x: { value: \"1px\", variable: true } })\n";
    let (root, project) = temp_project(&[
        ("package.json", "{\"name\":\"forget\"}"),
        ("a.ts", relation),
        ("b.ts", relation),
        ("c.ts", tokens),
        ("d.ts", tokens),
        (
            "input.tsx",
            "import { css } from \"@kirana-style/core\"\nimport { card } from \"./a\"\nimport { card as other } from \"./b\"\nimport { t } from \"./c\"\nimport { t as u } from \"./d\"\nexport const box = css({ width: t.x, height: u.x, color: { [other.within(\":hover\")]: \"red\" } })\nexport const C = () => <div sx={card.anchor} />\n",
        ),
    ]);
    let codes = |project: &Project| project.diagnostics().iter().map(|d| d.code).collect::<Vec<_>>();
    let input = root.join("input.tsx");
    project.transform(&input, &fs::read_to_string(&input).unwrap());
    let found = codes(&project);
    assert!(found.contains(&Code::RelationNameCollision) && found.contains(&Code::TokenNamespaceCollision));
    // b.ts renames its relation and d.ts its namespace: the session must not keep the old ones.
    fs::write(root.join("b.ts"), relation.replace("\"card\"", "\"other\"")).unwrap();
    fs::write(root.join("d.ts"), tokens.replace("\"shared\"", "\"own\"")).unwrap();
    project.invalidate(&root.join("b.ts"));
    project.invalidate(&root.join("d.ts"));
    project.transform(&input, &fs::read_to_string(&input).unwrap());
    let found = codes(&project);
    assert!(
        !found.contains(&Code::RelationNameCollision) && !found.contains(&Code::TokenNamespaceCollision),
        "{found:?}"
    );
    // Removing a transformed module drops what it declared too.
    assert!(project.remove(&input));
    fs::remove_dir_all(root).unwrap();
}

/// One group name in two packages is not a collision, since identities carry the package, but it is
/// pointed out (KF-011), and `export` names each token's package.
#[test]
fn a_group_name_two_packages_share_is_pointed_out() {
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const theme = defineTokens(\"theme\", { background: { value: \"white\", variable: true } })\n";
    let (root, project) = temp_project(&[
        ("package.json", "{\"name\":\"app\"}"),
        ("tokens.ts", tokens),
        ("registry/package.json", "{\"name\":\"@workspace/registry\"}"),
        ("registry/tokens.ts", tokens),
        (
            "input.ts",
            "import { css } from \"@kirana-style/core\"\nimport { theme } from \"./tokens\"\nimport { theme as other } from \"./registry/tokens\"\nexport const box = css({ color: theme.background, background: other.background })\n",
        ),
    ]);
    let input = root.join("input.ts");
    project.transform(&input, &fs::read_to_string(&input).unwrap());
    let shared: Vec<String> = project
        .diagnostics()
        .iter()
        .filter(|diagnostic| diagnostic.code == Code::TokenNamespaceShared)
        .map(|diagnostic| diagnostic.message.clone())
        .collect();
    assert_eq!(shared.len(), 1, "{shared:?}");
    assert!(shared[0].contains("\"theme\" is also declared by \"@workspace/registry\""), "{shared:?}");
    assert!(!project.diagnostics().iter().any(|diagnostic| diagnostic.code == Code::TokenNamespaceCollision));
    let design = project.design_system(std::slice::from_ref(&root));
    let packages: Vec<(&str, &str)> =
        design.tokens.iter().map(|token| (token.package.as_str(), token.identity.as_str())).collect();
    assert_eq!(packages, [("@workspace/registry", "theme.background"), ("app", "theme.background")]);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn dense_names_cover_the_build_and_keep_their_codes() {
    // A shorthand that a later override unfolds (D-045), conditions, a bridged value, and a string
    // that only looks like a class name.
    let card = "import { css } from \"@kirana-style/core\"\nexport const card = css({ padding: \"1rem\", color: { base: \"red\", \":hover\": \"blue\" } })\n";
    let page = "import { css, cx } from \"@kirana-style/core\"\nimport { card } from \"./card\"\nexport const quoted = \"k50_D9ur\"\nexport const page = (wide: boolean, size: number) => cx(card, wide && css({ paddingTop: 0, color: { \":hover\": null } }), css({ width: size }))\n";
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("card.ts", card), ("page.ts", page)]);
    project.mark_dense();
    let card_out = project.transform(&root.join("card.ts"), card).code.unwrap();
    let page_out = project.transform(&root.join("page.ts"), page).code.unwrap();
    assert!(card_out.contains(kirana_ir::dense::MARK) && page_out.contains("--k"));
    let css = project.stylesheet(true);
    assert!(!css.contains(kirana_ir::dense::MARK));
    let dense_css = project.dense_rename(&css);
    assert!(dense_css.len() < css.len());
    // Rules and their order are untouched; only the hashes changed.
    assert_eq!(dense_css.split('{').count(), css.split('{').count());
    let apply = |code: &str| {
        let mut out = String::new();
        let mut last = 0;
        for edit in project.dense_edits(code) {
            out.push_str(&code[last..edit.start]);
            out.push_str(&edit.text);
            last = edit.end;
        }
        out + &code[last..]
    };
    for code in [&card_out, &page_out] {
        let renamed = apply(code);
        assert!(!renamed.contains(kirana_ir::dense::MARK), "{renamed}");
        // Every atom the module names has its rule.
        for atom in renamed
            .split(['"', ' '])
            .filter(|token| token.starts_with("k") && token.contains('_') && !token.ends_with('_'))
        {
            if atom != "k50_D9ur" {
                assert!(dense_css.contains(&format!(".{atom}")), "{atom} in {dense_css}");
            }
        }
    }
    // The string the module wrote itself is left as it was.
    assert!(apply(&page_out).contains("\"k50_D9ur\""));
    // A module compiled later keeps every earlier code and adds its own.
    let before = project.dense_rename(&css);
    let extra = "import { css } from \"@kirana-style/core\"\nexport const x = css({ color: \"rebeccapurple\", margin: { \":focus\": \"2px\" } })\n";
    fs::write(root.join("extra.ts"), extra).unwrap();
    project.transform(&root.join("extra.ts"), extra);
    assert_eq!(project.dense_rename(&css), before);
    assert!(project.dense_rename(&project.stylesheet(true)).len() > before.len());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_build_reuses_a_transform_whose_inputs_are_unchanged() {
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const space = defineTokens(\"space\", { 1: \"1px\" })\n";
    let input = "import { css } from \"@kirana-style/core\"\nimport { space } from \"./tokens\"\nexport const box = css({ gap: space[1] })\n";
    let (root, project) =
        temp_project(&[("package.json", "{\"name\":\"app\"}"), ("tokens.ts", tokens), ("input.ts", input)]);
    let path = root.join("input.ts");
    let reused = |project: &Project| project.work().reused;

    // Off by default: the language server compiles every time.
    project.transform(&path, input);
    project.transform(&path, input);
    assert_eq!(reused(&project), 0);

    project.reuse_transforms();
    let first = project.transform(&path, input);
    let second = project.transform(&path, input);
    assert_eq!(reused(&project), 1);
    assert_eq!((second.code.as_deref(), second.map.as_deref()), (first.code.as_deref(), first.map.as_deref()));
    assert_eq!(second.dependencies, first.dependencies);
    assert!(!second.css_changed);

    // A file the evaluation read changed on disk, with nothing telling the project: compiled again.
    fs::write(root.join("tokens.ts"), tokens.replace("1px", "2px")).unwrap();
    project.invalidate(&root.join("tokens.ts"));
    let changed = project.transform(&path, input);
    assert_eq!(reused(&project), 1);
    assert_ne!(changed.code, first.code);
    assert!(changed.css_changed);
    project.transform(&path, input);
    assert_eq!(reused(&project), 2);

    // Another source, marked names, the module's own invalidation, its removal, a manifest: each
    // compiles again.
    let edited = input.replace("gap", "rowGap");
    project.transform(&path, &edited);
    project.transform(&path, input);
    assert_eq!(reused(&project), 2);
    project.mark_dense();
    assert!(project.transform(&path, input).code.unwrap().contains(kirana_ir::dense::MARK));
    assert_eq!(reused(&project), 2);
    project.transform(&path, input);
    assert_eq!(reused(&project), 3);
    project.invalidate(&path);
    project.transform(&path, input);
    assert_eq!(reused(&project), 3);
    project.remove(&path);
    project.transform(&path, input);
    assert_eq!(reused(&project), 3);
    project.invalidate(&root.join("package.json"));
    project.transform(&path, input);
    assert_eq!(reused(&project), 3);
    project.transform(&path, input);
    assert_eq!(reused(&project), 4);
    fs::remove_dir_all(root).unwrap();
}

/// A watch session reuses transforms too (KF-063), but never one that missed an import: it compiles
/// each time, as without reuse, until the file it names exists.
#[test]
fn a_transform_that_missed_an_import_is_never_reused() {
    let input = "import { css } from \"@kirana-style/core\"\nimport { space } from \"./tokens\"\nexport const box = css({ gap: space[1] })\n";
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("input.ts", input)]);
    project.reuse_transforms();
    let path = root.join("input.ts");
    let missed = project.transform(&path, input);
    assert!(missed.diagnostics.iter().any(|d| d.code == Code::UnresolvedImport));
    project.transform(&path, input);
    assert_eq!(project.work().reused, 0);
    // Created, and the session told: the next transform finds it.
    fs::write(
        root.join("tokens.ts"),
        "import { defineTokens } from \"@kirana-style/core\"\nexport const space = defineTokens(\"space\", { 1: \"1px\" })\n",
    )
    .unwrap();
    project.invalidate(&root.join("tokens.ts"));
    let found = project.transform(&path, input);
    assert!(!found.diagnostics.iter().any(|d| d.code == Code::UnresolvedImport), "{:?}", found.diagnostics);
    // Resolved now: the next one is reused.
    project.transform(&path, input);
    assert_eq!(project.work().reused, 1);
    fs::remove_dir_all(root).unwrap();
}

/// A host that writes no source maps asks for none, and gets the same code; a reused transform is
/// one built the same way.
#[test]
fn a_transform_without_a_map_writes_the_same_code() {
    let input = "import { css } from \"@kirana-style/core\"\nexport const box = css({ gap: \"1px\" })\n";
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("input.ts", input)]);
    let path = root.join("input.ts");
    let mapped = project.transform(&path, input);
    let bare = project.transform_with(&path, input, false);
    assert!(mapped.map.is_some());
    assert_eq!(bare.map, None);
    assert_eq!(bare.code, mapped.code);
    project.reuse_transforms();
    project.transform_with(&path, input, false);
    assert!(project.transform(&path, input).map.is_some(), "a transform without a map is not reused for one with");
    assert_eq!(project.work().reused, 0);
    assert_eq!(project.transform(&path, input).map, mapped.map);
    assert_eq!(project.work().reused, 1);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_dependency_changed_on_disk_is_noticed_without_an_invalidation() {
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const space = defineTokens(\"space\", { 1: \"1px\" })\n";
    let input = "import { css } from \"@kirana-style/core\"\nimport { space } from \"./tokens\"\nexport const box = css({ gap: space[1] })\n";
    let (root, project) =
        temp_project(&[("package.json", "{\"name\":\"app\"}"), ("tokens.ts", tokens), ("input.ts", input)]);
    project.reuse_transforms();
    let path = root.join("input.ts");
    let first = project.transform(&path, input);
    // The token file is compiled with new contents, as a bundler would when it reaches it.
    let tokens_path = root.join("tokens.ts");
    let edited = tokens.replace("1px", "3px");
    fs::write(&tokens_path, &edited).unwrap();
    project.transform(&tokens_path, &edited);
    let again = project.transform(&path, input);
    assert_ne!(again.code, first.code);
    fs::remove_dir_all(root).unwrap();
}

/// A preset's files are listed once however many of its modules read them, and an edit to one they
/// share is still seen through every importer's cached exports (KF-060).
#[test]
fn a_file_two_imported_modules_share_is_read_once_and_followed() {
    let shared = "export const unit = \"1px\"\n";
    let (root, project) = temp_project(&[
        ("package.json", "{\"name\":\"app\"}"),
        ("shared.ts", shared),
        ("a.ts", "import { unit } from \"./shared\"\nexport const a = unit\n"),
        ("b.ts", "import { unit } from \"./shared\"\nexport const b = unit\n"),
        ("index.ts", "export { a } from \"./a\"\nexport { b } from \"./b\"\n"),
    ]);
    project.reuse_transforms();
    let input = "import { css } from \"@kirana-style/core\"\nimport { a, b } from \"./index\"\nexport const box = css({ width: a, height: b })\n";
    let other = "import { css } from \"@kirana-style/core\"\nimport { a } from \"./index\"\nexport const line = css({ maxWidth: a })\n";
    let first = project.transform(&root.join("input.ts"), input);
    let names = |transformed: &kirana_project::Transformed| {
        transformed
            .dependencies
            .iter()
            .map(|path| path.file_name().unwrap().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
    };
    assert_eq!(names(&first), ["a.ts", "b.ts", "index.ts", "shared.ts"]);
    // Answered from the cached exports of `index.ts`, which read both of its sources.
    assert_eq!(names(&project.transform(&root.join("other.ts"), other)), ["a.ts", "b.ts", "index.ts", "shared.ts"]);
    fs::write(root.join("shared.ts"), shared.replace("1px", "2px")).unwrap();
    project.transform(&root.join("shared.ts"), &shared.replace("1px", "2px"));
    project.transform(&root.join("input.ts"), input);
    project.transform(&root.join("other.ts"), other);
    let sheet = project.stylesheet(false);
    for declaration in ["width: 2px", "height: 2px", "max-width: 2px"] {
        assert!(sheet.contains(declaration), "{declaration} in {sheet}");
    }
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn a_finished_stylesheet_keeps_runtime_tokens_and_what_the_bundle_names() {
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const glow = defineTokens(\"glow\", { soft: \"1px\" }, { runtime: true })\nexport const size = defineTokens(\"size\", { read: \"2px\", named: \"3px\", unused: \"4px\", kept: { value: \"5px\", runtime: true } }, { variable: true })\n";
    let page = "import { css } from \"@kirana-style/core\"\nimport { size } from \"./tokens\"\nexport const box = css({ gap: size.read })\n";
    let (root, project) =
        temp_project(&[("package.json", "{\"name\":\"app\"}"), ("tokens.ts", tokens), ("page.ts", page)]);
    let tokens_out = project.transform(&root.join("tokens.ts"), tokens).code.unwrap();
    project.transform(&root.join("page.ts"), page);
    let variable = |identity: &str| {
        let at = tokens_out.find(identity).unwrap_or_else(|| panic!("{identity} in {tokens_out}"));
        let rest = &tokens_out[at..];
        let start = rest.find("var(").unwrap() + 4;
        rest[start..start + rest[start..].find(')').unwrap()].to_owned()
    };
    let [soft, read, named, unused, kept] =
        ["\"soft\"", "\"read\"", "\"named\"", "\"unused\"", "\"kept\""].map(variable);

    // Without a bundle, every token its code names is written.
    let everything = project.stylesheet(true);
    for token in [&soft, &read, &named, &unused, &kept] {
        assert!(everything.contains(&format!("{token}:")), "{token} in {everything}");
    }
    // A finished bundle that names one of them.
    let (finished, pruned) = project.finished_stylesheet(true, std::slice::from_ref(&named));
    for token in [&soft, &read, &named, &kept] {
        assert!(finished.contains(&format!("{token}:")), "{token} in {finished}");
    }
    assert!(!finished.contains(&unused), "{finished}");
    assert_eq!(pruned, [(unused, "size.unused".to_owned())]);
    fs::remove_dir_all(root).unwrap();
}

/// The stylesheet and the project's diagnostics are kept until a module's record or a declaration
/// changes: asking again returns them as they were, and every change is seen.
#[test]
fn the_stylesheet_and_diagnostics_are_kept_until_something_changes() {
    let source = "import { css } from \"@kirana-style/core\"\nexport const box = css({ color: \"red\" })\n";
    let relation = "import { relation } from \"@kirana-style/core\"\nexport const card = relation(\"card\")\n";
    let reader = |from: &str| {
        format!(
            "import {{ css }} from \"@kirana-style/core\"\nimport {{ card }} from \"./{from}\"\nexport const x = css({{ color: {{ [card.within(\":hover\")]: \"red\" }} }})\n"
        )
    };
    let (root, project) = temp_project(&[
        ("package.json", "{\"name\":\"kept\"}"),
        ("input.ts", source),
        ("a.ts", relation),
        ("b.ts", relation),
    ]);
    let input = root.join("input.ts");
    let collisions =
        |project: &Project| project.diagnostics().iter().filter(|d| d.code == Code::RelationNameCollision).count();
    project.transform(&input, source);
    let (css, diagnostics) = (project.stylesheet(true), project.diagnostics());
    assert_eq!((project.stylesheet(true), project.diagnostics()), (css.clone(), diagnostics.clone()));
    // The same source again writes an equal record, which changes nothing.
    project.transform(&input, source);
    assert_eq!(project.stylesheet(true), css);
    // Other arguments are another stylesheet.
    assert_ne!(project.stylesheet(false), css);
    assert_eq!(project.finished_stylesheet(true, &[]).0, css);
    assert_eq!(project.stylesheet(true), css);
    // A module that no longer holds a style leaves the stylesheet without a full transform.
    project.transform(&input, "export const nothing = 1\n");
    assert!(!project.stylesheet(true).contains("red"));
    // A module with a style, then without one, and then removed.
    project.transform(&input, &source.replace("red", "blue"));
    assert!(project.stylesheet(true).contains("blue"));
    assert!(project.remove(&input));
    assert!(!project.stylesheet(true).contains("blue"));
    // A declaration read through an import, never transformed itself, is seen. Reading the
    // relation from b.ts instead of a.ts writes the same record (one name, one marker), yet b.ts
    // now declares it a second time.
    project.transform(&root.join("one.ts"), &reader("a"));
    project.transform(&root.join("two.ts"), &reader("a"));
    assert_eq!(collisions(&project), 0);
    project.transform(&root.join("two.ts"), &reader("b"));
    assert_eq!(collisions(&project), 1);
    project.invalidate(&root.join("b.ts"));
    assert_eq!(collisions(&project), 0);
    // A forced collision is seen too.
    project.debug_force_collision(&root.join("one.ts"));
    assert!(project.diagnostics().iter().any(|d| d.code == Code::ClassNameCollision));
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn an_exported_relation_is_unused_only_when_the_project_was_compiled_whole() {
    let unused = |project: &Project| {
        project
            .diagnostics()
            .iter()
            .filter(|diagnostic| diagnostic.code == kirana_diagnostics::Code::RelationUnused)
            .count()
    };
    let markers = r#"import { relation } from "@kirana-style/core"
export const menu = relation("menu")
"#;
    let anchor = r#"import { menu } from "./markers"
export const Menu = () => <div sx={menu.anchor} />
"#;
    let reader = r#"import { css } from "@kirana-style/core"
import { menu } from "./markers"
export const item = css({ padding: { base: "1rem", [menu.within("[data-slot]")]: 0 } })
"#;
    // A build that reaches the anchor but not the reader cannot tell the relation is unused.
    let (root, project) = temp_project(&[("markers.ts", markers), ("menu.tsx", anchor), ("item.ts", reader)]);
    let menu = root.join("menu.tsx");
    project.transform(&menu, &fs::read_to_string(&menu).unwrap());
    assert_eq!(unused(&project), 0);
    // Compiled whole, the reader is found.
    project.compile_paths(std::slice::from_ref(&root));
    assert_eq!(unused(&project), 0);
    // Compiled whole with no reader anywhere, it is reported.
    let (root, project) = temp_project(&[("markers.ts", markers), ("menu.tsx", anchor)]);
    project.compile_paths(std::slice::from_ref(&root));
    assert_eq!(unused(&project), 1);
    // A relation its module keeps to itself is reported by any build.
    let (root, project) = temp_project(&[(
        "local.tsx",
        "import { relation } from \"@kirana-style/core\"\nconst card = relation(\"card\")\nexport const Card = () => <div sx={card.anchor} />\n",
    )]);
    let local = root.join("local.tsx");
    project.transform(&local, &fs::read_to_string(&local).unwrap());
    assert_eq!(unused(&project), 1);
}

/// A relation kept private whose readers leave its module inside an exported object is exported all
/// the same (KF-024): a build that reaches the anchor and no reader says nothing. One whose anchor
/// alone leaves is read nowhere else, and a report names where it is declared.
#[test]
fn a_relation_whose_anchor_and_readers_are_exported_is_exported() {
    let axes = r#"import { css, recipe, relation, select } from "@kirana-style/core"
const ui = relation("ui")
export const axes = {
  anchor: ui.anchor,
  style: { lyra: ui.within('[data-style="lyra"]'), read: ui.within, pick: select.child },
  styled: css({ color: { [ui.within(":hover")]: "red" } }),
  sized: recipe({ variants: { size: { sm: { color: { [ui.within(":focus")]: "blue" } } } } }),
}
"#;
    let app = r#"import { axes } from "./axes"
export const App = () => <div sx={axes.anchor} />
"#;
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("axes.ts", axes), ("app.tsx", app)]);
    let entry = root.join("app.tsx");
    project.transform(&entry, &fs::read_to_string(&entry).unwrap());
    let unused = |project: &Project| -> Vec<kirana_diagnostics::Diagnostic> {
        project
            .diagnostics()
            .into_iter()
            .filter(|diagnostic| diagnostic.code == kirana_diagnostics::Code::RelationUnused)
            .collect()
    };
    assert!(unused(&project).is_empty(), "{:?}", unused(&project));
    // An exported anchor alone: no other module can read the relation, so any build reports it.
    let lone = "import { relation } from \"@kirana-style/core\"\nconst ui = relation(\"ui\")\nexport const axes = { anchor: ui.anchor }\n";
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("axes.ts", lone), ("app.tsx", app)]);
    let entry = root.join("app.tsx");
    project.transform(&entry, &fs::read_to_string(&entry).unwrap());
    let found = unused(&project);
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].file, "axes.ts");
    let start = lone.find("relation(\"ui\")").unwrap() as u32;
    assert_eq!((found[0].span.start, found[0].span.end), (start, start + "relation(\"ui\")".len() as u32));
}

/// A question costs the sites of its line, not the length of its file (KF-028): 3,000 questions on a
/// 6,000-line module took about 17 ms each when every site's line was counted from the file's start.
#[test]
fn trace_questions_cost_their_line_not_the_file() {
    let mut source = String::from("import { css } from \"@kirana-style/core\"\n");
    for index in 0..3_000 {
        source.push_str(&format!("export const s{index} = css({{ padding: \"{index}px\",\n  color: \"red\" }})\n"));
    }
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("probes.ts", &source)]);
    let queries: Vec<kirana_project::TraceQuery> = (0..3_000)
        .map(|index| kirana_project::TraceQuery {
            file: root.join("probes.ts").to_string_lossy().into_owned(),
            line: 2 + index * 2,
            property: "padding".to_owned(),
        })
        .collect();
    let started = std::time::Instant::now();
    let answers = project.trace_all(&queries);
    let took = started.elapsed();
    assert_eq!(answers.len(), 3_000);
    assert_eq!(answers[1_234].entries[0].value, "1234px");
    assert!(answers.iter().all(|answer| answer.entries.len() == 1));
    // Generous, for a debug build under coverage: before the index this took minutes.
    assert!(took < std::time::Duration::from_secs(20), "{took:?}");
    fs::remove_dir_all(root).unwrap();
}

/// The stylesheet is written from an atom index kept as records change (KF-062), not from a walk of
/// every module. After edits and removals it is the stylesheet a fresh session writes for the
/// modules left, byte for byte: shared atoms, the first module's copy of a class, unfolds two
/// modules share, and a theme's marker dependency.
#[test]
fn the_atom_index_writes_what_a_fresh_session_writes() {
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const theme = defineTokens(\"theme\", { ink: \"black\" }, { variable: true })\n";
    let module = |colour: &str, extra: &str| {
        format!(
            "import {{ css, cx, defineTheme }} from \"@kirana-style/core\"\nimport {{ theme }} from \"./tokens\"\nexport const box = css({{ color: \"{colour}\", padding: \"1rem\" }})\nexport const pick = (on: boolean) => cx(box, on && css({{ paddingTop: null }}))\n{extra}\n"
        )
    };
    // A shorthand unfolded on two targets, and one on a target nothing unfolds.
    let themed = "export const dark = defineTheme(theme, { ink: \"white\" })\nexport const shade = (on: boolean) => cx(css({ \"::before\": { padding: \"2px\" }, \"::after\": { padding: \"3px\" } }), on && css({ \"::before\": { paddingTop: null } }))";
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("tokens.ts", tokens)]);
    let path = |name: &str| root.join(name);
    project.transform(&path("a.ts"), &module("red", themed));
    project.transform(&path("b.ts"), &module("red", ""));
    project.transform(&path("c.ts"), &module("blue", ""));
    project.transform(&path("d.ts"), &module("green", ""));
    // An edit keeps one class of the old record and drops another; a removal drops an unfold one
    // other module still has.
    project.transform(&path("b.ts"), &module("green", ""));
    assert!(project.remove(&path("c.ts")));
    // A module earlier in path order now writes classes later ones wrote first.
    project.transform(&path("0.ts"), &module("green", ""));
    let fresh = |files: &[(&str, String)]| {
        let (other, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("tokens.ts", tokens)]);
        for (name, source) in files {
            project.transform(&other.join(name), source);
        }
        let css = project.stylesheet(false);
        fs::remove_dir_all(other).unwrap();
        css
    };
    let left = [
        ("0.ts", module("green", "")),
        ("a.ts", module("red", themed)),
        ("b.ts", module("green", "")),
        ("d.ts", module("green", "")),
    ];
    assert_eq!(project.stylesheet(false), fresh(&left));
    // Every module gone: nothing left of them.
    for name in ["a.ts", "0.ts", "b.ts", "d.ts"] {
        assert!(project.remove(&path(name)));
    }
    assert_eq!(project.stylesheet(false), fresh(&[]));
    fs::remove_dir_all(root).unwrap();
}

/// A style written out in full compiles once a session, wherever it is written (KF-059); one that
/// reports, reads a name or names an emitted rule compiles where it is written.
#[test]
fn a_style_written_out_in_full_compiles_once_a_session() {
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const size = defineTokens(\"size\", { gap: \"2px\" }, { variable: true })\n";
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}"), ("tokens.ts", tokens)]);
    let compile = |name: &str, source: &str| project.transform(&root.join(name), source);
    let variable = {
        let out = compile("tokens.ts", tokens).code.unwrap();
        let start = out.find("var(").unwrap() + 4;
        out[start..start + out[start..].find(')').unwrap()].to_owned()
    };
    let styles = |project: &Project| project.work().styles;
    let full = "{ color: \"red\", zIndex: -1, opacity: 0.5, inset: `0`, padding: { base: \"4px\", \":hover\": null }, \"--x\": \"1px\" }";
    let a = format!(
        "import {{ css }} from \"@kirana-style/core\"\nexport const a = css({full})\nexport const none = css()\n"
    );
    let first = compile("a.ts", &a);
    assert_eq!(first.diagnostics, []);
    assert_eq!(styles(&project), 0);
    // The same style in another module, twice, after other code: answered, and written the same.
    let b = format!(
        "import {{ css }} from \"@kirana-style/core\"\n\nconst pad = 1\nexport const b = css({full})\nexport const c = css({full})\nexport const two = css({full}, {full})\n"
    );
    let second = compile("b.ts", &b);
    // Both arguments are the key of a call that has two.
    assert_eq!(styles(&project), 2);
    let a_class = &first.code.as_deref().unwrap()[first.code.as_deref().unwrap().find("const a = ").unwrap()..];
    let b_class = &second.code.as_deref().unwrap()[second.code.as_deref().unwrap().find("const b = ").unwrap()..];
    assert_eq!(
        a_class.lines().next().unwrap().replace("const a", ""),
        b_class.lines().next().unwrap().replace("const b", "")
    );
    // Each of these compiles where it is written: a report keeps its place, a name is read, a
    // spread or a computed key is evaluated, a variable's emitted name is looked up.
    let others = format!(
        "import {{ css }} from \"@kirana-style/core\"\nconst hover = \":hover\"\nconst more = {{ color: \"blue\" }}\nexport const d = css({{ colr: \"red\" }})\nexport const e = css({{ colr: \"red\" }})\nexport const f = css({{ color: hover }})\nexport const g = css({{ ...more }})\nexport const h = css({{ color: {{ [hover]: \"red\" }} }})\nexport const i = css({{ gap: \"var({variable})\" }})\nexport const j = css({{ gap: \"var({variable})\" }})\nexport const k = css(...[more])\nexport const l = css({{ m() {{ return 1 }} }})\nexport const m = css({{ get n() {{ return 1 }} }})\nexport const n = css({{ color }})\nexport const o = css({{ margin: -hover }})\nexport const p = css({{ [\"color\"]: \"red\" }})\n"
    );
    let third = compile("c.ts", &others);
    assert_eq!(styles(&project), 2);
    let unknown: Vec<u32> =
        third.diagnostics.iter().filter(|d| d.code == Code::UnknownProperty).map(|d| d.span.start).collect();
    assert_eq!(unknown.len(), 2, "{:?}", third.diagnostics);
    assert_ne!(unknown[0], unknown[1]);
    // Marked names are another key.
    project.mark_dense();
    compile("d.ts", &a);
    assert_eq!(styles(&project), 2);
    compile("e.ts", &a);
    assert_eq!(styles(&project), 3);
    fs::remove_dir_all(root).unwrap();
}

/// A long session keeps what its modules define and import now, not everything they ever did: an
/// edited keyframes block's old name leaves the registry, a removed module's names go with it, and
/// an import a module drops no longer compiles it again.
#[test]
fn a_long_session_keeps_only_what_modules_still_define_and_import() {
    let frames = |to: &str| {
        format!(
            "import {{ css, keyframes }} from \"@kirana-style/core\"\nexport const spin = keyframes({{ from: {{ opacity: 0 }}, to: {{ opacity: {to} }} }})\nexport const a = css({{ animationName: spin }})\n"
        )
    };
    let (root, project) =
        temp_project(&[("package.json", "{\"name\":\"app\"}"), ("helper.ts", "export const gap = \"1px\"\n")]);
    let anim = root.join("anim.ts");
    let first = project.transform(&anim, &frames("1")).code.unwrap();
    let name = |code: &str| {
        let at = code.find("spin = ").unwrap() + 8;
        code[at..at + code[at..].find('"').unwrap()].to_owned()
    };
    let old = name(&first);
    // A style naming the keyframes by their emitted name finds them while they are defined.
    let reader = root.join("reader.ts");
    let reads = format!(
        "import {{ css }} from \"@kirana-style/core\"\nexport const b = css({{ animationName: \"{old}\", color: \"red\" }})\n"
    );
    project.transform(&reader, &reads);
    assert!(project.stylesheet(false).contains(&format!("@keyframes {old}")));
    // Edited: the old name is defined nowhere, so a module compiled now does not bring it back.
    let edited = project.transform(&anim, &frames("0.5")).code.unwrap();
    assert_ne!(name(&edited), old);
    project.transform(&reader, &reads.replace("red", "blue"));
    assert!(!project.stylesheet(false).contains(&format!("@keyframes {old}")), "{}", project.stylesheet(false));
    // Removed: its names go too.
    let current = name(&edited);
    project.remove(&anim);
    let reads_current = reads.replace(&old, &current);
    project.transform(&reader, &reads_current);
    assert!(!project.stylesheet(false).contains(&format!("@keyframes {current}")));

    // An import dropped: an edit of the file it named no longer compiles the module again.
    let user = root.join("user.ts");
    let importing =
        "import { css } from \"@kirana-style/core\"\nimport { gap } from \"./helper\"\nexport const c = css({ gap })\n";
    project.transform(&user, importing);
    assert_eq!(project.invalidate(&root.join("helper.ts")), std::slice::from_ref(&user));
    project.transform(&user, importing);
    project.transform(&user, "import { css } from \"@kirana-style/core\"\nexport const c = css({ gap: \"2px\" })\n");
    assert_eq!(project.invalidate(&root.join("helper.ts")), Vec::<PathBuf>::new());
    // Nor does one a module that stopped carrying styles, or one that no longer parses, had.
    project.transform(&user, importing);
    project.transform(&user, "export const plain = 1\n");
    assert_eq!(project.invalidate(&root.join("helper.ts")), Vec::<PathBuf>::new());
    project.transform(&user, importing);
    project.transform(&user, "import { css } from \"@kirana-style/core\"\nexport const c = css({ gap: \n");
    assert_eq!(project.invalidate(&root.join("helper.ts")), Vec::<PathBuf>::new());
    project.transform(&user, importing);
    project.remove(&user);
    assert_eq!(project.invalidate(&root.join("helper.ts")), Vec::<PathBuf>::new());
    fs::remove_dir_all(root).unwrap();
}

/// The session's styles written out in full are bounded: past 16,384 the cache starts over, so an
/// editor typing styles does not keep every keystroke (KF-059).
#[test]
fn styles_written_out_in_full_are_kept_up_to_a_bound() {
    let (root, project) = temp_project(&[("package.json", "{\"name\":\"app\"}")]);
    let style = |index: usize| format!("css({{ color: \"#{index:06x}\" }})");
    let mut many = String::from("import { css } from \"@kirana-style/core\"\n");
    for index in 0..=16_384 {
        many += &format!("export const s{index} = {}\n", style(index));
    }
    project.transform(&root.join("many.ts"), &many);
    assert_eq!(project.work().styles, 0);
    let again = |index: usize| {
        project.transform(
            &root.join("again.ts"),
            &format!("import {{ css }} from \"@kirana-style/core\"\nexport const x = {}\n", style(index)),
        );
        project.work().styles
    };
    // The last one kept, the first one dropped when the cache started over.
    assert_eq!(again(16_384), 1);
    assert_eq!(again(0), 1);
    fs::remove_dir_all(root).unwrap();
}
