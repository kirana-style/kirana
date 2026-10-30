//! Code actions (KRN-DX-007): quick fixes for diagnostics that have one exact fix, "Show compiled
//! CSS", "Explain precedence", and "Convert Tailwind classes to `css()`" through the migration
//! engine (`kirana-style migrate tailwind`, D-058).

use std::collections::BTreeSet;
use std::path::Path;

use kirana_migrate::environment::ProjectEnvironment;
use kirana_migrate::tailwind::{Options, ProjectMap};
use serde_json::{Value, json};

use crate::hover::{Focus, atoms_of, key_at, site_at};
use crate::text::{LineIndex, path_to_uri, string_at, uri_to_path};
use crate::{Server, document};

/// `[uri, offset?]` → `{ language: "css", content }`: the compiled CSS of one site, or of every site
/// in the document.
pub const SHOW_CSS: &str = "kirana.showCompiledCss";
/// `[uri, line, property]` → `{ content }`: the property's entries at that line, strongest first.
pub const EXPLAIN: &str = "kirana.explainPrecedence";
/// `[uri, offset]` → a workspace edit: the class string at the offset as `sx={css({…})}`.
pub const CONVERT: &str = "kirana.convertTailwind";
/// `[uri, offset]` → the locations of the elements the `css()` or `recipe()` at the offset reaches.
pub const SHOW_USES: &str = "kirana.showUses";

/// The breakpoint "vary at a breakpoint" writes: the preset's `md`.
const BREAKPOINT: &str = "@media (width >= 48rem)";

pub fn code_actions(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text) = document(server, params)?;
    let index = LineIndex::new(&text);
    let range: lsp_types::Range =
        serde_json::from_value(params.get("range").cloned().unwrap_or_default()).map_err(|error| error.to_string())?;
    let offset = index.offset(range.start);
    let uri = path_to_uri(&path);
    let mut out = Vec::new();
    for diagnostic in params.pointer("/context/diagnostics").and_then(Value::as_array).into_iter().flatten() {
        if let Some(fix) = quick_fix(&text, &index, diagnostic, &uri) {
            out.push(fix);
        }
    }
    if let Some((span, _)) = site_at(server, &path, &text, offset) {
        out.push(json!({
            "title": "Kirana: show compiled CSS",
            "kind": "source",
            "command": { "title": "Show compiled CSS", "command": SHOW_CSS, "arguments": [uri, span.0] },
        }));
        if let Some(Focus::Property(property)) = key_at(&text, offset) {
            let line = range.start.line + 1;
            out.push(json!({
                "title": format!("Kirana: explain precedence of {property}"),
                "kind": "source",
                "command": { "title": "Explain precedence", "command": EXPLAIN, "arguments": [uri, line, property] },
            }));
        }
    }
    if let Some(edit) = convert(server, &path, &text, offset) {
        out.push(json!({ "title": edit.0, "kind": "refactor.rewrite", "edit": edit.1 }));
    }
    let edits = [extract(server, &path, &text, offset), inline(server, &path, &text, offset)];
    for (title, kind, changes) in edits.into_iter().flatten().chain(vary(server, &path, &text, offset)) {
        out.push(json!({ "title": title, "kind": kind, "edit": { "changes": { uri.as_str(): changes } } }));
    }
    Ok(Value::Array(out))
}

/// The one exact fix some diagnostics have: a unit for a unitless length, the nearest property for
/// a misspelled one.
fn quick_fix(text: &str, index: &LineIndex<'_>, diagnostic: &Value, uri: &lsp_types::Uri) -> Option<Value> {
    let code = diagnostic.pointer("/data/code").and_then(Value::as_str)?;
    let range: lsp_types::Range = serde_json::from_value(diagnostic.get("range")?.clone()).ok()?;
    let (start, end) = (index.offset(range.start), index.offset(range.end));
    let written = &text[start..end];
    let (title, edit_start, edit_end, replacement) = match code {
        // `width: 5` → `width: "5px"`.
        "KRN1203" => {
            let colon = written.find(':')?;
            let after = &written[colon + 1..];
            let value = after.trim();
            let at = start + colon + 1 + (after.len() - after.trim_start().len());
            value.parse::<f64>().ok()?;
            (format!("Write \"{value}px\""), at, at + value.len(), format!("\"{value}px\""))
        }
        // `colour: "red"` → `color: "red"`.
        "KRN1201" => {
            let key_end = written.find(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))?;
            let key = &written[..key_end];
            let kebab = kirana_shared::kebab_case(key);
            let nearest = nearest_property(&kebab).filter(|nearest| *nearest != kebab)?;
            let camel = camel(nearest);
            (format!("Change to {camel}"), start, start + key_end, camel)
        }
        _ => return None,
    };
    Some(json!({
        "title": title,
        "kind": "quickfix",
        "diagnostics": [diagnostic],
        "isPreferred": true,
        "edit": { "changes": { uri.as_str(): [{ "range": index.range(edit_start, edit_end), "newText": replacement }] } },
    }))
}

/// The known property closest to a misspelled one, within two edits.
fn nearest_property(name: &str) -> Option<&'static str> {
    kirana_css_data::generated::PROPERTIES
        .iter()
        .map(|property| (distance(name, property), *property))
        .filter(|(distance, _)| *distance <= 2)
        .min()
        .map(|(_, property)| property)
}

fn distance(a: &str, b: &str) -> usize {
    let b: Vec<char> = b.chars().collect();
    let mut row: Vec<usize> = (0..=b.len()).collect();
    for (i, ca) in a.chars().enumerate() {
        let mut previous = row[0];
        row[0] = i + 1;
        for (j, cb) in b.iter().enumerate() {
            let current = row[j + 1];
            row[j + 1] = (previous + usize::from(ca != *cb)).min(row[j] + 1).min(current + 1);
            previous = current;
        }
    }
    row[b.len()]
}

fn camel(kebab: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for character in kebab.chars() {
        if character == '-' {
            upper = !out.is_empty();
        } else if upper {
            out.extend(character.to_uppercase());
            upper = false;
        } else {
            out.push(character);
        }
    }
    out
}

pub fn execute(server: &Server, params: &Value) -> Result<Value, String> {
    let command = params.get("command").and_then(Value::as_str).unwrap_or_default();
    let arguments = params.get("arguments").and_then(Value::as_array).cloned().unwrap_or_default();
    let uri: lsp_types::Uri = serde_json::from_value(arguments.first().cloned().unwrap_or_default())
        .map_err(|error| format!("{command}: {error}"))?;
    let path = uri_to_path(&uri).ok_or("not a file URI")?;
    let text = server.source(&path).ok_or_else(|| format!("cannot read {}", path.display()))?;
    match command {
        SHOW_CSS => {
            let only = arguments.get(1).and_then(Value::as_u64);
            Ok(json!({ "language": "css", "content": compiled_css(server, &path, &text, only) }))
        }
        EXPLAIN => {
            let line = arguments.get(1).and_then(Value::as_u64).ok_or("explain: missing line")? as usize;
            let property = arguments.get(2).and_then(Value::as_str).ok_or("explain: missing property")?;
            let trace = server.trace(&path, &text, line, property);
            let mut content = format!("# {property} at {}:{line}\n\n", server.project.display_name(&path));
            if trace.is_empty() {
                content.push_str("Nothing on this line sets it.\n");
            }
            for (position, entry) in trace.iter().enumerate() {
                let marker = if position == 0 { "wins" } else { "loses" };
                content.push_str(&format!(
                    "{}. `{}` at `{}` ({}, `{}`) — {marker}{}\n",
                    position + 1,
                    entry.value,
                    entry.context(),
                    entry.layer,
                    entry.class,
                    if entry.reason.is_empty() { String::new() } else { format!(": {}", entry.reason) }
                ));
            }
            Ok(json!({ "content": content }))
        }
        CONVERT => {
            let offset = arguments.get(1).and_then(Value::as_u64).ok_or("convert: missing offset")? as usize;
            Ok(convert(server, &path, &text, offset).map_or(Value::Null, |(_, edit)| edit))
        }
        SHOW_USES => {
            let offset = arguments.get(1).and_then(Value::as_u64).ok_or("uses: missing offset")? as usize;
            Ok(crate::outline::show_uses(server, &path, &text, offset))
        }
        _ => Err(format!("unknown command {command}")),
    }
}

/// The CSS of one site (`only` is its start), or of every site in the file, each under a comment
/// naming its line.
fn compiled_css(server: &Server, path: &Path, text: &str, only: Option<u64>) -> String {
    let sites = server.sites(path);
    let index = LineIndex::new(text);
    let spans: BTreeSet<(u32, u32)> = sites
        .iter()
        .map(|site| (site.span.start, site.span.end))
        .filter(|span| only.is_none_or(|start| u64::from(span.0) == start))
        .collect();
    let mut out = format!("/* {} — compiled by Kirana */\n", server.project.display_name(path));
    for span in spans {
        let line = index.position(span.0 as usize).line + 1;
        let label = text[span.0 as usize..span.1 as usize].lines().next().unwrap_or_default();
        let label: String = label.chars().take(60).collect();
        out.push_str(&format!("\n/* line {line}: {} */\n", label.replace("*/", "* /")));
        for atom in atoms_of(&sites, span) {
            out.push_str(&atom.rule);
            out.push('\n');
        }
    }
    out
}

/// "Convert Tailwind classes to `css()`": a `className="…"` string at `offset` becomes
/// `sx={css({…})}`, lowered by the same engine as `kirana-style migrate tailwind`, with the imports the
/// object needs. Returns the action's title and workspace edit.
fn convert(server: &Server, path: &Path, text: &str, offset: usize) -> Option<(String, Value)> {
    let grammar = server.project.config().utilities.as_ref()?;
    let (start, end, quote) = string_at(text, offset)?;
    let before = text[..start - 1].trim_end().strip_suffix('=')?.trim_end();
    let attribute_start = before.strip_suffix("className")?.len();
    let classes = text[start..end].trim();
    if classes.is_empty() {
        return None;
    }
    // The classes in a file of their own next to the document, so relative imports resolve as
    // they would in it.
    let scratch = path.with_file_name("__kirana_convert__.tsx");
    let source =
        format!("export function K() {{\n  return <div className={}{classes}{} />\n}}\n", quote as char, quote as char);
    let empty = BTreeSet::new();
    let map = ProjectMap::default();
    let options = Options { grammar, custom_variants: &empty, custom_utilities: &empty, project: &map };
    let environment = ProjectEnvironment { project: &server.project, file: &scratch };
    let migration = kirana_migrate::tailwind::migrate(&scratch, &source, &options, &environment);
    // A class string that is only a relation anchor (`group`) compiles to no `css()`.
    let call = css_call(&migration.source)?;
    let index = LineIndex::new(text);
    let uri = path_to_uri(path);
    let mut edits = vec![json!({
        "range": index.range(attribute_start, end + 1),
        "newText": format!("sx={{{}}}", reindent(&call, &indentation(text, attribute_start))),
    })];
    let imports: Vec<&str> =
        migration.source.lines().filter(|line| line.starts_with("import ") && !imported(text, line)).collect();
    if !imports.is_empty() {
        edits.push(json!({ "range": index.range(0, 0), "newText": format!("{}\n", imports.join("\n")) }));
    }
    let notes = migration.notes.len();
    let title = if notes == 0 {
        "Kirana: convert Tailwind classes to css()".to_owned()
    } else {
        format!("Kirana: convert Tailwind classes to css() ({notes} left as comments)")
    };
    Some((title, json!({ "changes": { uri.as_str(): edits } })))
}

/// Whether the document already imports every name of `line` (`import { a, b } from "x"`) from the
/// same module.
fn imported(text: &str, line: &str) -> bool {
    let (names, module) = line.rsplit_once(" from ").unwrap_or((line, ""));
    let names: Vec<&str> = names
        .trim_start_matches("import")
        .trim()
        .trim_matches(|c| c == '{' || c == '}')
        .split(',')
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .collect();
    text.lines().any(|existing| {
        existing.starts_with("import ")
            && existing.ends_with(module)
            && names.iter().all(|name| {
                existing.split(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$')).any(|word| word == *name)
            })
    })
}

/// The `css(…)` call the codemod wrote for the classes. It writes the call as a styles-object entry,
/// closed by `})` on a line of its own at the entry's indentation; report comments inside may hold
/// unbalanced brackets, so the closing line is found rather than counted.
fn css_call(source: &str) -> Option<String> {
    let start = source.find("css(")?;
    let end = source[start..].find("\n  })").map_or(source.len(), |at| start + at + 5);
    Some(source[start..end].to_owned())
}

fn indentation(text: &str, offset: usize) -> String {
    let line_start = text[..offset].rfind('\n').map_or(0, |index| index + 1);
    text[line_start..].chars().take_while(|c| *c == ' ' || *c == '\t').collect()
}

/// The migrated call's lines, re-indented under the attribute's line.
fn reindent(call: &str, indent: &str) -> String {
    let mut lines = call.lines();
    let mut out = lines.next().unwrap_or_default().to_owned();
    // The codemod indents the call's lines under a two-space entry; they keep their depth below it.
    for line in lines {
        out.push('\n');
        out.push_str(indent);
        out.push_str(line);
    }
    out
}

/// One code action's text edits: `(title, kind, edits)`.
type Edit = (String, &'static str, Vec<Value>);

fn replace(index: &LineIndex<'_>, start: usize, end: usize, text: &str) -> Value {
    json!({ "range": index.range(start, end), "newText": text })
}

/// "Extract to `css()`": an inline `css({…})` in an element's `sx` becomes a named handle above the
/// statement that holds the element.
fn extract(server: &Server, path: &Path, text: &str, offset: usize) -> Option<Edit> {
    if server.is_component(path) {
        return None;
    }
    let (element, _) = site_at(server, path, text, offset)?;
    if !crate::summary::is_binding(&text[element.0..element.1]) {
        return None;
    }
    // The innermost `css(…)` call in the element's `sx` around the cursor: written inline, it is
    // part of the element's site rather than a site of its own.
    let call = text[element.0..element.1]
        .match_indices("css(")
        .filter(|(at, _)| element.0 + at <= offset)
        .filter_map(|(at, _)| {
            let start = element.0 + at;
            crate::summary::closing(text, start + 4)
                .filter(|close| *close >= offset && *close < element.1)
                .map(|close| (start, close + 1))
        })
        .last()?;
    let element = (element.0 as u32, element.1 as u32);
    // The statement at the top level holding the element: the nearest line above that starts at
    // column 0 with a declaration.
    let mut statement = text[..element.0 as usize].rfind('\n').map_or(0, |index| index + 1);
    loop {
        let line = &text[statement..];
        if ["export ", "function ", "const ", "let ", "class "].iter().any(|start| line.starts_with(start)) {
            break;
        }
        if statement == 0 {
            return None;
        }
        statement = text[..statement - 1].rfind('\n').map_or(0, |index| index + 1);
    }
    let tag = text[..element.0 as usize]
        .rfind('<')
        .map(|open| &text[open + 1..])
        .map(|rest| rest.split(|c: char| !(c.is_ascii_alphanumeric() || c == '_')).next().unwrap_or(""))
        .filter(|tag| !tag.is_empty())
        .unwrap_or("element");
    let mut stem: String = tag.chars().next().map(|first| first.to_ascii_lowercase()).into_iter().collect();
    stem.push_str(&tag[1..]);
    stem.push_str("Style");
    let taken = |name: &str| {
        text.split(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '$')).any(|word| word == name)
    };
    // The first of `h2Style`, `h2Style2` … the file does not use; the numbers never run out.
    let name = (1..)
        .map(|n| if n == 1 { stem.clone() } else { format!("{stem}{n}") })
        .find(|name| !taken(name))
        .unwrap_or_default();
    let index = LineIndex::new(text);
    let declaration = format!("const {name} = {}\n\n", text[call.0..call.1].trim());
    Some((
        format!("Kirana: extract to css() as {name}"),
        "refactor.extract",
        vec![replace(&index, statement, statement, &declaration), replace(&index, call.0, call.1, &name)],
    ))
}

/// "Inline style handle": a handle declared in this file with one use, in an element's `sx`, is
/// written at the use and its declaration removed.
fn inline(server: &Server, path: &Path, text: &str, offset: usize) -> Option<Edit> {
    let (chain, start, end) = crate::text::chain_at(text, offset)?;
    if chain.contains('.') {
        return None;
    }
    let (element, _) = site_at(server, path, text, offset)?;
    if !crate::summary::is_binding(&text[element.0..element.1]) {
        return None;
    }
    let definitions = crate::outline::definitions(server, path, text);
    let (call, ..) = definitions.iter().find(|(_, name, _)| name == chain)?;
    let uses = text
        .match_indices(chain)
        .filter(|(at, _)| {
            let before = text[..*at].chars().next_back();
            let after = text[at + chain.len()..].chars().next();
            let word = |c: Option<char>| c.is_some_and(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$');
            !word(before) && !word(after)
        })
        .count();
    // The declaration and this one use; an exported handle may be used elsewhere.
    let line_start = text[..call.0].rfind('\n').map_or(0, |index| index + 1);
    if uses != 2 || text[line_start..call.0].trim_start().starts_with("export") {
        return None;
    }
    let mut line_end = text[call.1..].find('\n').map_or(text.len(), |index| call.1 + index + 1);
    if text[line_end..].starts_with('\n') {
        line_end += 1;
    }
    let index = LineIndex::new(text);
    Some((
        format!("Kirana: inline {chain}"),
        "refactor.inline",
        vec![replace(&index, start, end, text[call.0..call.1].trim()), replace(&index, line_start, line_end, "")],
    ))
}

/// "Vary at md" and "vary on :hover": a plain property value in a `css()` becomes a conditional
/// value with the same value under the condition, ready to change.
fn vary(server: &Server, path: &Path, text: &str, offset: usize) -> Vec<Edit> {
    let Some((call, _)) = site_at(server, path, text, offset) else { return Vec::new() };
    if !text[call.0..call.1].starts_with("css(") {
        return Vec::new();
    }
    let Some(Focus::Property(property)) = key_at(text, offset) else { return Vec::new() };
    // `key_at` found a key followed by its colon.
    let colon = text[offset..call.1].find(':').map_or(offset, |at| offset + at);
    let value_start = colon + 1 + (text[colon + 1..].len() - text[colon + 1..].trim_start().len());
    if text[value_start..].starts_with('{') {
        return Vec::new();
    }
    let mut depth = 0usize;
    let mut value_end = value_start;
    for (at, byte) in text[value_start..call.1].bytes().enumerate() {
        match byte {
            b'(' | b'[' | b'{' => depth += 1,
            b')' | b']' if depth > 0 => depth -= 1,
            b',' | b'}' | b'\n' if depth == 0 => {
                value_end = value_start + at;
                break;
            }
            b'}' => depth -= 1,
            _ => {}
        }
    }
    // The site parsed, so the value after the key is never empty.
    let value = text[value_start..value_end].trim_end();
    let value_end = value_start + value.len();
    let index = LineIndex::new(text);
    [("at md", BREAKPOINT), ("on :hover", ":hover")]
        .into_iter()
        .map(|(label, condition)| {
            (
                format!("Kirana: vary {property} {label}"),
                "refactor.rewrite",
                vec![replace(
                    &index,
                    value_start,
                    value_end,
                    &format!("{{ base: {value}, \"{condition}\": {value} }}"),
                )],
            )
        })
        .collect()
}
