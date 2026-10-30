//! Pictures of a style (KRN-DX-013): the box model, the grid or flex layout, the colours and the
//! type a site sets, drawn from its base values. Every editor gets the text drawing; a client that
//! renders images in hovers (`initializationOptions.images`) gets an SVG, in the colours of its
//! theme (`theme`: `light` or `dark`).

use std::fmt::Write as _;

use crate::colors::parse;
use crate::model::{Entry, Resolved};

/// The theme a client draws on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Theme {
    Light,
    Dark,
}

impl Theme {
    pub fn from_name(name: Option<&str>) -> Theme {
        if name == Some("dark") { Theme::Dark } else { Theme::Light }
    }

    fn ink(self) -> &'static str {
        match self {
            Theme::Light => "#1f2328",
            Theme::Dark => "#e6edf3",
        }
    }

    fn muted(self) -> &'static str {
        match self {
            Theme::Light => "#59636e",
            Theme::Dark => "#9198a1",
        }
    }
}

/// The base value (no condition, on the element) of the first of `properties` that is set.
pub(crate) fn base<'r>(resolved: &'r Resolved, properties: &[&str]) -> Option<&'r Entry> {
    properties.iter().find_map(|property| {
        resolved
            .effective()
            .filter(|entry| entry.property == *property && entry.conditions.is_empty() && entry.target.is_empty())
            // What applies when no handle guard holds: an unconditionally applied source.
            .find(|entry| entry.source.as_ref().is_none_or(|source| source.when.is_none()))
    })
}

/// How a value is shown in a drawing: a token by its short name, a long value cut.
pub(crate) fn shown(entry: &Entry) -> String {
    let value = match entry.tokens.first() {
        Some(token) if entry.value.starts_with("var(") => {
            token.identity.rsplit('.').take(2).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join(".")
        }
        // A colour pair never sizes a box: the value as written.
        _ => entry.value.clone(),
    };
    if value.chars().count() > 18 { format!("{}…", value.chars().take(17).collect::<String>()) } else { value }
}

/// One side of padding, margin or border width: its own longhand, the axis, or the shorthand.
fn side<'r>(resolved: &'r Resolved, box_property: &str, side: &str) -> Option<&'r Entry> {
    let axis = if matches!(side, "top" | "bottom") { "block" } else { "inline" };
    let logical = match side {
        "top" => format!("{box_property}-block-start"),
        "bottom" => format!("{box_property}-block-end"),
        "left" => format!("{box_property}-inline-start"),
        _ => format!("{box_property}-inline-end"),
    };
    let (own, axis) = (format!("{box_property}-{side}"), format!("{box_property}-{axis}"));
    base(resolved, &[&own, &logical, &axis, box_property])
}

/// The four sides of a box property, or `None` when none is set.
fn sides(resolved: &Resolved, box_property: &str) -> Option<[Option<String>; 4]> {
    let found = ["top", "right", "bottom", "left"].map(|name| side(resolved, box_property, name).map(shown));
    found.iter().any(Option::is_some).then_some(found)
}

/// One label for four sides, as the CSS shorthand writes them: `1rem`, `0.5rem 1rem`, or all four.
pub(crate) fn label(sides: &[Option<String>; 4]) -> String {
    let [top, right, bottom, left] = sides.clone().map(|side| side.unwrap_or_else(|| "0".to_owned()));
    if top == right && right == bottom && bottom == left {
        top
    } else if top == bottom && right == left {
        format!("{top} {right}")
    } else if right == left {
        format!("{top} {right} {bottom}")
    } else {
        format!("{top} {right} {bottom} {left}")
    }
}

/// The grid's column tracks: `repeat(3, 1fr)` → three `1fr`; plain lists split at the top level.
fn tracks(template: &str) -> Vec<String> {
    let template = template.trim();
    if let Some(inner) = template.strip_prefix("repeat(").and_then(|rest| rest.strip_suffix(')'))
        && let Some((count, track)) = inner.split_once(',')
        && let Ok(count) = count.trim().parse::<usize>()
    {
        return vec![track.trim().to_owned(); count.min(12)];
    }
    let mut out = Vec::new();
    let mut depth = 0usize;
    let mut current = String::new();
    for character in template.chars() {
        match character {
            '(' => depth += 1,
            ')' => depth = depth.saturating_sub(1),
            ' ' if depth == 0 => {
                if !current.is_empty() {
                    out.push(std::mem::take(&mut current));
                }
                continue;
            }
            _ => {}
        }
        current.push(character);
    }
    if !current.is_empty() {
        out.push(current);
    }
    out.truncate(12);
    out
}

/// The layout a site sets, as one line: `grid · 3 cols · gap 0.75rem`.
fn layout_line(resolved: &Resolved) -> Option<(String, Vec<String>, bool)> {
    let display = base(resolved, &["display"])?.value.clone();
    let gap = base(resolved, &["gap", "column-gap", "row-gap"]).map(shown);
    if display.contains("grid") {
        let columns = base(resolved, &["grid-template-columns"]).map(|entry| tracks(&entry.value)).unwrap_or_default();
        let mut line = "grid".to_owned();
        if !columns.is_empty() {
            let _ = write!(line, " · {} col{}", columns.len(), if columns.len() > 1 { "s" } else { "" });
        }
        if let Some(gap) = &gap {
            let _ = write!(line, " · gap {gap}");
        }
        return Some((line, columns, false));
    }
    if display.contains("flex") {
        let direction = base(resolved, &["flex-direction"]).map_or("row".to_owned(), |entry| entry.value.clone());
        let mut line = format!("flex · {direction}");
        if let Some(gap) = &gap {
            let _ = write!(line, " · gap {gap}");
        }
        for (property, short) in [("justify-content", "justify"), ("align-items", "items")] {
            if let Some(entry) = base(resolved, &[property]) {
                let _ = write!(line, " · {short} {}", entry.value);
            }
        }
        return Some((line, Vec::new(), direction.starts_with("column")));
    }
    None
}

/// The text drawing, for every editor: the box model and the layout, in a code block.
pub(crate) fn text(resolved: &Resolved) -> Option<String> {
    let margin = sides(resolved, "margin");
    let padding = sides(resolved, "padding");
    let width = base(resolved, &["width", "inline-size"]).map(shown);
    let height = base(resolved, &["height", "block-size"]).map(shown);
    let layout = layout_line(resolved);
    if margin.is_none() && padding.is_none() && layout.is_none() {
        return None;
    }
    let inner = 30;
    let mut out = String::new();
    let line = |out: &mut String, left: &str, body: &str, right: &str, width: usize| {
        let length = body.chars().count();
        let _ = writeln!(out, "{left}{body}{}{right}", " ".repeat(width.saturating_sub(length)));
    };
    if let Some(margin) = &margin {
        let _ = writeln!(out, "  margin {}", label(margin));
    }
    let _ = writeln!(out, "┌{}┐", "─".repeat(inner));
    if let Some(padding) = &padding {
        line(&mut out, "│ ", &format!("padding {}", label(padding)), "│", inner - 1);
    }
    let content = match (&width, &height) {
        (None, None) => "content".to_owned(),
        (width, height) => format!(
            "{} × {}",
            width.clone().unwrap_or_else(|| "auto".to_owned()),
            height.clone().unwrap_or_else(|| "auto".to_owned())
        ),
    };
    let _ = writeln!(out, "│   ┌{}┐   │", "─".repeat(inner - 8));
    line(&mut out, "│   │ ", &content, "│   │", inner - 9);
    if let Some((_, columns, _)) = &layout
        && !columns.is_empty()
    {
        let cell = ((inner - 8) / columns.len()).max(2) - 1;
        let row: Vec<String> = columns.iter().map(|_| "▒".repeat(cell)).collect();
        line(&mut out, "│   │", &row.join("│"), "│   │", inner - 8);
    }
    let _ = writeln!(out, "│   └{}┘   │", "─".repeat(inner - 8));
    let _ = writeln!(out, "└{}┘", "─".repeat(inner));
    if let Some((line, ..)) = &layout {
        let _ = writeln!(out, "  {line}");
    }
    Some(out)
}

/// A colour as `#rrggbb` (or `#rrggbbaa`), for a swatch.
fn hex(css: &str) -> Option<String> {
    let colour = parse(css)?;
    let byte = |name: &str| (colour[name].as_f64().unwrap_or(0.0) * 255.0).round() as u8;
    let alpha = byte("alpha");
    Some(if alpha == 255 {
        format!("#{:02x}{:02x}{:02x}", byte("red"), byte("green"), byte("blue"))
    } else {
        format!("#{:02x}{:02x}{:02x}{alpha:02x}", byte("red"), byte("green"), byte("blue"))
    })
}

/// The light and dark colour of an entry, when it is a colour.
pub(crate) fn colours(entry: &Entry) -> Option<(String, Option<String>)> {
    if let Some(token) = entry.tokens.first() {
        let light = hex(&token.light);
        let dark = token.dark.as_deref().and_then(hex);
        if let Some(light) = light {
            return Some((light, dark));
        }
    }
    if let Some((light, dark)) = kirana_project::split_light_dark(&entry.value) {
        return Some((hex(&light)?, hex(&dark)));
    }
    Some((hex(&entry.value)?, None))
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// A length in pixels, when it is one (`1rem` at 16px, `12px`).
fn length_px(value: &str) -> Option<f64> {
    let value = value.trim();
    if let Some(rem) = value.strip_suffix("rem") {
        return rem.parse::<f64>().ok().map(|rem| rem * 16.0);
    }
    value.strip_suffix("px").and_then(|px| px.parse().ok())
}

/// The box model as DevTools draws it, for clients that render images: margin, border, padding
/// and content nested, each side's value on its side, the content's size and layout in the middle,
/// the corners rounded by the border radius. `None` when the style sets none of it.
pub(crate) fn box_svg(resolved: &Resolved, theme: Theme, compact: bool) -> Option<String> {
    let margin = ["top", "right", "bottom", "left"].map(|name| side(resolved, "margin", name).map(shown));
    let border = ["top", "right", "bottom", "left"].map(|name| side(resolved, "border-width", name).map(shown));
    let padding = ["top", "right", "bottom", "left"].map(|name| side(resolved, "padding", name).map(shown));
    let width = base(resolved, &["width", "inline-size", "max-width"]);
    let height = base(resolved, &["height", "block-size"]);
    let display = base(resolved, &["display"]).map(|entry| entry.value.clone());
    let any = |sides: &[Option<String>; 4]| sides.iter().any(Option::is_some);
    if !any(&margin) && !any(&border) && !any(&padding) && width.is_none() && height.is_none() && display.is_none() {
        return None;
    }
    let (ink, muted) = (theme.ink(), theme.muted());
    // A hover is only as tall as the room beside the line: compact sits beside the property list.
    let (w, h, sx, sy) = if compact { (236, 128, 22, 14) } else { (320, 150, 26, 16) };
    // Side bands hold this many characters; the content's size is set smaller when compact.
    let (band, value_size, content_size) = if compact { (3, 9, 9) } else { (4, 10, 11) };
    let font = "font-family=\"ui-monospace,SFMono-Regular,Menlo,Consolas,monospace\"";
    let radius =
        base(resolved, &["border-radius"]).and_then(|entry| length_px(&entry.value)).map_or(3.0, |px| px.min(16.0));
    let mut body = String::new();
    // One layer: its rectangle, its name, and its four values.
    let mut layer = |name: &str,
                     rect: (i32, i32, i32, i32),
                     fill: &str,
                     stroke: &str,
                     extra: &str,
                     rx: f64,
                     sides: &[Option<String>; 4]| {
        let (x, y, width, height) = rect;
        let _ = write!(
            body,
            "<rect x=\"{x}\" y=\"{y}\" width=\"{width}\" height=\"{height}\" rx=\"{rx}\" fill=\"{fill}\" stroke=\"{stroke}\"{extra}/>"
        );
        let _ = write!(
            body,
            "<text x=\"{}\" y=\"{}\" fill=\"{muted}\" {font} font-size=\"8\" letter-spacing=\".06em\">{name}</text>",
            x + 5,
            y + 9
        );
        let (cx, cy) = (x + width / 2, y + height / 2);
        // The left and right bands hold `band` characters: a longer value there is left to the top
        // when it matches the top's, and cut otherwise.
        let value = |index: usize| {
            let text = sides[index].as_deref().unwrap_or("–");
            let narrow = index % 2 == 1 && text.chars().count() > band;
            if narrow && sides[index] == sides[0] {
                String::new()
            } else if narrow {
                escape(&format!("{}…", text.chars().take(3).collect::<String>()))
            } else {
                escape(text)
            }
        };
        for (index, (tx, ty)) in
            [(cx, y + 10), (x + width - sx / 2, cy + 3), (cx, y + height - 3), (x + sx / 2, cy + 3)]
                .into_iter()
                .enumerate()
        {
            let colour = if sides[index].is_some() { ink } else { muted };
            let _ = write!(
                body,
                "<text x=\"{tx}\" y=\"{ty}\" text-anchor=\"middle\" fill=\"{colour}\" {font} font-size=\"{value_size}\">{}</text>",
                value(index)
            );
        }
    };
    let inset = |level: i32| (4 + level * sx, 4 + level * sy, w - 8 - 2 * level * sx, h - 8 - 2 * level * sy);
    layer("MARGIN", inset(0), "#f9731618", "#f97316", " stroke-dasharray=\"4 3\"", 4.0, &margin);
    layer("BORDER", inset(1), "#eab30824", "#ca8a04", "", radius, &border);
    layer("PADDING", inset(2), "#22c55e22", "#16a34a", "", (radius - 2.0).max(2.0), &padding);
    let (cx, cy, cw, ch) = inset(3);
    let _ = write!(
        body,
        "<rect x=\"{cx}\" y=\"{cy}\" width=\"{cw}\" height=\"{ch}\" rx=\"2\" fill=\"#3b82f633\" stroke=\"#3b82f6\"/>"
    );
    let size = match (width, height) {
        (None, None) => "auto".to_owned(),
        (width, height) => format!(
            "{} × {}",
            width.map_or("auto".to_owned(), |entry| {
                if entry.property == "max-width" { format!("≤ {}", shown(entry)) } else { shown(entry) }
            }),
            height.map_or("auto".to_owned(), shown)
        ),
    };
    let _ = write!(
        body,
        "<text x=\"{}\" y=\"{}\" text-anchor=\"middle\" fill=\"{ink}\" {font} font-size=\"{content_size}\" font-weight=\"600\">{}</text>",
        w / 2,
        cy + ch / 2 + (if display.is_some() { 0 } else { 4 }),
        escape(&size)
    );
    if let Some(display) = &display {
        let _ = write!(
            body,
            "<text x=\"{}\" y=\"{}\" text-anchor=\"middle\" fill=\"{muted}\" {font} font-size=\"9\">({})</text>",
            w / 2,
            cy + ch / 2 + 12,
            escape(display)
        );
    }
    Some(format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\">{body}</svg>"
    ))
}

/// A 12px colour swatch; a colour pair is split diagonally, light above dark.
pub(crate) fn swatch(light: &str, dark: Option<&str>, theme: Theme) -> String {
    let edge = theme.muted();
    let fill = match dark {
        Some(dark) if dark != light => {
            format!("<path d=\"M0 0H12L0 12Z\" fill=\"{light}\"/><path d=\"M12 0V12H0Z\" fill=\"{dark}\"/>")
        }
        _ => format!("<rect width=\"12\" height=\"12\" fill=\"{light}\"/>"),
    };
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"12\" height=\"12\" viewBox=\"0 0 12 12\">{fill}<rect x=\".5\" y=\".5\" width=\"11\" height=\"11\" rx=\"2\" fill=\"none\" stroke=\"{edge}\"/></svg>"
    )
}

/// A Markdown image of an SVG, as a `data:` URI.
pub(crate) fn image(svg: &str) -> String {
    format!("![style]({})", data_uri(svg))
}

/// An SVG as a `data:` URI.
pub(crate) fn data_uri(svg: &str) -> String {
    format!("data:image/svg+xml;base64,{}", base64(svg.as_bytes()))
}

fn base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        for (index, shift) in [18, 12, 6, 0].into_iter().enumerate() {
            if index <= chunk.len() {
                out.push(ALPHABET[(n >> shift & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_matches_the_standard_encoding() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"<svg/>"), "PHN2Zy8+");
    }

    fn entry(property: &str, value: &str, tokens: Vec<crate::model::Token>) -> Entry {
        Entry {
            property: property.to_owned(),
            value: value.to_owned(),
            conditions: Vec::new(),
            target: String::new(),
            group: crate::model::Group::of(property),
            tokens,
            rank: 0,
            class: String::new(),
            rule: String::new(),
            source: None,
            pixels: None,
        }
    }

    fn token(light: &str, dark: Option<&str>) -> crate::model::Token {
        crate::model::Token { identity: "color.x".to_owned(), light: light.to_owned(), dark: dark.map(str::to_owned) }
    }

    #[test]
    fn four_sides_read_as_their_shorthand() {
        let sides = |values: [&str; 4]| values.map(|value| Some(value.to_owned()));
        assert_eq!(label(&sides(["1px", "1px", "1px", "1px"])), "1px");
        assert_eq!(label(&sides(["1px", "2px", "1px", "2px"])), "1px 2px");
        assert_eq!(label(&sides(["1px", "2px", "3px", "2px"])), "1px 2px 3px");
        assert_eq!(label(&sides(["1px", "2px", "3px", "4px"])), "1px 2px 3px 4px");
        assert_eq!(label(&[None, None, None, Some("1px".to_owned())]), "0 0 0 1px");
    }

    #[test]
    fn lengths_in_pixels() {
        assert_eq!(length_px("0.5rem"), Some(8.0));
        assert_eq!(length_px(" 12px "), Some(12.0));
        assert_eq!(length_px("50%"), None);
    }

    #[test]
    fn colours_from_tokens_pairs_and_literals() {
        assert_eq!(
            colours(&entry("color", "var(--a)", vec![token("#fff", Some("#000"))])),
            Some(("#ffffff".to_owned(), Some("#000000".to_owned())))
        );
        // A token whose value is no colour falls back to the value, which is none either.
        assert_eq!(colours(&entry("color", "var(--a)", vec![token("inherit", None)])), None);
        assert_eq!(
            colours(&entry("color", "light-dark(#fff, #000)", vec![])),
            Some(("#ffffff".to_owned(), Some("#000000".to_owned())))
        );
        assert_eq!(colours(&entry("color", "light-dark(currentcolor, #000)", vec![])), None);
        assert_eq!(colours(&entry("color", "#ff000080", vec![])), Some(("#ff000080".to_owned(), None)));
        assert_eq!(colours(&entry("color", "currentcolor", vec![])), None);
    }

    #[test]
    fn values_as_drawn() {
        assert_eq!(shown(&entry("padding", "var(--k)", vec![token("1rem", None)])), "color.x");
        assert_eq!(shown(&entry("width", "calc(100% - var(--k))", vec![token("1rem", None)])), "calc(100% - var(-…");
        assert_eq!(shown(&entry("width", "10rem", vec![])), "10rem");
    }

    fn resolved(entries: Vec<Entry>) -> Resolved {
        Resolved { kind: "sx", entries, conditions: Vec::new(), switches: Vec::new() }
    }

    #[test]
    fn layouts_and_sizes_as_drawn() {
        // One column is singular; a height alone leaves the width automatic.
        let grid = resolved(vec![entry("display", "grid", vec![]), entry("grid-template-columns", "1fr", vec![])]);
        assert_eq!(layout_line(&grid).unwrap().0, "grid · 1 col");
        let tall = resolved(vec![entry("padding", "1px", vec![]), entry("height", "2rem", vec![])]);
        assert!(text(&tall).unwrap().contains("auto × 2rem"));
        // A capped width reads as a bound; a set width as itself.
        let capped = box_svg(&resolved(vec![entry("max-width", "18rem", vec![])]), Theme::Light, false).unwrap();
        assert!(capped.contains("≤ 18rem × auto"), "{capped}");
        let set = box_svg(&resolved(vec![entry("width", "10rem", vec![])]), Theme::Dark, true).unwrap();
        assert!(set.contains("10rem × auto"), "{set}");
    }

    #[test]
    fn tracks_expand_repeat_and_split_lists() {
        assert_eq!(tracks("1fr  2fr "), ["1fr", "2fr"]);
        assert!(tracks("").is_empty());
        assert_eq!(tracks("repeat(3, 1fr)"), ["1fr", "1fr", "1fr"]);
        assert_eq!(tracks("200px minmax(0, 1fr) auto"), ["200px", "minmax(0, 1fr)", "auto"]);
        assert_eq!(tracks("repeat(auto-fill, 10rem)"), ["repeat(auto-fill, 10rem)"]);
        assert_eq!(tracks("repeat(99, 1fr)").len(), 12);
    }
}
