//! The editors' brand (`editors/brand/`), compiled in: the icon, generated from the logo
//! (`brand.json`, `apps/docs/scripts/generate-brand.ts`), and the colours of each group of properties
//! (`palette.json`). The VS Code extension reads the same two files, so a new logo or colour reaches
//! the card, the hints and every view at once, in every editor.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde_json::Value;

const BRAND: &str = include_str!("../../../editors/brand/brand.json");
const PALETTE: &str = include_str!("../../../editors/brand/palette.json");

struct Brand {
    icon: String,
    groups: BTreeMap<String, String>,
    quiet: String,
}

fn brand() -> &'static Brand {
    static BRAND_FILES: OnceLock<Brand> = OnceLock::new();
    BRAND_FILES.get_or_init(|| {
        let brand: Value = serde_json::from_str(BRAND).expect("brand.json is JSON");
        let palette: Value = serde_json::from_str(PALETTE).expect("palette.json is JSON");
        let text = |value: &Value| value.as_str().unwrap_or_default().to_owned();
        Brand {
            icon: text(&brand["icon"]),
            groups: palette["groups"]
                .as_object()
                .map(|groups| groups.iter().map(|(group, colour)| (group.clone(), text(colour))).collect())
                .unwrap_or_default(),
            quiet: text(&palette["quiet"]),
        }
    })
}

/// A group's colour (`layout`, `box` …) as a CSS value; groups without one are quiet.
pub(crate) fn colour(group: &str) -> &'static str {
    let brand = brand();
    brand.groups.get(group).map_or(brand.quiet.as_str(), String::as_str)
}

/// The icon as a Markdown image `size` pixels square.
pub(crate) fn icon(size: u32) -> String {
    let svg = brand().icon.replacen("<svg ", &format!("<svg width=\"{size}\" height=\"{size}\" "), 1);
    format!("![Kirana]({})", crate::diagram::data_uri(&svg))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_brand_files_hold_an_icon_and_a_colour_per_group() {
        assert!(brand().icon.starts_with("<svg") && brand().icon.ends_with("</svg>"));
        for group in ["layout", "box", "size", "colour", "type", "border"] {
            assert!(colour(group).starts_with("var(--vscode-"), "{group}");
        }
        // Red reads as an error: no group uses it.
        assert!(brand().groups.values().all(|colour| !colour.contains("red")));
        assert_eq!(colour("motion"), brand().quiet);
        assert!(icon(14).starts_with("![Kirana](data:image/svg+xml;base64,"));
    }
}
