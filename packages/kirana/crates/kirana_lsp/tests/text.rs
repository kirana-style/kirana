//! Positions, URIs and cursor context.

use std::path::{Path, PathBuf};
use std::str::FromStr;

use kirana_lsp::text::{LineIndex, Slot, chain_at, path_to_uri, slot_of, string_at, uri_to_path};
use lsp_types::{Position, Uri};

#[test]
fn positions_count_utf16_and_offsets_clamp() {
    let text = "a\né𝄞b\nlast";
    let index = LineIndex::new(text);
    // `é` is two bytes and one UTF-16 unit; `𝄞` four bytes and two units.
    assert_eq!(index.position(2), Position::new(1, 0));
    assert_eq!(index.position(4), Position::new(1, 1));
    assert_eq!(index.position(8), Position::new(1, 3));
    // An offset inside a character counts the character's start; past the end, the end.
    assert_eq!(index.position(3), Position::new(1, 0));
    assert_eq!(index.position(100), Position::new(2, 4));
    assert_eq!(index.offset(Position::new(1, 3)), 8);
    // Past a line's end clamps to it; past the last line, to the text's end.
    assert_eq!(index.offset(Position::new(0, 9)), 1);
    assert_eq!(index.offset(Position::new(9, 0)), text.len());
    assert_eq!(index.range(2, 4).end, Position::new(1, 1));
}

#[test]
fn uris_round_trip_with_escapes_and_drives() {
    let path = Path::new("/home/a b/ç.tsx");
    let uri = path_to_uri(path);
    assert_eq!(uri.as_str(), "file:///home/a%20b/%C3%A7.tsx");
    assert_eq!(uri_to_path(&uri), Some(PathBuf::from("/home/a b/ç.tsx")));
    assert_eq!(path_to_uri(Path::new(r"C:\app\a.tsx")).as_str(), "file:///C:/app/a.tsx");
    let drive = Uri::from_str("file:///C:/app/a.tsx").unwrap();
    assert_eq!(uri_to_path(&drive), Some(PathBuf::from("C:/app/a.tsx")));
    // Escapes that are not UTF-8 are no path.
    assert_eq!(uri_to_path(&Uri::from_str("file:///a%FF").unwrap()), None);
    assert_eq!(uri_to_path(&Uri::from_str("untitled:Untitled-1").unwrap()), None);
}

#[test]
fn chains_and_strings_under_the_cursor() {
    let text = "x = color.brand.500 + .a";
    assert_eq!(chain_at(text, 6), Some(("color.brand.500", 4, 19)));
    assert_eq!(chain_at(text, 2), None);
    assert_eq!(chain_at("1.5", 1), None);
    assert_eq!(chain_at(text, 23), Some(("a", 23, 24)));
    let text = r#"a("x\"y", 'z')"#;
    assert_eq!(string_at(text, 4), Some((3, 7, b'"')));
    assert_eq!(string_at(text, 7), Some((3, 7, b'"')));
    assert_eq!(string_at(text, 12), Some((11, 12, b'\'')));
    assert_eq!(string_at(text, 9), None);
    // An unterminated string runs to the cursor.
    assert_eq!(string_at("a(\"open", 7), Some((3, 7, b'"')));
}

#[test]
fn slots_tell_keys_from_values() {
    let slot = |text: &str| slot_of(text, text.rfind('"').unwrap());
    assert_eq!(slot(r#"css({ ""#), Slot::Key { nested: false });
    assert_eq!(slot(r#"css({ color: { ""#), Slot::Key { nested: true });
    assert_eq!(slot(r#"css({ "::before": { ""#), Slot::Key { nested: false });
    assert_eq!(slot(r#"css({ display: ""#), Slot::Value { property: "display".to_owned() });
    assert_eq!(slot(r#"css({ "align-items": ""#), Slot::Value { property: "align-items".to_owned() });
    assert_eq!(slot(r#"css({ color: { base: "x", ":hover": ""#), Slot::Value { property: "color".to_owned() });
    assert_eq!(slot(r#"css({ color: { [":hover"]: ""#), Slot::Value { property: "color".to_owned() });
    assert_eq!(slot(r#"css({ color: { [card.within(":hover")]: ""#), Slot::Value { property: "color".to_owned() });
    assert_eq!(
        slot(r#"css({ color: { "@media (width >= 1px)": { ":hover": ""#),
        Slot::Value { property: "color".to_owned() }
    );
    assert_eq!(slot(r#"css({ a: { b: 1 }, color: { "@media x": ""#), Slot::Value { property: "color".to_owned() });
    assert_eq!(slot(r#"css({ color: { a: { b: {} }, ":hover": ""#), Slot::Value { property: "color".to_owned() });
    // A condition with nothing around it, a pseudo-element or `select` value, and other strings.
    assert_eq!(slot(r#"":hover": ""#), Slot::Other);
    assert_eq!(slot(r#"css({ "::before": ""#), Slot::Other);
    assert_eq!(slot(r#"css({ [select.child("a")]: ""#), Slot::Other);
    assert_eq!(slot(r#"css({ "x": ""#), Slot::Value { property: "x".to_owned() });
    assert_eq!(slot(r#"f(""#), Slot::Other);
    assert_eq!(slot(r#": ""#), Slot::Other);
    assert_eq!(slot(r#"css({ ': ""#), Slot::Other);
    assert_eq!(slot(r#"css({ [x]]: ""#), Slot::Other);
    assert_eq!(slot(r#"""#), Slot::Other);
}

#[test]
fn offsets_inside_a_character_read_from_its_start() {
    // `—` is three bytes; asking at its second byte must not slice inside it.
    let text = "a — color.brand";
    assert_eq!(kirana_lsp::text::chain_at(text, 3), None);
    assert_eq!(kirana_lsp::text::chain_at(text, 1), Some(("a", 0, 1)));
    let quoted = "x = \"a — b\"";
    assert_eq!(kirana_lsp::text::string_at(quoted, 7).map(|(start, ..)| start), Some(5));
}

#[test]
fn a_panic_fails_one_message_not_the_server() {
    assert_eq!(kirana_lsp::guarded("x", || 1), Ok(1));
    let error = kirana_lsp::guarded("textDocument/hover", || -> u8 { panic!("boom") }).unwrap_err();
    assert_eq!(error, "kirana lsp: textDocument/hover failed: boom");
    let error = kirana_lsp::guarded("x", || -> u8 { panic!("{}", String::from("owned")) }).unwrap_err();
    assert!(error.ends_with("owned"));
    let error = kirana_lsp::guarded("x", || -> u8 { std::panic::panic_any(7) }).unwrap_err();
    assert!(error.ends_with("unknown panic"));
}
