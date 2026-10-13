use std::path::Path;

use kirana_migrate::{Note, migrate};

fn run(name: &str, source: &str) -> kirana_migrate::Migration {
    migrate(Path::new(name), source)
}

fn rewritten(source: &str) -> String {
    run("input.tsx", source).source
}

fn notes(source: &str) -> Vec<String> {
    run("input.tsx", source).notes.into_iter().map(|note: Note| note.message).collect()
}

/// Everything the codemod rewrites, in one file, as the prototype rewrote this repository.
#[test]
fn the_whole_fixture() {
    let source = include_str!("../../../fixtures/migrate/input.tsx");
    let result = run("input.tsx", source);
    insta::assert_snapshot!("fixture", result.source);
    insta::assert_debug_snapshot!("fixture-notes", result.notes);
    assert!(result.changed(source));
    assert!(result.rename.is_none());
}

/// A token file loses the `.stylex` in its name, and every import of it follows.
#[test]
fn token_files_are_renamed_and_their_importers_follow() {
    let result = run("theme.stylex.ts", "import * as stylex from \"@stylexjs/stylex\"\n");
    assert_eq!(result.rename.as_deref(), Some("theme.ts"));
    assert!(result.changed("import * as stylex from \"@stylexjs/stylex\"\n"));

    assert!(rewritten("import { a } from './theme.stylex'\n").contains("'./theme'"));
    assert!(rewritten("import { a } from \"./theme.stylex\"\n").contains("\"./theme\""));
}

/// A file that does not parse is left exactly as it was.
#[test]
fn a_file_that_does_not_parse_is_left_alone() {
    let source = "const = = =\n";
    let result = run("broken.ts", source);
    assert_eq!(result.source, source);
    assert!(!result.changed(source));
    assert_eq!(result.notes.len(), 1, "{:?}", result.notes);
    assert!(result.notes[0].message.contains("does not parse"));
}

/// StyleX's `default: null` means "nothing at rest"; Kirana's `base: null` removes an earlier
/// value. They are not the same instruction, so the entry goes rather than being translated.
#[test]
fn default_null_entries_are_dropped_not_translated() {
    let one_per_line = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: {\n  color: {\n    default: null,\n    \":hover\": \"red\",\n  },\n} })\n",
    );
    assert!(!one_per_line.contains("default"), "{one_per_line}");
    assert!(!one_per_line.contains("base: null"), "{one_per_line}");
    assert!(one_per_line.contains("\":hover\": \"red\""), "{one_per_line}");

    // As the last entry, the separator before it goes instead.
    let last = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { color: { \":hover\": \"red\", default: null } } })\n",
    );
    assert!(!last.contains("default"), "{last}");
    assert!(last.contains("{ \":hover\": \"red\" }"), "{last}");

    // Sharing a line with something else, only the entry and its comma go.
    let inline = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { color: { default: null, \":hover\": \"red\" } } })\n",
    );
    assert!(inline.contains("{ \":hover\": \"red\" }"), "{inline}");
}

/// A `default` that is not an object key, and a `default` with a real value.
#[test]
fn only_default_keys_are_rewritten() {
    let source = "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { color: { default: \"red\" }, content: \"'default'\" } })\n";
    let out = rewritten(source);
    assert!(out.contains("base: \"red\""), "{out}");
    assert!(out.contains("\"'default'\""), "{out}");
    // An identifier that merely starts with the word is not a key.
    let untouched = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { color: defaults } })\n",
    );
    assert!(untouched.contains("defaults"), "{untouched}");
}

/// The three relation placements, and the one that has no equivalent.
#[test]
fn relations_map_by_placement() {
    let out = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { opacity: {\n  [stylex.when.ancestor(\"[data-x]\", m)]: 1,\n  [stylex.when.siblingBefore(\":checked\")]: 2,\n  [stylex.when.siblingAfter(\":checked\", m)]: 3,\n} } })\n",
    );
    assert!(out.contains("m.within(\"[data-x]\")"), "{out}");
    assert!(out.contains("peer.after(\":checked\")"), "{out}");
    assert!(out.contains("m.before(\":checked\")"), "{out}");

    let unmapped =
        notes("import * as stylex from \"@stylexjs/stylex\"\nconst a = stylex.when.descendant(\":hover\")\n");
    assert!(unmapped.iter().any(|note| note.contains("no equivalent")), "{unmapped:?}");
}

/// A marker spread applies its anchor; the default marker needs an import this cannot choose.
#[test]
fn markers_become_anchors() {
    let source = "import * as stylex from \"@stylexjs/stylex\"\nconst a = <div {...stylex.props(s.root, fieldMarker, stylex.defaultMarker())} />\n";
    let out = rewritten(source);
    assert!(out.contains("sx={[s.root, fieldMarker.anchor, peer.anchor]}"), "{out}");
    assert!(notes(source).iter().any(|note| note.contains("default marker")), "{:?}", notes(source));

    // A module that declares `peer` itself needs no note.
    let declares = "import * as stylex from \"@stylexjs/stylex\"\nexport const peer = 1\nconst a = <div {...stylex.props(stylex.defaultMarker())} />\n";
    assert!(notes(declares).is_empty(), "{:?}", notes(declares));

    // A spread of something else is left alone.
    let other = rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst a = <div {...rest} />\n");
    assert!(other.contains("{...rest}"), "{other}");
    let call = rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst a = <div {...other(1)} />\n");
    assert!(call.contains("{...other(1)}"), "{call}");
}

/// `stylex.props` outside a spread keeps its call shape under an aliased name.
#[test]
fn props_outside_a_spread_is_aliased() {
    let out = rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst a = stylex.props(s.root)\n");
    assert!(out.contains("styleProps(s.root)"), "{out}");
    assert!(out.contains("props as styleProps"), "{out}");
}

/// The four StyleX style types all become `Sx`.
#[test]
fn style_types_become_sx() {
    for name in ["StyleXStyles", "CompiledStyles", "StyleXArray", "StaticStyles"] {
        let out = rewritten(&format!("import * as stylex from \"@stylexjs/stylex\"\nlet a: stylex.{name}\n"));
        assert!(out.contains("let a: Sx"), "{out}");
        assert!(out.contains("type Sx"), "{out}");
    }
    // Another qualified name from the same namespace is left alone.
    let other = rewritten("import * as stylex from \"@stylexjs/stylex\"\nlet a: stylex.Theme\n");
    assert!(other.contains("stylex.Theme"), "{other}");
    // And a qualified name from somewhere else entirely.
    let elsewhere = rewritten("import * as stylex from \"@stylexjs/stylex\"\nlet a: other.StyleXStyles\n");
    assert!(elsewhere.contains("other.StyleXStyles"), "{elsewhere}");
}

/// What the codemod declines to rewrite, and says so.
#[test]
fn it_reports_what_it_will_not_guess() {
    let unmapped = notes("import * as stylex from \"@stylexjs/stylex\"\nconst a = stylex.defineConstsLater(1, 2)\n");
    assert!(unmapped.iter().any(|note| note.contains("no mapping for stylex.defineConstsLater")), "{unmapped:?}");

    let not_object = notes("import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create(shared)\n");
    assert!(not_object.iter().any(|note| note.contains("without an object")), "{not_object:?}");

    let entry = notes("import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: shared })\n");
    assert!(entry.iter().any(|note| note.contains("not an object")), "{entry:?}");
}

/// A call with no arguments takes the paths that read one.
#[test]
fn calls_without_arguments_do_not_panic() {
    let out = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst a = stylex.defineVars()\nconst b = stylex.defineConsts()\n",
    );
    assert!(out.contains("defineTokens()"), "{out}");
    assert!(out.contains("stylex.defineConsts()") || out.contains("defineConsts()"), "{out}");
}

/// A marker declared without a name, and a block-bodied dynamic style.
#[test]
fn shapes_the_prototype_did_not_meet() {
    // `stylex.defineMarker()` not assigned to anything still produces a relation.
    let bare = rewritten("import * as stylex from \"@stylexjs/stylex\"\nexport default stylex.defineMarker()\n");
    assert!(bare.contains("relation(\"unnamed\")"), "{bare}");

    // A block-bodied arrow is not an expression to wrap, so it is left to the report's reader.
    let block = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: (w: number) => { return { width: w } } })\n",
    );
    assert!(!block.contains("css("), "{block}");
}

/// A file with nothing to import from Kirana loses the StyleX import and gains nothing.
#[test]
fn an_import_with_nothing_to_replace_it_is_removed() {
    let out = rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst a = 1\n");
    assert_eq!(out.trim(), "const a = 1", "{out}");
}

/// Shapes that take the paths the fixture does not.
#[test]
fn the_edges_of_each_rewrite() {
    // A `when` call whose callee is one member deep, and one whose object is not an identifier.
    let shallow = rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst a = other.when(1)\n");
    assert!(shallow.contains("other.when(1)"), "{shallow}");
    let computed = rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst a = get().when.ancestor(1)\n");
    assert!(computed.contains("get().when.ancestor(1)"), "{computed}");

    // A namespace member that is not `when`, and a `when` on something that is not StyleX.
    let other_namespace =
        rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst a = stylex.other.ancestor(1)\n");
    assert!(other_namespace.contains("stylex.other.ancestor(1)"), "{other_namespace}");
    let other_object = rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst a = foo.when.ancestor(1)\n");
    assert!(other_object.contains("foo.when.ancestor(1)"), "{other_object}");

    // A computed member: there is no name to map, so it is left alone.
    let computed_key = rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst a = stylex.when[key](1)\n");
    assert!(computed_key.contains("stylex.when[key](1)"), "{computed_key}");

    // A spread inside a `create` object, which is not a style entry.
    let spread = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ ...shared, a: { color: \"red\" } })\n",
    );
    assert!(spread.contains("...shared"), "{spread}");
    assert!(spread.contains("a: css({ color: \"red\" })"), "{spread}");

    // Whitespace between the key and its colon.
    let spaced = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { color: { default : \"red\" } } })\n",
    );
    assert!(spaced.contains("base : \"red\""), "{spaced}");

    // A dropped entry with trailing spaces after its comma.
    let trailing = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: {\n  color: {\n    default: null,   \n    \":hover\": \"red\",\n  },\n} })\n",
    );
    assert!(!trailing.contains("default"), "{trailing}");
    assert!(trailing.contains("\":hover\""), "{trailing}");

    // The default marker outside a spread.
    let marker = rewritten("import * as stylex from \"@stylexjs/stylex\"\nconst m = stylex.defaultMarker()\n");
    assert!(marker.contains("const m = peer.anchor"), "{marker}");
}

/// Two rewrites over one range: the second is skipped and said so, rather than corrupting the file.
///
/// A condition whose text contains `default:` is the way to produce one — the key scan finds it
/// inside the string while the call around it is being replaced whole.
#[test]
fn overlapping_rewrites_are_reported() {
    let source = "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { opacity: { [stylex.when.ancestor(\"[data-x=\\\"default: null\\\"]\")]: 1 } } })\n";
    let result = run("input.tsx", source);
    assert!(
        result.notes.iter().any(|note| note.message.contains("overlapping")),
        "{:?}\n{}",
        result.notes,
        result.source
    );
}

/// The helpers Kirana shares with StyleX keep their arguments.
#[test]
fn shared_helpers_are_renamed() {
    let out = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst a = stylex.firstThatWorks(\"100dvh\", \"100vh\")\nconst b = stylex.positionTry({ positionArea: \"top\" })\nconst c = stylex.viewTransitionClass({ old: { opacity: 0 } })\n",
    );
    assert!(out.contains("const a = firstThatWorks(\"100dvh\", \"100vh\")"), "{out}");
    assert!(out.contains("const b = positionTry({ positionArea: \"top\" })"), "{out}");
    assert!(out.contains("const c = viewTransition({ old: { opacity: 0 } })"), "{out}");
    assert!(
        out.contains("import { firstThatWorks, positionTry, viewTransition } from \"@kirana-style/core\""),
        "{out}"
    );
}
