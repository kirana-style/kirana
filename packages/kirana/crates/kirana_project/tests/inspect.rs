//! The inspection API the language server and the lint plugin read (KRN-DX-001, KRN-DX-009).

use std::sync::Arc;

use kirana_project::{Project, split_light_dark};
use kirana_shared::OsFs;

const TOKENS: &str = r##"import { defineTokens } from "@kirana-style/core"
export const color = defineTokens("color", {
  brand: "#0af",
  ink: { light: "black", dark: "white" },
  shade: { light: "multiply", dark: "screen" },
  space: { value: "4px", variable: true },
})
"##;

const INPUT: &str = r##"import { css, firstThatWorks, keyframes, relation, select } from "@kirana-style/core"
import { color } from "./tokens"
const card = relation("card")
const peer = relation("peer")
const spin = keyframes({ to: { rotate: "1turn" } })
export const box = css({
  animationName: spin,
  color: { base: color.brand, ":hover": color.ink, "@media (width >= 40rem)": "red" },
  mixBlendMode: color.shade,
  padding: color.space,
  minHeight: firstThatWorks("100dvh", "100vh"),
  opacity: { [card.within(":hover")]: 0.5, [peer.after(":checked")]: 0.7, [peer.before()]: 0.9 },
  "::before": { content: "''" },
  [select.child('[data-slot="icon"]')]: { width: "1rem", "::after": { content: "''" } },
  [select.descendant("svg")]: { height: "1rem" },
})
export function C() {
  return <div sx={card.anchor}><input sx={peer.anchor} /><p sx={box} /></div>
}
"##;

/// A project on disk (the resolver reads the real file system), transformed once.
fn project() -> (std::path::PathBuf, Project) {
    let root = std::env::temp_dir().join(format!(
        "kirana-inspect-{}-{}",
        std::process::id(),
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join("package.json"), r##"{"name":"inspect"}"##).unwrap();
    std::fs::write(root.join("tokens.ts"), TOKENS).unwrap();
    std::fs::write(root.join("input.tsx"), INPUT).unwrap();
    let config = format!(r##"{{"root":{:?}}}"##, root.to_string_lossy());
    let project = Project::new(&config, Arc::new(OsFs)).unwrap();
    project.transform(&root.join("input.tsx"), INPUT);
    (root, project)
}

#[test]
fn sites_describe_every_atom_readably() {
    let (root, project) = project();
    assert!(project.sites(&root.join("missing.tsx")).is_empty());
    let sites = project.sites(&root.join("input.tsx"));
    let atoms: Vec<_> = sites.iter().flat_map(|site| &site.atoms).collect();
    let find = |property: &str, condition: &str| {
        atoms
            .iter()
            .find(|atom| atom.property == property && atom.conditions.join(" & ") == condition)
            .unwrap_or_else(|| panic!("{property} {condition}: {atoms:#?}"))
    };
    let base = find("color", "");
    assert_eq!(base.value, "#0af");
    assert_eq!(base.layer, "kirana.atoms");
    assert!(base.rule.starts_with(&format!(".{} {{ color: #0af }}", base.class)), "{}", base.rule);
    assert_eq!(find("color", ":hover").value, "light-dark(black, white)");
    let media = find("color", "@media (width >= 40rem)");
    assert!(media.rule.starts_with("@media (width >= 40rem) { .") && media.rule.ends_with("} }"), "{}", media.rule);
    let tall = find("min-height", "");
    assert_eq!(tall.value, "firstThatWorks(100dvh, 100vh)");
    assert!(tall.rule.ends_with("{ min-height: 100vh; min-height: 100dvh }"), "{}", tall.rule);
    assert_eq!(find("mix-blend-mode", "").tokens, ["color.shade"]);
    assert_eq!(find("padding", "").tokens, ["color.space"]);
    find("opacity", "card.within(:hover)");
    find("opacity", "peer.after(:checked)");
    find("opacity", "peer.before()");
    let targets: Vec<(&str, &str)> = atoms.iter().map(|atom| (atom.property.as_str(), atom.target.as_str())).collect();
    assert!(targets.contains(&("content", "::before")));
    assert!(targets.contains(&("width", r##"> [data-slot="icon"]"##)));
    assert!(targets.contains(&("content", r##"> [data-slot="icon"]::after"##)));
    assert!(targets.contains(&("height", "svg")));
    assert!(atoms.iter().any(|atom| atom.layer == "kirana.contextual"));
    // Sites come back in source order.
    assert!(sites.windows(2).all(|pair| pair[0].span.start <= pair[1].span.start));
}

#[test]
fn tokens_cover_inlined_variable_and_mode_values() {
    let (_, project) = project();
    let tokens = project.tokens();
    let get = |identity: &str| tokens.iter().find(|token| token.identity == identity).unwrap();
    let brand = get("color.brand");
    assert_eq!((brand.value.as_str(), brand.variable, brand.light.as_deref()), ("#0af", false, None));
    assert_eq!((brand.package.as_str(), brand.file.as_str()), ("inspect", "tokens.ts"));
    assert_eq!(&TOKENS[brand.span.start as usize..brand.span.end as usize], "brand: \"#0af\"");
    let ink = get("color.ink");
    assert_eq!((ink.light.as_deref(), ink.dark.as_deref()), (Some("black"), Some("white")));
    let shade = get("color.shade");
    assert!(shade.variable);
    assert_eq!((shade.light.as_deref(), shade.dark.as_deref()), (Some("multiply"), Some("screen")));
    assert_eq!(shade.value, "multiply screen");
    assert!(get("color.space").variable);
}

#[test]
fn relations_list_declarations_anchors_and_reads() {
    let (_, project) = project();
    let relations = project.relations();
    let names: Vec<&str> = relations.iter().map(|relation| relation.name.as_str()).collect();
    assert_eq!(names, ["card", "peer"]);
    assert_eq!(relations[0].declared_in, ["input.tsx"]);
    assert_eq!(relations[0].anchored_in, ["input.tsx"]);
    assert_eq!(relations[0].read_in, ["input.tsx"]);
}

#[test]
fn light_dark_pairs_split_at_the_top_level_comma() {
    assert_eq!(
        split_light_dark("light-dark(rgb(0, 0, 0), oklch(1 0 0))"),
        Some(("rgb(0, 0, 0)".to_owned(), "oklch(1 0 0)".to_owned()))
    );
    assert_eq!(split_light_dark("light-dark(red)"), None);
    assert_eq!(split_light_dark("light-dark(red, blue"), None);
    assert_eq!(split_light_dark("red"), None);
}

#[test]
fn ranks_follow_the_precedence_ladder() {
    let (root, project) = project();
    let sites = project.sites(&root.join("input.tsx"));
    let atoms: Vec<_> = sites.iter().flat_map(|site| &site.atoms).collect();
    let rank = |condition: &str| {
        atoms.iter().find(|atom| atom.property == "color" && atom.conditions.join(" & ") == condition).unwrap().rank
    };
    // Base, then a state, then a breakpoint: the stronger condition writes later and ranks higher.
    assert!(rank("") < rank(":hover"));
    assert!(rank("") < rank("@media (width >= 40rem)"));
    // Ranks are a permutation of each site's atoms.
    for site in &sites {
        let mut ranks: Vec<u32> = site.atoms.iter().map(|atom| atom.rank).collect();
        ranks.sort_unstable();
        assert_eq!(ranks, (0..site.atoms.len() as u32).collect::<Vec<_>>());
    }
}

#[test]
fn origins_find_every_site_producing_a_class() {
    let (root, project) = project();
    let sites = project.sites(&root.join("input.tsx"));
    let applied =
        sites.iter().find(|site| &INPUT[site.span.start as usize..site.span.end as usize] == "sx={box}").unwrap();
    let class = applied.atoms[0].class.as_str();
    let origins = project.origins(&[class].into_iter().collect());
    let spans: Vec<&str> =
        origins.iter().map(|origin| &INPUT[origin.span.start as usize..origin.span.end as usize]).collect();
    assert!(spans.iter().any(|span| span.starts_with("css({")), "{spans:?}");
    assert!(spans.contains(&"sx={box}"), "{spans:?}");
    assert!(origins.iter().all(|origin| origin.class == class && origin.path == root.join("input.tsx")));
    assert!(project.origins(&["nothing"].into_iter().collect()).is_empty());
}
