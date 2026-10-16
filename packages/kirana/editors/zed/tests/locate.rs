//! The binary lookup, on the host (the extension itself runs as WebAssembly inside Zed).

use kirana_zed::{Found, lists_kirana, locate};

#[test]
fn finds_the_project_binary_through_package_json() {
    assert!(lists_kirana(r#"{ "devDependencies": { "kirana-style": "^0.2.1" } }"#));
    assert!(lists_kirana(r#"{ "dependencies": { "react": "19.2.0", "kirana-style": "0.2.1" } }"#));
    // The library and the bundler plugin do not install the command.
    assert!(!lists_kirana(r#"{ "dependencies": { "@kirana-style/core": "0.2.1", "@kirana-style/vite": "0.2.1" } }"#));
    assert!(!lists_kirana(r#"{ "peerDependencies": { "kirana-style": "*" } }"#));
    assert!(!lists_kirana("{}"));
    assert!(!lists_kirana("not json"));
}

#[test]
fn prefers_the_setting_then_the_project_then_path() {
    let lsp = vec!["lsp".to_owned()];
    assert_eq!(
        locate("/repo", Some(("/opt/kirana".to_owned(), None)), Some("kirana-style"), None),
        Ok(Found { command: "/opt/kirana".to_owned(), args: lsp.clone() })
    );
    assert_eq!(
        locate(
            "/repo",
            Some(("node".to_owned(), Some(vec!["bin/kirana-style.ts".to_owned(), "lsp".to_owned()]))),
            Some("kirana-style"),
            None
        )
        .unwrap()
        .args,
        ["bin/kirana-style.ts", "lsp"]
    );
    assert_eq!(
        locate("/repo/", None, Some("kirana-style"), Some("/usr/bin/kirana-style".to_owned())),
        Ok(Found { command: "/repo/node_modules/.bin/kirana-style".to_owned(), args: lsp.clone() })
    );
    // An older install, from before the command was named `kirana-style`.
    assert_eq!(
        locate("/repo", None, Some("kirana"), None),
        Ok(Found { command: "/repo/node_modules/.bin/kirana".to_owned(), args: lsp.clone() })
    );
    assert_eq!(
        locate("/repo", None, None, Some("/usr/bin/kirana-style".to_owned())),
        Ok(Found { command: "/usr/bin/kirana-style".to_owned(), args: lsp })
    );
    assert!(locate("/repo", None, None, None).unwrap_err().contains("install kirana-style"));
    assert_eq!(kirana_zed::NAMES, ["kirana-style", "kirana"]);
}
