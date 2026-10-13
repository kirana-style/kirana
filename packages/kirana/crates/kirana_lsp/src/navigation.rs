//! Navigation (KRN-DX-006): from a token to its definition and its uses, from a relation read to
//! where its anchor is applied, and workspace symbols for tokens and relations.
//!
//! Tokens and relations are found through the compiler (where they are declared, which files anchor
//! and read a relation); uses inside a file are found by their written names.

use std::path::{Path, PathBuf};

use kirana_project::{RelationInfo, SCRIPT_EXTENSIONS, TokenInfo, collect_sources};
use serde_json::{Value, json};

use crate::hover::tokens_for;
use crate::text::{LineIndex, chain_at, path_to_uri};
use crate::{Server, document_position};

pub fn definition(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text, offset) = document_position(server, params)?;
    let Some((chain, _, _)) = chain_at(&text, offset) else { return Ok(Value::Null) };
    let tokens = tokens_for(server, chain, &text);
    if !tokens.is_empty() {
        return Ok(Value::Array(tokens.iter().filter_map(|token| token_location(server, token)).collect()));
    }
    let (local, member) = chain.split_once('.').map_or((chain, ""), |(local, member)| (local, member));
    let Some(relation) = relation_named(server, &path, &text, local) else { return Ok(Value::Null) };
    // A read jumps to the anchors; the relation itself (or `.anchor`) to its declaration.
    if matches!(member, "within" | "after" | "before") {
        let anchors = occurrences(server, &relation.anchored_in, &[".anchor"], Some(local));
        if !anchors.is_empty() {
            return Ok(Value::Array(anchors));
        }
    }
    Ok(Value::Array(declaration(server, &relation).into_iter().collect()))
}

pub fn references(server: &Server, params: &Value) -> Result<Value, String> {
    let (path, text, offset) = document_position(server, params)?;
    let Some((chain, _, _)) = chain_at(&text, offset) else { return Ok(Value::Null) };
    if let Some(token) = tokens_for(server, chain, &text).into_iter().next() {
        let mut needles = vec![chain.to_owned()];
        if token.identity != chain {
            needles.push(token.identity.clone());
        }
        let files = project_files(server);
        let needles: Vec<&str> = needles.iter().map(String::as_str).collect();
        return Ok(Value::Array(search(&files, &needles)));
    }
    let local = chain.split('.').next().unwrap_or(chain);
    let Some(relation) = relation_named(server, &path, &text, local) else { return Ok(Value::Null) };
    let mut files: Vec<String> = relation.declared_in.clone();
    files.extend(relation.anchored_in.iter().cloned());
    files.extend(relation.read_in.iter().cloned());
    files.sort();
    files.dedup();
    let needles: Vec<String> = ["anchor", "within(", "after(", "before("].iter().map(|m| format!(".{m}")).collect();
    let needles: Vec<&str> = needles.iter().map(String::as_str).collect();
    Ok(Value::Array(occurrences(server, &files, &needles, Some(local))))
}

pub fn symbols(server: &Server, params: &Value) -> Result<Value, String> {
    let query = params.get("query").and_then(Value::as_str).unwrap_or("").to_lowercase();
    let mut out = Vec::new();
    for token in server.project.tokens() {
        if token.identity.to_lowercase().contains(&query)
            && let Some(location) = token_location(server, &token)
        {
            out.push(json!({ "name": token.identity, "kind": 14, "location": location, "containerName": "token" }));
        }
    }
    for relation in server.project.relations() {
        if relation.name.to_lowercase().contains(&query)
            && let Some(location) = declaration(server, &relation)
        {
            out.push(json!({ "name": relation.name, "kind": 24, "location": location, "containerName": "relation" }));
        }
    }
    Ok(Value::Array(out))
}

fn location(path: &Path, text: &str, start: usize, end: usize) -> Value {
    let index = LineIndex::new(text);
    json!({ "uri": path_to_uri(path), "range": index.range(start, end) })
}

fn token_location(server: &Server, token: &TokenInfo) -> Option<Value> {
    let path = server.root.join(&token.file);
    let text = server.source(&path)?;
    Some(location(&path, &text, token.span.start as usize, token.span.end as usize))
}

/// The relation a local name refers to: declared in this file (`const x = relation("name")`),
/// else imported under that name from the file declaring it.
fn relation_named(server: &Server, path: &Path, text: &str, local: &str) -> Option<RelationInfo> {
    let relations = server.project.relations();
    let file = server.project.display_name(path);
    if let Some(name) = declared_name(text, local) {
        return relations.into_iter().find(|relation| relation.name == name && relation.declared_in.contains(&file));
    }
    relations.into_iter().find(|relation| {
        relation.declared_in.iter().any(|declared| {
            server
                .source(&server.root.join(declared))
                .is_some_and(|source| declared_name(&source, local).is_some_and(|name| name == relation.name))
        })
    })
}

/// The relation name in `<local> = relation("name")`.
fn declared_name(text: &str, local: &str) -> Option<String> {
    let mut from = 0;
    while let Some(found) = text[from..].find(local) {
        let start = from + found;
        from = start + local.len();
        let boundary = start == 0 || !is_word(text.as_bytes()[start - 1]);
        let call =
            text[from..].trim_start().strip_prefix('=').and_then(|rest| rest.trim_start().strip_prefix("relation("));
        let argument = call.map(str::trim_start).filter(|_| boundary).unwrap_or_default();
        if let Some(quote) = argument.chars().next().filter(|quote| matches!(quote, '"' | '\'' | '`')) {
            return argument[1..].split(quote).next().map(str::to_owned);
        }
    }
    None
}

fn is_word(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$'
}

fn declaration(server: &Server, relation: &RelationInfo) -> Option<Value> {
    for file in &relation.declared_in {
        let path = server.root.join(file);
        let text = server.source(&path).unwrap_or_default();
        for quote in ['"', '\'', '`'] {
            let needle = format!("relation({quote}{}{quote})", relation.name);
            if let Some(start) = text.find(&needle) {
                return Some(location(&path, &text, start, start + needle.len()));
            }
        }
    }
    None
}

/// Uses of `<local><member>` in the given project files; without a match under that name in a file,
/// any `<identifier><member>` whose identifier is bound to the same relation there.
fn occurrences(server: &Server, files: &[String], members: &[&str], local: Option<&str>) -> Vec<Value> {
    let paths: Vec<PathBuf> = files.iter().map(|file| server.root.join(file)).collect();
    let needles: Vec<String> = members.iter().map(|member| format!("{}{member}", local.unwrap_or_default())).collect();
    let needles: Vec<&str> = needles.iter().map(String::as_str).collect();
    let documents: Vec<(PathBuf, String)> =
        paths.iter().filter_map(|path| server.source(path).map(|text| (path.clone(), text))).collect();
    search(&documents, &needles)
}

fn project_files(server: &Server) -> Vec<(PathBuf, String)> {
    let mut files = Vec::new();
    collect_sources(&server.root, &mut files, SCRIPT_EXTENSIONS);
    collect_sources(&server.root, &mut files, kirana_frontend::sfc::COMPONENT_EXTENSIONS);
    files.into_iter().filter_map(|path| server.source(&path).map(|text| (path, text))).collect()
}

/// Whole-name occurrences of any needle.
fn search(files: &[(PathBuf, String)], needles: &[&str]) -> Vec<Value> {
    let mut out = Vec::new();
    for (path, text) in files {
        for needle in needles {
            let mut from = 0;
            while let Some(found) = text[from..].find(needle) {
                let start = from + found;
                let end = start + needle.len();
                from = end;
                let before = start == 0 || !is_word(text.as_bytes()[start - 1]);
                let last = needle.as_bytes()[needle.len() - 1];
                let after = !is_word(last) || end >= text.len() || !is_word(text.as_bytes()[end]);
                if before && after {
                    out.push(location(path, text, start, end));
                }
            }
        }
    }
    out
}
