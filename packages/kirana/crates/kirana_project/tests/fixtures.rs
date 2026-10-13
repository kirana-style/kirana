//! Golden transform fixtures (KRN-TEST-002). Each directory under `fixtures/transform/` holds an
//! `input.tsx` (plus any files it imports), an optional `kirana.json`, and the expected
//! `output.tsx`, `output.css` and `diagnostics.json`. Set `KIRANA_UPDATE_FIXTURES=1` to rewrite
//! the expectations, then review the diff like any behaviour change.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use kirana_project::Project;
use kirana_shared::OsFs;

fn fixtures_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/transform")
}

fn run_case(directory: &Path) -> Vec<String> {
    let root = fs::canonicalize(directory).unwrap();
    let config = fs::read_to_string(root.join("kirana.json")).unwrap_or_else(|_| "{}".to_owned());
    let mut config: serde_json::Value = serde_json::from_str(&config).unwrap();
    config["root"] = serde_json::Value::String(root.to_string_lossy().into_owned());
    let input = root.join("input.tsx");
    let source = fs::read_to_string(&input).unwrap();
    let actual = match Project::new(&config.to_string(), Arc::new(OsFs)) {
        Ok(project) => {
            let result = project.transform(&input, &source);
            let mut diagnostics = result.diagnostics.clone();
            diagnostics.extend(project.diagnostics());
            [
                ("output.tsx", result.code.clone().unwrap_or_else(|| "// unchanged\n".to_owned())),
                ("output.css", project.stylesheet(false)),
                ("diagnostics.json", format!("{}\n", serde_json::to_string_pretty(&diagnostics).unwrap())),
            ]
        }
        Err(diagnostics) => [
            ("output.tsx", "// configuration rejected\n".to_owned()),
            ("output.css", String::new()),
            ("diagnostics.json", format!("{}\n", serde_json::to_string_pretty(&diagnostics).unwrap())),
        ],
    };
    let update = std::env::var_os("KIRANA_UPDATE_FIXTURES").is_some();
    let mut failures = Vec::new();
    for (name, text) in actual {
        let path = root.join(name);
        let expected = fs::read_to_string(&path).unwrap_or_default();
        if expected != text {
            if update {
                fs::write(&path, &text).unwrap();
            } else {
                failures.push(format!("{}/{name}:\n--- expected\n{expected}\n--- actual\n{text}", directory.display()));
            }
        }
    }
    failures
}

#[test]
fn golden_fixtures() {
    let mut cases: Vec<PathBuf> = fs::read_dir(fixtures_root())
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.join("input.tsx").exists())
        .collect();
    cases.sort();
    assert!(!cases.is_empty());
    let failures: Vec<String> = cases.iter().flat_map(|case| run_case(case)).collect();
    assert!(failures.is_empty(), "{} fixture file(s) differ:\n{}", failures.len(), failures.join("\n"));
}
