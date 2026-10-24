//! `kirana-style migrate tailwind` against a real project: the fixture's grammar and scales, resolved the
//! way the command line resolves them.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use kirana_config::Grammar;
use kirana_migrate::tailwind::{Environment, Options, ProjectMap, lower, migrate, survey};
use kirana_project::Project;
use kirana_shared::OsFs;

fn root() -> PathBuf {
    fs::canonicalize(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/migrate-tailwind")).unwrap()
}

fn project() -> Project {
    let root = root();
    let mut config: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(root.join("kirana.json")).unwrap()).unwrap();
    config["root"] = serde_json::Value::String(root.to_string_lossy().into_owned());
    Project::new(&config.to_string(), Arc::new(OsFs)).expect("the fixture's configuration is valid")
}

struct Env<'p> {
    project: &'p Project,
    file: &'p Path,
}

impl Environment for Env<'_> {
    fn export(&self, module: &str, export: &str) -> kirana_ir::Value {
        self.project.import_value(self.file, module, export)
    }

    fn is_external(&self, specifier: &str) -> bool {
        self.project.is_external(self.file, specifier)
    }

    fn specifier(&self, file: &Path) -> String {
        format!("./{}", file.file_stem().unwrap().to_string_lossy())
    }

    fn resolve(&self, specifier: &str) -> Option<PathBuf> {
        self.project.resolve(self.file, specifier)
    }
}

fn custom() -> (BTreeSet<String>, BTreeSet<String>) {
    (
        ["data-open".to_owned(), "data-horizontal".to_owned(), "dark".to_owned()].into(),
        ["no-scrollbar".to_owned(), "scroll-fade-*".to_owned()].into(),
    )
}

/// Migrates `source` as the file `name` in the fixture directory.
fn run(project: &Project, name: &str, source: &str) -> kirana_migrate::Migration {
    let grammar: Grammar = project.config().utilities.clone().unwrap();
    let (variants, utilities) = custom();
    let root = root();
    let relations = ProjectMap::default();
    let options =
        Options { grammar: &grammar, custom_variants: &variants, custom_utilities: &utilities, project: &relations };
    let file = root.join(name);
    migrate(&file, source, &options, &Env { project, file: &file })
}

fn notes(migration: &kirana_migrate::Migration) -> Vec<String> {
    migration.notes.iter().map(|note| note.message.clone()).collect()
}

#[test]
fn the_whole_fixture() {
    let project = project();
    let source = fs::read_to_string(root().join("input.tsx")).unwrap();
    let migration = run(&project, "input.tsx", &source);
    insta::assert_snapshot!("tailwind", migration.source);
    insta::assert_debug_snapshot!("tailwind-notes", notes(&migration));
    assert!(migration.changed(&source));
}

/// The objects the codemod writes compile to the atoms their utility strings compile to.
#[test]
fn migrated_objects_compile_to_the_atoms_of_their_utility_strings() {
    let project = project();
    let atoms = |name: &str, source: &str| -> String {
        let transformed = project.transform(&root().join(name), source);
        let errors: Vec<&str> = transformed
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.severity == kirana_diagnostics::Severity::Error)
            .map(|diagnostic| diagnostic.message.as_str())
            .collect();
        assert!(errors.is_empty(), "{name}: {errors:?}\n{source}");
        let code = transformed.code.unwrap_or_default();
        let class = code.split("className=\"").nth(1).and_then(|rest| rest.split('"').next()).unwrap_or_default();
        let mut names: Vec<&str> = class.split(' ').filter(|name| !name.is_empty() && !name.ends_with('_')).collect();
        names.sort_unstable();
        names.join(" ")
    };
    for (index, classes) in [
        "flex flex-col gap-4 p-4 text-sm",
        "px-2 hover:bg-primary/80 md:px-1",
        "-mt-2 w-1/2 rounded-lg p-50 bg-[rgb(1,2,3)]",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "font-semibold opacity-50 border",
        "after:absolute hover:after:bg-muted",
        "@container @md:p-2 data-horizontal:flex-row has-data-[icon=x]:px-1",
    ]
    .iter()
    .enumerate()
    {
        let migrated =
            run(&project, &format!("m{index}.tsx"), &format!("export const A = () => <p className=\"{classes}\" />\n"));
        assert!(migrated.notes.is_empty(), "{classes}: {:?}", notes(&migrated));
        let from_object = atoms(&format!("m{index}.tsx"), &migrated.source);
        let from_string = atoms(&format!("u{index}.tsx"), &format!("export const A = () => <p sx=\"{classes}\" />\n"));
        assert!(!from_object.is_empty(), "{classes}");
        assert_eq!(from_object, from_string, "{classes}\n{}", migrated.source);
    }
}

#[test]
fn a_file_without_imports_gets_them_at_the_top() {
    let project = project();
    let migration = run(&project, "a.tsx", "export const A = () => <p className=\"p-2\" />\n");
    assert!(
        migration.source.starts_with(
            "import { css } from \"@kirana-style/core\"\nimport { space } from \"./scales\"\n\nconst styles"
        ),
        "{}",
        migration.source
    );
    // Nothing to rewrite: the file is returned as it was.
    let untouched = run(&project, "b.tsx", "export const b = 1\n");
    assert_eq!(untouched.source, "export const b = 1\n");
    assert!(!untouched.changed("export const b = 1\n"));
    // Only a relation: an import and a declaration, no styles object.
    let relation = run(&project, "c.tsx", "import x from \"y\"\nexport const C = () => <p className=\"group\" />\n");
    assert!(
        relation
            .source
            .contains("import { relation } from \"@kirana-style/core\"\n\nconst group = relation(\"group\")")
    );
}

#[test]
fn an_existing_styles_binding_is_not_shadowed() {
    let project = project();
    let migration = run(&project, "a.tsx", "const styles = 1\nexport const A = () => <p className=\"p-2\" />\n");
    assert!(migration.source.contains("const migrated = {"), "{}", migration.source);
    assert!(migration.source.contains("sx={migrated.a}") || migration.source.contains("sx={migrated."));
}

#[test]
fn a_file_that_does_not_parse_is_left_alone() {
    let project = project();
    let migration = run(&project, "a.tsx", "const = = =\n");
    assert_eq!(migration.source, "const = = =\n");
    assert_eq!(notes(&migration), ["the file does not parse; nothing was rewritten"]);
}

#[test]
fn joiner_imports_go_when_nothing_uses_them() {
    let project = project();
    let only = run(
        &project,
        "a.tsx",
        "import { cn } from \"./utils\"\nexport const A = () => <p className={cn(\"p-2\")} />\n",
    );
    assert!(!only.source.contains("./utils"), "{}", only.source);
    let first = run(
        &project,
        "a.tsx",
        "import { cn, other } from \"./utils\"\nexport const A = () => <p className={cn(\"p-2\", other)} />\n",
    );
    assert!(first.source.contains("import { cn, other } from \"./utils\""), "{}", first.source);
    let last = run(
        &project,
        "a.tsx",
        "import { other, cn } from \"./utils\"\nexport const A = () => <p className={cn(\"p-2\")} />\n",
    );
    assert!(last.source.contains("import { other } from \"./utils\""), "{}", last.source);
    let middle = run(
        &project,
        "a.tsx",
        "import { other, cn, more } from \"./utils\"\nexport const A = () => <p className={cn(\"p-2\")} />\n",
    );
    assert!(middle.source.contains("import { other, more } from \"./utils\""), "{}", middle.source);
}

#[test]
fn values_render_as_source() {
    let project = project();
    let object = |classes: &str| {
        let literal = serde_json::to_string(classes).unwrap();
        let migration = run(&project, "a.tsx", &format!("export const A = () => <p className={{{literal}}} />\n"));
        let start = migration.source.find("css({").unwrap_or_else(|| panic!("{classes}: {}", migration.source));
        migration.source[start..].split("\n  }),").next().unwrap().to_owned()
    };
    assert!(object("p-[a`b${c}\\d]").contains(r#"padding: "a`b${c}\\d""#));
    assert!(object("p-[say_\"hi\"]").contains(r#"padding: 'say "hi"'"#));
    assert!(object("p-[say_\"it's\"]").contains(r#"padding: "say \"it's\"""#));
    assert!(object("-mt-[3px]").contains(r#"marginTop: "calc(3px * -1)""#));
    assert!(object("[--x:1]").contains(r#""--x": "1""#));
    assert!(object("[-webkit-line-clamp:2]").contains(r#"WebkitLineClamp: "2""#));
    assert!(object("[x:--spacing(2)_--spacing(4)]").contains("x: `calc(${space[1]} * 2) calc(${space[1]} * 4)`"));
    assert!(object("text-blue-600").contains("color: color.blue[600]"));
    assert!(object("p-0.5").contains(r#"padding: space["0.5"]"#));
}

/// Migrates a snippet and returns the source and the report.
fn snippet(name: &str, source: &str) -> (String, Vec<String>) {
    let project = project();
    let migration = run(&project, name, source);
    let report = notes(&migration);
    (migration.source, report)
}

#[test]
fn every_class_expression_shape() {
    let (source, report) = snippet(
        "a.tsx",
        "function C({ className, ...props }) {\n  const kept = className\n  return <>\n    \
         <p className={cn((\"p-2\"), props.className, open && \"\", obj.fn(), a + b)} />\n    \
         <p className=<b /> />\n    <p xlink:href=\"x\" className=\"p-2\" />\n    \
         <p data-slot={slot} className=\"p-2\" />\n    <p data-slot=\"2-col\" className=\"p-2\" />\n    \
         <svg:rect className=\"p-2\" />\n  </>\n}\n",
    );
    assert!(source.contains("const kept = sx"), "{source}");
    assert!(source.contains("sx={[styles.cP, props.sx]} className={cn(obj.fn(), a + b)}"), "{source}");
    assert!(source.contains("<p className=<b /> />"), "{source}");
    assert!(source.contains("<p xlink:href=\"x\" sx={styles.cP2} />"), "{source}");
    assert!(source.contains("_2Col: css("), "{source}");
    assert!(source.contains("<svg:rect sx={styles.cSvgRect} />"), "{source}");
    assert_eq!(report, ["`cn(obj.fn(), a + b)` is not a static class string; it stays a class"]);
}

#[test]
fn recipes_and_their_calls() {
    let (source, report) = snippet(
        "a.tsx",
        "const v = cva(\"\", { variants: { ...a, tone: { ...b, x: \"p-2\" } }, compoundVariants: [{ ...c, tone: \"x\", class: \"p-4\" }, d] })\n\
         const empty = cva()\n\
         function C({ className, tone }) {\n  return <>\n    <p className={cn(v({ className }))} />\n    \
         <p className={cn(v(opts))} />\n    <p className={cn(v({ tone }))} />\n    \
         <p className={cn(v({ tone, className: \"p-2\" }))} />\n    <p className={cn(v({ tone, className: dynamic }))} />\n  </>\n}\n",
    );
    assert!(!source.contains("base:"), "an empty base is left out:\n{source}");
    assert!(source.contains("variants: {\n    ...a,\n    tone: {\n      ...b,\n      x: {"), "{source}");
    assert!(source.contains("      ...c,\n      tone: \"x\",\n      css: {"), "{source}");
    assert!(source.contains("    },\n    d,\n  ],"), "{source}");
    assert!(source.contains("const empty = recipe({})"), "{source}");
    assert!(source.contains("sx={[v(), sx]}"), "{source}");
    assert!(source.contains("sx={v(opts)}"), "{source}");
    assert!(source.contains("sx={v({ tone })}"), "{source}");
    assert!(source.contains("sx={[v({ tone }), styles.cP]}"), "{source}");
    assert!(source.contains("sx={[v({ tone }), dynamic]}"), "{source}");
    assert_eq!(report, ["`dynamic` is cva's className option and not a static class string; pass it as className"]);
}

#[test]
fn objects_handed_to_merge_props() {
    let (source, _) = snippet(
        "a.tsx",
        "const top = { className: \"p-2\" }\nfunction C({ className }) {\n  return mergeProps({ className }, { className: other })\n}\n",
    );
    assert!(source.contains("const top = { ...styleProps(styles.root) }"), "{source}");
    assert!(source.contains("mergeProps({ ...styleProps(sx) }, { className: other })"), "{source}");
    // Only the `props` import: no declarations follow it.
    let (only, _) =
        snippet("b.tsx", "import x from \"y\"\nfunction C({ className }) {\n  return mergeProps({ className })\n}\n");
    assert!(
        only.starts_with("import x from \"y\"\nimport { props as styleProps } from \"@kirana-style/core\"\nfunction C"),
        "{only}"
    );
}

#[test]
fn variants_the_codemod_resolves_itself() {
    let (source, report) = snippet(
        "a.tsx",
        "export default function () {\n  return <>\n    <p className=\"peer/field size-4\" />\n    \
         <p className=\"peer-disabled/field:p-2 group/card:p-2 grouped:p-2 [&:hover]:p-2 after:after:p-2\" />\n    \
         <p className=\"[&_svg]:data-[x]:p-2 [&_svg]:[a]:p-2 [&_svg[a]x]:p-2 [&_svg[a[b]]]:p-2 [&_svg:not([class=a]b)]:p-2\" />\n    \
         <p className=\"[--x-color:red] dark:[--x-color:blue] [foo] [x:--spacing(2] p-(--gap\" />\n  </>\n}\n",
    );
    assert!(source.contains("const fieldPeer = relation(\"field\")"), "{source}");
    assert!(source.contains("[fieldPeer.after(\":disabled\")]"), "{source}");
    assert!(source.contains("[cardGroup.within()]"), "{source}");
    assert!(source.contains("[cardGroup.within()]: space[2], \":hover\": space[2] }"), "{source}");
    assert!(source.contains("[select.descendant(\"svg[data-x]\")]"), "{source}");
    assert!(source.contains("\"--x-color\": \"light-dark(red, blue)\""), "{source}");
    assert!(source.contains("x: \"--spacing(2\""), "{source}");
    for expected in [
        "`grouped:p-2`: `grouped:` reads another element's state",
        "`after:after:p-2`: a pseudo-element inside another block; write it in css() by hand",
        "`[&_svg]:[a]:p-2`: `:is(a)` is a state of the contextual target, which css() cannot select",
        "`[&_svg[a]x]:p-2`: `svg[a]x` is not a contextual target: an element name, attribute selectors and pseudo-classes",
        "`[foo]` is not a utility",
        "`p-(--gap`: no such value",
    ] {
        assert!(report.iter().any(|note| note.starts_with(expected)), "{expected}\n{report:#?}");
    }
}

#[test]
fn imports_are_written_relative_to_the_file() {
    let (source, report) =
        snippet("sub/a.tsx", "export const A = () => <p className=\"p-2 bg-muted rounded-lg shadow-sm\" />\n");
    assert!(report.is_empty(), "{report:?}");
    assert!(source.contains("import { shadow } from \"@kirana-style/preset-scales\""), "{source}");
    assert!(source.contains("import { radius, space } from \"../scales\""), "{source}");
    assert!(source.contains("import { theme } from \"../theme\""), "{source}");
}

#[test]
fn an_edit_inside_a_rewritten_attribute_goes_with_it() {
    let (source, report) = snippet(
        "a.tsx",
        "export const A = () => <p className={cn(\"p-2\", items.map(({ className }) => className))} />\n",
    );
    assert!(source.contains("sx={styles.aP} className={cn(items.map(({ className }) => className))}"), "{source}");
    assert_eq!(report.len(), 1, "{report:?}");
}

#[test]
fn dark_pairs_only_colours() {
    let (source, report) = snippet(
        "a.tsx",
        "export const A = () => <p className=\"opacity-50 dark:opacity-80 dark:bg-muted [fill:red] dark:[fill:blue]\" />\n",
    );
    assert!(source.contains("backgroundColor: `light-dark(transparent, ${theme.muted})`"), "{source}");
    assert!(source.contains("fill: \"light-dark(red, blue)\""), "{source}");
    assert!(source.contains("opacity: { light: \"50%\", dark: \"80%\" },"), "{source}");
    assert!(source.contains("const modes = defineTokens(\n  \"fixtures-migrate-tailwind-a-modes\","), "{source}");
    assert!(source.contains("opacity: modes.opacity,"), "{source}");
    assert_eq!(
        report,
        [
            "`dark:` on properties that are not colours became per-mode tokens (`modes`): they follow the color scheme and Kirana's `mode` handles — apply `mode.dark` and `mode.light` where the app's theme switch sets `.dark`"
        ]
    );
    // At conditions of its own, `dark:` pairs with the value the enclosing conditions set.
    let (source, report) = snippet(
        "b.tsx",
        "export const B = () => <p className=\"text-muted hover:underline dark:hover:text-primary\" />\n",
    );
    assert!(
        source.contains("color: { base: theme.muted, \":hover\": `light-dark(${theme.muted}, ${theme.primary})` }"),
        "{source}"
    );
    assert!(report.is_empty(), "{report:?}");
}

#[test]
fn token_imports_never_shadow_a_name() {
    // The file already has `space` and `scalesSpace`; the preset's `space` becomes `scalesSpace2`.
    let (source, _) = snippet(
        "a.tsx",
        "import { space, scalesSpace } from \"./other\"\nexport const A = () => <p className=\"p-2 gap-4\" />\n",
    );
    assert!(source.contains("import { space as scalesSpace2 } from \"./scales\""), "{source}");
    assert!(source.contains("padding: scalesSpace2[2]") && source.contains("gap: scalesSpace2[4]"), "{source}");
    // Two modules exporting `color`: the second is imported under its module's name.
    let (source, _) = snippet("b.tsx", "export const B = () => <p className=\"text-blue-600 bg-brand\" />\n");
    assert!(source.contains("import { color } from \"./scales\""), "{source}");
    assert!(source.contains("import { color as brandColor } from \"./brand\""), "{source}");
    assert!(source.contains("backgroundColor: brandColor.brand"), "{source}");
}

#[test]
fn a_key_or_a_comment_is_not_a_use() {
    // `[line-height:1]` replaces the paired line height: `lineHeight` is only a key now.
    let (source, _) =
        snippet("a.tsx", "export const A = () => <p className=\"text-sm [line-height:1] hover:!p-2\" />\n");
    assert!(source.contains("import { fontSize } from \"./scales\""), "{source}");
    assert!(source.contains("lineHeight: \"1\""), "{source}");
}

#[test]
fn a_recipe_anchor_goes_to_every_call() {
    let (source, report) = snippet(
        "a.tsx",
        "const v = cva(\"group/tabs p-2\", { variants: { size: { sm: \"group/size\", md: \"group/tabs\" } } })\n\
         const unused = cva(\"group/lone\")\n\
         export const A = () => <p className={cn(v({ size: \"sm\" }))} />\n",
    );
    assert!(source.contains("sx={[tabsGroup.anchor, sizeGroup.anchor, v({ size: \"sm\" })]}"), "{source}");
    assert_eq!(report, ["recipe `unused` anchors `loneGroup.anchor`: apply it where the recipe is used"]);
}

#[test]
fn only_a_components_own_class_name_becomes_sx() {
    let (source, _) = snippet(
        "a.tsx",
        "function Calendar({ className, classNames }) {\n  const own = className\n  return <DayPicker className={className} \
         classNames={{ day: cn(\"group/day p-2\", classNames.day) }} components={{ Root: ({ className, ...rest }) => \
         <div className={className} {...rest} />, Chevron: ({ className: chevron }) => <i className={cn(chevron)} /> }} \
         render={function render({ className }) { return mergeProps({ className }) }} />\n}\n\
         const helper = ({ className }) => className\nexport const Card = function ({ className }) { return <p className={className} /> }\n",
    );
    assert!(source.contains("function Calendar({ sx, classNames })"), "{source}");
    assert!(source.contains("const own = sx"), "{source}");
    assert!(source.contains("<DayPicker sx={sx}"), "{source}");
    assert!(
        source.contains("day: styleProps(dayGroup.anchor, styles.calendar, cn(classNames.day)).className"),
        "{source}"
    );
    assert!(source.contains("Root: ({ className, ...rest }) => <div className={className} {...rest} />"), "{source}");
    assert!(source.contains("Chevron: ({ className: chevron }) => <i className={cn(chevron)} />"), "{source}");
    assert!(source.contains("mergeProps({ className })"), "{source}");
    assert!(source.contains("const helper = ({ className }) => className"), "{source}");
    assert!(source.contains("export const Card = function ({ sx }) { return <p sx={sx} /> }"), "{source}");
}

#[test]
fn a_relation_anchored_in_one_file_is_imported_by_its_readers() {
    let project = project();
    let grammar: Grammar = project.config().utilities.clone().unwrap();
    let (variants, utilities) = custom();
    let empty = ProjectMap::default();
    let mut options =
        Options { grammar: &grammar, custom_variants: &variants, custom_utilities: &utilities, project: &empty };
    let root = root();
    let files = [
        ("card.tsx", "export const Card = () => <div className=\"group/card p-2\" />\n"),
        (
            "title.tsx",
            "export const Title = () => <p className=\"group-hover/card:underline group-hover/lone:p-2\" />\n",
        ),
        ("broken.tsx", "const = =\n"),
    ];
    let mut relations = ProjectMap::default();
    for (name, source) in files {
        let file = root.join(name);
        relations.add(&file, &survey(&file, source, &options, &Env { project: &project, file: &file }));
    }
    assert_eq!(relations.anchors.len(), 1);
    options.project = &relations;
    let run = |name: &str, source: &str| {
        let file = root.join(name);
        migrate(&file, source, &options, &Env { project: &project, file: &file })
    };
    let card = run(files[0].0, files[0].1);
    assert!(card.source.contains("export const cardGroup = relation(\"card\")"), "{}", card.source);
    let title = run(files[1].0, files[1].1);
    assert!(title.source.contains("import { cardGroup } from \"./card\""), "{}", title.source);
    assert!(!title.source.contains("const cardGroup"), "{}", title.source);
    assert_eq!(
        notes(&title),
        [
            "`loneGroup` (relation \"lone\") is read here and anchored in no migrated file: apply its anchor where the state lives"
        ]
    );
}

#[test]
fn a_pseudo_element_exists_only_under_its_conditions() {
    let (source, _) =
        snippet("a.tsx", "export const A = () => <p className=\"hover:after:p-2 focus-visible:after:p-4\" />\n");
    assert!(source.contains("content: { \":hover\": '\"\"', \":focus-visible\": '\"\"' }"), "{source}");
}

/// Surveys a snippet first, as the command line does, then migrates it with what the survey found.
fn surveyed(name: &str, source: &str) -> String {
    let project = project();
    let grammar: Grammar = project.config().utilities.clone().unwrap();
    let (variants, utilities) = custom();
    let empty = ProjectMap::default();
    let mut options =
        Options { grammar: &grammar, custom_variants: &variants, custom_utilities: &utilities, project: &empty };
    let file = root().join(name);
    let mut map = ProjectMap::default();
    map.add(&file, &survey(&file, source, &options, &Env { project: &project, file: &file }));
    options.project = &map;
    migrate(&file, source, &options, &Env { project: &project, file: &file }).source
}

#[test]
fn a_wrapper_hands_sx_to_the_installed_component() {
    let source = surveyed(
        "a.tsx",
        "import * as Primitive from \"react\"\n\
         function Collapsible({ ...props }) {\n  return <Primitive.Suspense data-slot=\"collapsible\" {...props} />\n}\n\
         function Own({ ...props }) {\n  return <div {...props} />\n}\n\
         function Classed({ ...props }) {\n  return <Primitive.Suspense className=\"p-2\" {...props} />\n}\n\
         const helper = ({ ...props }) => <Primitive.Suspense {...props} />\n\
         function Provider({ ...props }) {\n  return <Primitive.Suspense {...props} />\n}\n\
         function Named({ className, ...props }) {\n  return <Primitive.Suspense className={className} {...props} />\n}\n\
         import { Profiler as Timed } from \"react\"\nimport { Missing } from \"./missing\"\n\
         export const Page = () => <><Collapsible className=\"flex\" /><Own className=\"flex\" /><Classed className=\"flex\" />\
         <Timed className=\"flex\" /><Missing className=\"flex\" /><Provider /><Named className=\"flex\" /></>\n",
    );
    assert!(source.contains("function Collapsible({ sx, ...props })"), "{source}");
    assert!(
        source.contains("<Primitive.Suspense data-slot=\"collapsible\" {...styleProps(sx)} {...props} />"),
        "{source}"
    );
    // A host element reads `sx` only as its own attribute, not from a spread; one that sets its own
    // class is left as it is.
    assert!(
        source.contains("function Own({ sx, ...props })") && source.contains("<div sx={sx} {...props} />"),
        "{source}"
    );
    assert!(source.contains("function Classed({ ...props })"), "{source}");
    assert!(source.contains("const helper = ({ ...props }) => <Primitive.Suspense {...props} />"), "{source}");
    // Nobody passes the provider a class: it takes no `sx`.
    assert!(source.contains("function Provider({ ...props })"), "{source}");
}

#[test]
fn a_constant_class_string_becomes_a_style() {
    let (source, report) = snippet(
        "a.tsx",
        "const LABEL = \"group/label p-2\"\nexport const NAME = `gap-4`\nexport function Exported() {}\nconst OTHER = \"p-4\"\nlet LOOSE = \"p-4\"\n\
         export const A = () => <><span className={LABEL} /><i className={cn(NAME, \"p-2\")} /><b className={LABEL} /></>\n\
         export const B = () => LABEL.length\n",
    );
    assert!(source.contains("const LABEL = css(labelGroup.anchor, {\n  padding"), "{source}");
    assert!(source.contains("export const NAME = css({\n  gap: space[4],\n})"), "{source}");
    assert!(source.contains("<span sx={LABEL} />") && source.contains("<b sx={LABEL} />"), "{source}");
    assert!(source.contains("<i sx={[NAME, styles.aI]} />"), "{source}");
    assert!(source.contains("const OTHER = \"p-4\"") && source.contains("let LOOSE = \"p-4\""), "{source}");
    assert_eq!(
        report,
        [
            "`LABEL` is now a style, and it is also used as a string elsewhere; those uses need a class name: `props(LABEL).className`"
        ]
    );
}

#[test]
fn an_important_utility_removes_every_other_value() {
    let (source, report) = snippet("a.tsx", "export const A = () => <p className=\"hover:p-4 p-2! hover:gap-4!\" />\n");
    assert!(source.contains("padding: { \"*\": null, base: space[2], \":hover\": space[4] }"), "{source}");
    assert_eq!(report, ["`hover:gap-4!`: Kirana has no `!important`; the precedence ladder decides"]);
}

#[test]
fn an_option_drops_the_pair_tailwind_merge_would_delete() {
    let (source, _) = snippet(
        "a.tsx",
        "const v = cva(\"text-sm\", { variants: { size: { sm: \"text-[0.8rem]\", md: \"text-sm\", lg: \"p-2\" } }, \
         compoundVariants: [{ size: \"sm\", class: \"text-[1rem]\" }] })\n",
    );
    // `text-[0.8rem]` sets the size alone: the base's line height goes, as `cn()` deleted `text-sm`.
    assert!(source.contains("sm: {\n        fontSize: \"0.8rem\",\n        lineHeight: null,\n      },"), "{source}");
    assert!(
        source.contains("md: {\n        fontSize: fontSize.sm,\n        lineHeight: lineHeight.sm,\n      },"),
        "{source}"
    );
    assert!(source.contains("lg: {\n        padding: space[2],\n      },"), "{source}");
    assert!(source.contains("css: {\n        fontSize: \"1rem\",\n        lineHeight: null,\n      },"), "{source}");
}

#[test]
fn a_dark_value_with_nothing_at_rest_starts_from_initial() {
    let (source, _) = snippet(
        "b.tsx",
        "const modes = 1\nexport const B = () => <p className=\"dark:opacity-80 hover:opacity-50 dark:hover:opacity-90\" />\n",
    );
    assert!(source.contains("const migratedModes = defineTokens("), "{source}");
    assert!(source.contains("opacity: { light: \"initial\", dark: \"80%\" },"), "{source}");
    assert!(source.contains("opacity2: { light: \"50%\", dark: \"90%\" },"), "{source}");
    assert!(
        source.contains("opacity: { base: migratedModes.opacity, \":hover\": migratedModes.opacity2 }"),
        "{source}"
    );
    // Two `dark:` values for one place are one token, the later one's.
    let (source, _) = snippet("c.tsx", "export const C = () => <p className=\"dark:opacity-80 dark:opacity-70\" />\n");
    assert!(source.contains("opacity: { light: \"initial\", dark: \"70%\" },\n  },"), "{source}");
}

#[test]
fn consecutive_strings_in_a_joiner_are_one_class_list() {
    let (source, _) = snippet(
        "a.tsx",
        "export const A = ({ on }) => <><p className={cn(\"bg-muted p-2\", \"dark:bg-primary\", on && \"gap-4\", \"p-4\")} />\
         <p className={cn(\"p-2\", cn(\"gap-4\", \"p-4\"), on && \"gap-2\")} /></>\n",
    );
    assert!(source.contains("backgroundColor: `light-dark(${theme.muted}, ${theme.primary})`"), "{source}");
    assert!(source.contains("sx={[styles.aP, on && styles.aP2, styles.aP3]}"), "{source}");
    assert!(source.contains("sx={[styles.aP4, styles.aP5, on && styles.aP6]}"), "{source}");
    // A nested joiner with a condition inside is several items behind one `&&`.
    let (source, _) = snippet(
        "b.tsx",
        "export const B = ({ on, off }) => <p className={cn(on && cn(\"p-2\", off && \"gap-4\"))} />\n",
    );
    assert!(source.contains("sx={on && [styles.bP, off && styles.bP2]}"), "{source}");
}

#[test]
fn a_size_s_line_height_yields_to_one_set_directly() {
    let (source, _) = snippet("a.tsx", "export const A = () => <p className=\"[line-height:2] text-sm\" />\n");
    assert!(source.contains("lineHeight: \"2\",") && !source.contains("lineHeight.sm"), "{source}");
}

#[test]
fn space_and_divide_style_every_child_but_the_last() {
    let (source, _) = snippet(
        "a.tsx",
        "export const A = () => <div className=\"space-x-2 -space-y-1 divide-y divide-x-2 divide-border divide-y-bogus space-z-2\" />\n",
    );
    assert!(source.contains("[select.child(\":not(:last-child)\")]"), "{source}");
    assert!(source.contains("marginInlineStart: \"0px\""), "{source}");
    assert!(source.contains("borderBlockEndWidth: \"1px\""), "{source}");
    assert!(source.contains("borderInlineEndWidth: \"2px\""), "{source}");
    assert!(source.contains("borderColor"), "{source}");
}

#[test]
fn a_child_rule_under_a_condition_or_block_is_reported() {
    let (_, report) = snippet(
        "a.tsx",
        "export const A = () => <div className=\"[&_svg]:space-x-2 hover:divide-y dark:divide-y space-y-bogus\" />\n",
    );
    assert_eq!(report.len(), 4, "{report:?}");
    assert!(report[3].contains("space-y-bogus"), "{report:?}");
    assert!(
        report[..3].iter().all(|item| item.contains("a child rule under a condition or inside a block")),
        "{report:?}"
    );
}

#[test]
fn a_recipe_imported_from_a_migrated_file_is_a_style() {
    let project = project();
    let grammar: Grammar = project.config().utilities.clone().unwrap();
    let (variants, utilities) = custom();
    let empty = ProjectMap::default();
    let mut options =
        Options { grammar: &grammar, custom_variants: &variants, custom_utilities: &utilities, project: &empty };
    let root = root();
    // Surveyed under a file that exists, so the import resolves to it.
    let recipes = root.join("utils.ts");
    let declaring = "import { cva } from \"class-variance-authority\"\nexport const buttonVariants = cva(\"p-2\")\n";
    let mut map = ProjectMap::default();
    map.add(&recipes, &survey(&recipes, declaring, &options, &Env { project: &project, file: &recipes }));
    options.project = &map;
    let file = root.join("a.tsx");
    let source = "import { buttonVariants, other } from \"./utils\"\n\
                  export const A = () => <><a className={buttonVariants()} /><a className={other()} /></>\n";
    let migration = migrate(&file, source, &options, &Env { project: &project, file: &file });
    assert!(migration.source.contains("<a sx={buttonVariants()} />"), "{}", migration.source);
    assert!(migration.source.contains("<a className={other()} />"), "{}", migration.source);
}

#[test]
fn a_class_left_on_a_component_is_reported() {
    let (source, report) = snippet(
        "a.tsx",
        "export const A = ({ id }) => <><Card className={cn(\"p-2\", id)} /><div className={cn(\"p-2\", id)} /></>\n",
    );
    assert!(source.contains("<Card sx={styles.aCard} className={cn(id)} />"), "{source}");
    assert!(
        report.iter().filter(|item| item.contains("stays a class on a component that takes `sx`")).count() == 1,
        "{report:?}"
    );
}

#[test]
fn a_props_type_declaring_class_name_declares_sx() {
    let (source, _) = snippet(
        "a.tsx",
        "function Card({ className }: { className: string; title?: { className?: string }; untyped? }) {\n  \
         return <p className={cn(\"p-2\", className)} />\n}\n\
         function Plain(props: { className?: string }) {\n  return null\n}\n\
         function Bare({ className }: { className? }) {\n  return <p className={className} />\n}\n",
    );
    assert!(source.contains("import type { Sx } from \"@kirana-style/core\""), "{source}");
    assert!(source.contains("({ sx }: { sx: Sx; title?: { className?: string }; untyped? })"), "{source}");
    assert!(source.contains("function Plain(props: { className?: string })"), "{source}");
    assert!(source.contains("function Bare({ sx }: { sx? })"), "{source}");
}

#[test]
fn in_a_slot_reads_the_relation_every_element_with_that_slot_anchors() {
    let project = project();
    let grammar: Grammar = project.config().utilities.clone().unwrap();
    let (variants, utilities) = custom();
    let empty = ProjectMap::default();
    let mut options =
        Options { grammar: &grammar, custom_variants: &variants, custom_utilities: &utilities, project: &empty };
    let root = root();
    let files = [
        (
            "group.tsx",
            "import * as Primitive from \"react\"\n\
             export const G = ({ id }) => <>\n  \
             <div data-slot=\"button-group\" className=\"flex\" />\n  \
             <span data-slot=\"button-group\" />\n  \
             <Primitive.Fragment data-slot=\"button-group\" />\n  \
             <Primitive.Fragment data-slot=\"button-group\" className={id} />\n  \
             <p data-slot=\"unread\" data-x={id} />\n</>\n",
        ),
        (
            "button.tsx",
            "export const B = () => <button className=\"in-data-[slot=button-group]:p-2 in-data-[slot='nowhere']:p-4 in-data-[slot=]:p-1 in-data-[slot=button-group]/g:p-1\" />\n",
        ),
    ];
    let mut map = ProjectMap::default();
    for (name, source) in files {
        let file = root.join(name);
        map.add(&file, &survey(&file, source, &options, &Env { project: &project, file: &file }));
    }
    options.project = &map;
    let run = |name: &str, source: &str| {
        let file = root.join(name);
        migrate(&file, source, &options, &Env { project: &project, file: &file })
    };
    let group = run(files[0].0, files[0].1);
    let source = &group.source;
    assert!(source.contains("export const inButtonGroup = relation(\"in-button-group\")"), "{source}");
    assert!(
        source.contains("<div data-slot=\"button-group\" sx={[inButtonGroup.anchor, styles.buttonGroup]} />"),
        "{source}"
    );
    assert!(source.contains("<span sx={inButtonGroup.anchor} data-slot=\"button-group\" />"), "{source}");
    assert!(
        source.contains("<Primitive.Fragment {...styleProps(inButtonGroup.anchor)} data-slot=\"button-group\" />"),
        "{source}"
    );
    assert!(source.contains("<p data-slot=\"unread\" data-x={id} />"), "{source}");
    assert!(
        notes(&group).iter().any(|note| note.contains("apply `inButtonGroup.anchor` here by hand")),
        "{:?}",
        notes(&group)
    );
    let button = run(files[1].0, files[1].1);
    let source = &button.source;
    assert!(source.contains("import { inButtonGroup } from \"./group\""), "{source}");
    assert!(source.contains("[inButtonGroup.within()]"), "{source}");
    assert!(
        notes(&button)
            .iter()
            .any(|note| note
                .contains("`inNowhere` (relation \"in-nowhere\") is read here and anchored in no migrated file")),
        "{:?}",
        notes(&button)
    );
}

#[test]
fn a_parts_styles_move_onto_the_project_component_it_renders() {
    let (source, _) = snippet(
        "a.tsx",
        "import * as Primitive from \"react\"\nimport { Button } from \"./button\"\n\
         export const A = ({ id, fn }) => <>\n  \
         <Primitive.Fragment render={<Button variant=\"ghost\" />} className=\"p-2\" />\n  \
         <Primitive.Fragment render={<Button />} className={cn(\"p-1\")} />\n  \
         <Primitive.Fragment render={<Button className=\"p-1\" />} className=\"p-2\" />\n  \
         <Primitive.Fragment render={<b />} className=\"p-2\" />\n  \
         <Primitive.Fragment render={fn} className=\"p-2\" />\n  \
         <Primitive.Fragment render=\"x\" className=\"p-2\" />\n  \
         <Primitive.Fragment render={<Primitive.Fragment />} className=\"p-2\" />\n  \
         <Primitive.Fragment render className=\"p-2\" />\n  \
         <Primitive.Fragment render={<Button />} className={cn(\"p-2\", id)} />\n  \
         <Primitive.Fragment className=\"p-2\" />\n</>\n",
    );
    assert!(
        source.contains("<Primitive.Fragment render={<Button sx={styles.aFragment} variant=\"ghost\" />}  />"),
        "{source}"
    );
    assert!(source.contains("<Primitive.Fragment render={<Button sx={styles.aFragment2} />}  />"), "{source}");
    assert!(source.contains("render={<Button sx={styles.aButton} />} {...styleProps(styles.aFragment3)}"), "{source}");
    assert_eq!(source.matches("{...styleProps(").count(), 8, "{source}");
}

#[test]
fn a_contextual_rule_the_targets_own_style_outranks_is_reported() {
    let source = surveyed(
        "a.tsx",
        "import { cva } from \"class-variance-authority\"\n\
         const buttonVariants = cva(\"px-2\")\n\
         export const Item = () => <p data-slot=\"item\" className=\"w-1/2 -mt-2 hover:p-2\" />\n\
         export const Button = () => <b data-slot=\"btn\" className={cn(buttonVariants())} />\n\
         export const Plain = () => <i data-slot=\"plain\" />\n\
         export const Group = () => <div className=\"*:data-[slot=item]:w-1/3 *:data-[slot=item]:w-1/2 *:data-[slot=item]:md:w-1/2 *:data-[slot=item]:mt-2 [&>[data-slot=btn]]:p-4 *:data-[slot=plain]:p-2 [&_svg]:p-2 [&>[data-slot]]:p-2\" />\n",
    );
    assert!(
        source.contains("tailwind: *:data-[slot=item]:w-1/3 — `data-slot=\"item\"` sets `width` itself"),
        "{source}"
    );
    assert!(
        source.contains("tailwind: [&>[data-slot=btn]]:p-4 — `data-slot=\"btn\"` sets `paddingInline` itself"),
        "{source}"
    );
    assert!(source.contains("tailwind: *:data-[slot=item]:md:w-1/2 — `data-slot=\"item\"` sets `width`"), "{source}");
    assert_eq!(source.matches("which outranks a contextual rule").count(), 4, "{source}");
}

#[test]
fn a_class_string_in_another_class_prop_is_compiled_in_place() {
    let (source, _) = snippet(
        "a.tsx",
        "export const A = ({ id }) => <><Example containerClassName=\"p-2\" /><Example containerClassName=\"\" /><Example containerClassName={id} /></>\n",
    );
    assert!(source.contains("<Example containerClassName={styleProps(styles.aExample).className} />"), "{source}");
    assert!(source.contains("<Example containerClassName=\"\" />"), "{source}");
    assert!(source.contains("<Example containerClassName={id} />"), "{source}");
}

#[test]
fn a_contextual_rule_on_a_slotted_target_moves_onto_the_target() {
    let source = surveyed(
        "a.tsx",
        "import { cva } from \"class-variance-authority\"\n\
         const groupVariants = cva(\"flex *:data-[slot=item]:-mt-2\", { variants: { size: { sm: \"*:data-[slot=item]:p-1\" } } })\n\
         const other = cva(\"*:data-[slot=item]:p-2\")\n\
         export const Item = ({ className }) => <p data-slot=\"item\" className={cn(\"w-1/2\", className)} />\n\
         export const Bare = () => <i data-slot=\"bare\" />\n\
         export const Field = () => <div data-slot=\"field\" className=\"*:data-[slot=item]:w-1/3 **:data-[slot=item]:md:p-4 *:data-[slot=bare]:p-2 dark:*:data-[slot=item]:p-2 *:data-[slot=item]:p-2! *:data-[slot=item]:[--x:1] *:[svg]:p-2 [&>[data-slot=item]:not([class*='w-'])]:w-1/2\" />\n\
         export const Group = () => <div data-slot=\"group\" className={cn(groupVariants({ size }))} />\n\
         export const Twice = () => <><b data-slot=\"one\" className={cn(other())} /><b data-slot=\"two\" className={cn(other())} /></>\n",
    );
    // The target carries the parents' rules, before the caller's `sx`.
    assert!(source.contains("sx={[styles.item, styles.item2, sx]}"), "{source}");
    assert!(source.contains("':is([data-slot=\"field\"] > [data-slot=\"item\"])': \"calc(1/3 * 100%)\""), "{source}");
    assert!(
        source.contains("':is([data-slot=\"field\"] [data-slot=\"item\"])': { \"@media (width >= 48rem)\""),
        "{source}"
    );
    assert!(source.contains("':is([data-slot=\"group\"] > [data-slot=\"item\"])': `calc("), "{source}");
    // What stays with the parent: a target without styles of its own, `dark:`, `!`, an arbitrary
    // property, a recipe's variant, a recipe applied under two slots, and targets without a slot.
    assert!(source.contains("[select.child('[data-slot=\"bare\"]')]"), "{source}");
    assert!(source.contains("[select.child(\"svg\")]"), "{source}");
    assert_eq!(source.matches("[select.child('[data-slot=\"item\"]')]").count(), 3, "{source}");
    // A guard the codemod drops stays with the parent.
    assert!(source.contains("[select.child(\"[data-slot=item]\")]"), "{source}");
}

#[test]
fn inverted_rules_keep_their_source_order() {
    let source = surveyed(
        "a.tsx",
        "export const Item = () => <p data-slot=\"item\" className=\"block\" />\n\
         export const Field = () => <div data-slot=\"field\" className=\"*:data-[slot=item]:flex *:data-[slot=item]:block\" />\n",
    );
    assert!(source.contains("display: { ':is([data-slot=\"field\"] > [data-slot=\"item\"])': \"block\" }"), "{source}");
}

#[test]
fn an_inversion_seen_twice_is_carried_once() {
    let project = project();
    let grammar: Grammar = project.config().utilities.clone().unwrap();
    let (variants, utilities) = custom();
    let empty = ProjectMap::default();
    let options =
        Options { grammar: &grammar, custom_variants: &variants, custom_utilities: &utilities, project: &empty };
    let file = root().join("a.tsx");
    let source = "export const Item = () => <p data-slot=\"item\" className=\"block\" />\n\
                  export const A = () => <div data-slot=\"field\" className=\"*:data-[slot=item]:flex\" />\n\
                  export const B = () => <div data-slot=\"field\" className=\"*:data-[slot=item]:flex\" />\n";
    let surveyed = survey(&file, source, &options, &Env { project: &project, file: &file });
    assert_eq!(surveyed.inversions.len(), 1);
    let mut map = ProjectMap::default();
    map.add(&file, &surveyed);
    map.add(&file, &surveyed);
    assert_eq!(map.inversions.len(), 1);
}

#[test]
fn a_map_of_class_strings_is_compiled_in_place() {
    let (source, _) = snippet(
        "a.tsx",
        "export const A = ({ id }) => <><DayPicker modifiersClassNames={{ booked: \"p-2\", empty: \"\", other: id, ...rest }} /><DayPicker classNames={id} /><DayPicker classNames=\"p-2\" /></>\n",
    );
    assert!(source.contains("modifiersClassNames={{ booked: styleProps(styles.aDayPickerBooked).className ?? \"\", empty: \"\", other: id, ...rest }}"), "{source}");
    assert!(source.contains("<DayPicker classNames={id} />"), "{source}");
}

#[test]
fn a_render_target_keeps_merging_the_class_a_part_hands_it() {
    let source = surveyed(
        "a.tsx",
        "import * as Primitive from \"react\"\n\
         import { cva } from \"class-variance-authority\"\n\
         const v = cva(\"p-2\")\n\
         export const Button = ({ className, ...props }) => <Primitive.Fragment className={cn(\"p-2\", className)} {...props} />\n\
         export const Card = ({ className }) => <div className={cn(\"p-2\", className)} />\n\
         export const Chip = ({ className }) => <Primitive.Fragment className={cn(v({ className }))} />\n\
         export const Plain = ({ className }) => <div className={cn(\"p-2\", className)} />\n\
         export const Inner = ({ className }) => <b className={cn(\"p-1\", className)} />\n\
         export const Wrap = ({ className }) => <Inner className={cn(\"p-2\", className)} />\n\
         export const Uses = () => <><Primitive.Fragment render={<Button />} /><Primitive.Fragment render={<Card />} /><Primitive.Fragment render={<Chip />} /><Primitive.Fragment render={<i />} /><Primitive.Fragment render={<Wrap />} /></>\n",
    );
    assert!(source.contains("Button = ({ sx, className, ...props }) => <Primitive.Fragment {...styleProps(styles.buttonFragment, sx, typeof className === \"string\" && className)}"), "{source}");
    assert!(
        source.contains("Card = ({ sx, className }) => <div {...styleProps(styles.cardDiv, sx, typeof className === \"string\" && className)} />"),
        "{source}"
    );
    assert!(source.contains("{...styleProps(v(), sx, typeof className === \"string\" && className)}"), "{source}");
    assert!(source.contains("Plain = ({ sx }) => <div sx={[styles.plainDiv, sx]} />"), "{source}");
    // Passed on by a render target, the inner component receives the part's class too.
    assert!(
        source.contains("Wrap = ({ sx, className }) => <Inner sx={[styles.wrapInner, sx]} className={className} />"),
        "{source}"
    );
    assert!(
        source.contains("Inner = ({ sx, className }) => <b {...styleProps(styles.innerB, sx, typeof className === \"string\" && className)} />"),
        "{source}"
    );
}

#[test]
fn a_dropped_class_guard_is_reported() {
    let (source, report) = snippet(
        "a.tsx",
        "export const A = () => <div className=\"*:[div:not([class*='w-'])]:w-1/2 [&>i:not([class*='h-'])]:bogus-1 [&_svg:not([class*='size-'])]:size-2\" />\n",
    );
    assert!(source.contains("[select.child(\"div\")]"), "{source}");
    assert_eq!(
        report.iter().filter(|item| item.contains("applied without its `[class*=…]` guard")).count(),
        1,
        "{report:?}"
    );
}

#[test]
fn a_dark_value_outranks_the_states_it_encloses() {
    let (source, _) = snippet(
        "a.tsx",
        "export const A = () => <p className=\"bg-primary dark:bg-muted aria-expanded:bg-ring hover:bg-border dark:hover:bg-destructive md:bg-ring p-2\" />\n",
    );
    // In dark mode `dark:bg-muted` outranks `aria-expanded:bg-ring`; `dark:hover:` pairs itself;
    // `md:` is an at-rule and keeps its value.
    assert!(source.contains("'[aria-expanded=\"true\"]': `light-dark(${theme.ring}, ${theme.muted})`"), "{source}");
    assert!(source.contains("\":hover\": `light-dark(${theme.border}, ${theme.destructive})`"), "{source}");
    assert!(source.contains("\"@media (width >= 48rem)\": theme.ring"), "{source}");
}

/// One class string lowered on its own, as a tool asks for it (KF-004): the same objects as the
/// codemod, with the module that declares what they read.
#[test]
fn a_class_string_lowers_on_its_own() {
    let project = project();
    let grammar: Grammar = project.config().utilities.clone().unwrap();
    let (variants, utilities) = custom();
    let relations = ProjectMap::default();
    let options =
        Options { grammar: &grammar, custom_variants: &variants, custom_utilities: &utilities, project: &relations };
    let file = root().join("report.tsx");
    let environment = Env { project: &project, file: &file };
    let lowered = lower(&file, "gap-1 text-blue-600 dark:p-2 group/menu h-7", &options, &environment);
    assert_eq!(
        lowered.style.as_deref(),
        Some(
            "css({\n    // tailwind: h-7 — `h-7` is not a utility\n    gap: space[1],\n    color: color.blue[600],\n    padding: modes.padding,\n  })"
        )
    );
    assert_eq!(lowered.anchors, ["menuGroup"]);
    assert_eq!(lowered.left, ["h-7 — `h-7` is not a utility"]);
    assert_eq!(lowered.notes.len(), 2, "{:?}", lowered.notes);
    assert!(lowered.module.starts_with(
        "import { css, defineTokens, relation } from \"@kirana-style/core\"\nimport { color, space } from \"./scales\"\n"
    ));
    assert!(lowered.module.contains("const menuGroup = relation(\"menu\")\n"), "{}", lowered.module);
    assert!(lowered.module.ends_with("}),\n}\n\nconst sx = [menuGroup.anchor, styles.style]\n"), "{}", lowered.module);
    // An anchor alone is still applied; nothing at all is an empty module.
    let anchor = lower(&file, "group", &options, &environment);
    assert_eq!((anchor.style, anchor.anchors.as_slice()), (None, ["group".to_owned()].as_slice()));
    assert!(
        anchor.module.ends_with("const group = relation(\"group\")\n\nconst sx = [group.anchor]\n"),
        "{}",
        anchor.module
    );
    let empty = lower(&file, "", &options, &environment);
    assert_eq!((empty.style, empty.module.as_str()), (None, ""));
}
