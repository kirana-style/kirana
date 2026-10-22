//! `kirana-style analyze` (KRN-DX-008): every section of the report, from one compiled project.

use std::path::PathBuf;
use std::sync::Arc;

use kirana_project::{LayerSize, Project, layer_sizes};
use kirana_shared::OsFs;

const TOKENS: &str = r##"import { defineTokens } from "@kirana-style/core"
export const color = defineTokens("color", {
  ink: { value: "black", variable: true },
  edge: { value: "gray", variable: true },
  unused: { value: "pink", variable: true },
  inlined: "red",
})
export const alias = defineTokens("alias", { line: color.edge }, { variable: true })
"##;

const THEME: &str = r##"import { defineTheme } from "@kirana-style/core"
import { color } from "./tokens"
export const night = defineTheme(color, { ink: "white" })
"##;

/// Twelve sites share `display: grid`, six share `gap`, and one of the two modules alone sets
/// `color: blue`.
fn cards() -> String {
    let mut source = String::from(
        "import { css, recipe, relation } from \"@kirana-style/core\"\nimport { color, alias } from \"./tokens\"\nimport { night } from \"./theme\"\nconst card = relation(\"card\")\n",
    );
    for index in 0..12 {
        let gap = if index < 6 { ", gap: \"1rem\"" } else { "" };
        source.push_str(&format!("export const a{index} = css({{ display: \"grid\"{gap} }})\n"));
    }
    source.push_str(
        "export const tinted = css({ color: color.ink, borderColor: alias.line, opacity: { [card.within(\":hover\")]: 0.5 } })\n\
         export const button = recipe({ variants: { tone: { loud: { color: \"blue\" }, quiet: { color: \"gray\" } } } })\n\
         export function Card({ tone, width }: { tone: \"loud\" | \"quiet\"; width: string }) {\n\
           return <div sx={[night, tinted]}><button sx={button({ tone })} /><p sx={css({ width })} /></div>\n\
         }\n",
    );
    source
}

const OTHER: &str = r##"import { counterStyle, css, keyframes, positionTry, viewTransition } from "@kirana-style/core"
export const other = css({ display: "grid", content: "'{'" })
export const Other = () => <p sx={[other, css({ color: "green" })]} />
const spin = keyframes({ to: { rotate: "1turn" } })
export const marked = css({ animationName: spin, "::before": { content: "''" } })
export const quoted = css({ "::before": { content: "''" } })
const below = positionTry({ marginTop: "1px" })
const slide = viewTransition({ old: { opacity: 0 } })
export const Anchored = () => <p sx={[slide, css({ positionTryFallbacks: below })]} />
const check = counterStyle({ symbols: '"*"' })
export const Listed = () => <ul sx={css({ listStyleType: check })} />
"##;

fn project() -> (PathBuf, Project) {
    let root = std::env::temp_dir().join(format!(
        "kirana-analyze-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    std::fs::create_dir_all(root.join("src")).unwrap();
    std::fs::write(root.join("package.json"), r##"{"name":"analyze"}"##).unwrap();
    std::fs::write(root.join("src/tokens.ts"), TOKENS).unwrap();
    std::fs::write(root.join("src/theme.ts"), THEME).unwrap();
    std::fs::write(root.join("src/cards.tsx"), cards()).unwrap();
    std::fs::write(root.join("src/other.tsx"), OTHER).unwrap();
    std::fs::write(root.join("src/plain.ts"), "export const nothing = 1\n").unwrap();
    let config = format!(r##"{{"root":{:?}}}"##, root.to_string_lossy());
    (root.clone(), Project::new(&config, Arc::new(OsFs)).unwrap())
}

#[test]
fn reports_reuse_size_runtime_work_themes_relations_and_tokens() {
    let (root, project) = project();
    let (diagnostics, _) = project.compile_paths(&[root.join("src")]);
    let analysis = project.analyze(&diagnostics);

    // plain.ts contributes nothing; tokens.ts and theme.ts contribute definitions, not atoms.
    assert_eq!(analysis.modules, 4, "{analysis:#?}");
    assert_eq!(analysis.by_module.len(), 2);
    assert_eq!(analysis.bytes, project.stylesheet(true).len());
    let layers: Vec<&str> = analysis.layers.iter().map(|layer| layer.layer.as_str()).collect();
    assert_eq!(layers, ["order", "kirana.tokens", "kirana.themes", "kirana.atoms"]);
    assert_eq!(analysis.layers.iter().map(|layer| layer.bytes).sum::<usize>(), analysis.bytes);

    let bucket = |label: &str| analysis.reuse.iter().find(|bucket| bucket.sites == label).unwrap().atoms;
    assert_eq!(bucket("10+"), 1, "{:#?}", analysis.reuse);
    assert_eq!(bucket("5–9"), 1);
    assert_eq!(analysis.reuse.iter().map(|bucket| bucket.atoms).sum::<usize>(), analysis.atoms);
    let top = &analysis.most_reused[0];
    assert_eq!((top.declaration.as_str(), top.sites, top.modules), ("display: grid", 14, 2));
    assert_eq!(analysis.most_reused[1].declaration, "gap: 1rem");
    assert!(analysis.most_reused.iter().all(|atom| atom.sites > 1));
    assert!(
        analysis.most_reused.iter().any(|atom| atom.declaration == "content: '' on ::before"),
        "{:#?}",
        analysis.most_reused
    );

    let cards = analysis.by_module.iter().find(|module| module.file == "src/cards.tsx").unwrap();
    let other = analysis.by_module.iter().find(|module| module.file == "src/other.tsx").unwrap();
    assert!(cards.bytes >= other.bytes && cards.exclusive < cards.bytes, "{:#?}", analysis.by_module);
    // `display: grid` is shared; the content and the colour are other.tsx's own.
    assert!(other.exclusive > 0 && other.exclusive < other.bytes);

    assert_eq!(analysis.bridged.len(), 1);
    assert_eq!(analysis.bridged[0].file, "src/cards.tsx");
    assert!(analysis.bridged[0].message.starts_with("width is set at runtime"));
    assert!(analysis.bridged[0].line > 10);
    assert_eq!(analysis.runtime_recipes.len(), 1);

    assert_eq!(analysis.themes.len(), 1);
    assert_eq!(analysis.themes[0].overrides, ["color.ink"]);
    assert_eq!(analysis.themes[0].files, ["src/cards.tsx", "src/theme.ts"]);

    // The relation is read, and no element carries its anchor.
    assert_eq!(analysis.unproven_reads.len(), 1);
    assert_eq!(analysis.unproven_reads[0].relation, "card");
    assert_eq!(analysis.unproven_reads[0].read_in, ["src/cards.tsx"]);

    // `edge` is read through `alias.line`; `inlined` is not a variable, so nothing can tell.
    let unused: Vec<&str> = analysis.unused_tokens.iter().map(|token| token.identity.as_str()).collect();
    assert_eq!(unused, ["color.unused"]);
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn an_empty_project_has_an_empty_report() {
    let (root, project) = project();
    let analysis = project.analyze(&[]);
    assert_eq!((analysis.modules, analysis.sites, analysis.atoms), (0, 0, 0));
    assert!(analysis.most_reused.is_empty() && analysis.by_module.is_empty() && analysis.themes.is_empty());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn layer_sizes_skip_braces_in_strings() {
    let css = "@layer a,b;@property --x{syntax:\"*\";inherits:false}@layer kirana.atoms{.a{content:\"}\\\"{\"}.b{content:'{'}}@layer kirana.atoms{.c{color:red}}";
    let sizes = layer_sizes(css);
    let size = |layer: &str, bytes: usize| LayerSize { layer: layer.to_owned(), bytes };
    assert_eq!(sizes, [size("order", 11), size("@property", 40), size("kirana.atoms", css.len() - 51)]);
}
