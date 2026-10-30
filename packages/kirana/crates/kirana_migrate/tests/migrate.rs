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

/// Everything the codemod rewrites, in one file.
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
/// A condition whose text holds `default:` produces one, since the key scan finds it inside the
/// string while the call around it is replaced whole.
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

/// What StyleX reads one way and Kirana another (KF-074), in one JavaScript file: bare numbers,
/// legacy names, fallback arrays, theme values for dark mode, condition blocks at the top of a
/// style, and what is reported instead of rewritten.
#[test]
fn the_legacy_fixture() {
    let source = include_str!("../../../fixtures/migrate/legacy.js");
    let result = run("legacy.js", source);
    insta::assert_snapshot!("legacy", result.source);
    insta::assert_debug_snapshot!("legacy-notes", result.notes);
}

fn style(entry: &str) -> String {
    rewritten(&format!("import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({{ a: {entry} }})\n"))
}

/// StyleX gives a bare number `px` (`ms` on a duration); Kirana takes one only where the property's
/// grammar does, so the unit is written where Kirana would refuse the number.
#[test]
fn bare_numbers_get_the_unit_stylex_gave_them() {
    let out = style(
        "{ width: 10, margin: -4, animationDelay: 20, zIndex: 2, flexGrow: 1, top: 0, '--gap': 4, colour: 3, left: -size, height: { default: 10, ':hover': 1.5 } }",
    );
    for expected in [
        "width: \"10px\"",
        "margin: \"-4px\"",
        "animationDelay: \"20ms\"",
        "zIndex: 2",
        "flexGrow: 1",
        "top: 0",
        "'--gap': 4",
        "colour: 3",
        "left: -size",
        "height: { base: \"10px\", ':hover': \"1.5px\" }",
    ] {
        assert!(out.contains(expected), "{expected} in {out}");
    }
}

/// StyleX's fallback array, the later value where it works, is `firstThatWorks` preferring the
/// first; an array of anything but literals, or of one value, is left alone.
#[test]
fn fallback_arrays_become_first_that_works() {
    let out = style(
        "{ minHeight: ['100vh', '100dvh'], width: [10, 20], top: [0, '1px'], left: [size, 1], right: ['1px'], bottom: [...edges, '1px'] }",
    );
    assert!(out.contains("minHeight: firstThatWorks('100dvh', '100vh')"), "{out}");
    assert!(out.contains("width: firstThatWorks(\"20px\", \"10px\")"), "{out}");
    assert!(out.contains("top: firstThatWorks('1px', 0)"), "{out}");
    assert!(
        out.contains("left: [size, 1]") && out.contains("right: ['1px']") && out.contains("[...edges, '1px']"),
        "{out}"
    );
    assert!(out.contains("import { css, firstThatWorks } from \"@kirana-style/core\""), "{out}");
}

/// StyleX's own property names become the standard ones, keys written as strings too; a name
/// Kirana knows, and a shorthand key whose value is a variable, stay.
#[test]
fn legacy_names_become_standard_ones() {
    let out = style(
        "{ start: 0, 'end': 1, marginHorizontal: 2, gridGap: 2, borderStartColor: 'red', marginInline: 4, '::after': { paddingEnd: 2 }, float: 'end', clear: 'start', ...{ paddingStart } }",
    );
    for expected in [
        "insetInlineStart: 0",
        "insetInlineEnd: \"1px\"",
        "marginInline: \"2px\"",
        // Kirana knows `grid-gap`, so it stays.
        "gridGap: \"2px\"",
        "borderInlineStartColor: 'red'",
        "marginInline: \"4px\"",
        "paddingInlineEnd: \"2px\"",
        "float: \"inline-end\"",
        "clear: 'start'",
    ] {
        assert!(out.contains(expected), "{expected} in {out}");
    }
    let shorthand = style("{ start }");
    assert!(shorthand.contains("{ start }"), "{shorthand}");
}

/// A condition block at the top of a style moves inside each property it sets, joining a
/// conditions object already there; nested blocks nest their conditions.
#[test]
fn condition_blocks_move_into_their_properties() {
    let out = style(
        "{ color: { default: null, ':focus': 'pink' }, ':hover': { color: 'blue', opacity: 0.5 }, '@media print': { ':active': { color: 'black' }, color: 'gray' }, width: { default: 1, '@media print': { ':hover': 2 } }, '@media print ': { width: { ':active': 3 } } }",
    );
    assert!(
        out.contains(
            "css({ color: { ':focus': 'pink', ':hover': 'blue', '@media print': { base: 'gray', ':active': 'black' } }, opacity: { ':hover': 0.5 }, width: { base: \"1px\", '@media print': { ':hover': \"2px\" }, '@media print ': { ':active': \"3px\" } } })"
        ),
        "{out}"
    );
    // A later block sets what an earlier one did: the later wins, as in StyleX.
    let twice =
        style("{ ':hover': { color: 'blue' }, ':focus': { color: 'red' }, ':hover:focus': { color: 'green' } }");
    assert!(twice.contains("color: { ':hover': 'blue', ':focus': 'red', ':hover:focus': 'green' }"), "{twice}");
}

/// A style several lines long is written back one property a line, in its own indentation, a block
/// first or not; a pseudo-element's block keeps every rewrite made inside it.
#[test]
fn a_lifted_style_keeps_its_layout() {
    let out = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({\n  a: {\n    ':hover': { color: 'blue' },\n    color: 'red',\n    '::after': { start: 0, width: 10 },\n  },\n})\n",
    );
    assert!(
        out.contains("  a: css({\n    color: { base: 'red', ':hover': 'blue' },\n    '::after': { insetInlineStart: 0, width: \"10px\" },\n  }),"),
        "{out}"
    );
}

/// What the walk passes over: a spread in a theme or a conditions object, a string it cannot read
/// as text, an attribute that is not a spread.
#[test]
fn the_walk_passes_over_what_it_does_not_rewrite() {
    let out = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst t = stylex.defineVars({ ...base, ink: 'black' })\nconst s = stylex.create({ a: { color: { ...x, default: 'red' }, content: '\\uD800' } })\nconst e = <div className=\"x\" {...stylex.props(s.a)} />\n",
    );
    assert!(out.contains("{ ...base, ink: 'black' }") && out.contains("{ ...x, base: 'red' }"), "{out}");
    assert!(out.contains("content: '\\uD800'") && out.contains("<div className=\"x\" sx={[s.a]} />"), "{out}");
}

/// Keys set twice, as JavaScript allows: the later value wins, and conditions set twice merge.
#[test]
fn what_is_set_twice_merges_with_the_later_winning() {
    let out = style("{ color: 'red', color: 'black', ':hover': { color: 'blue' }, color: 'gray' }");
    assert!(out.contains("css({ color: { base: 'gray', ':hover': 'blue' } })"), "{out}");
    let merged = style("{ color: { ':hover': { default: 'a' } }, ':hover': { color: { ':focus': 'b' } } }");
    assert!(merged.contains("css({ color: { ':hover': { base: 'a', ':focus': 'b' } } })"), "{merged}");
}

/// Two rewrites over one range inside a style to lift: it is left where it is, and both are said.
#[test]
fn a_style_with_overlapping_rewrites_is_not_lifted() {
    let source = "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { opacity: stylex.when.ancestor(\"[data-x=\\\"default: null\\\"]\"), ':hover': { color: 'blue' } } })\n";
    let reported = notes(source);
    assert!(reported.iter().any(|note| note.contains("condition blocks were left where they are")), "{reported:?}");
    assert!(reported.iter().any(|note| note.contains("overlapping rewrite skipped")), "{reported:?}");
    assert!(rewritten(source).contains("':hover': { color: 'blue' }"));
}

/// What lifting cannot place is reported and left as written.
#[test]
fn condition_blocks_it_cannot_move_are_reported() {
    for entry in [
        "{ ...base, ':hover': { color: 'blue' } }",
        "{ [key]: 'x', ':hover': { color: 'blue' } }",
        "{ ':hover': { '::after': { color: 'blue' } } }",
        "{ ':hover': { ...base, [key]: 'x', color: 'blue' } }",
        "{ color: { ...base, default: 'red' }, ':hover': { color: 'blue' } }",
        "{ color: { [stylex.when.ancestor(':focus')]: 'red' }, ':hover': { color: 'blue' } }",
        "{ color: { default: { ...base } }, ':hover': { color: 'blue' } }",
        "{ color: { ':focus': { ...base } }, ':hover': { color: 'blue' } }",
    ] {
        let source =
            format!("import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({{ a: {entry} }})\n");
        assert!(notes(&source).iter().any(|note| note.contains("cannot move")), "{entry}: {:?}", notes(&source));
        assert!(rewritten(&source).contains("':hover': {"), "{entry}");
    }
    // A selector Kirana takes no condition for, at the top or inside a property.
    let source = "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { ':autofill + label': { color: 'red' }, color: { default: 'blue', ':not(.x) > h1': 'red' } } })\n";
    let reported = notes(source);
    assert_eq!(reported.iter().filter(|note| note.contains("port this selector by hand")).count(), 2, "{reported:?}");
}

/// `!important` is reported, never dropped: Kirana writes none, and removing it changes what the
/// rule beats.
#[test]
fn important_is_reported() {
    let source = "import * as stylex from \"@stylexjs/stylex\"\nconst s = stylex.create({ a: { color: 'red !important', content: `\"x\" !important`, width: `${size}px` } })\n";
    let reported = notes(source);
    assert_eq!(reported.iter().filter(|note| note.contains("`!important` on")).count(), 2, "{reported:?}");
    assert!(rewritten(source).contains("'red !important'"));
}

/// A theme value for dark mode is a mode object, its condition written out, quoted as a computed
/// key, or held in a constant; the file's reads of it follow. Any other shape stays.
#[test]
fn dark_scheme_theme_values_become_modes() {
    let out = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst DARK = '@media (prefers-color-scheme: dark)'\nconst OTHER = '@media print'\nconst values = { ink: { default: 'black', [DARK]: 'white' }, mark: { default: 'red', ['@media (prefers-color-scheme: dark)']: 'pink' }, wide: { default: 1, [OTHER]: 2 }, spread: { ...x, default: 1 }, plain: 'blue' }\nexport const theme = stylex.defineVars(values)\nexport const read = [values.ink.default, values.ink[DARK], values.wide[OTHER], other.ink.default, values.ink[0]]\nexport const t = stylex.createTheme(theme)\n",
    );
    assert!(out.contains("ink: { light: 'black', dark: 'white' }"), "{out}");
    assert!(out.contains("mark: { light: 'red', dark: 'pink' }"), "{out}");
    assert!(out.contains("wide: { default: 1, [OTHER]: 2 }") && out.contains("spread: { ...x, default: 1 }"), "{out}");
    assert!(
        out.contains("[values.ink.light, values.ink.dark, values.wide[OTHER], other.ink.default, values.ink[0]]"),
        "{out}"
    );
    // Written in the call itself.
    let inline = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nexport const t = stylex.createTheme(colors, { ink: { default: 'black', '@media (prefers-color-scheme: dark)': 'white' } })\n",
    );
    assert!(inline.contains("ink: { light: 'black', dark: 'white' }"), "{inline}");
}

/// A Flow file is named as one, with the way to read it; any other file that does not parse
/// keeps the plain note.
#[test]
fn a_flow_file_is_named_as_such() {
    let flow = "/**\n * Copyright\n *\n * @flow strict\n */\n\nimport * as stylex from '@stylexjs/stylex';\nopaque type T: 'a' = 'a';\n";
    let result = run("theme.stylex.js", flow);
    assert_eq!(result.source, flow);
    assert!(
        result.notes[0].message.contains("Flow") && result.notes[0].message.contains("flow-remove-types"),
        "{:?}",
        result.notes
    );
    assert!(!run("broken.js", "const = =\n// @flow, after the code\n").notes[0].message.contains("Flow"));
}

/// Every script extension loses `.stylex`, and so do the specifiers naming one; `as const` is
/// written into TypeScript only.
#[test]
fn stylex_files_of_every_extension_are_renamed() {
    for (from, to) in
        [("theme.stylex.js", Some("theme.js")), ("theme.stylex.mjs", Some("theme.mjs")), ("theme.stylex.css", None)]
    {
        assert_eq!(run(from, "export const a = 1\n").rename.as_deref(), to, "{from}");
    }
    let out = rewritten(
        "import a from './a.stylex.js'\nimport b from \"./b.stylex.tsx\"\nimport c from './c.stylexy'\nimport d from './d.stylex.json'\n",
    );
    assert!(out.contains("'./a.js'") && out.contains("\"./b.tsx\""), "{out}");
    assert!(out.contains("'./c.stylexy'") && out.contains("'./d.stylex.json'"), "{out}");
    let consts =
        "import * as stylex from \"@stylexjs/stylex\"\nexport const sizes = stylex.defineConsts({ small: 4 })\n";
    assert!(run("sizes.stylex.ts", consts).source.contains("{ small: 4 } as const"));
    assert!(run("sizes.stylex.js", consts).source.contains("export const sizes = { small: 4 }\n"));
}

/// Frames and dynamic styles are styles too; anything else in their place is left alone.
#[test]
fn keyframes_and_dynamic_styles_are_read_as_styles() {
    let out = rewritten(
        "import * as stylex from \"@stylexjs/stylex\"\nconst k = stylex.keyframes({ from: { start: 0, top: 4 }, to: 'none' })\nconst j = stylex.keyframes(frames)\nconst s = stylex.create({ a: (x) => ({ height: 4 }), b: (x) => x ? one : two })\n",
    );
    assert!(out.contains("from: { insetInlineStart: 0, top: \"4px\" }, to: 'none'"), "{out}");
    assert!(out.contains("keyframes(frames)"), "{out}");
    assert!(out.contains("a: (x) => css({ height: \"4px\" })"), "{out}");
}
