//! Server templates in the language server (D-069): the names a Blade, Twig, ERB, HEEx or Edge
//! template passes to `kirana(…)` are sites of the class map's exports.

use std::path::PathBuf;

use kirana_lsp::Server;
use kirana_lsp::text::{LineIndex, path_to_uri};
use lsp_server::{Notification, Request, RequestId};
use serde_json::{Value, json};

const STYLES: &str = r##"import { css } from "@kirana-style/core"
export const card = css({ display: "flex", gap: "0.5rem" })
export const button = { primary: css({ color: "#0af" }) }
"##;

const ERB: &str = "<p class=\"<%= kirana :card, \"button.primary\", :missing %>\"></p>\n";
const BLADE: &str = "<p class=\"@kirana('card')\"></p>\n";

struct Fixture {
    root: PathBuf,
    server: Server,
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn fixture() -> Fixture {
    let root = std::env::temp_dir().join(format!(
        "kirana-templates-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    std::fs::create_dir_all(root.join("styles")).unwrap();
    std::fs::write(root.join("package.json"), r#"{"name":"app"}"#).unwrap();
    std::fs::write(root.join("styles/app.styles.ts"), STYLES).unwrap();
    let config = json!({ "root": root, "classes": { "modules": ["styles"], "out": "classes.json" } });
    let server = Server::start(&config.to_string(), &json!({})).unwrap();
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

    fn open(&mut self, name: &str, text: &str) -> Vec<Notification> {
        let uri = self.uri(name);
        self.server.notification(Notification::new(
            "textDocument/didOpen".to_owned(),
            json!({ "textDocument": { "uri": uri, "languageId": "erb", "version": 1, "text": text } }),
        ))
    }

    fn hover(&mut self, name: &str, text: &str, needle: &str) -> String {
        let offset = text.find(needle).unwrap() + 1;
        let params =
            json!({ "textDocument": { "uri": self.uri(name) }, "position": LineIndex::new(text).position(offset) });
        let value = self.ok("textDocument/hover", params);
        value.pointer("/contents/value").and_then(Value::as_str).unwrap_or_default().to_owned()
    }

    fn hints(&mut self, name: &str) -> Value {
        let uri = self.uri(name);
        self.ok("textDocument/inlayHint", json!({ "textDocument": { "uri": uri } }))
    }
}

fn diagnostics_for(notifications: &[Notification], uri: &str) -> Value {
    notifications
        .iter()
        .find(|notification| notification.params["uri"] == uri)
        .map(|notification| notification.params["diagnostics"].clone())
        .expect("published")
}

#[test]
fn names_in_templates_hover_summarize_and_report() {
    let mut f = fixture();
    let published = f.open("home.html.erb", ERB);
    let diagnostics = diagnostics_for(&published, &f.uri("home.html.erb"));
    let diagnostics = diagnostics.as_array().unwrap();
    assert_eq!(diagnostics.len(), 1, "{diagnostics:?}");
    assert_eq!(diagnostics[0]["code"], "unknown-class-name");
    assert!(diagnostics[0]["message"].as_str().unwrap().contains("`missing`"));
    assert_eq!(f.hints("home.html.erb").as_array().unwrap().len(), 2);
    assert!(f.hover("home.html.erb", ERB, ":card").contains("display: flex"));
    assert!(f.hover("home.html.erb", ERB, "\"button.primary").contains("color"));

    f.open("home.blade.php", BLADE);
    assert!(f.hover("home.blade.php", BLADE, "'card").contains("gap"));

    // A template that names nothing, and one that stops naming, compile nothing.
    let published = f.open("plain.edge", "<p>{{ title }}</p>\n");
    assert_eq!(diagnostics_for(&published, &f.uri("plain.edge")), json!([]));
    assert_eq!(f.hints("plain.edge"), json!([]));
    let uri = f.uri("home.blade.php");
    f.server.notification(Notification::new(
        "textDocument/didChange".to_owned(),
        json!({ "textDocument": { "uri": uri, "version": 2 }, "contentChanges": [{ "text": "<p></p>\n" }] }),
    ));
    assert_eq!(f.hints("home.blade.php"), json!([]));
}
