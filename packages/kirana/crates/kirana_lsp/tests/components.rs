//! Vue, Svelte and Astro components in the language server (`design-notes/editor-components.md`):
//! script blocks compile as the build's block modules, template bindings are sites, and every span
//! lands in the component.

use std::path::PathBuf;

use kirana_lsp::Server;
use kirana_lsp::text::{LineIndex, path_to_uri};
use lsp_server::{Notification, Request, RequestId};
use serde_json::{Value, json};

const TOKENS: &str = r##"import { defineTokens } from "@kirana-style/core"
export const color = defineTokens("color", { brand: "#0af" })
"##;

const VUE: &str = r##"<script setup lang="ts">
import { css } from "@kirana-style/core"
import { color } from "./tokens"
const card = css({ display: "grid", padding: "1rem", color: color.brand })
const wide = css({ padding: "2rem", width: 5 })
</script>

<template>
  <section :sx="[card, on && wide]">
    <p v-for="item in items" :sx="item.on &amp;&amp; card">{{ item }}</p>
  </section>
</template>
"##;

const SVELTE: &str = r##"<script module>
export const shared = 1
</script>
<script>
  import { css } from "@kirana-style/core"
  const card = css({ backgroundColor: "red", paddingTop: "4px" })
</script>

{#each items as item}
  <p sx={[card, item.on && card]}>{item}</p>
{/each}
"##;

const ASTRO: &str = r##"---
import { css } from "@kirana-style/core"
const card = css({ display: "flex", gap: "0.5rem" })
---
<ul sx={card}>{items.map((item) => <li sx={[card, item]}>{item}</li>)}</ul>
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

fn fixture(files: &[(&str, &str)]) -> Fixture {
    let root = std::env::temp_dir().join(format!(
        "kirana-components-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("package.json"), r#"{"name":"app"}"#).unwrap();
    std::fs::write(root.join("tokens.ts"), TOKENS).unwrap();
    for (name, text) in files {
        std::fs::write(root.join(name), text).unwrap();
    }
    let server = Server::start(&json!({ "root": root }).to_string(), &json!({})).unwrap();
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

    fn notify(&mut self, method: &str, params: Value) -> Vec<Notification> {
        self.server.notification(Notification::new(method.to_owned(), params))
    }

    fn open(&mut self, name: &str, text: &str) -> Vec<Notification> {
        let uri = self.uri(name);
        self.notify(
            "textDocument/didOpen",
            json!({ "textDocument": { "uri": uri, "languageId": "vue", "version": 1, "text": text } }),
        )
    }

    /// Request parameters at the `nth` occurrence of `needle` in `text`, `delta` bytes in.
    fn at(&self, name: &str, text: &str, needle: &str, nth: usize, delta: usize) -> Value {
        let offset = text.match_indices(needle).nth(nth).unwrap_or_else(|| panic!("{needle}")).0 + delta;
        json!({ "textDocument": { "uri": self.uri(name) }, "position": LineIndex::new(text).position(offset) })
    }

    fn hover(&mut self, name: &str, text: &str, needle: &str, nth: usize, delta: usize) -> String {
        let params = self.at(name, text, needle, nth, delta);
        let value = self.ok("textDocument/hover", params);
        value.pointer("/contents/value").and_then(Value::as_str).unwrap_or_default().to_owned()
    }
}

/// An inlay hint's label: its parts' text joined.
fn label_text(hint: &Value) -> String {
    hint["label"].as_array().map_or_else(
        || hint["label"].as_str().unwrap_or_default().to_owned(),
        |parts| parts.iter().filter_map(|part| part["value"].as_str()).collect(),
    )
}

fn diagnostics_for<'n>(notifications: &'n [Notification], uri: &str) -> &'n Value {
    notifications
        .iter()
        .find(|notification| notification.params["uri"] == uri)
        .map(|notification| &notification.params["diagnostics"])
        .expect("published")
}

#[test]
fn vue_script_diagnostics_land_in_the_component() {
    let mut f = fixture(&[]);
    let published = f.open("Card.vue", VUE);
    let diagnostics = diagnostics_for(&published, &f.uri("Card.vue")).as_array().unwrap().clone();
    // `width: 5` in the script, reported on its line in the component; nothing from the template.
    assert_eq!(diagnostics.len(), 1, "{diagnostics:?}");
    let line = VUE[..VUE.find("width: 5").unwrap()].lines().count() as u64 - 1;
    assert_eq!(diagnostics[0]["range"]["start"]["line"], line);
    // The quick fix applies to the component's text.
    let params = json!({
        "textDocument": { "uri": f.uri("Card.vue") },
        "range": diagnostics[0]["range"],
        "context": { "diagnostics": diagnostics },
    });
    let actions = f.ok("textDocument/codeAction", params);
    assert_eq!(actions[0]["title"], "Write \"5px\"", "{actions}");
}

#[test]
fn vue_template_bindings_hover_summarize_and_show_colours() {
    let mut f = fixture(&[]);
    f.open("Card.vue", VUE);
    let hover = f.hover("Card.vue", VUE, ":sx=\"[card", 0, 6);
    assert!(hover.contains("display: grid"), "{hover}");
    assert!(hover.contains("padding: 2rem"), "{hover}");
    // A binding inside `v-for` reads the loop's item; it still resolves its handles.
    let hover = f.hover("Card.vue", VUE, "item.on &amp;&amp; card", 0, 20);
    assert!(hover.contains("display: grid"), "{hover}");
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("Card.vue") } }));
    let labels: Vec<String> = hints.as_array().unwrap().iter().map(label_text).collect();
    assert!(labels.iter().any(|label| label.starts_with("▦ grid")), "{labels:?}");
    // At the end of the line: only the tag's `>` follows the binding.
    let end = VUE.find("on && wide]\">").unwrap() + "on && wide]\">".len();
    assert!(hints.as_array().unwrap().iter().any(|hint| hint["position"] == json!(LineIndex::new(VUE).position(end))));
    // The token's swatch is in the script, where it is written.
    let colours = f.ok("textDocument/documentColor", json!({ "textDocument": { "uri": f.uri("Card.vue") } }));
    let start = colours[0]["range"]["start"].clone();
    assert_eq!(start, json!(LineIndex::new(VUE).position(VUE.find("color.brand").unwrap())));
    // Hover on a property in the script explains its precedence through the block's module.
    let hover = f.hover("Card.vue", VUE, "padding: \"2rem\"", 0, 2);
    assert!(hover.contains("padding"), "{hover}");
    assert!(!hover.contains("kirana trace"), "{hover}");
    // The compiled CSS of the whole component, and the lens over each `css()`.
    let css = f.ok(
        "workspace/executeCommand",
        json!({ "command": "kirana.showCompiledCss", "arguments": [f.uri("Card.vue")] }),
    );
    assert!(css["content"].as_str().unwrap().contains("display:grid") || css["content"].to_string().contains("grid"));
    let lenses = f.ok("textDocument/codeLens", json!({ "textDocument": { "uri": f.uri("Card.vue") } }));
    // Two definitions, each with its counts and its uses in the template.
    assert_eq!(lenses.as_array().unwrap().len(), 4, "{lenses}");
    assert_eq!(lenses[1]["command"]["title"], "used by 2 elements");
}

#[test]
fn svelte_each_bindings_resolve_without_false_errors() {
    let mut f = fixture(&[]);
    let published = f.open("List.svelte", SVELTE);
    assert_eq!(diagnostics_for(&published, &f.uri("List.svelte")), &json!([]));
    let hover = f.hover("List.svelte", SVELTE, "sx={[card", 0, 6);
    assert!(hover.contains("background-color: red"), "{hover}");
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("List.svelte") } }));
    assert_eq!(hints.as_array().unwrap().len(), 1, "{hints}");
}

#[test]
fn astro_bindings_inside_expressions() {
    let mut f = fixture(&[("index.astro", ASTRO)]);
    // Indexed at start: hover works before the file is opened.
    let hover = f.hover("index.astro", ASTRO, "sx={[card, item]}", 0, 6);
    assert!(hover.contains("display: flex"), "{hover}");
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("index.astro") } }));
    assert_eq!(hints.as_array().unwrap().len(), 2, "{hints}");
    let explain = f.ok(
        "workspace/executeCommand",
        json!({ "command": "kirana.explainPrecedence", "arguments": [f.uri("index.astro"), 3, "gap"] }),
    );
    assert!(explain["content"].as_str().unwrap().contains("0.5rem"), "{explain}");
    // A line outside every block traces nothing.
    let explain = f.ok(
        "workspace/executeCommand",
        json!({ "command": "kirana.explainPrecedence", "arguments": [f.uri("index.astro"), 5, "gap"] }),
    );
    assert!(explain["content"].as_str().unwrap().contains("Nothing on this line"), "{explain}");
}

#[test]
fn a_block_that_is_not_tsx_still_compiles_without_its_template() {
    // `<T>x` is an assertion in TypeScript and an element in TSX: the template is dropped.
    let source = "<script setup lang=\"ts\">\nimport { css } from \"@kirana-style/core\"\nconst n = <number>1\nconst card = css({ width: 5 })\n</script>\n<template><p :sx=\"card\"></p></template>\n";
    let mut f = fixture(&[]);
    let published = f.open("Cast.vue", source);
    let diagnostics = diagnostics_for(&published, &f.uri("Cast.vue"));
    assert_eq!(diagnostics.as_array().unwrap().len(), 1, "{diagnostics}");
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("Cast.vue") } }));
    assert_eq!(hints, json!([]));
}

#[test]
fn edits_removed_blocks_token_changes_and_deletion() {
    let mut f = fixture(&[("Card.vue", VUE)]);
    let uri = f.uri("Card.vue");
    // Removing the script drops its module: the template has nothing left to resolve.
    let bare = "<template><p :sx=\"card\"></p></template>\n";
    f.notify(
        "textDocument/didChange",
        json!({ "textDocument": { "uri": uri, "version": 2 }, "contentChanges": [{ "text": bare }] }),
    );
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("Card.vue") } }));
    assert_eq!(hints, json!([]));
    f.notify("textDocument/didClose", json!({ "textDocument": { "uri": uri } }));
    // A token file changing re-compiles the component that reads it, from disk.
    std::fs::write(f.root.join("tokens.ts"), TOKENS.replace("#0af", "#f00")).unwrap();
    let tokens = f.uri("tokens.ts");
    f.notify("workspace/didChangeWatchedFiles", json!({ "changes": [{ "uri": tokens, "type": 2 }] }));
    let colours = f.ok("textDocument/documentColor", json!({ "textDocument": { "uri": f.uri("Card.vue") } }));
    assert_eq!(colours[0]["color"]["red"], 1.0, "{colours}");
    // Deleting the component removes its blocks from the session.
    std::fs::remove_file(f.root.join("Card.vue")).unwrap();
    f.notify("workspace/didChangeWatchedFiles", json!({ "changes": [{ "uri": uri, "type": 3 }] }));
    let symbols = f.ok("workspace/symbol", json!({ "query": "" }));
    assert!(symbols.to_string().contains("color.brand"));
}

#[test]
fn references_search_components() {
    let mut f = fixture(&[("Card.vue", VUE)]);
    let tokens = "import { defineTokens } from \"@kirana-style/core\"\nexport const color = defineTokens(\"color\", { brand: \"#0af\" })\n";
    let params = json!({
        "textDocument": { "uri": f.uri("tokens.ts") },
        "position": LineIndex::new(tokens).position(tokens.find("brand").unwrap()),
        "context": { "includeDeclaration": true },
    });
    // From the token's key: no chain there, so search from a use instead.
    let _ = f.ok("textDocument/references", params);
    let params = json!({
        "textDocument": { "uri": f.uri("Card.vue") },
        "position": LineIndex::new(VUE).position(VUE.find("color.brand").unwrap() + 7),
        "context": { "includeDeclaration": true },
    });
    let found = f.ok("textDocument/references", params);
    assert!(found.to_string().contains("Card.vue"), "{found}");
}

const ANGULAR_INLINE: &str = r##"import { Component } from "@angular/core"
import { SxDirective } from "@kirana-style/angular"
import { css } from "@kirana-style/core"

const styles = { card: css({ display: "grid", gap: "1rem" }), bad: css({ width: 5 }) }

@Component({
  selector: "app-card",
  imports: [SxDirective],
  template: `<section [sx]="[styles.card, on &amp;&amp; styles.bad]">{{ text }}</section>`,
})
export class Card {
  protected readonly styles = styles
  on = false
}
"##;

const ANGULAR_COMPONENT: &str = r##"import { Component } from "@angular/core"
import { css } from "@kirana-style/core"

const styles = { card: css({ display: "flex", padding: "1rem" }) }

@Component({ selector: "app-list", templateUrl: "./list.component.html" })
export class List {
  protected readonly styles = styles
}
"##;

const ANGULAR_TEMPLATE: &str =
    "<ul>\n  @for (item of items; track item) {\n    <li [sx]=\"styles.card\">{{ item }}</li>\n  }\n</ul>\n";

#[test]
fn angular_inline_templates_hover_summarize_and_report() {
    let mut f = fixture(&[]);
    let published = f.open("card.component.ts", ANGULAR_INLINE);
    // `width: 5` in the `css()` call, on its line; nothing from the template. (The fixture installs
    // no Angular, so its imports are reported unresolved too.)
    let diagnostics = diagnostics_for(&published, &f.uri("card.component.ts")).as_array().unwrap().clone();
    let codes: Vec<&str> = diagnostics.iter().filter_map(|diagnostic| diagnostic["code"].as_str()).collect();
    assert_eq!(codes.iter().filter(|code| **code == "unitless-length").count(), 1, "{diagnostics:?}");
    let template = ANGULAR_INLINE[..ANGULAR_INLINE.find("template:").unwrap()].lines().count() as u64 - 1;
    assert!(diagnostics.iter().all(|diagnostic| diagnostic["range"]["start"]["line"] != template), "{diagnostics:?}");
    let hover = f.hover("card.component.ts", ANGULAR_INLINE, "[sx]=\"[styles.card", 0, 9);
    assert!(hover.contains("display: grid"), "{hover}");
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("card.component.ts") } }));
    let labels: Vec<String> = hints.as_array().unwrap().iter().map(label_text).collect();
    assert!(labels.iter().any(|label| label.starts_with("▦ grid")), "{labels:?}");
    // Without `[sx]` in its template the file is a module again, with its own sites.
    let plain = ANGULAR_INLINE.replace("[sx]=", "title=");
    f.notify(
        "textDocument/didChange",
        json!({ "textDocument": { "uri": f.uri("card.component.ts"), "version": 2 }, "contentChanges": [{ "text": plain }] }),
    );
    let hover = f.hover("card.component.ts", &plain, "display: \"grid\"", 0, 2);
    assert!(hover.contains("display"), "{hover}");
}

#[test]
fn angular_html_templates_read_their_component() {
    // `orphan.html` is on disk at start: indexing passes over a template no component names.
    let mut f = fixture(&[
        ("list.component.ts", ANGULAR_COMPONENT),
        ("list.component.html", ANGULAR_TEMPLATE),
        ("orphan.html", "<p [sx]=\"x\"></p>"),
    ]);
    // Indexed at start: the template's binding resolves before it is opened.
    let hover = f.hover("list.component.html", ANGULAR_TEMPLATE, "[sx]=\"styles.card", 0, 9);
    assert!(hover.contains("display: flex"), "{hover}");
    let published = f.open("list.component.html", ANGULAR_TEMPLATE);
    assert_eq!(diagnostics_for(&published, &f.uri("list.component.html")), &json!([]));
    // Only the template's binding: the component's own `css()` is in the `.ts` file.
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("list.component.html") } }));
    assert_eq!(hints.as_array().unwrap().len(), 1, "{hints}");
    assert!(label_text(&hints[0]).starts_with("⇶ flex"), "{hints}");
    // An `.html` file no component names compiles nothing.
    f.open("page.html", "<p [sx]=\"x\"></p>");
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("page.html") } }));
    assert_eq!(hints, json!([]));
    // A component that names its template, with `[sx]` only in a comment, compiles nothing itself.
    f.open(
        "named.component.ts",
        "// [sx] lives in the template\n@Component({ templateUrl: './named.html' })\nexport class Named {}\n",
    );
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("named.component.ts") } }));
    assert_eq!(hints, json!([]));
    // A folder named like a script is not a component, and a template in a missing folder has none.
    std::fs::create_dir_all(f.root.join("views/folder.ts")).unwrap();
    f.open("views/view.html", "<p [sx]=\"x\"></p>");
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("views/view.html") } }));
    assert_eq!(hints, json!([]));
    f.open("missing/view.html", "<p [sx]=\"x\"></p>");
    let hints = f.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": f.uri("missing/view.html") } }));
    assert_eq!(hints, json!([]));
}
