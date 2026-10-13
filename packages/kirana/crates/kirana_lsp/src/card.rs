//! The style card (KRN-DX-013): what a style does, laid out for reading in a hover or an inline
//! summary's tooltip — a header naming the style and the handles it merges, the box model drawn
//! as DevTools draws it, the resolved properties, the values that depend on a condition, and the
//! compiled CSS.

use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::path::Path;

use kirana_project::SiteAtom;
use serde_json::json;

use crate::Server;
use crate::diagram::{self, Theme};
use crate::model::{self, Entry, Resolved};
use crate::summary::{is_binding, short_condition};
use crate::text::path_to_uri;

/// Rows the resolved table shows before it counts the rest.
const ROWS: usize = 8;

/// Properties listed beside the box model, where they cost no height of their own.
const BESIDE: usize = 10;

/// A property name in its group's colour (`editors/brand/palette.json`). Plain text for clients
/// without HTML in hovers.
fn paint(property: &str, group: model::Group, html: bool) -> String {
    if !html {
        return property.to_owned();
    }
    let colour = crate::brand::colour(group.name());
    format!("<span style=\"color:{colour};\">{property}</span>")
}

/// The card for the site spanning `span`.
pub(crate) fn card(server: &Server, path: &Path, text: &str, span: (usize, usize), atoms: &[SiteAtom]) -> String {
    let resolved = model::resolve(server, path, text, span, atoms);
    render(server, path, text, span, atoms, &resolved)
}

pub(crate) fn render(
    server: &Server,
    path: &Path,
    text: &str,
    span: (usize, usize),
    atoms: &[SiteAtom],
    resolved: &Resolved,
) -> String {
    let site = &text[span.0..span.1];
    let images = server.options.images;
    let mut out = String::new();
    header(&mut out, site, resolved, atoms.len(), images);
    let theme = server.options.theme;
    // With HTML, the box model and the properties sit side by side: half the height.
    let html = server.options.html;
    let picture = images.then(|| diagram::box_svg(resolved, theme, html)).flatten();
    let beside = html && picture.is_some();
    if !beside {
        match &picture {
            Some(svg) => {
                let _ = write!(out, "{}\n\n", diagram::image(svg));
            }
            None => {
                if let Some(drawing) = diagram::text(resolved) {
                    let _ = write!(out, "```text\n{drawing}```\n\n");
                }
            }
        }
    }
    // In source order within each group.
    let base: Vec<(usize, &Entry)> = resolved
        .entries
        .iter()
        .enumerate()
        .filter(|(_, entry)| entry.conditions.is_empty() && entry.target.is_empty() && guard(entry).is_none())
        .collect();
    let mut sorted = base.clone();
    sorted.sort_by_key(|(index, entry)| (entry.group, *index));
    let sorted: Vec<&Entry> = sorted.into_iter().map(|(_, entry)| entry).collect();
    let rows = rows(&sorted, images, theme);
    let more = |shown: usize| {
        let link = if server.options.commands {
            format!(" — [open the inspector]({})", inspect_link(path, span))
        } else {
            String::new()
        };
        format!("*{} more{link}*", rows.len() - shown)
    };
    if beside {
        let mut lines: Vec<String> = rows
            .iter()
            .take(BESIDE)
            .map(|(property, value, group)| format!("{} {value}", paint(property, *group, html)))
            .collect();
        if rows.len() > BESIDE {
            lines.push(more(BESIDE));
        }
        let image = diagram::image(picture.as_deref().unwrap_or_default());
        let _ = write!(out, "| Box model | Resolved |\n|:--|:--|\n| {image} | {} |\n\n", lines.join("<br>"));
    } else if !rows.is_empty() {
        out.push_str("**Resolved**\n\n| Property | Value |\n|:--|:--|\n");
        for (property, value, group) in rows.iter().take(ROWS) {
            let _ = writeln!(out, "| {} | {value} |", paint(property, *group, html));
        }
        if rows.len() > ROWS {
            let _ = writeln!(out, "| | {} |", more(ROWS));
        }
        out.push('\n');
    }
    // Values that depend on a breakpoint, a state, a target or a guard in the `sx`.
    let mut conditional: BTreeMap<String, Vec<&Entry>> = BTreeMap::new();
    for entry in resolved.effective() {
        let mut when: Vec<String> = Vec::new();
        if let Some(guard) = guard(entry) {
            when.push(format!("if {guard}"));
        }
        when.extend(entry.conditions.iter().map(|condition| breakpoint(condition)));
        if !entry.target.is_empty() {
            when.push(entry.target.clone());
        }
        if !when.is_empty() {
            conditional.entry(when.join(" ")).or_default().push(entry);
        }
    }
    if !conditional.is_empty() {
        out.push_str("**When**\n\n| Condition | Property | Value |\n|:--|:--|:--|\n");
        for (when, entries) in &conditional {
            for (index, entry) in entries.iter().enumerate() {
                let label = if index == 0 { format!("`{}`", escape(when)) } else { String::new() };
                let property = paint(&entry.property, entry.group, html);
                let _ = writeln!(out, "| {label} | {property} | {} |", value_cell(entry, images, theme));
            }
        }
        out.push('\n');
    }
    let rules: Vec<&str> = atoms.iter().map(|atom| atom.rule.as_str()).collect();
    let bytes: usize = rules.iter().map(|rule| rule.len() + 1).sum();
    let _ =
        write!(out, "**Compiled CSS** · {} · {:.2} kB\n\n```css\n", plural(rules.len(), "rule"), bytes as f64 / 1024.0);
    for atom in atoms {
        out.push_str(&crate::hover::pretty_rule(atom));
        out.push('\n');
    }
    out.push_str("```\n");
    if server.options.commands {
        let uri = path_to_uri(path);
        let _ = write!(
            out,
            "\n[Open inspector]({}) · [Show compiled CSS]({})\n",
            inspect_link(path, span),
            crate::hover::command_link(crate::actions::SHOW_CSS, &json!([uri, span.0]))
        );
    }
    out
}

/// The resolved table's rows: one per property, and one for padding or margin set on all four
/// sides, written as the shorthand (`margin | .5rem 1rem`).
fn rows(entries: &[&Entry], images: bool, theme: Theme) -> Vec<(String, String, model::Group)> {
    let mut out = Vec::new();
    let mut merged: Vec<&str> = Vec::new();
    for entry in entries {
        if merged.contains(&entry.property.as_str()) {
            continue;
        }
        let shorthand = ["padding", "margin"].into_iter().find(|name| entry.property.starts_with(&format!("{name}-")));
        if let Some(name) = shorthand {
            let sides: Vec<&&Entry> = ["top", "right", "bottom", "left"]
                .iter()
                .filter_map(|side| entries.iter().find(|other| other.property == format!("{name}-{side}")))
                .collect();
            if sides.len() == 4 {
                let values = [0, 1, 2, 3].map(|index| Some(sides[index].value.clone()));
                out.push((name.to_owned(), format!("`{}`", escape_code(&diagram::label(&values))), model::Group::Box));
                merged.extend(sides.iter().map(|side| side.property.as_str()));
                continue;
            }
        }
        out.push((entry.property.clone(), value_cell(entry, images, theme), entry.group));
    }
    out
}

/// `**Kirana** · \`styles.card\`` and, for an element, the handles its `sx` merges.
fn header(out: &mut String, site: &str, resolved: &Resolved, declarations: usize, images: bool) {
    let kind = resolved.kind;
    // The brand's icon leads the card, where the client shows images.
    if images {
        let _ = write!(out, "{} ", crate::brand::icon(14));
    }
    if !is_binding(site) {
        let _ = write!(out, "**Kirana** · `{kind}` · {}\n\n", plural(declarations, "declaration"));
        return;
    }
    let expression = expression(site);
    let note = if kind == "utility string" { " · utility string" } else { "" };
    let _ = write!(out, "**Kirana** · `{}`{note}\n\n", escape_code(&expression));
    let sources = resolved.sources();
    if sources.is_empty() {
        return;
    }
    let links: Vec<String> = sources
        .iter()
        .map(|source| {
            let when = source.when.as_ref().map(|when| format!(" if `{}`", escape_code(when))).unwrap_or_default();
            format!("[`{}`]({}#L{}){when}", escape_code(&source.label), source.uri, source.line + 1)
        })
        .collect();
    let lead = if sources.len() == 1 { "From".to_owned() } else { format!("Merges {} handles:", sources.len()) };
    let _ = write!(out, "{lead} {} · {}\n\n", links.join(" + "), plural(declarations, "declaration"));
}

/// The expression an element's `sx` holds: `styles.card` in `sx={styles.card}`.
fn expression(site: &str) -> String {
    let inner = crate::summary::binding_expression(site);
    let flat: String = inner.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() > 60 { format!("{}…", flat.chars().take(59).collect::<String>()) } else { flat }
}

/// The `sx` guard an entry is applied under (`on` in `on && wide`).
fn guard(entry: &Entry) -> Option<&str> {
    entry.source.as_ref().and_then(|source| source.when.as_deref())
}

/// A value as the tables show it: the value, its pixels, the token it reads, a swatch for a colour.
fn value_cell(entry: &Entry, images: bool, theme: Theme) -> String {
    let mut cell = String::new();
    if images
        && entry.group == model::Group::Colour
        && let Some((light, dark)) = diagram::colours(entry)
    {
        let _ = write!(cell, "{} ", diagram::image(&diagram::swatch(&light, dark.as_deref(), theme)));
    }
    // A token reads as its name and its value, not as the custom property it compiles to.
    let token = entry.tokens.first().filter(|_| entry.value.starts_with("var("));
    if let Some(token) = token {
        let _ = write!(cell, "`{}`", token.identity);
        match &token.dark {
            Some(dark) if dark != &token.light => {
                let _ = write!(cell, " · `{}` / `{}`", escape_code(&token.light), escape_code(dark));
            }
            _ => {
                let _ = write!(cell, " · `{}`", escape_code(&token.light));
                if let Some(pixels) = model::pixels(&token.light, 16.0) {
                    let _ = write!(cell, " · {pixels}");
                }
            }
        }
        return cell;
    }
    let value = match kirana_project::split_light_dark(&entry.value) {
        Some((light, dark)) => format!("`{}` / `{}`", escape_code(&light), escape_code(&dark)),
        None => format!("`{}`", escape_code(&entry.value)),
    };
    cell.push_str(&value);
    if let Some(pixels) = &entry.pixels {
        let _ = write!(cell, " · {pixels}");
    }
    if let Some(token) = entry.tokens.first() {
        let _ = write!(cell, " · `{}`", token.identity);
    }
    cell
}

/// A condition as written, a preset breakpoint by its name (`md`).
fn breakpoint(condition: &str) -> String {
    let short = short_condition(condition);
    if short.starts_with('@') || condition.starts_with(':') && short == condition[1..] {
        condition.to_owned()
    } else {
        short
    }
}

fn inspect_link(path: &Path, span: (usize, usize)) -> String {
    crate::hover::command_link("kirana.inspect", &json!([path_to_uri(path), span.0]))
}

fn plural(n: usize, word: &str) -> String {
    format!("{n} {word}{}", if n == 1 { "" } else { "s" })
}

/// Text inside a table cell: the cell separator escaped.
fn escape(text: &str) -> String {
    text.replace('|', "\\|")
}

/// Text inside inline code in a table cell: backticks cannot be escaped there, so they become
/// quotes; the cell separator is escaped.
fn escape_code(text: &str) -> String {
    text.replace('`', "'").replace('|', "\\|")
}
