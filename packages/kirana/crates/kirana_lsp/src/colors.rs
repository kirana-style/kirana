//! Colour decorators (KRN-DX-003): swatches beside colour literals and colour tokens inside style
//! sites. A token's swatch shows its light value (hover shows both); the picker edits literals
//! only, never a token reference.

use std::collections::BTreeSet;

use lightningcss::traits::Parse;
use lightningcss::values::color::{CssColor, OKLCH, SRGB};
use serde_json::{Value, json};

use crate::hover::tokens_for;
use crate::text::LineIndex;
use crate::{Server, document};

pub fn document_colors(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text) = document(server, params)?;
    let index = LineIndex::new(&text);
    let spans: BTreeSet<(usize, usize)> =
        server.sites(&path).iter().map(|site| (site.span.start as usize, site.span.end as usize)).collect();
    let mut out = Vec::new();
    for (start, end) in spans {
        // A file changed on disk since it was compiled has spans its text no longer has.
        let Some(site) = text.get(start..end) else { continue };
        for (offset, length, colour) in literals(site).into_iter().chain(token_colours(server, site, &text)) {
            out.push(json!({ "range": index.range(start + offset, start + offset + length), "color": colour }));
        }
    }
    Ok(Value::Array(out))
}

/// Colour string literals in a site: `(offset of the content, length, colour)`.
fn literals(site: &str) -> Vec<(usize, usize, Value)> {
    let bytes = site.as_bytes();
    let mut out = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        let quote = bytes[index];
        if matches!(quote, b'"' | b'\'')
            && let Some(length) = site[index + 1..].find(quote as char)
        {
            let content = &site[index + 1..index + 1 + length];
            match kirana_project::split_light_dark(content) {
                // A pair is two colours: each half gets its own swatch, and the picker edits that
                // half alone, never collapsing the pair into one colour.
                Some((light, dark)) => {
                    let mut from = content.find('(').map_or(0, |open| open + 1);
                    for half in [light, dark] {
                        if let Some(at) = content[from..].find(half.as_str()).map(|at| from + at)
                            && let Some(colour) = parse(&half)
                        {
                            out.push((index + 1 + at, half.len(), colour));
                            from = at + half.len();
                        }
                    }
                }
                None => {
                    if let Some(colour) = parse(content) {
                        out.push((index + 1, length, colour));
                    }
                }
            }
            index += length + 2;
            continue;
        }
        index += 1;
    }
    out
}

/// Member chains in a site that name colour tokens.
fn token_colours(server: &Server, site: &str, text: &str) -> Vec<(usize, usize, Value)> {
    let mut out = Vec::new();
    let mut index = 0;
    while index < site.len() {
        // Only at the start of a character: a byte inside one (`—`) is no place to read a name.
        if !site.is_char_boundary(index) {
            index += 1;
            continue;
        }
        match crate::text::chain_at(site, index) {
            Some((chain, start, end)) if start >= index => {
                if let Some(token) = tokens_for(server, chain, text).into_iter().next() {
                    let shown = token.light.as_deref().unwrap_or(&token.value);
                    if let Some(colour) = parse(shown) {
                        out.push((start, end - start, colour));
                    }
                }
                index = end.max(index + 1);
            }
            _ => index += 1,
        }
    }
    out
}

/// A CSS colour as LSP's sRGB components, `None` for anything that is not a colour (`currentcolor`,
/// system colours, `light-dark()` shows its light side).
pub(crate) fn parse(text: &str) -> Option<Value> {
    let colour = CssColor::parse_string(text.trim()).ok()?;
    let colour = match colour {
        CssColor::LightDark(light, _) => *light,
        other => other,
    };
    let srgb = SRGB::try_from(&colour).ok()?;
    // Not `clamp`: `max` returns the other operand for NaN, which a `none` component produces.
    #[allow(clippy::manual_clamp)]
    let clamp = |value: f32| value.max(0.0).min(1.0);
    Some(json!({ "red": clamp(srgb.r), "green": clamp(srgb.g), "blue": clamp(srgb.b), "alpha": clamp(srgb.alpha) }))
}

/// The ways to write a picked colour: hex, `rgb()` and `oklch()`. Only for a literal; a range that
/// holds a token reference gets none, so the picker cannot overwrite a token.
pub fn presentations(server: &Server, params: &Value) -> Result<Value, String> {
    let (_, text) = document(server, params)?;
    let range: lsp_types::Range =
        serde_json::from_value(params.get("range").cloned().unwrap_or_default()).map_err(|error| error.to_string())?;
    let index = LineIndex::new(&text);
    let written = &text[index.offset(range.start)..index.offset(range.end)];
    if parse(written).is_none() {
        return Ok(json!([]));
    }
    let colour: lsp_types::Color =
        serde_json::from_value(params.get("color").cloned().unwrap_or_default()).map_err(|error| error.to_string())?;
    let byte = |value: f32| (value.clamp(0.0, 1.0) * 255.0).round() as u8;
    let (r, g, b, a) = (byte(colour.red), byte(colour.green), byte(colour.blue), byte(colour.alpha));
    let hex = if a == 255 { format!("#{r:02x}{g:02x}{b:02x}") } else { format!("#{r:02x}{g:02x}{b:02x}{a:02x}") };
    let alpha = if a == 255 { String::new() } else { format!(" / {}", round(colour.alpha, 3)) };
    let srgb = SRGB { r: colour.red, g: colour.green, b: colour.blue, alpha: colour.alpha };
    let oklch = OKLCH::from(srgb);
    let oklch = format!("oklch({} {} {}{alpha})", round(oklch.l, 3), round(oklch.c, 3), round(oklch.h, 1));
    let rgb = format!("rgb({r} {g} {b}{alpha})");
    // The format the colour is written in comes first: the picker shows and writes it, and its
    // header cycles through the others.
    let written = written.trim_start();
    let mut labels = if written.starts_with("oklch") {
        vec![oklch, hex, rgb]
    } else if written.starts_with("rgb") {
        vec![rgb, hex, oklch]
    } else {
        vec![hex, rgb, oklch]
    };
    labels.dedup();
    Ok(Value::Array(
        labels
            .into_iter()
            .map(|label| json!({ "label": label, "textEdit": { "range": range, "newText": label } }))
            .collect(),
    ))
}

fn round(value: f32, places: i32) -> String {
    let factor = 10f32.powi(places);
    // Every component written here is non-negative; an achromatic hue is NaN, written as 0.
    let rounded = (value.max(0.0) * factor).round() / factor;
    let text = format!("{rounded}");
    text.strip_suffix(".0").map(str::to_owned).unwrap_or(text)
}
