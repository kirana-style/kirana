//! The binary lookup, on the host (the extension itself runs as WebAssembly inside Zed).

use kirana_zed::{Found, locate};

#[test]
fn prefers_the_setting_then_the_project_then_path() {
    let lsp = vec!["lsp".to_owned()];
    assert_eq!(
        locate("/repo", Some(("/opt/kirana".to_owned(), None)), true, None),
        Ok(Found { command: "/opt/kirana".to_owned(), args: lsp.clone() })
    );
    assert_eq!(
        locate(
            "/repo",
            Some(("node".to_owned(), Some(vec!["bin/kirana.ts".to_owned(), "lsp".to_owned()]))),
            true,
            None
        )
        .unwrap()
        .args,
        ["bin/kirana.ts", "lsp"]
    );
    assert_eq!(
        locate("/repo/", None, true, Some("/usr/bin/kirana".to_owned())),
        Ok(Found { command: "/repo/node_modules/.bin/kirana".to_owned(), args: lsp.clone() })
    );
    assert_eq!(
        locate("/repo", None, false, Some("/usr/bin/kirana".to_owned())),
        Ok(Found { command: "/usr/bin/kirana".to_owned(), args: lsp })
    );
    assert!(locate("/repo", None, false, None).unwrap_err().contains("install @kirana-style/compiler"));
}
