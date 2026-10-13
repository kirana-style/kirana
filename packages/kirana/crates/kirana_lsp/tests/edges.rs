//! The less travelled paths of the card, the hints, the refactorings and components: each test
//! names the case it holds the server to.

use std::path::PathBuf;

use kirana_lsp::Server;
use kirana_lsp::text::{LineIndex, path_to_uri};
use lsp_server::{ErrorCode, Notification, Request, RequestId};
use serde_json::{Value, json};

const TOKENS: &str = r##"import { defineTokens } from "@kirana-style/core"
export const space = defineTokens("space", { gutter: { value: "0.5rem", variable: true } })
export const blend = defineTokens("blend", { shade: { light: "multiply", dark: "screen" } })
"##;

const STYLES: &str = r##"import { css } from "@kirana-style/core"
export const card = css({ display: "flex", columnGap: "3px" })
"##;

const PAGE: &str = r##"import { css, relation } from "@kirana-style/core"
import { card } from "./styles"
import { blend, space } from "./tokens"

const loose = relation( "loose" )
const base = css({
  display: "block",
  padding: "1rem",
  margin: "1px 2px 3px 4px",
  borderRadius: "8px",
  gap: space.gutter,
  width: `calc(${space.gutter} * 2)`,
  mixBlendMode: blend.shade,
  outlineColor: "currentcolor",
  color: "light-dark(currentcolor, #000)",
  fontFamily: "a-very-long-font-family-name, another-long-font-family-name, sans-serif",
})
const wide = css({ padding: "2rem" })
const quoted = css({ "margin-left": "1px" })
const cond = css({ padding: { base: "1px", ":hover": "2px" } })
const styles = { one: css({ opacity: 1 }) }
const solo = css({ opacity: 0.5 })

export function C({ extra }: { extra: any }) {
  return (
    <div>
      <p sx={[base, wide, extra]} />
      <i sx={card} />
      <u sx={quoted} />
      <s sx={styles.one} />
      <b sx={cond} />
      <q sx={solo} />
    </div>
  )
}
"##;

struct Fixture {
    root: PathBuf,
    server: Server,
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn fixture(files: &[(&str, &str)], options: Value) -> Fixture {
    let root = std::env::temp_dir().join(format!(
        "kirana-edges-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("package.json"), r#"{"name":"app"}"#).unwrap();
    for (name, text) in files {
        std::fs::write(root.join(name), text).unwrap();
    }
    let server =
        Server::start(&json!({ "root": root }).to_string(), &json!({ "initializationOptions": options })).unwrap();
    Fixture { root, server }
}

impl Fixture {
    fn uri(&self, name: &str) -> String {
        path_to_uri(&self.root.join(name)).as_str().to_owned()
    }

    fn ok(&mut self, method: &str, params: Value) -> Value {
        let response = self.server.request(&Request::new(RequestId::from(1), method.to_owned(), params));
        response.response_result.unwrap_or_else(|error| panic!("{method}: {error:?}"))
    }

    fn at(&self, name: &str, text: &str, needle: &str, delta: usize) -> Value {
        let offset = text.find(needle).unwrap_or_else(|| panic!("{needle}")) + delta;
        json!({ "textDocument": { "uri": self.uri(name) }, "position": LineIndex::new(text).position(offset) })
    }

    fn hover(&mut self, name: &str, text: &str, needle: &str) -> String {
        let params = self.at(name, text, needle, 1);
        self.ok("textDocument/hover", params)["contents"]["value"].as_str().unwrap_or_default().to_owned()
    }

    fn actions(&mut self, name: &str, text: &str, needle: &str, delta: usize) -> Vec<String> {
        let at = self.at(name, text, needle, delta);
        let params = json!({
            "textDocument": at["textDocument"],
            "range": { "start": at["position"], "end": at["position"] },
            "context": { "diagnostics": [] },
        });
        let actions = self.ok("textDocument/codeAction", params);
        actions.as_array().unwrap().iter().filter_map(|action| action["title"].as_str()).map(str::to_owned).collect()
    }
}

fn page() -> Fixture {
    fixture(
        &[("tokens.ts", TOKENS), ("styles.ts", STYLES), ("page.tsx", PAGE)],
        json!({ "images": true, "html": true, "summaryLength": 0 }),
    )
}

#[test]
fn a_runtime_merge_shows_what_a_later_handle_overrides() {
    let mut f = page();
    let hover = f.hover("page.tsx", PAGE, "sx={[base");
    // The compiler merges the static handles: `wide`'s padding is the one the element gets.
    assert!(hover.contains("Merges 2 handles") && hover.contains("`2rem` · 32px"), "{hover}");
    // Tokens read as names and values: a variable length in pixels, a mode token in both modes, a
    // token read inside a larger value.
    assert!(hover.contains("`space.gutter` · `0.5rem` · 8px"), "{hover}");
    assert!(hover.contains("`blend.shade` · `multiply` / `screen`"), "{hover}");
    assert!(hover.contains("`calc(var(--"), "{hover}");
    assert!(hover.contains(" · `space.gutter`<br>"), "{hover}");
    // Colour properties whose value is no colour get no swatch.
    assert!(hover.contains("outline-color</span> `currentcolor`<br>"), "{hover}");
    assert!(hover.contains("color</span> `currentcolor` / `#000`<br>"), "{hover}");
}

#[test]
fn the_box_model_of_a_block_with_four_margins_and_a_pixel_radius() {
    let mut f = page();
    let hover = f.hover("page.tsx", PAGE, "sx={[base");
    let start = hover.find("![style](data:image/svg+xml;base64,").unwrap();
    assert!(start > 0, "the brand's icon comes first");
    // The text drawing, without images, shows the four sides and no layout line for `block`.
    let mut plain = fixture(&[("tokens.ts", TOKENS), ("styles.ts", STYLES), ("page.tsx", PAGE)], json!({}));
    let text = plain.hover("page.tsx", PAGE, "sx={[base");
    assert!(text.contains("margin 1px 2px 3px 4px"), "{text}");
    assert!(!text.contains("grid") && !text.contains("flex ·"), "{text}");
}

#[test]
fn a_handle_from_another_file_is_its_source() {
    let mut f = page();
    let hover = f.hover("page.tsx", PAGE, "sx={card}");
    assert!(hover.contains("From [`card`]("), "{hover}");
    assert!(hover.contains("styles.ts#L2"), "{hover}");
}

#[test]
fn long_values_are_cut_in_a_summary() {
    let mut f = page();
    let uri = f.uri("page.tsx");
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": uri } }));
    let labels: Vec<&str> = hints.as_array().unwrap().iter().filter_map(|hint| hint["label"].as_str()).collect();
    assert!(
        labels.iter().any(|label| label.contains("font-family a-very-long-font-family-name, anoth…")),
        "{labels:?}"
    );
}

#[test]
fn colours_of_a_pair_whose_half_is_no_colour() {
    let mut f = page();
    let uri = f.uri("page.tsx");
    let colours = f.ok("textDocument/documentColor", json!({ "textDocument": { "uri": uri } }));
    // `light-dark(currentcolor, #000)`: only the dark half is a colour.
    let index = LineIndex::new(PAGE);
    let at = PAGE.find("#000").unwrap();
    assert!(colours.as_array().unwrap().iter().any(|colour| colour["range"]["start"] == json!(index.position(at))));
    assert!(
        !colours.to_string().contains(&json!(index.position(PAGE.find("currentcolor, #000").unwrap())).to_string())
    );
}

#[test]
fn symbols_highlights_and_refactorings_at_their_edges() {
    let mut f = page();
    let uri = f.uri("page.tsx");
    // `relation( "loose" )` is not written the way the outline looks for it: no symbol, no error.
    let symbols = f.ok("textDocument/documentSymbol", json!({ "textDocument": { "uri": uri } }));
    assert!(!symbols.to_string().contains("\"loose\""), "{symbols}");
    // A quoted key is highlighted with its quotes.
    let at = f.at("page.tsx", PAGE, "sx={quoted}", 1);
    let highlights = f.ok("textDocument/documentHighlight", at);
    let key = PAGE.find("\"margin-left\"").unwrap();
    let range = json!(LineIndex::new(PAGE).range(key, key + "\"margin-left\"".len()));
    assert!(highlights.as_array().unwrap().iter().any(|highlight| highlight["range"] == range), "{highlights}");
    // No inline for a member, no variation for a conditional value; one with braces in its value.
    assert!(!f.actions("page.tsx", PAGE, "styles.one} />", 8).iter().any(|title| title.starts_with("Kirana: inline")));
    assert!(!f.actions("page.tsx", PAGE, "padding: { base", 2).iter().any(|title| title.starts_with("Kirana: vary")));
    assert!(f.actions("page.tsx", PAGE, "width: `calc", 2).contains(&"Kirana: vary width at md".to_owned()));
    // `kirana/inspect` needs a document.
    let request = Request::new(RequestId::from(2), "kirana/inspect".to_owned(), json!({}));
    assert!(f.server.request(&request).response_result.is_err());
}

#[test]
fn inline_takes_the_blank_line_and_extract_needs_a_declaration() {
    let text = "import { css } from \"@kirana-style/core\"\nconst solo = css({ opacity: 0.5 })\n\nexport const A = () => <p sx={solo} />\n";
    let loose = "import { css } from \"@kirana-style/core\"\n;<p sx={css({ color: \"red\" })} />\n";
    let mut f = fixture(&[("a.tsx", text), ("loose.tsx", loose)], json!({}));
    let at = f.at("a.tsx", text, "sx={solo}", 5);
    let params = json!({
        "textDocument": at["textDocument"],
        "range": { "start": at["position"], "end": at["position"] },
        "context": { "diagnostics": [] },
    });
    let actions = f.ok("textDocument/codeAction", params);
    let inline = actions.as_array().unwrap().iter().find(|action| action["title"] == "Kirana: inline solo").unwrap();
    // The declaration's line and the blank line after it go.
    let removed = &inline["edit"]["changes"][f.uri("a.tsx")][1]["range"];
    assert_eq!(removed["start"]["line"], 1);
    assert_eq!(removed["end"]["line"], 3);
    assert!(!f.actions("loose.tsx", loose, "css({ color", 2).iter().any(|title| title.starts_with("Kirana: extract")));
}

#[test]
fn a_panicking_handler_answers_with_an_error() {
    let response = kirana_lsp::respond(RequestId::from(7), "textDocument/hover", || panic!("boom"));
    let error = response.response_result.unwrap_err();
    assert_eq!(error.code, ErrorCode::InternalError as i32);
    assert_eq!(error.message, "kirana lsp: textDocument/hover failed: boom");
    let fine = kirana_lsp::respond(RequestId::from(8), "x", || lsp_server::Response::new_ok(RequestId::from(8), 1));
    assert!(fine.response_result.is_ok());
}

const VUE: &str = r##"<script setup lang="ts">
import { css, relation } from "@kirana-style/core"
const props = defineProps<{ extra?: unknown }>()
const group = relation("group")
const card = css({ display: "grid", padding: "1rem", color: { [group.within(":hover")]: "red" } })
</script>

<template>
  <section :sx="[card, props.extra]" />
</template>
"##;

const SVELTE: &str = r##"<script>
  import { css } from "@kirana-style/core"
  const card = css({ paddingTop: "4px" })
</script>

<p sx={[card, css({ width: 5 })]}></p>
"##;

#[test]
fn components_forward_sx_and_report_project_diagnostics() {
    let mut f = fixture(&[("Card.vue", VUE), ("List.svelte", SVELTE)], json!({}));
    let uri = f.uri("Card.vue");
    let open = json!({ "textDocument": { "uri": uri, "languageId": "vue", "version": 1, "text": VUE } });
    let published = f.server.notification(Notification::new("textDocument/didOpen".to_owned(), open));
    // A relation read in the script and never anchored: a project-wide diagnostic naming the
    // script's block, reported at the block's start in the component.
    let diagnostics = published.iter().find(|n| n.params["uri"] == uri).unwrap().params["diagnostics"].clone();
    let without = diagnostics
        .as_array()
        .unwrap()
        .iter()
        .find(|d| d["code"] == "relation-without-anchor")
        .unwrap_or_else(|| panic!("{diagnostics}"));
    assert_eq!(without["range"]["start"], json!({ "line": 0, "character": 24 }));
    // A binding that merges a handle with a prop is recorded as its expression; it still summarizes.
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": uri } }));
    assert!(hints.to_string().contains("▦ grid"), "{hints}");
    // A `css()` written in a template reports nothing: the build does not compile templates.
    let svelte = f.uri("List.svelte");
    let open = json!({ "textDocument": { "uri": svelte, "languageId": "svelte", "version": 1, "text": SVELTE } });
    let published = f.server.notification(Notification::new("textDocument/didOpen".to_owned(), open));
    let diagnostics = &published.iter().find(|n| n.params["uri"] == svelte).unwrap().params["diagnostics"];
    assert_eq!(diagnostics, &json!([]));
}

const OUTLINE: &str = r##"import { css, recipe } from "@kirana-style/core"
const prop = "color"
export default css({ [prop]: "red" })
console.log(recipe({ base: { color: "blue" } }))
const a2 = css({ paddingTop: "1px", marginTop: "1px", opacity: 0.5 })
const b2 = css({ paddingTop: "2px", marginTop: "2px" })
const split = css({ margin: "1px 2px" })
const column = css({ display: "grid", gridTemplateColumns: "1fr", padding: "1px" })
const pStyle = 1
const computed = css({ [prop]: "green" })
export function D() {
  return (
    <div>
      <p sx={css({ color: "red" })} />
      <i sx={[a2, b2]} />
      <u sx={computed} />
      <s sx={split} />
      <em sx={column} />
      <b sx={[a2, b2, a2, b2, a2, b2, a2, b2, a2, b2, a2, b2, a2, b2, a2, b2, a2, b2]} />
    </div>
  )
}
"##;

fn outline() -> Fixture {
    fixture(&[("outline.tsx", OUTLINE)], json!({}))
}

#[test]
fn definitions_without_a_name_and_keys_that_cannot_be_found() {
    let mut f = outline();
    let uri = f.uri("outline.tsx");
    let symbols = f.ok("textDocument/documentSymbol", json!({ "textDocument": { "uri": uri } }));
    let names: Vec<&str> = symbols.as_array().unwrap().iter().filter_map(|symbol| symbol["name"].as_str()).collect();
    assert!(names.contains(&"css()") && names.contains(&"recipe()"), "{names:?}");
    // A computed key (`[prop]`): its property is known, its key cannot be pointed at.
    let on_key = f.at("outline.tsx", OUTLINE, "[prop]: \"green\"", 2);
    let highlights = f.ok("textDocument/documentHighlight", on_key);
    assert_eq!(highlights, json!([]), "the key names no property it can find: {highlights}");
    let on_element = f.at("outline.tsx", OUTLINE, "sx={computed}", 1);
    let highlights = f.ok("textDocument/documentHighlight", on_element);
    assert_eq!(highlights.as_array().unwrap().len(), 1, "only the element: {highlights}");
    // One grid column is singular in the drawing.
    let column = f.hover("outline.tsx", OUTLINE, "sx={column}");
    assert!(column.contains("grid · 1 col\n"), "{column}");
    // A shorthand split into longhands highlights its one key once.
    let on_split = f.at("outline.tsx", OUTLINE, "sx={split}", 1);
    let highlights = f.ok("textDocument/documentHighlight", on_split);
    assert_eq!(highlights.as_array().unwrap().len(), 2, "the key and the element: {highlights}");
    // An element that names a handle but receives only a third of it (the rest merged away) does
    // not use it.
    let lenses = f.ok("textDocument/codeLens", json!({ "textDocument": { "uri": uri } }));
    let line = OUTLINE[..OUTLINE.find("const a2").unwrap()].lines().count();
    let uses: Vec<&Value> =
        lenses.as_array().unwrap().iter().filter(|lens| lens["range"]["start"]["line"] == line).collect();
    assert!(uses.iter().all(|lens| !lens["command"]["title"].as_str().unwrap().starts_with("used by")), "{uses:?}");
    // A long expression is cut in the card's header; one declaration is singular.
    let long = f.hover("outline.tsx", OUTLINE, "sx={[a2, b2, a2");
    assert!(long.contains("…`"), "{long}");
    let single = f.hover("outline.tsx", OUTLINE, "sx={computed}");
    assert!(single.contains("1 declaration") && single.contains("1 rule"), "{single}");
    // Extract finds a name the file does not use.
    let titles = f.actions("outline.tsx", OUTLINE, "css({ color: \"red\" })} />", 2);
    assert!(titles.contains(&"Kirana: extract to css() as pStyle2".to_owned()), "{titles:?}");
}

#[test]
fn requests_without_a_document_fail_and_stale_files_answer_what_still_fits() {
    let mut f = outline();
    for method in [
        "textDocument/documentSymbol",
        "textDocument/foldingRange",
        "kirana/styleRanges",
        "textDocument/documentHighlight",
    ] {
        let request = Request::new(RequestId::from(3), method.to_owned(), json!({}));
        assert!(f.server.request(&request).response_result.is_err(), "{method}");
    }
    let request = Request::new(
        RequestId::from(4),
        "workspace/executeCommand".to_owned(),
        json!({ "command": "kirana.showUses", "arguments": [f.uri("outline.tsx")] }),
    );
    assert!(f.server.request(&request).response_result.is_err());
    // A hint whose data does not name a readable file cannot be resolved.
    for uri in ["not a uri", "untitled:x", "file:///no/such/file.tsx"] {
        let hint = json!({ "position": { "line": 0, "character": 0 }, "label": "x", "data": { "uri": uri, "start": 0, "end": 1 } });
        let request = Request::new(RequestId::from(5), "inlayHint/resolve".to_owned(), hint);
        assert!(f.server.request(&request).response_result.is_err(), "{uri}");
    }
    // The file loses its elements on disk, without a notification: what still fits is answered.
    let cut = &OUTLINE[..OUTLINE.find("export function D").unwrap()];
    std::fs::write(f.root.join("outline.tsx"), cut).unwrap();
    let uri = f.uri("outline.tsx");
    let symbols = f.ok("textDocument/documentSymbol", json!({ "textDocument": { "uri": uri } }));
    assert!(symbols.to_string().contains("a2"), "{symbols}");
    let key = f.at("outline.tsx", cut, "paddingTop: \"1px\"", 2);
    let highlights = f.ok("textDocument/documentHighlight", key);
    assert_eq!(highlights.as_array().unwrap().len(), 1, "the key alone: {highlights}");
    let element = json!({ "textDocument": { "uri": uri }, "position": { "line": 13, "character": 9 } });
    assert_eq!(f.ok("textDocument/hover", element), Value::Null);
}

#[test]
fn sources_that_changed_or_went_away_on_disk() {
    let user = "import { card } from \"./styles\"\nexport const U = () => <i sx={card} />\n";
    let mut f =
        fixture(&[("styles.ts", STYLES), ("page.tsx", PAGE), ("tokens.ts", TOKENS), ("use.tsx", user)], json!({}));
    // `kirana.showUses` from `card`: both elements; one in a file deleted since is left out.
    let definition = STYLES.find("css({").unwrap();
    let uses = f.ok(
        "workspace/executeCommand",
        json!({ "command": "kirana.showUses", "arguments": [f.uri("styles.ts"), definition] }),
    );
    assert_eq!(uses.as_array().unwrap().len(), 2, "{uses}");
    std::fs::remove_file(f.root.join("use.tsx")).unwrap();
    let uses = f.ok(
        "workspace/executeCommand",
        json!({ "command": "kirana.showUses", "arguments": [f.uri("styles.ts"), definition] }),
    );
    assert_eq!(uses.as_array().unwrap().len(), 1, "{uses}");
    // The definition's file rewritten, then deleted, on disk: the element's card has no source.
    std::fs::write(f.root.join("styles.ts"), "x").unwrap();
    let hover = f.hover("page.tsx", PAGE, "sx={card}");
    assert!(hover.contains("**Kirana** · `card`") && !hover.contains("From"), "{hover}");
    std::fs::remove_file(f.root.join("styles.ts")).unwrap();
    let hover = f.hover("page.tsx", PAGE, "sx={card}");
    assert!(!hover.contains("From"), "{hover}");
}
