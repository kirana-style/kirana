//! The language server, driven the way an editor drives it (KRN-DX-001 … KRN-DX-007).

use std::path::{Path, PathBuf};

use kirana_lsp::text::{LineIndex, path_to_uri};
use kirana_lsp::{RESTART, Server};
use lsp_server::{Connection, Message, Notification, Request, RequestId, Response};
use serde_json::{Value, json};

const TOKENS: &str = r##"import { defineTokens, select } from "@kirana-style/core"
export const color = defineTokens("color", {
  brand: "#0af",
  blend: { light: "multiply", dark: "screen" },
  red: { 500: "#f00" },
  ink: { light: "black", dark: "white" },
  wash: { value: "rgb(0 0 0 / 0.5)", variable: true },
})
export const space = defineTokens("space", { 1: "0.25rem", 4: "1rem" })
export const sizes = { a: "1px", b: 2, [select.child("x")]: "3px", c: true }
"##;

const CARD: &str = r##"import { css, recipe, relation, select } from "@kirana-style/core"
import { color, space } from "./tokens"

const card = relation("card")
export const box = css({
  display: "grid",
  gap: space[4],
  color: { base: color.ink, ":hover": "#ff0000", "@media (width >= 48rem)": "red" },
  padding: color.wash,
  opacity: { [card.within(":hover")]: 0.5 },
  [select.child("svg")]: { width: "1rem" },
  mixBlendMode: color.blend,
  borderColor: "currentcolor",
  zIndex: undefined,
})
export const button = recipe({ base: { color: "blue" }, variants: { size: { sm: { paddingTop: "1px" } } } })
export const broken = css({ width: 5, colr: "red", backgroundColr: "red" })
export const sized = (w: string) => css({ width: w })
export function Card({ w }: { w: string }) {
  return (
    <article sx={card.anchor}>
      <h2 sx={[box, css({ width: w })]} />
      <p sx="flex p-4 hover:bg-brand" />
      <span className="flex p-4" />
    </article>
  )
}
// xcolor.ink is not a use of the token.
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

fn config(root: &Path) -> String {
    let tokens = root.join("tokens.ts").to_string_lossy().into_owned();
    json!({
        "root": root,
        "utilities": {
            "scales": {
                "space": [{ "module": tokens, "export": "space" }],
                "sizes": [{ "module": tokens, "export": "missing" }, { "module": tokens, "export": "sizes" }],
                "color": [{ "module": tokens, "export": "color" }],
            },
            "utilities": {
                "flex": [{ "static": { "display": "flex" } }],
                "items": [{ "properties": ["alignItems"], "values": { "center": "center" } }],
                "p": [{ "properties": ["padding"], "scale": "space" }],
                "bg": [{ "properties": ["backgroundColor"], "scale": "color" }],
                "line-clamp": [{ "properties": ["lineClamp"], "number": { "step": 1 } }],
                "size": [{ "properties": ["width"], "scale": "sizes" }],
            },
            "variants": { "hover": ":hover", "md": "@media (width >= 48rem)" },
        },
    })
    .to_string()
}

fn fixture(options: Value) -> Fixture {
    let root = std::env::temp_dir().join(format!(
        "kirana-lsp-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("package.json"), r#"{"name":"app"}"#).unwrap();
    std::fs::write(root.join("tokens.ts"), TOKENS).unwrap();
    std::fs::write(root.join("card.tsx"), CARD).unwrap();
    let server = Server::start(&config(&root), &json!({ "initializationOptions": options })).unwrap();
    Fixture { root, server }
}

impl Fixture {
    fn card(&self) -> PathBuf {
        self.root.join("card.tsx")
    }

    fn uri(&self) -> String {
        path_to_uri(&self.card()).as_str().to_owned()
    }

    fn request(&mut self, method: &str, params: Value) -> Response {
        self.server.request(&Request::new(RequestId::from(1), method.to_owned(), params))
    }

    fn ok(&mut self, method: &str, params: Value) -> Value {
        let response = self.request(method, params);
        match response.response_result {
            Ok(value) => value,
            Err(error) => panic!("{method}: {error:?}"),
        }
    }

    fn notify(&mut self, method: &str, params: Value) -> Vec<Notification> {
        self.server.notification(Notification::new(method.to_owned(), params))
    }

    fn open(&mut self, text: &str) -> Vec<Notification> {
        let uri = self.uri();
        self.notify(
            "textDocument/didOpen",
            json!({ "textDocument": { "uri": uri, "languageId": "typescriptreact", "version": 1, "text": text } }),
        )
    }

    /// The position of the `nth` occurrence of `needle` in the card, `delta` bytes in.
    fn at(&self, needle: &str, nth: usize, delta: usize) -> Value {
        let offset = CARD.match_indices(needle).nth(nth).unwrap_or_else(|| panic!("{needle}")).0 + delta;
        let position = LineIndex::new(CARD).position(offset);
        json!({ "textDocument": { "uri": self.uri() }, "position": position })
    }

    fn range(&self, needle: &str) -> Value {
        let start = CARD.find(needle).unwrap();
        json!(LineIndex::new(CARD).range(start, start + needle.len()))
    }
}

/// An inlay hint's label: its parts' text joined.
fn label_text(hint: &Value) -> String {
    hint["label"].as_array().map_or_else(
        || hint["label"].as_str().unwrap_or_default().to_owned(),
        |parts| parts.iter().filter_map(|part| part["value"].as_str()).collect(),
    )
}

fn hover_text(value: &Value) -> String {
    value.pointer("/contents/value").and_then(Value::as_str).unwrap_or_default().to_owned()
}

#[test]
fn diagnostics_follow_open_change_and_close() {
    let mut f = fixture(json!({}));
    let published = f.open(CARD);
    let card = published.iter().find(|n| n.params["uri"] == f.uri()).unwrap();
    let names: Vec<&str> =
        card.params["diagnostics"].as_array().unwrap().iter().filter_map(|d| d["code"].as_str()).collect();
    assert!(names.contains(&"unitless-length") && names.contains(&"unknown-property"), "{names:?}");
    let unitless =
        card.params["diagnostics"].as_array().unwrap().iter().find(|d| d["code"] == "unitless-length").unwrap();
    assert!(unitless["message"].as_str().unwrap().contains("help: write the unit"));
    assert_eq!(unitless["severity"], 1);
    // A fixed document publishes without them.
    let fixed = CARD.replace("width: 5, colr: \"red\"", "width: \"5px\"");
    let uri = f.uri();
    let changed = f.notify(
        "textDocument/didChange",
        json!({ "textDocument": { "uri": uri, "version": 2 }, "contentChanges": [{ "text": fixed }] }),
    );
    let names: Vec<&str> =
        changed[0].params["diagnostics"].as_array().unwrap().iter().filter_map(|d| d["code"].as_str()).collect();
    assert!(!names.contains(&"unitless-length"), "{names:?}");
    assert!(
        f.notify(
            "textDocument/didChange",
            json!({ "textDocument": { "uri": uri, "version": 3 }, "contentChanges": [] })
        )
        .is_empty()
    );
    // Closing clears its diagnostics and goes back to the file on disk.
    let closed = f.notify("textDocument/didClose", json!({ "textDocument": { "uri": uri } }));
    assert_eq!(closed.last().unwrap().params["diagnostics"], json!([]));
    // Malformed notifications and unknown ones are ignored.
    for method in [
        "textDocument/didOpen",
        "textDocument/didChange",
        "textDocument/didClose",
        "workspace/didChangeWatchedFiles",
        "$/unknown",
    ] {
        assert!(f.notify(method, json!({ "nonsense": true })).is_empty());
    }
    assert!(
        f.notify(
            "textDocument/didOpen",
            json!({ "textDocument": { "uri": "untitled:x", "languageId": "tsx", "version": 1, "text": "" } })
        )
        .is_empty()
    );
    assert!(f.notify("textDocument/didClose", json!({ "textDocument": { "uri": "untitled:x" } })).is_empty());
}

#[test]
fn watched_files_invalidate_restart_and_remove() {
    let mut f = fixture(json!({}));
    f.open(CARD);
    let tokens = path_to_uri(&f.root.join("tokens.ts")).as_str().to_owned();
    std::fs::write(f.root.join("tokens.ts"), TOKENS.replace("#0af", "#0b0")).unwrap();
    let changed = f.notify("workspace/didChangeWatchedFiles", json!({ "changes": [{ "uri": tokens, "type": 2 }] }));
    assert!(changed.iter().all(|n| n.method == "textDocument/publishDiagnostics"));
    let config = path_to_uri(&f.root.join("kirana.config.ts")).as_str().to_owned();
    let restart = f.notify(
        "workspace/didChangeWatchedFiles",
        json!({ "changes": [{ "uri": config, "type": 2 }, { "uri": "untitled:y", "type": 1 }] }),
    );
    assert_eq!(restart[0].method, RESTART);
    // A module that is not open is re-read from disk; a deleted one leaves the graph.
    std::fs::write(
        f.root.join("other.tsx"),
        "import { css } from \"@kirana-style/core\"\nexport const o = css({ width: 5 })\n",
    )
    .unwrap();
    let other = path_to_uri(&f.root.join("other.tsx")).as_str().to_owned();
    f.notify("workspace/didChangeWatchedFiles", json!({ "changes": [{ "uri": other, "type": 1 }] }));
    f.notify("workspace/didChangeWatchedFiles", json!({ "changes": [{ "uri": other, "type": 2 }] }));
    std::fs::remove_file(f.root.join("other.tsx")).unwrap();
    f.notify("workspace/didChangeWatchedFiles", json!({ "changes": [{ "uri": other, "type": 3 }] }));
}

#[test]
fn hover_explains_styles_properties_conditions_and_tokens() {
    let mut f = fixture(json!({}));
    // A token: both modes.
    let ink = f.ok("textDocument/hover", f.at("color.ink", 0, 7));
    let text = hover_text(&ink);
    assert!(text.contains("`color.ink`") && text.contains("| `black` | `white` |"), "{text}");
    assert!(text.contains("Inlined"));
    let wash = hover_text(&f.ok("textDocument/hover", f.at("color.wash", 0, 7)));
    assert!(wash.contains("rgb(0 0 0 / 0.5)") && wash.contains("custom property"), "{wash}");
    // A property key: its rules, precedence, and the trace command.
    let property = hover_text(&f.ok("textDocument/hover", f.at("color: { base", 0, 2)));
    assert!(
        property.contains("**Precedence**") && property.contains("kirana-style trace card.tsx:8 color"),
        "{property}"
    );
    assert!(property.contains("@media (width >= 48rem) {"), "{property}");
    // A condition key.
    let hovered = hover_text(&f.ok("textDocument/hover", f.at("\":hover\": \"#ff0000\"", 0, 2)));
    assert!(hovered.contains(":where(:hover)"), "{hovered}");
    // The site itself, a recipe, an sx attribute, a utility string, a variable token read.
    assert!(hover_text(&f.ok("textDocument/hover", f.at("css({\n  display", 0, 1))).contains("`css()`"));
    assert!(hover_text(&f.ok("textDocument/hover", f.at("recipe(", 0, 1))).contains("`recipe()`"));
    let sx = hover_text(&f.ok("textDocument/hover", f.at("sx={[box", 0, 1)));
    assert!(sx.contains("Merges 2 handles") && sx.contains("display: grid"), "{sx}");
    assert!(hover_text(&f.ok("textDocument/hover", f.at("sx=\"flex", 0, 5))).contains("utility string"));
    assert!(hover_text(&f.ok("textDocument/hover", f.at("padding: color.wash", 0, 1))).contains("Reads `color.wash`"));
    // A pseudo-element or base key, a key nothing sets, and nowhere at all.
    assert!(!hover_text(&f.ok("textDocument/hover", f.at("base:", 0, 1))).contains("Precedence"));
    assert_eq!(f.ok("textDocument/hover", f.at("import", 0, 2)), Value::Null);
    let error = f.request(
        "textDocument/hover",
        json!({ "textDocument": { "uri": "untitled:z" }, "position": { "line": 0, "character": 0 } }),
    );
    assert!(error.response_result.is_err());
    let missing = path_to_uri(&f.root.join("missing.tsx")).as_str().to_owned();
    assert!(
        f.request(
            "textDocument/hover",
            json!({ "textDocument": { "uri": missing }, "position": { "line": 0, "character": 0 } })
        )
        .response_result
        .is_err()
    );
    assert!(
        f.request("textDocument/hover", json!({ "textDocument": { "uri": f.uri() }, "position": "nope" }))
            .response_result
            .is_err()
    );
    assert!(f.request("textDocument/hover", json!({})).response_result.is_err());
}

#[test]
fn colours_show_literals_and_tokens_and_edit_literals_only() {
    let mut f = fixture(json!({}));
    let colours = f.ok("textDocument/documentColor", json!({ "textDocument": { "uri": f.uri() } }));
    let colours = colours.as_array().unwrap();
    let red = colours.iter().find(|c| c["color"]["red"] == 1.0 && c["color"]["green"] == 0.0).unwrap();
    assert_eq!(red["color"]["alpha"], 1.0);
    // `color.ink` shows its light side, black.
    assert!(colours.iter().any(|c| c["color"] == json!({ "red": 0.0, "green": 0.0, "blue": 0.0, "alpha": 1.0 })));
    let uri = f.uri();
    let literal = f.ok(
        "textDocument/colorPresentation",
        json!({ "textDocument": { "uri": uri }, "range": f.range("#ff0000"), "color": { "red": 1.0, "green": 0.0, "blue": 0.0, "alpha": 0.5 } }),
    );
    let labels: Vec<&str> = literal.as_array().unwrap().iter().filter_map(|p| p["label"].as_str()).collect();
    assert_eq!(labels[0], "#ff000080");
    assert_eq!(labels[1], "rgb(255 0 0 / 0.5)");
    assert!(labels[2].starts_with("oklch(0.628 0.258 29.2"), "{labels:?}");
    let opaque = f.ok(
        "textDocument/colorPresentation",
        json!({ "textDocument": { "uri": uri }, "range": f.range("#ff0000"), "color": { "red": 1.0, "green": 1.0, "blue": 1.0, "alpha": 1.0 } }),
    );
    assert_eq!(opaque[0]["label"], "#ffffff");
    let token = f.ok(
        "textDocument/colorPresentation",
        json!({ "textDocument": { "uri": uri }, "range": f.range("color.ink"), "color": { "red": 0.0, "green": 0.0, "blue": 0.0, "alpha": 1.0 } }),
    );
    assert_eq!(token, json!([]));
    assert!(
        f.request("textDocument/colorPresentation", json!({ "textDocument": { "uri": uri }, "range": 1 }))
            .response_result
            .is_err()
    );
    assert!(
        f.request(
            "textDocument/colorPresentation",
            json!({ "textDocument": { "uri": uri }, "range": f.range("#ff0000"), "color": 1 })
        )
        .response_result
        .is_err()
    );
    assert!(f.request("textDocument/documentColor", json!({})).response_result.is_err());
}

#[test]
fn summaries_and_lenses_describe_sites() {
    let mut f = fixture(json!({}));
    let uri = f.uri();
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": uri }, "range": f.range("import") }));
    let labels: Vec<String> = hints.as_array().unwrap().iter().map(label_text).collect();
    assert!(labels.iter().any(|label| label.starts_with("▦ grid · gap 1rem")), "{labels:?}");
    assert!(labels.iter().any(|label| label.contains("hover: bg")), "{labels:?}");
    let lenses = f.ok("textDocument/codeLens", json!({ "textDocument": { "uri": uri } }));
    let titles: Vec<&str> = lenses.as_array().unwrap().iter().filter_map(|l| l["command"]["title"].as_str()).collect();
    assert!(titles.iter().any(|title| title.starts_with("css() · ") && title.contains("conditional")), "{titles:?}");
    assert!(titles.iter().any(|title| title.starts_with("recipe() · ")), "{titles:?}");
    assert!(f.request("textDocument/inlayHint", json!({})).response_result.is_err());
    assert!(f.request("textDocument/codeLens", json!({})).response_result.is_err());
    let mut off = fixture(json!({ "summary": false, "codeLens": false }));
    let uri = off.uri();
    assert_eq!(off.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": uri } })), json!([]));
    assert_eq!(off.ok("textDocument/codeLens", json!({ "textDocument": { "uri": uri } })), json!([]));
}

#[test]
fn summary_vocabulary() {
    let mut f = fixture(json!({}));
    let text = CARD.replace(
        "export const broken",
        "export function Many() { return <i sx={css({ display: \"none\", paddingInline: \"1px\", paddingBlock: \"1px\", paddingTop: \"1px\", paddingRight: \"1px\", paddingBottom: \"1px\", paddingLeft: \"1px\", paddingInlineStart: \"1px\", paddingInlineEnd: \"1px\", margin: \"1px\", marginInline: \"1px\", marginBlock: \"1px\", marginTop: \"1px\", marginRight: \"1px\", marginBottom: \"1px\", marginLeft: \"1px\", marginInlineStart: \"1px\", marginInlineEnd: \"1px\", height: \"1px\", minWidth: \"1px\", maxWidth: \"1px\", minHeight: \"1px\", maxHeight: \"1px\", backgroundColor: \"red\", fontSize: \"1px\", fontWeight: 700, lineHeight: 1, letterSpacing: \"1px\", borderRadius: \"1px\", borderWidth: \"1px\", borderColor: \"red\", zIndex: 1, gridTemplateColumns: \"1fr\", gridTemplateRows: \"1fr\", alignItems: \"center\", justifyContent: \"center\", flexDirection: \"row\", boxShadow: \"none\", cursor: \"pointer\", width: { \"@media (width >= 40rem)\": \"1px\", \"@media (width >= 64rem)\": \"2px\", \"@media (width >= 80rem)\": \"3px\", \"@media (width >= 96rem)\": \"4px\", \"@media (width >= 10rem)\": \"5px\" }, \"::before\": { content: \"''\" } })} /> }\nexport const broken",
    );
    f.open(&text);
    let uri = f.uri();
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": uri } }));
    let many = hints.as_array().unwrap().iter().map(label_text).find(|l| l.starts_with("hidden")).unwrap();
    assert!(many.ends_with(" · +34"), "{many}");
    // Every abbreviation and breakpoint is exercised through the summary of a long style.
    let full = kirana_lsp_summary(&mut f, &text);
    for expected in [
        "px 1px",
        "py 1px",
        "pt 1px",
        "pr 1px",
        "pb 1px",
        "pl 1px",
        "ps 1px",
        "pe 1px",
        "m 1px",
        "mx 1px",
        "my 1px",
        "mt 1px",
        "mr 1px",
        "mb 1px",
        "ml 1px",
        "ms 1px",
        "me 1px",
        "h 1px",
        "min-w 1px",
        "max-w 1px",
        "min-h 1px",
        "max-h 1px",
        "bg red",
        "text 1px",
        "font 700",
        "leading 1",
        "tracking 1px",
        "rounded 1px",
        "border 1px",
        "border red",
        "z 1",
        "cols 1fr",
        "rows 1fr",
        "items center",
        "justify center",
        "flex row",
        "shadow none",
        "cursor pointer",
        "sm: w 1px",
        "lg: w 2px",
        "xl: w 3px",
        "2xl: w 4px",
        "@media (width >= 10rem): w 5px",
        "before: content ''",
    ] {
        assert!(full.contains(expected), "{expected} in {full}");
    }
}

/// The untruncated summary of the `Many` element, through the CSS command (every atom) and the
/// same vocabulary.
fn kirana_lsp_summary(f: &mut Fixture, text: &str) -> String {
    let offset = text.find("sx={css({ display: \"none\"").unwrap() as u64;
    let uri = f.uri();
    let css =
        f.ok("workspace/executeCommand", json!({ "command": "kirana.showCompiledCss", "arguments": [uri, offset] }));
    assert!(css["content"].as_str().unwrap().contains("padding-inline: 1px"));
    kirana_lsp::summary_of_document(&f.server, &f.card(), offset as usize)
}

#[test]
fn completion_offers_conditions_values_targets_and_utilities() {
    let mut f = fixture(json!({}));
    let text = CARD
        .replace(
            "display: \"grid\",",
            "display: \"gr\",\n  \":ho\": 1,\n  color: { \"\": 1, \":hover\": \"r\" },\n  [select.]: {},",
        )
        .replace("sx=\"flex p-4", "sx=\"flex p-");
    f.open(&text);
    let uri = f.uri();
    let at = |needle: &str, delta: usize| {
        let offset = text.find(needle).unwrap() + delta;
        json!({ "textDocument": { "uri": uri }, "position": LineIndex::new(&text).position(offset) })
    };
    let labels = |value: &Value| -> Vec<String> {
        let items = value.get("items").unwrap_or(value);
        items.as_array().unwrap().iter().map(|item| item["label"].as_str().unwrap().to_owned()).collect()
    };
    let values = f.ok("textDocument/completion", at("\"gr\"", 3));
    assert!(labels(&values).contains(&"grid".to_owned()) && labels(&values).contains(&"inherit".to_owned()));
    let top = labels(&f.ok("textDocument/completion", at("\":ho\"", 4)));
    assert!(
        top.contains(&":hover".to_owned()) && top.contains(&"::before".to_owned()) && !top.contains(&"base".to_owned())
    );
    let nested = labels(&f.ok("textDocument/completion", at("{ \"\": 1", 3)));
    assert!(
        nested.contains(&"base".to_owned())
            && nested.contains(&"@media".to_owned())
            && !nested.contains(&"::before".to_owned())
    );
    let colour = labels(&f.ok("textDocument/completion", at("\"r\" }", 2)));
    assert!(colour.contains(&"currentcolor".to_owned()));
    let targets = labels(&f.ok("textDocument/completion", at("[select.]", 8)));
    assert_eq!(targets, ["descendant", "child"]);
    let utilities = labels(&f.ok("textDocument/completion", at("sx=\"flex p-", 11)));
    assert!(utilities.contains(&"p-4".to_owned()) && utilities.contains(&"bg-".to_owned()), "{utilities:?}");
    let roots = labels(&f.ok("textDocument/completion", at("sx=\"flex", 5)));
    assert!(
        roots.contains(&"hover:".to_owned())
            && roots.contains(&"items-center".to_owned())
            && roots.contains(&"flex".to_owned())
    );
    // An `sx` array string, a variant prefix, and colour values in a scale.
    let array = text.replace("sx={[box, css({ width: w })]}", "sx={[box, \"hover:bg-\"]}");
    f.open(&array);
    let at_array = json!({ "textDocument": { "uri": uri }, "position": LineIndex::new(&array).position(array.find("hover:bg-").unwrap() + 9) });
    let scaled = labels(&f.ok("textDocument/completion", at_array));
    assert!(scaled.contains(&"bg-brand".to_owned()), "{scaled:?}");
    // Outside strings, in a call argument, and in a string that is not in a style.
    f.open(&text);
    assert_eq!(f.ok("textDocument/completion", at("export function", 1)), Value::Null);
    assert_eq!(f.ok("textDocument/completion", at("relation(\"card\")", 10)), Value::Null);
    assert!(f.request("textDocument/completion", json!({})).response_result.is_err());
}

#[test]
fn utilities_need_a_grammar() {
    let root = std::env::temp_dir().join(format!("kirana-lsp-nogrammar-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let text = "export const A = () => <p sx=\"fl\" className=\"flex\" />\n";
    std::fs::write(root.join("a.tsx"), text).unwrap();
    let mut server = Server::start(&json!({ "root": root }).to_string(), &json!({})).unwrap();
    let uri = path_to_uri(&root.join("a.tsx")).as_str().to_owned();
    let request = |method: &str, params: Value| Request::new(RequestId::from(1), method.to_owned(), params);
    let completion = server.request(&request(
        "textDocument/completion",
        json!({ "textDocument": { "uri": uri }, "position": { "line": 0, "character": 32 } }),
    ));
    assert_eq!(completion.response_result.unwrap(), Value::Null);
    let actions = server.request(&request(
        "textDocument/codeAction",
        json!({ "textDocument": { "uri": uri }, "range": { "start": { "line": 0, "character": 46 }, "end": { "line": 0, "character": 46 } }, "context": { "diagnostics": [] } }),
    ));
    assert_eq!(actions.response_result.unwrap(), json!([]));
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn navigation_finds_definitions_uses_anchors_and_symbols() {
    let mut f = fixture(json!({}));
    let definition = f.ok("textDocument/definition", f.at("color.ink", 0, 7));
    assert!(definition[0]["uri"].as_str().unwrap().ends_with("tokens.ts"));
    let anchors = f.ok("textDocument/definition", f.at("card.within", 0, 6));
    assert_eq!(anchors.as_array().unwrap().len(), 1);
    assert!(anchors[0]["uri"].as_str().unwrap().ends_with("card.tsx"));
    let declaration = f.ok("textDocument/definition", f.at("card.anchor", 0, 1));
    assert_eq!(declaration[0]["range"]["start"]["line"], 3);
    assert_eq!(f.ok("textDocument/definition", f.at("import", 0, 2)), json!(null));
    assert_eq!(f.ok("textDocument/definition", f.at("{ w }", 0, 2)), Value::Null);
    let uses = f.ok("textDocument/references", f.at("color.ink", 0, 7));
    assert_eq!(uses.as_array().unwrap().len(), 1);
    let relation = f.ok("textDocument/references", f.at("card.anchor", 0, 1));
    assert_eq!(relation.as_array().unwrap().len(), 2);
    assert_eq!(f.ok("textDocument/references", f.at("import", 0, 2)), Value::Null);
    assert_eq!(f.ok("textDocument/references", f.at("{ w }", 0, 2)), Value::Null);
    let symbols = f.ok("workspace/symbol", json!({ "query": "C" }));
    let names: Vec<&str> = symbols.as_array().unwrap().iter().filter_map(|s| s["name"].as_str()).collect();
    assert!(names.contains(&"color.brand") && names.contains(&"card"), "{names:?}");
    assert!(f.request("textDocument/definition", json!({})).response_result.is_err());
    assert!(f.request("textDocument/references", json!({})).response_result.is_err());
}

#[test]
fn navigation_through_imported_relations_and_aliased_tokens() {
    let mut f = fixture(json!({}));
    std::fs::write(
        f.root.join("rel.ts"),
        "import { relation } from \"@kirana-style/core\"\nexport const group = relation('group')\n",
    )
    .unwrap();
    let reader = "import { css } from \"@kirana-style/core\"\nimport { group } from \"./rel\"\nimport { color as palette } from \"./tokens\"\nexport const r = css({ color: { [group.within(\":hover\")]: palette.brand } })\nexport const A = () => <div sx={group.anchor}><p sx={r} /></div>\n";
    std::fs::write(f.root.join("reader.tsx"), reader).unwrap();
    let uri = path_to_uri(&f.root.join("reader.tsx")).as_str().to_owned();
    f.notify(
        "textDocument/didOpen",
        json!({ "textDocument": { "uri": uri, "languageId": "tsx", "version": 1, "text": reader } }),
    );
    let at = |needle: &str, delta: usize| json!({ "textDocument": { "uri": uri }, "position": LineIndex::new(reader).position(reader.find(needle).unwrap() + delta) });
    let aliased = f.ok("textDocument/definition", at("palette.brand", 9));
    assert!(aliased[0]["uri"].as_str().unwrap().ends_with("tokens.ts"));
    let uses = f.ok("textDocument/references", at("palette.brand", 9));
    assert_eq!(uses.as_array().unwrap().len(), 1);
    let declared = f.ok("textDocument/definition", at("group.anchor", 1));
    assert!(declared[0]["uri"].as_str().unwrap().ends_with("rel.ts"));
    // A read whose anchor is under another name jumps to the declaration instead.
    let elsewhere = reader.replace("sx={group.anchor}", "sx={[group][0].anchor}");
    f.notify(
        "textDocument/didChange",
        json!({ "textDocument": { "uri": uri, "version": 2 }, "contentChanges": [{ "text": elsewhere }] }),
    );
    let read = f.ok("textDocument/definition", json!({ "textDocument": { "uri": uri }, "position": LineIndex::new(&elsewhere).position(elsewhere.find("group.within").unwrap() + 7) }));
    assert!(read[0]["uri"].as_str().unwrap().ends_with("rel.ts"), "{read}");
    // A declaration written in a way the search does not find has no location; a file that is gone
    // has no relation to resolve.
    std::fs::write(
        f.root.join("rel.ts"),
        "import { relation } from \"@kirana-style/core\"\nexport const group = relation( 'group' )\n",
    )
    .unwrap();
    assert_eq!(f.ok("textDocument/definition", at("group.anchor", 1)), json!([]));
    std::fs::remove_file(f.root.join("rel.ts")).unwrap();
    assert_eq!(f.ok("textDocument/definition", at("group.anchor", 1)), Value::Null);
    // A token whose file cannot be read has no location.
    std::fs::remove_file(f.root.join("tokens.ts")).unwrap();
    assert_eq!(f.ok("textDocument/definition", f.at("color.ink", 0, 7)), json!([]));
}

#[test]
fn code_actions_fix_explain_show_and_convert() {
    let mut f = fixture(json!({}));
    f.open(CARD);
    let uri = f.uri();
    let unitless_range = f.range("width: 5");
    let unknown_range = f.range("colr: \"red\"");
    let diagnostics = json!([
        { "range": unitless_range, "message": "m", "data": { "code": "KRN1203" } },
        { "range": unknown_range, "message": "m", "data": { "code": "KRN1201" } },
        { "range": unknown_range, "message": "m", "data": { "code": "KRN1202" } },
        { "range": unknown_range, "message": "m" },
    ]);
    let actions = f.ok(
        "textDocument/codeAction",
        json!({ "textDocument": { "uri": uri }, "range": unitless_range, "context": { "diagnostics": diagnostics } }),
    );
    let titles: Vec<&str> = actions.as_array().unwrap().iter().filter_map(|a| a["title"].as_str()).collect();
    assert!(titles.contains(&"Write \"5px\"") && titles.contains(&"Change to color"), "{titles:?}");
    let site = f.ok("textDocument/codeAction", json!({ "textDocument": { "uri": uri }, "range": f.range("display: \"grid\""), "context": { "diagnostics": [] } }));
    let titles: Vec<&str> = site.as_array().unwrap().iter().filter_map(|a| a["title"].as_str()).collect();
    assert!(
        titles.contains(&"Kirana: show compiled CSS") && titles.contains(&"Kirana: explain precedence of display"),
        "{titles:?}"
    );
    // Fixes that cannot be made exactly are not offered.
    let odd = json!([
        { "range": f.range("broken"), "message": "m", "data": { "code": "KRN1203" } },
        { "range": f.range("width: 5, colr"), "message": "m", "data": { "code": "KRN1203" } },
        { "range": f.range("display: \"grid\""), "message": "m", "data": { "code": "KRN1201" } },
        { "range": f.range("export"), "message": "m", "data": { "code": "KRN1201" } },
        { "range": "nope", "message": "m", "data": { "code": "KRN1201" } },
    ]);
    let none = f.ok(
        "textDocument/codeAction",
        json!({ "textDocument": { "uri": uri }, "range": f.range("import"), "context": { "diagnostics": odd } }),
    );
    assert_eq!(none, json!([]));
    // Converting a class string.
    let convert = f.ok("textDocument/codeAction", json!({ "textDocument": { "uri": uri }, "range": f.range("flex p-4\" />\n    </"), "context": { "diagnostics": [] } }));
    let rewrite = convert.as_array().unwrap().iter().find(|a| a["kind"] == "refactor.rewrite").unwrap();
    let edits = rewrite["edit"]["changes"][&uri].as_array().unwrap();
    let new_text = edits[0]["newText"].as_str().unwrap();
    eprintln!("EDITS {}", serde_json::to_string_pretty(&edits).unwrap());
    assert!(
        new_text.starts_with("sx={css({")
            && new_text.contains("display: \"flex\"")
            && new_text.contains("padding: space[4]"),
        "{new_text}"
    );
    // A class the grammar does not know is left as a comment and counted.
    let unknown = CARD.replace("className=\"flex p-4\"", "className=\"flex nope\"");
    f.open(&unknown);
    let at = LineIndex::new(&unknown).range(unknown.find("flex nope").unwrap(), unknown.find("flex nope").unwrap());
    let counted = f.ok(
        "textDocument/codeAction",
        json!({ "textDocument": { "uri": uri }, "range": at, "context": { "diagnostics": [] } }),
    );
    assert!(counted.as_array().unwrap().iter().any(|a| a["title"].as_str().unwrap().contains("left as comments")));
    // Only `className` strings convert, and not empty ones.
    for (from, to) in [
        ("className=\"flex p-4\"", "title=\"flex p-4\""),
        ("className=\"flex p-4\"", "className=\" \""),
        ("className=\"flex p-4\"", "className={\"flex p-4\"}"),
    ] {
        let other = CARD.replace(from, to);
        f.open(&other);
        let start = other.find(&to[to.len() - 4..]).unwrap();
        let at = LineIndex::new(&other).range(start + 1, start + 1);
        let result = f.ok(
            "textDocument/codeAction",
            json!({ "textDocument": { "uri": uri }, "range": at, "context": { "diagnostics": [] } }),
        );
        assert!(result.as_array().unwrap().iter().all(|a| a["kind"] != "refactor.rewrite"), "{to}");
    }
    assert!(
        f.request("textDocument/codeAction", json!({ "textDocument": { "uri": uri }, "range": 1 }))
            .response_result
            .is_err()
    );
    assert!(f.request("textDocument/codeAction", json!({})).response_result.is_err());
}

#[test]
fn commands_show_css_explain_and_convert() {
    let mut f = fixture(json!({}));
    let uri = f.uri();
    let all = f.ok("workspace/executeCommand", json!({ "command": "kirana.showCompiledCss", "arguments": [uri] }));
    let content = all["content"].as_str().unwrap();
    assert!(
        content.starts_with("/* card.tsx — compiled by Kirana */") && content.contains("/* line 5: css({ */"),
        "{content}"
    );
    let line = CARD[..CARD.find("color: { base").unwrap()].lines().count() + 1;
    let explain = f.ok(
        "workspace/executeCommand",
        json!({ "command": "kirana.explainPrecedence", "arguments": [uri, line, "color"] }),
    );
    let text = explain["content"].as_str().unwrap();
    assert!(text.contains("— wins") && text.contains("— loses: "), "{text}");
    let nothing = f.ok(
        "workspace/executeCommand",
        json!({ "command": "kirana.explainPrecedence", "arguments": [uri, 1, "color"] }),
    );
    assert!(nothing["content"].as_str().unwrap().contains("Nothing on this line"));
    let offset = CARD.find("flex p-4\" />\n    </").unwrap();
    let edit =
        f.ok("workspace/executeCommand", json!({ "command": "kirana.convertTailwind", "arguments": [uri, offset] }));
    assert!(edit["changes"][&uri].is_array());
    assert_eq!(
        f.ok("workspace/executeCommand", json!({ "command": "kirana.convertTailwind", "arguments": [uri, 0] })),
        Value::Null
    );
    for bad in [
        json!({ "command": "kirana.explainPrecedence", "arguments": [uri] }),
        json!({ "command": "kirana.explainPrecedence", "arguments": [uri, 1] }),
        json!({ "command": "kirana.convertTailwind", "arguments": [uri] }),
        json!({ "command": "kirana.nope", "arguments": [uri] }),
        json!({ "command": "kirana.showCompiledCss", "arguments": ["untitled:q"] }),
        json!({ "command": "kirana.showCompiledCss", "arguments": [path_to_uri(&f.root.join("missing.tsx")).as_str()] }),
        json!({ "command": "kirana.showCompiledCss" }),
    ] {
        assert!(f.request("workspace/executeCommand", bad.clone()).response_result.is_err(), "{bad}");
    }
}

#[test]
fn unknown_requests_are_method_not_found() {
    let mut f = fixture(json!({}));
    let response = f.request("textDocument/semanticTokens/full", json!({}));
    assert_eq!(response.response_result.unwrap_err().code, lsp_server::ErrorCode::MethodNotFound as i32);
}

#[test]
fn start_reports_bad_configuration() {
    assert!(Server::start("not json", &json!({})).is_err());
    assert!(Server::start(r#"{"names":{"prefix":"9"}}"#, &json!({ "rootUri": "file:///nowhere-kirana" })).is_err());
    // Without a root in the configuration, the client's root is used, else the working directory.
    let root = std::env::temp_dir().join(format!("kirana-lsp-root-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let server = Server::start("{}", &json!({ "rootUri": path_to_uri(&root).as_str() }));
    assert!(server.is_ok());
    assert!(Server::start(r#"{"root":""}"#, &json!({ "rootUri": 1 })).is_ok());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn serves_a_session_over_a_connection() {
    let root = std::env::temp_dir().join(format!("kirana-lsp-serve-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join("a.tsx"),
        "import { css } from \"@kirana-style/core\"\nexport const a = css({ width: 5 })\n",
    )
    .unwrap();
    let (server, client) = Connection::memory();
    let config = json!({ "root": root }).to_string();
    let thread = std::thread::spawn(move || kirana_lsp::serve(&server, &config));
    let send = |message: Message| client.sender.send(message).unwrap();
    send(Message::Request(Request::new(RequestId::from(1), "initialize".to_owned(), json!({ "capabilities": {} }))));
    let Message::Response(initialized) = client.receiver.recv().unwrap() else { panic!() };
    assert_eq!(initialized.response_result.unwrap()["capabilities"]["hoverProvider"], true);
    send(Message::Notification(Notification::new("initialized".to_owned(), json!({}))));
    let uri = path_to_uri(&root.join("a.tsx")).as_str().to_owned();
    send(Message::Notification(Notification::new(
        "textDocument/didOpen".to_owned(),
        json!({ "textDocument": { "uri": uri, "languageId": "tsx", "version": 1, "text": "import { css } from \"@kirana-style/core\"\nexport const a = css({ width: 5 })\n" } }),
    )));
    let Message::Notification(published) = client.receiver.recv().unwrap() else { panic!() };
    assert_eq!(published.method, "textDocument/publishDiagnostics");
    send(Message::Request(Request::new(
        RequestId::from(2),
        "textDocument/hover".to_owned(),
        json!({ "textDocument": { "uri": uri }, "position": { "line": 1, "character": 24 } }),
    )));
    let Message::Response(hover) = client.receiver.recv().unwrap() else { panic!() };
    assert!(hover.response_result.is_ok());
    send(Message::Response(Response::new_ok(RequestId::from(9), json!(null))));
    send(Message::Request(Request::new(RequestId::from(3), "shutdown".to_owned(), json!(null))));
    let Message::Response(_) = client.receiver.recv().unwrap() else { panic!() };
    send(Message::Notification(Notification::new("exit".to_owned(), json!(null))));
    assert!(thread.join().unwrap().is_ok());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn serve_fails_without_initialize_and_on_a_closed_connection() {
    let (server, client) = Connection::memory();
    let thread = std::thread::spawn(move || kirana_lsp::serve(&server, "{}"));
    client.sender.send(Message::Notification(Notification::new("exit".to_owned(), json!(null)))).unwrap();
    assert!(thread.join().unwrap().is_err());
    // A session whose client goes away without `shutdown` ends.
    let root = std::env::temp_dir().join(format!("kirana-lsp-gone-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let (server, client) = Connection::memory();
    let config = json!({ "root": root }).to_string();
    let thread = std::thread::spawn(move || kirana_lsp::serve(&server, &config));
    client
        .sender
        .send(Message::Request(Request::new(
            RequestId::from(1),
            "initialize".to_owned(),
            json!({ "capabilities": {} }),
        )))
        .unwrap();
    let _ = client.receiver.recv().unwrap();
    client.sender.send(Message::Notification(Notification::new("initialized".to_owned(), json!({})))).unwrap();
    drop(client);
    assert!(thread.join().unwrap().is_ok());
    // Bad configuration fails after initialize.
    let (server, client) = Connection::memory();
    let thread = std::thread::spawn(move || kirana_lsp::serve(&server, "not json"));
    client
        .sender
        .send(Message::Request(Request::new(
            RequestId::from(1),
            "initialize".to_owned(),
            json!({ "capabilities": {} }),
        )))
        .unwrap();
    client.sender.send(Message::Notification(Notification::new("initialized".to_owned(), json!({})))).unwrap();
    assert!(thread.join().unwrap().is_err());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn edge_paths_of_hover_colours_and_navigation() {
    let mut f = fixture(json!({}));
    // A member chain that is no token falls through to the site; a key nothing sets shows the site.
    assert!(hover_text(&f.ok("textDocument/hover", f.at("select.child", 0, 8))).contains("`css()`"));
    let unset = hover_text(&f.ok("textDocument/hover", f.at("zIndex: undefined", 0, 2)));
    assert!(unset.contains("display: grid"), "{unset}");
    // Whitespace inside a site is the site; between statements, nothing.
    assert!(hover_text(&f.ok("textDocument/hover", f.at("css({\n  display", 0, 5))).contains("`css()`"));
    assert_eq!(f.ok("textDocument/definition", f.at("return (", 0, 7)), Value::Null);
    assert_eq!(f.ok("textDocument/references", f.at("return (", 0, 7)), Value::Null);
    // A local that is not a relation, and a symbol query that matches nothing.
    assert_eq!(f.ok("textDocument/definition", f.at("sx={[box", 0, 6)), Value::Null);
    assert_eq!(f.ok("workspace/symbol", json!({ "query": "zzz" })), json!([]));
    // `currentcolor` and a mode token that is not a colour have no swatch.
    let uri = f.uri();
    let colours = f.ok("textDocument/documentColor", json!({ "textDocument": { "uri": uri } }));
    let count = colours.as_array().unwrap().len();
    assert!(count >= 3, "{colours}");
    assert!(
        f.request("textDocument/colorPresentation", json!({ "textDocument": { "uri": "untitled:c" } }))
            .response_result
            .is_err()
    );
    // A file changed on disk without a notification keeps its old spans: nothing out of range.
    std::fs::write(f.card(), "x").unwrap();
    assert_eq!(f.ok("textDocument/documentColor", json!({ "textDocument": { "uri": uri } })), json!([]));
    assert_eq!(f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": uri } })), json!([]));
    assert_eq!(f.ok("textDocument/codeLens", json!({ "textDocument": { "uri": uri } })), json!([]));
}

#[test]
fn lenses_count_bridged_values_and_singulars() {
    let mut f = fixture(json!({}));
    let uri = f.uri();
    let lenses = f.ok("textDocument/codeLens", json!({ "textDocument": { "uri": uri } }));
    let titles: Vec<&str> = lenses.as_array().unwrap().iter().filter_map(|l| l["command"]["title"].as_str()).collect();
    assert!(titles.contains(&"css() · 1 declaration · 1 bridged"), "{titles:?}");
}

#[test]
fn utility_scales_flatten_nested_and_plain_values() {
    let mut f = fixture(json!({}));
    let text = CARD.replace("sx=\"flex p-4", "sx=\"flex size-");
    f.open(&text);
    let uri = f.uri();
    let position = LineIndex::new(&text).position(text.find("size-").unwrap() + 5);
    let result = f.ok("textDocument/completion", json!({ "textDocument": { "uri": uri }, "position": position }));
    let labels: Vec<&str> = result["items"].as_array().unwrap().iter().filter_map(|i| i["label"].as_str()).collect();
    assert!(labels.contains(&"size-a") && labels.contains(&"size-b") && !labels.contains(&"size-c"), "{labels:?}");
    let bg = text.replace("sx=\"flex size-", "sx=\"flex bg-");
    f.open(&bg);
    let position = LineIndex::new(&bg).position(bg.find("bg-").unwrap() + 3);
    let result = f.ok("textDocument/completion", json!({ "textDocument": { "uri": uri }, "position": position }));
    let labels: Vec<&str> = result["items"].as_array().unwrap().iter().filter_map(|i| i["label"].as_str()).collect();
    assert!(labels.contains(&"bg-red-500"), "{labels:?}");
    // A string in an `sx` array after a call.
    let array = CARD.replace("sx={[box, css({ width: w })]}", "sx={[box, css({ width: w }), \"p-\"]}");
    f.open(&array);
    let position = LineIndex::new(&array).position(array.find("\"p-\"").unwrap() + 3);
    let result = f.ok("textDocument/completion", json!({ "textDocument": { "uri": uri }, "position": position }));
    assert!(result["items"].as_array().unwrap().iter().any(|i| i["label"] == "p-4"));
}

#[test]
fn documents_closed_without_a_file_and_project_diagnostics() {
    let mut f = fixture(json!({}));
    // A read of a relation nobody anchors is a project-wide error naming this file.
    let unanchored = CARD.replace("<article sx={card.anchor}>", "<article>");
    let published = f.open(&unanchored);
    let codes: Vec<&str> =
        published[0].params["diagnostics"].as_array().unwrap().iter().filter_map(|d| d["code"].as_str()).collect();
    assert!(codes.contains(&"relation-without-anchor"), "{codes:?}");
    // Closing a document that was never opened, and one whose file is gone.
    let never = path_to_uri(&f.root.join("never.tsx")).as_str().to_owned();
    assert!(
        f.notify("textDocument/didClose", json!({ "textDocument": { "uri": never } }))
            .iter()
            .all(|n| n.params["uri"] != never)
    );
    let ghost = f.root.join("ghost.tsx");
    let ghost_uri = path_to_uri(&ghost).as_str().to_owned();
    f.notify(
        "textDocument/didOpen",
        json!({ "textDocument": { "uri": ghost_uri, "languageId": "tsx", "version": 1, "text": "export {}" } }),
    );
    let closed = f.notify("textDocument/didClose", json!({ "textDocument": { "uri": ghost_uri } }));
    assert_eq!(closed.last().unwrap().params["diagnostics"], json!([]));
}

#[test]
fn watched_changes_reach_modules_that_are_not_open() {
    let mut f = fixture(json!({}));
    // The card is indexed but not open: a change on disk recompiles it.
    std::fs::write(f.card(), CARD.replace("width: 5", "width: 6")).unwrap();
    let uri = f.uri();
    f.notify("workspace/didChangeWatchedFiles", json!({ "changes": [{ "uri": uri, "type": 2 }] }));
    let lenses = f.ok("textDocument/codeLens", json!({ "textDocument": { "uri": uri } }));
    assert!(lenses.as_array().is_some());
    // Its importer gone, a token change has nothing to recompile.
    std::fs::remove_file(f.card()).unwrap();
    let tokens = path_to_uri(&f.root.join("tokens.ts")).as_str().to_owned();
    f.notify("workspace/didChangeWatchedFiles", json!({ "changes": [{ "uri": tokens, "type": 2 }] }));
}

#[test]
fn conversion_adds_missing_imports_and_skips_anchors() {
    let mut f = fixture(json!({}));
    let uri = f.uri();
    let without = CARD.replace("import { color, space } from \"./tokens\"\n", "");
    f.open(&without);
    let at =
        LineIndex::new(&without).range(without.find("flex p-4\" />").unwrap(), without.find("flex p-4\" />").unwrap());
    let actions = f.ok(
        "textDocument/codeAction",
        json!({ "textDocument": { "uri": uri }, "range": at, "context": { "diagnostics": [] } }),
    );
    let rewrite = actions.as_array().unwrap().iter().find(|a| a["kind"] == "refactor.rewrite").unwrap();
    let edits = rewrite["edit"]["changes"][&uri].as_array().unwrap();
    assert_eq!(edits.len(), 2);
    assert_eq!(edits[1]["newText"], "import { space } from \"./tokens\"\n");
    // With every import present, only the attribute changes.
    f.open(CARD);
    let at = f.range("flex p-4\" />");
    let actions = f.ok(
        "textDocument/codeAction",
        json!({ "textDocument": { "uri": uri }, "range": at, "context": { "diagnostics": [] } }),
    );
    let rewrite = actions.as_array().unwrap().iter().find(|a| a["kind"] == "refactor.rewrite").unwrap();
    assert_eq!(rewrite["edit"]["changes"][&uri].as_array().unwrap().len(), 1);
    // `group` alone is a relation anchor: no `css()` to write.
    let group = CARD.replace("className=\"flex p-4\"", "className=\"group\"");
    f.open(&group);
    let at = LineIndex::new(&group).range(group.find("group\"").unwrap(), group.find("group\"").unwrap());
    let actions = f.ok(
        "textDocument/codeAction",
        json!({ "textDocument": { "uri": uri }, "range": at, "context": { "diagnostics": [] } }),
    );
    assert!(actions.as_array().unwrap().iter().all(|a| a["kind"] != "refactor.rewrite"));
    // An empty class string has nothing to convert.
    let empty = CARD.replace("className=\"flex p-4\"", "className=\" \"");
    f.open(&empty);
    let inside = empty.find("className=\" \"").unwrap() + "className=\" ".len();
    let at = LineIndex::new(&empty).range(inside, inside);
    let actions = f.ok(
        "textDocument/codeAction",
        json!({ "textDocument": { "uri": uri }, "range": at, "context": { "diagnostics": [] } }),
    );
    assert!(actions.as_array().unwrap().iter().all(|a| a["kind"] != "refactor.rewrite"));
    // A camel-case misspelling gets a camel-case fix.
    let fix = f.ok(
        "textDocument/codeAction",
        json!({ "textDocument": { "uri": uri }, "range": f.range("import"), "context": { "diagnostics": [
            { "range": f.range("backgroundColr: \"red\""), "message": "m", "data": { "code": "KRN1201" } },
            { "message": "no range", "data": { "code": "KRN1201" } },
        ] } }),
    );
    assert_eq!(fix[0]["title"], "Change to backgroundColor");
    // A site action without a property under the cursor offers the CSS only.
    let site = f.ok("textDocument/codeAction", json!({ "textDocument": { "uri": uri }, "range": f.range("css({\n  display"), "context": { "diagnostics": [] } }));
    let titles: Vec<&str> = site.as_array().unwrap().iter().filter_map(|a| a["title"].as_str()).collect();
    assert_eq!(titles, ["Kirana: show compiled CSS"]);
}

#[test]
fn serve_ends_when_the_client_stops_listening() {
    let root = std::env::temp_dir().join(format!("kirana-lsp-deaf-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let config = json!({ "root": root }).to_string();
    let start = |config: String| {
        let (server, client) = Connection::memory();
        let thread = std::thread::spawn(move || kirana_lsp::serve(&server, &config));
        client
            .sender
            .send(Message::Request(Request::new(
                RequestId::from(1),
                "initialize".to_owned(),
                json!({ "capabilities": {} }),
            )))
            .unwrap();
        let _ = client.receiver.recv().unwrap();
        client.sender.send(Message::Notification(Notification::new("initialized".to_owned(), json!({})))).unwrap();
        (thread, client)
    };
    // A response it cannot send.
    let (thread, Connection { sender, receiver }) = start(config.clone());
    drop(receiver);
    sender
        .send(Message::Request(Request::new(RequestId::from(2), "workspace/symbol".to_owned(), json!({ "query": "" }))))
        .unwrap();
    assert!(thread.join().unwrap().is_err());
    // A notification it cannot send.
    let (thread, Connection { sender, receiver }) = start(config.clone());
    drop(receiver);
    let uri = path_to_uri(&root.join("a.tsx")).as_str().to_owned();
    sender
        .send(Message::Notification(Notification::new(
            "textDocument/didOpen".to_owned(),
            json!({ "textDocument": { "uri": uri, "languageId": "tsx", "version": 1, "text": "" } }),
        )))
        .unwrap();
    assert!(thread.join().unwrap().is_err());
    // Something other than `exit` after `shutdown`.
    let (thread, client) = start(config);
    client.sender.send(Message::Request(Request::new(RequestId::from(3), "shutdown".to_owned(), json!(null)))).unwrap();
    let _ = client.receiver.recv().unwrap();
    client.sender.send(Message::Notification(Notification::new("initialized".to_owned(), json!({})))).unwrap();
    assert!(thread.join().unwrap().is_err());
    std::fs::remove_dir_all(root).unwrap();
}
