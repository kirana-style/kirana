//! The binary lookup, on the host (the extension itself runs as WebAssembly inside Zed).

use kirana_zed::{Found, locate};

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
    // A project still on 0.1.0, where the command was `kirana`.
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
