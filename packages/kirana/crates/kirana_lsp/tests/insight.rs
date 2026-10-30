//! The visual and structural features (KRN-DX-013 … KRN-DX-015): the overview hover and its
//! drawings, clickable summaries, the outline, folding, highlights, "used by", refactorings and the
//! inspector's requests.

use std::path::PathBuf;

use kirana_lsp::Server;
use kirana_lsp::text::{LineIndex, path_to_uri};
use lsp_server::{Notification, Request, RequestId};
use serde_json::{Value, json};

const TOKENS: &str = r##"import { defineTokens } from "@kirana-style/core"
export const color = defineTokens("color", {
  ink: { light: "black", dark: "white" },
  wash: { value: "rgb(0 0 0 / 0.5)", variable: true },
})
export const space = defineTokens("space", { 4: "1rem" })
"##;

const CARD: &str = r##"import { css, props, recipe, relation } from "@kirana-style/core"
import { color, space } from "./tokens"

const card = relation("card")
const base = css({
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: space[4],
  padding: "1rem",
  margin: "0.5rem 1rem",
  borderWidth: "1px",
  borderRadius: "0.5rem",
  backgroundColor: color.wash,
  color: color.ink,
  fontSize: "0.875rem",
  fontWeight: 600,
  lineHeight: 1.5,
})
const wide = css({ padding: "2rem" })
const row = css({ display: "flex", flexDirection: "column", gap: "4px", justifyContent: "center", alignItems: "start" })
const solo = css({ opacity: 0.5, "::after": { content: "'a — b'" } })
const tint = css({ backgroundColor: color.wash, color: color.ink })
export const button = recipe({ base: { color: "blue" }, variants: { size: { sm: { paddingTop: "1px" } } } })
export function Card({ on }: { on: boolean }) {
  return (
    <article sx={[base, on && wide]}>
      <h2 sx={css({ width: "10rem", height: "2rem", margin: "0" })} />
      <div sx={row} />
      <p {...props(base)} />
      <span sx={on ? wide : row} />
      <i sx={solo} />
      <u sx={tint} />
      <b sx={card.anchor} />
    </article>
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

fn fixture(options: Value) -> Fixture {
    let root = std::env::temp_dir().join(format!(
        "kirana-insight-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("package.json"), r#"{"name":"app"}"#).unwrap();
    std::fs::write(root.join("tokens.ts"), TOKENS).unwrap();
    std::fs::write(root.join("card.tsx"), CARD).unwrap();
    let server =
        Server::start(&json!({ "root": root }).to_string(), &json!({ "initializationOptions": options })).unwrap();
    Fixture { root, server }
}

impl Fixture {
    fn uri(&self) -> String {
        path_to_uri(&self.root.join("card.tsx")).as_str().to_owned()
    }

    fn document(&self) -> Value {
        json!({ "textDocument": { "uri": self.uri() } })
    }

    fn at(&self, needle: &str, delta: usize) -> Value {
        let offset = CARD.find(needle).unwrap_or_else(|| panic!("{needle}")) + delta;
        json!({ "textDocument": { "uri": self.uri() }, "position": LineIndex::new(CARD).position(offset) })
    }

    fn ok(&mut self, method: &str, params: Value) -> Value {
        let response = self.server.request(&Request::new(RequestId::from(1), method.to_owned(), params));
        response.response_result.unwrap_or_else(|error| panic!("{method}: {error:?}"))
    }

    fn hover(&mut self, needle: &str, delta: usize) -> String {
        let params = self.at(needle, delta);
        self.ok("textDocument/hover", params)["contents"]["value"].as_str().unwrap_or_default().to_owned()
    }

    fn command(&mut self, command: &str, arguments: Value) -> Value {
        self.ok("workspace/executeCommand", json!({ "command": command, "arguments": arguments }))
    }
}

fn label(hint: &Value) -> String {
    hint["label"].as_str().unwrap().to_owned()
}

/// The SVG inside a hover's `data:` image.
fn svg_of(hover: &str) -> String {
    // The box model (`![style]`), not the brand's icon that leads the card.
    let start = hover.find("![style](data:image/svg+xml;base64,").expect("an image")
        + "![style](data:image/svg+xml;base64,".len();
    let encoded = &hover[start..start + hover[start..].find(')').unwrap()];
    let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut bits = 0u32;
    let mut count = 0;
    let mut out = Vec::new();
    for character in encoded.chars().filter(|c| *c != '=') {
        bits = bits << 6 | alphabet.find(character).unwrap() as u32;
        count += 6;
        if count >= 8 {
            count -= 8;
            out.push((bits >> count) as u8);
            bits &= (1 << count) - 1;
        }
    }
    String::from_utf8(out).unwrap()
}

#[test]
fn the_card_names_draws_and_tabulates_a_style() {
    let mut f = fixture(json!({}));
    let hover = f.hover("sx={[base", 1);
    // A header naming the expression and linking each handle it merges, with its guard.
    assert!(hover.starts_with("**Kirana** · `[base, on && wide]`\n\nMerges 2 handles: [`base`]("), "{hover}");
    assert!(hover.contains("card.tsx#L6) + [`wide`]("), "{hover}");
    assert!(hover.contains(") if `on` · 16 declarations"), "{hover}");
    // A text drawing for clients without images.
    assert!(hover.contains("```text\n") && hover.contains("padding 1rem"), "{hover}");
    // Resolved values in source order within each group, with pixels and both colour modes.
    let resolved = &hover[hover.find("**Resolved**").unwrap()..hover.find("**When**").unwrap()];
    assert!(resolved.find("| display |").unwrap() < resolved.find("| grid-template-columns |").unwrap(), "{resolved}");
    assert!(resolved.contains("| padding | `1rem` · 16px |"), "{resolved}");
    assert!(resolved.contains("| color | `black` / `white` |"), "{resolved}");
    // A token by its name and value, not the custom property it compiles to.
    assert!(resolved.contains("| background-color | `color.wash` · `rgb(0 0 0 / 0.5)` |"), "{resolved}");
    assert!(resolved.contains("more* |"), "{resolved}");
    // Values under a guard sit with the conditional ones.
    assert!(hover.contains("| `if on` | padding | `2rem` · 32px |"), "{hover}");
    assert!(hover.contains("**Compiled CSS** · 16 rules · "), "{hover}");
    assert!(!hover.contains("command:"), "{hover}");
    // A ternary: each branch is its own guard.
    let ternary = f.hover("sx={on ? wide", 1);
    assert!(ternary.contains("`if !on`") && ternary.contains("`if on`"), "{ternary}");
    // A single handle reads "From"; an inline style names no handle.
    let row = f.hover("sx={row}", 1);
    assert!(row.contains("From [`row`]("), "{row}");
    let inline = f.hover("sx={css({ width", 1);
    assert!(inline.contains("10rem × 2rem") && !inline.contains("From"), "{inline}");
    assert!(!f.hover("sx={solo}", 1).contains("```text"));
    // A definition's card has no merge line.
    let definition = f.hover("css({\n  display", 1);
    assert!(definition.starts_with("**Kirana** · `css()` · 15 declarations\n"), "{definition}");
}

#[test]
fn clients_that_render_images_get_svg_in_their_theme() {
    let mut f = fixture(json!({ "images": true, "commandLinks": true, "theme": "dark", "rootFontSize": 10 }));
    let hover = f.hover("sx={[base", 1);
    // The brand's icon leads the card; the box model follows.
    assert!(hover.starts_with("![Kirana](data:image/svg+xml;base64,"), "{hover}");
    assert!(hover.contains("![style](data:image/svg+xml;base64,"), "{hover}");
    assert!(hover.contains("command:kirana.inspect?") && hover.contains("command:kirana.showCompiledCss?"), "{hover}");
    assert!(hover.contains("[open the inspector](command:kirana.inspect?"), "{hover}");
    assert!(hover.contains("· 10px"), "{hover}");
    let svg = svg_of(&hover);
    assert!(svg.starts_with("<svg") && svg.ends_with("</svg>"), "{svg}");
    assert!(svg.contains("#e6edf3"), "dark ink: {svg}");
    // Every layer, each side's value, the content's size and layout.
    for text in ["MARGIN", "BORDER", "PADDING", ">.5rem<", ">1rem<", ">1px<", ">auto<", ">(grid)<"] {
        assert!(svg.contains(text), "{text} in {svg}");
    }
    // Colours get a swatch in the table: a pair split light and dark.
    let swatches = hover.matches("data:image/svg+xml").count();
    assert!(swatches >= 3, "{hover}");
    // The theme follows the client.
    f.server.notification(Notification::new(kirana_lsp::THEME.to_owned(), json!({ "theme": "light" })));
    let svg = svg_of(&f.hover("sx={[base", 1));
    assert!(svg.contains("#1f2328") && !svg.contains("#e6edf3"), "{svg}");
    // A capped width, a set size and no box at all.
    assert!(svg_of(&f.hover("sx={css({ width", 1)).contains("10rem × 2rem"));
    assert!(svg_of(&f.hover("sx={row}", 1)).contains(">(flex)<"));
    assert!(!f.hover("sx={solo}", 1).contains("![style]("), "no box model to draw");
}

#[test]
fn hints_sit_at_the_end_of_the_line_as_long_as_asked() {
    // No limit: every declaration.
    let mut f = fixture(json!({ "summaryLength": 0 }));
    let hints = f.ok("textDocument/inlayHint", f.document());
    let article = hints.as_array().unwrap().iter().find(|hint| label(hint).starts_with("▦ grid")).unwrap();
    assert!(!label(article).contains('+'), "{}", label(article));
    // A short limit still shows the first declaration, cut.
    let mut f = fixture(json!({ "summaryLength": 10 }));
    let hints = f.ok("textDocument/inlayHint", f.document());
    assert!(hints.as_array().unwrap().iter().any(|hint| label(hint) == "▦ grid · +15"), "{hints}");
    // At the end of the line, past the text that follows the tag.
    let line = CARD.lines().position(|line| line.contains("sx={[base")).unwrap();
    let hint = hints.as_array().unwrap().iter().find(|hint| hint["position"]["line"] == line).unwrap();
    assert_eq!(hint["position"]["character"], CARD.lines().nth(line).unwrap().trim_end().len());
}

#[test]
fn clients_with_html_get_the_card_side_by_side_in_colour() {
    let mut f = fixture(json!({ "images": true, "html": true, "theme": "dark" }));
    let hover = f.hover("sx={[base", 1);
    assert!(hover.contains("| Box model | Resolved |\n|:--|:--|\n| ![style](data:image/svg+xml;base64,"), "{hover}");
    assert!(hover.contains("<span style=\"color:var(--vscode-charts-blue);\">display</span> `grid`<br>"), "{hover}");
    assert!(hover.contains("<span style=\"color:var(--vscode-charts-green);\">padding</span>"), "{hover}");
    assert!(hover.contains("<br>*"), "the rest is counted: {hover}");
    // The conditional table is painted too; a style with nothing to draw lists its rows as a table.
    assert!(hover.contains("| `if on` | <span style=\"color:var(--vscode-charts-green);\">padding</span>"), "{hover}");
    let solo = f.hover("sx={solo}", 1);
    assert!(
        solo.contains("| <span style=\"color:var(--vscode-descriptionForeground);\">opacity</span> | `0.5` |"),
        "{solo}"
    );
    let svg = svg_of(&hover);
    assert!(svg.contains("width=\"236\" height=\"128\""), "{svg}");
}

#[test]
fn hints_summarize_and_resolve_to_the_card() {
    let mut f = fixture(json!({}));
    let hints = f.ok("textDocument/inlayHint", f.document());
    let hints = hints.as_array().unwrap();
    let labels: Vec<String> = hints.iter().map(label).collect();
    let article = hints.iter().find(|hint| label(hint).starts_with("▦ grid")).unwrap();
    assert!(label(article).contains(" · m .5rem 1rem · border 1px · rounded 0.5rem · +6"), "{labels:?}");
    assert!(labels.iter().any(|label| label.starts_with("on: p 2rem · !on: flex")), "{labels:?}");
    assert!(labels.iter().any(|label| label == "⇶ flex · flex column · gap 4px · justify center · items start"));
    assert!(labels.contains(&"bg color.wash · text black/white".to_owned()), "{labels:?}");
    // Hovering a hint resolves its card.
    let resolved = f.ok("inlayHint/resolve", article.clone());
    let tooltip = resolved["tooltip"]["value"].as_str().unwrap();
    assert!(tooltip.starts_with("**Kirana** · `[base, on && wide]`") && tooltip.contains("**Resolved**"), "{tooltip}");
    // `{...props(base)}` is summarized from the handle it names, and resolves too.
    let spread = CARD.find("{...props(base)} />").unwrap() + "{...props(base)} />".len();
    let hint = hints.iter().find(|hint| hint["position"] == json!(LineIndex::new(CARD).position(spread))).unwrap();
    let tooltip = f.ok("inlayHint/resolve", hint.clone());
    assert!(tooltip["tooltip"]["value"].as_str().unwrap().contains("| display | `grid` |"), "{tooltip}");
    // A hint whose element is gone keeps no tooltip; one without data is refused.
    let mut stale = article.clone();
    stale["data"]["start"] = json!(0);
    stale["data"]["end"] = json!(1);
    assert!(f.ok("inlayHint/resolve", stale).get("tooltip").is_none());
    let request = Request::new(RequestId::from(2), "inlayHint/resolve".to_owned(), json!({ "label": "x" }));
    assert!(f.server.request(&request).response_result.is_err());
}

#[test]
fn outline_folding_and_style_ranges() {
    let mut f = fixture(json!({}));
    let symbols = f.ok("textDocument/documentSymbol", f.document());
    let names: Vec<&str> = symbols.as_array().unwrap().iter().filter_map(|symbol| symbol["name"].as_str()).collect();
    for expected in ["card", "base", "wide", "row", "solo", "tint", "button"] {
        assert!(names.contains(&expected), "{expected} in {names:?}");
    }
    let button = symbols.as_array().unwrap().iter().find(|symbol| symbol["name"] == "button").unwrap();
    assert_eq!(button["kind"], 5);
    let tokens = path_to_uri(&f.root.join("tokens.ts")).as_str().to_owned();
    let declared = f.ok("textDocument/documentSymbol", json!({ "textDocument": { "uri": tokens } }));
    assert!(declared.to_string().contains("color.ink"), "{declared}");
    let folds = f.ok("textDocument/foldingRange", f.document());
    assert_eq!(folds.as_array().unwrap().len(), 1, "{folds}");
    assert!(folds[0]["collapsedText"].as_str().unwrap().starts_with("grid"), "{folds}");
    let ranges = f.ok("kirana/styleRanges", f.document());
    assert_eq!(ranges[0]["name"], "base");
    assert_eq!(ranges[0]["multiline"], true);
    assert_eq!(ranges[1]["multiline"], false);
    assert!(ranges[0]["summary"].as_str().unwrap().contains("p 1rem"));
}

#[test]
fn highlights_join_keys_and_elements() {
    let mut f = fixture(json!({}));
    // On a key: the key, and the elements receiving it.
    let from_key = f.ok("textDocument/documentHighlight", f.at("padding: \"1rem\"", 2));
    let kinds: Vec<u64> = from_key.as_array().unwrap().iter().map(|h| h["kind"].as_u64().unwrap()).collect();
    // The article, and the `props(base)` spread: the compiler records that call as a site too.
    assert_eq!(kinds, [3, 2, 2], "{from_key}");
    // On an element: the keys of what it receives.
    let from_element = f.ok("textDocument/documentHighlight", f.at("sx={row}", 1));
    assert!(from_element.as_array().unwrap().len() >= 4, "{from_element}");
    // Elsewhere: nothing.
    assert_eq!(f.ok("textDocument/documentHighlight", f.at("import", 1)), Value::Null);
    assert_eq!(f.ok("textDocument/documentHighlight", f.at("const base = css({", 20)), Value::Null);
}

#[test]
fn lenses_count_uses_and_the_command_lists_them() {
    let mut f = fixture(json!({}));
    let lenses = f.ok("textDocument/codeLens", f.document());
    let titles: Vec<&str> =
        lenses.as_array().unwrap().iter().filter_map(|lens| lens["command"]["title"].as_str()).collect();
    assert!(titles.contains(&"used by 2 elements"), "{titles:?}");
    let offset = CARD.find("css({ padding: \"2rem\"").unwrap();
    let uses = f.command("kirana.showUses", json!([f.uri(), offset]));
    assert_eq!(uses.as_array().unwrap().len(), 2, "{uses}");
    assert_eq!(f.command("kirana.showUses", json!([f.uri(), 0])), json!([]));
}

#[test]
fn inspect_simulates_conditions_and_switches() {
    let mut f = fixture(json!({}));
    let mut params = f.at("sx={[base", 1);
    let off = f.ok("kirana/inspect", params.clone());
    assert_eq!(off["kind"], "sx");
    assert_eq!(off["switches"], json!(["on"]));
    let value = |inspected: &Value, property: &str| -> Vec<String> {
        inspected["effective"]
            .as_array()
            .unwrap()
            .iter()
            .map(|index| &inspected["entries"][index.as_u64().unwrap() as usize])
            .filter(|entry| entry["property"] == property)
            .map(|entry| entry["value"].as_str().unwrap().to_owned())
            .collect()
    };
    assert_eq!(value(&off, "padding"), ["1rem"]);
    params["active"] = json!(["on"]);
    let on = f.ok("kirana/inspect", params);
    assert_eq!(value(&on, "padding"), ["2rem"]);
    assert_eq!(f.ok("kirana/inspect", f.at("import", 1)), Value::Null);
    // A style holding a multi-byte character (`—`) gets its colours without a panic.
    assert!(f.ok("textDocument/documentColor", f.document()).as_array().is_some());
    let stats = f.ok("kirana/stats", json!({}));
    assert!(stats["bytes"].as_u64().unwrap() > 100 && stats["rules"].as_u64().unwrap() > 10, "{stats}");
}

#[test]
fn refactorings_extract_inline_and_vary() {
    let mut f = fixture(json!({}));
    let actions = |f: &mut Fixture, needle: &str, delta: usize| -> Value {
        let at = f.at(needle, delta);
        let params = json!({
            "textDocument": at["textDocument"],
            "range": { "start": at["position"], "end": at["position"] },
            "context": { "diagnostics": [] },
        });
        f.ok("textDocument/codeAction", params)
    };
    let titles = |actions: &Value| -> Vec<String> {
        actions.as_array().unwrap().iter().filter_map(|action| action["title"].as_str()).map(str::to_owned).collect()
    };
    let extracted = actions(&mut f, "css({ width", 2);
    let extract =
        extracted.as_array().unwrap().iter().find(|a| a["title"] == "Kirana: extract to css() as h2Style").unwrap();
    let edits = extract["edit"]["changes"][f.uri()].as_array().unwrap();
    assert!(edits[0]["newText"].as_str().unwrap().starts_with("const h2Style = css({ width"), "{edits:?}");
    assert_eq!(edits[0]["range"]["start"]["line"], CARD[..CARD.find("export function Card").unwrap()].lines().count());
    assert_eq!(edits[1]["newText"], "h2Style");
    // A handle used once inlines; one used twice does not.
    assert!(titles(&actions(&mut f, "sx={solo}", 5)).contains(&"Kirana: inline solo".to_owned()));
    let inline = actions(&mut f, "sx={solo}", 5);
    let inline = inline.as_array().unwrap().iter().find(|a| a["title"] == "Kirana: inline solo").unwrap();
    assert_eq!(
        inline["edit"]["changes"][f.uri()][0]["newText"],
        "css({ opacity: 0.5, \"::after\": { content: \"'a — b'\" } })"
    );
    assert!(!titles(&actions(&mut f, "sx={row}", 5)).iter().any(|title| title.starts_with("Kirana: inline")));
    // A plain value varies at a breakpoint or a state; a conditional one does not.
    let varied = actions(&mut f, "padding: \"1rem\"", 2);
    let vary = varied.as_array().unwrap().iter().find(|a| a["title"] == "Kirana: vary padding at md").unwrap();
    assert_eq!(
        vary["edit"]["changes"][f.uri()][0]["newText"],
        "{ base: \"1rem\", \"@media (width >= 48rem)\": \"1rem\" }"
    );
    assert!(titles(&varied).contains(&"Kirana: vary padding on :hover".to_owned()));
    assert!(titles(&actions(&mut f, "gap: space[4]", 2)).contains(&"Kirana: vary gap at md".to_owned()));
}

#[test]
fn a_colour_pair_has_a_swatch_per_mode_in_its_own_format() {
    let mut f = fixture(json!({}));
    let text = "import { css } from \"@kirana-style/core\"\nexport const a = css({ color: \"light-dark(oklch(0.45 0 0), #ffffff)\", fill: \"rgb(1 2 3)\" })\n";
    std::fs::write(f.root.join("pair.tsx"), text).unwrap();
    let uri = path_to_uri(&f.root.join("pair.tsx")).as_str().to_owned();
    let open = json!({ "textDocument": { "uri": uri, "languageId": "typescriptreact", "version": 1, "text": text } });
    f.server.notification(Notification::new("textDocument/didOpen".to_owned(), open));
    let colours = f.ok("textDocument/documentColor", json!({ "textDocument": { "uri": uri } }));
    let index = LineIndex::new(text);
    let ranges: Vec<Value> = colours.as_array().unwrap().iter().map(|colour| colour["range"].clone()).collect();
    // The light half, the dark half, and the plain colour: three swatches.
    let at = |needle: &str| json!(index.range(text.find(needle).unwrap(), text.find(needle).unwrap() + needle.len()));
    assert_eq!(ranges, [at("oklch(0.45 0 0)"), at("#ffffff"), at("rgb(1 2 3)")]);
    // The picker offers the written format first.
    let picked = |f: &mut Fixture, range: &Value| -> String {
        let params = json!({
            "textDocument": { "uri": uri },
            "range": range,
            "color": { "red": 1.0, "green": 0.0, "blue": 0.0, "alpha": 1.0 },
        });
        f.ok("textDocument/colorPresentation", params)[0]["label"].as_str().unwrap().to_owned()
    };
    assert!(picked(&mut f, &ranges[0]).starts_with("oklch("));
    assert_eq!(picked(&mut f, &ranges[1]), "#ff0000");
    assert_eq!(picked(&mut f, &ranges[2]), "rgb(255 0 0)");
}

#[test]
fn uses_count_the_elements_that_name_a_handle() {
    let mut f = fixture(json!({}));
    // Equal declarations share one class; each handle is used where it is named.
    let text = "import { css } from \"@kirana-style/core\"\nconst a = css({ fontWeight: 600 })\nconst b = css({ fontWeight: 600 })\nexport const C = () => <p><i sx={a} /><b sx={b} /><u sx={b} /></p>\n";
    std::fs::write(f.root.join("twins.tsx"), text).unwrap();
    let uri = path_to_uri(&f.root.join("twins.tsx")).as_str().to_owned();
    let open = json!({ "textDocument": { "uri": uri, "languageId": "typescriptreact", "version": 1, "text": text } });
    f.server.notification(Notification::new("textDocument/didOpen".to_owned(), open));
    let lenses = f.ok("textDocument/codeLens", json!({ "textDocument": { "uri": uri } }));
    let titles: Vec<&str> =
        lenses.as_array().unwrap().iter().filter_map(|lens| lens["command"]["title"].as_str()).collect();
    assert_eq!(
        titles.iter().filter(|title| title.starts_with("used by")).collect::<Vec<_>>(),
        [&"used by 1 element", &"used by 2 elements"]
    );
    // Hints carry their parts and groups for a client to colour.
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": uri } }));
    assert_eq!(
        hints[0]["data"]["parts"],
        json!([{ "text": "font 600", "group": "type", "colour": "var(--vscode-charts-yellow)" }])
    );
    assert_eq!(hints[0]["data"]["mark"], "");
}
