//! The StyleX codemod behind `kirana-style migrate stylex` (KRN-API-013, D-003).
//!
//! It rewrites the mechanical half of a migration and **reports** the other half rather than
//! guessing at it. Every line in the report is a mistake a hand port from StyleX
//! makes:
//! a relation whose placement cannot be proven from one file, a `stylex.when` with no equivalent,
//! a default marker that needs an import the codemod cannot choose.
//!
//! The one rewrite worth reading twice is `default: null`. StyleX's means "this entry has no value
//! at rest"; Kirana's `base: null` is a merge instruction that removes an earlier handle's value
//! (D-013). They are not the same thing, so the entry is dropped instead of translated — a
//! translation would silently change what the component does.

pub mod environment;
pub mod tailwind;

use std::collections::BTreeSet;
use std::path::Path;

use oxc_ast::ast::{
    Argument, ArrowFunctionBody, CallExpression, Expression, ImportDeclaration, JSXAttributeItem, JSXSpreadAttribute,
    ObjectPropertyKind, PropertyKey, TSTypeName, VariableDeclarator,
};
use oxc_ast_visit::{Visit, walk};
use oxc_span::{GetSpan, Span};

/// One thing the codemod will not decide on its own.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Note {
    /// Byte offset in the original source.
    pub offset: u32,
    pub message: String,
}

/// What migrating one file produced.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Migration {
    pub source: String,
    pub notes: Vec<Note>,
    /// The name the file should take: `theme.stylex.ts` becomes `theme.ts`.
    pub rename: Option<String>,
}

impl Migration {
    /// Whether anything changed, so a caller can skip writing the file.
    pub fn changed(&self, original: &str) -> bool {
        self.source != original || self.rename.is_some()
    }
}

#[derive(Debug)]
struct Edit {
    span: Span,
    text: String,
}

/// The import the rewritten file needs, assembled from what the rewrites used.
const IMPORT_MARKER: &str = "/*__KIRANA_IMPORT__*/";

/// Migrates one file's source.
///
/// A file that does not parse is returned unchanged with a note: a codemod that half-rewrites a
/// file it could not read is worse than one that declines.
pub fn migrate(path: &Path, source: &str) -> Migration {
    let rename = path
        .file_name()
        .and_then(|name| name.to_str())
        .and_then(|name| name.strip_suffix(".stylex.ts").map(|stem| format!("{stem}.ts")));
    let file = path.display().to_string();
    let parsed = kirana_frontend::with_parsed(path, &file, source, |parsed| {
        let mut walker = Walker::new(source);
        walker.visit_program(parsed.program);
        walker.finish()
    });
    match parsed {
        Ok((rewritten, notes)) => Migration { source: rewritten, notes, rename },
        Err(_) => Migration {
            source: source.to_owned(),
            notes: vec![Note { offset: 0, message: "the file does not parse; nothing was rewritten".to_owned() }],
            rename: None,
        },
    }
}

struct Walker<'s> {
    source: &'s str,
    edits: Vec<Edit>,
    notes: Vec<Note>,
    /// Imports the rewritten file needs from `@kirana-style/core`.
    used: BTreeSet<&'static str>,
    /// Spans already rewritten whole, so nothing inside them is rewritten again. A JSX spread that
    /// becomes `sx={[…]}` contains calls this would otherwise edit, and two edits over one range
    /// corrupt the file.
    claimed: Vec<Span>,
    /// The name a `stylex.defineVars`/`defineMarker` call is assigned to, by call start.
    names: Vec<(u32, String)>,
    /// True once the default marker is used, which needs an import this cannot choose.
    default_marker: bool,
}

/// `stylex.<name>`, when the callee is exactly that.
fn member_of<'a>(expression: &'a Expression<'a>, object: &str) -> Option<&'a str> {
    let member = expression.as_member_expression()?;
    let identifier = member.object().get_identifier_reference()?;
    (identifier.name.as_str() == object).then(|| member.static_property_name())?
}

/// `stylex.when.<name>`.
fn when_of<'a>(expression: &'a Expression<'a>) -> Option<&'a str> {
    let member = expression.as_member_expression()?;
    let inner = member.object().as_member_expression()?;
    let identifier = inner.object().get_identifier_reference()?;
    (identifier.name.as_str() == "stylex" && inner.static_property_name() == Some("when"))
        .then(|| member.static_property_name())?
}

impl<'s> Walker<'s> {
    fn new(source: &'s str) -> Self {
        Self {
            source,
            edits: Vec::new(),
            notes: Vec::new(),
            used: BTreeSet::new(),
            claimed: Vec::new(),
            names: Vec::new(),
            default_marker: false,
        }
    }

    fn text(&self, span: Span) -> &'s str {
        &self.source[span.start as usize..span.end as usize]
    }

    fn replace(&mut self, span: Span, text: impl Into<String>) {
        self.edits.push(Edit { span, text: text.into() });
    }

    fn insert(&mut self, at: u32, text: impl Into<String>) {
        self.edits.push(Edit { span: Span::new(at, at), text: text.into() });
    }

    fn note(&mut self, offset: u32, message: impl Into<String>) {
        self.notes.push(Note { offset, message: message.into() });
    }

    /// The variable a call is assigned to, for the names `defineTokens` and `relation` need.
    fn name_of(&self, start: u32) -> &str {
        self.names.iter().find(|(at, _)| *at == start).map_or("unnamed", |(_, name)| name.as_str())
    }

    /// Applies the edits from the end, and reports any that overlap rather than corrupting the file.
    fn finish(mut self) -> (String, Vec<Note>) {
        self.edits.sort_by(|a, b| b.span.start.cmp(&a.span.start).then(b.span.end.cmp(&a.span.end)));
        let mut out = self.source.to_owned();
        let mut last_start = u32::MAX;
        for edit in &self.edits {
            if edit.span.end > last_start {
                self.notes.push(Note {
                    offset: edit.span.start,
                    message: format!("overlapping rewrite skipped: {:?}", edit.text),
                });
                continue;
            }
            out.replace_range(edit.span.start as usize..edit.span.end as usize, &edit.text);
            last_start = edit.span.start;
        }
        let names: Vec<&str> = self.used.iter().copied().collect();
        let import = if names.is_empty() {
            String::new()
        } else {
            format!("import {{ {} }} from \"@kirana-style/core\"", names.join(", "))
        };
        out = out.replace(IMPORT_MARKER, &import);
        if self.default_marker && !out.contains("export const peer") {
            self.notes.push(Note {
                offset: 0,
                message: "uses the default marker: import `peer` from the module that declares it".to_owned(),
            });
        }
        // `./theme.stylex` becomes `./theme`, to match the renamed file.
        out = strip_stylex_specifiers(&out);
        self.notes.sort_by_key(|note| note.offset);
        (out, self.notes)
    }

    /// `{...stylex.props(a, b)}` becomes `sx={[a, b]}`; a marker argument applies its anchor.
    fn spread(&mut self, attribute: &JSXSpreadAttribute<'_>) {
        let Expression::CallExpression(call) = &attribute.argument else { return };
        if member_of(&call.callee, "stylex") != Some("props") {
            return;
        }
        let arguments: Vec<String> = call
            .arguments
            .iter()
            .map(|argument| match argument.as_expression() {
                Some(Expression::Identifier(identifier)) if identifier.name.ends_with("Marker") => {
                    format!("{}.anchor", identifier.name)
                }
                Some(Expression::CallExpression(inner))
                    if member_of(&inner.callee, "stylex") == Some("defaultMarker") =>
                {
                    self.default_marker = true;
                    "peer.anchor".to_owned()
                }
                _ => self.text(argument.span()).to_owned(),
            })
            .collect();
        self.replace(attribute.span, format!("sx={{[{}]}}", arguments.join(", ")));
        self.claimed.push(attribute.span);
    }

    /// `stylex.create({ a: {…} })` becomes `{ a: css({…}) }`.
    fn create(&mut self, call: &CallExpression<'_>) {
        let Some(Expression::ObjectExpression(object)) = call.arguments.first().and_then(Argument::as_expression)
        else {
            self.note(call.span.start, "stylex.create without an object argument");
            return;
        };
        self.replace(Span::new(call.span.start, object.span.start), "");
        self.replace(Span::new(object.span.end, call.span.end), "");
        self.used.insert("css");
        for property in &object.properties {
            let ObjectPropertyKind::ObjectProperty(property) = property else { continue };
            match &property.value {
                Expression::ObjectExpression(value) => {
                    self.insert(value.span.start, "css(");
                    self.insert(value.span.end, ")");
                    self.defaults(value.span);
                }
                Expression::ArrowFunctionExpression(arrow)
                    if !matches!(arrow.body, ArrowFunctionBody::FunctionBody(_)) =>
                {
                    // A dynamic style: `(size) => ({ … })` becomes `(size) => css({ … })`. The
                    // body's own parenthesis is the place to put the name.
                    let body = arrow.body.span();
                    self.insert(body.start, "css");
                    self.defaults(arrow.span);
                }
                _ => self.note(property.span.start, "stylex.create entry is not an object"),
            }
        }
    }

    /// Rewrites `default:` keys inside a style object, and drops `default: null` entries.
    ///
    /// Scanning the text rather than the tree keeps this to one pass over a small span, and the
    /// keys it looks for are unambiguous: `default` as an object key at the start of an entry.
    fn defaults(&mut self, span: Span) {
        let region = self.text(span);
        let base = span.start as usize;
        let bytes = self.source.as_bytes();
        let mut from = 0;
        while let Some(offset) = region[from..].find("default") {
            let start = base + from + offset;
            let end = start + "default".len();
            from += offset + "default".len();
            let before_ok = start == 0 || !is_word_byte(bytes[start - 1]);
            let mut after = end;
            while after < bytes.len() && bytes[after].is_ascii_whitespace() {
                after += 1;
            }
            if !before_ok || bytes.get(after) != Some(&b':') {
                continue;
            }
            let mut value = after + 1;
            while value < bytes.len() && bytes[value].is_ascii_whitespace() {
                value += 1;
            }
            if self.source[value..].starts_with("null") && !is_word_byte(*bytes.get(value + 4).unwrap_or(&b' ')) {
                self.drop_entry(start as u32, (value + 4) as u32);
            } else {
                self.replace(Span::new(start as u32, end as u32), "base");
            }
        }
    }

    /// Removes an entry and exactly one separator, leaving no blank line behind.
    fn drop_entry(&mut self, start: u32, end: u32) {
        let bytes = self.source.as_bytes();
        let (mut start, mut end) = (start as usize, end as usize);
        let entry_end = end;
        while bytes.get(end).is_some_and(|byte| byte.is_ascii_whitespace() && *byte != b'\n') {
            end += 1;
        }
        if bytes.get(end) == Some(&b',') {
            end += 1;
            let line_start = self.source[..start].rfind('\n').map_or(0, |at| at + 1);
            if self.source[line_start..start].trim().is_empty() {
                start = line_start.saturating_sub(1);
                while bytes.get(end).is_some_and(|byte| *byte == b' ' || *byte == b'\t') {
                    end += 1;
                }
            } else {
                while bytes.get(end).is_some_and(u8::is_ascii_whitespace) {
                    end += 1;
                }
            }
        } else {
            // The last entry in the object: take the separator before it instead, and leave the
            // space that closed the object where it was.
            end = entry_end;
            while start > 0 && (bytes[start - 1].is_ascii_whitespace() || bytes[start - 1] == b',') {
                start -= 1;
            }
        }
        self.replace(Span::new(start as u32, end as u32), "");
    }

    /// Everything that is a plain rename or a small wrapper.
    fn call(&mut self, call: &CallExpression<'_>) {
        if self.claimed.iter().any(|span| span.start <= call.span.start && call.span.end <= span.end) {
            return;
        }
        let Some(property) = member_of(&call.callee, "stylex") else {
            if let Some(when) = when_of(&call.callee) {
                self.when(call, when);
            }
            return;
        };
        let callee = call.callee.span();
        let first = call.arguments.first().map(GetSpan::span);
        match property {
            "create" => self.create(call),
            "props" => {
                // Components routinely name a rest parameter `props`, so the import is aliased.
                self.replace(callee, "styleProps");
                self.used.insert("props as styleProps");
            }
            "defineVars" => {
                let name = self.name_of(call.span.start).to_owned();
                self.replace(callee, "defineTokens");
                if let Some(first) = first {
                    self.insert(first.start, format!("{:?}, ", name));
                    self.insert(first.end, ", { variable: true }");
                }
                self.used.insert("defineTokens");
            }
            "defineConsts" => {
                if let Some(first) = first {
                    self.replace(Span::new(call.span.start, first.start), "");
                    self.replace(Span::new(first.end, call.span.end), " as const");
                }
            }
            "defineMarker" => {
                let name = self.name_of(call.span.start).trim_end_matches("Marker").to_owned();
                self.replace(call.span, format!("relation({:?})", name));
                self.used.insert("relation");
            }
            "defaultMarker" => {
                self.default_marker = true;
                self.replace(call.span, "peer.anchor");
            }
            "keyframes" => {
                self.replace(callee, "keyframes");
                self.used.insert("keyframes");
            }
            "createTheme" => {
                self.replace(callee, "defineTheme");
                self.used.insert("defineTheme");
            }
            // Same arguments, same order, same meaning; StyleX's view-transition class takes the
            // same four parts and is likewise a class name (KRN-API-017 to KRN-API-019).
            "firstThatWorks" => {
                self.replace(callee, "firstThatWorks");
                self.used.insert("firstThatWorks");
            }
            "positionTry" => {
                self.replace(callee, "positionTry");
                self.used.insert("positionTry");
            }
            "viewTransitionClass" => {
                self.replace(callee, "viewTransition");
                self.used.insert("viewTransition");
            }
            other => self.note(call.span.start, format!("no mapping for stylex.{other}")),
        }
    }

    /// `stylex.when.ancestor(state, marker)` becomes `marker.within(state)`.
    fn when(&mut self, call: &CallExpression<'_>, when: &str) {
        let Some(method) = (match when {
            "ancestor" => Some("within"),
            "siblingBefore" => Some("after"),
            "siblingAfter" => Some("before"),
            _ => None,
        }) else {
            self.note(call.span.start, format!("stylex.when.{when} has no equivalent; write a `:has()` condition"));
            return;
        };
        let state = call.arguments.first().map(|argument| self.text(argument.span())).unwrap_or_default().to_owned();
        let marker = match call.arguments.get(1) {
            Some(argument) => self.text(argument.span()).to_owned(),
            None => {
                self.default_marker = true;
                "peer".to_owned()
            }
        };
        self.replace(call.span, format!("{marker}.{method}({state})"));
    }
}

fn is_word_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$'
}

/// `from "./theme.stylex"` becomes `from "./theme"`, for the files this codemod renames.
fn strip_stylex_specifiers(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let mut rest = source;
    while let Some(offset) = rest.find(".stylex\"").or_else(|| rest.find(".stylex'")) {
        out.push_str(&rest[..offset]);
        out.push(rest.as_bytes()[offset + ".stylex".len()] as char);
        rest = &rest[offset + ".stylex\"".len()..];
    }
    out.push_str(rest);
    out
}

impl<'a> Visit<'a> for Walker<'a> {
    fn visit_variable_declarator(&mut self, declarator: &VariableDeclarator<'a>) {
        if let (Some(name), Some(init)) = (declarator.id.get_identifier_name(), declarator.init.as_ref()) {
            self.names.push((init.span().start, name.to_string()));
        }
        walk::walk_variable_declarator(self, declarator);
    }

    fn visit_import_declaration(&mut self, declaration: &ImportDeclaration<'a>) {
        if declaration.source.value == "@stylexjs/stylex" {
            self.replace(declaration.span, IMPORT_MARKER);
        }
        walk::walk_import_declaration(self, declaration);
    }

    fn visit_ts_type_name(&mut self, name: &TSTypeName<'a>) {
        if let TSTypeName::QualifiedName(qualified) = name
            && let TSTypeName::IdentifierReference(left) = &qualified.left
            && left.name == "stylex"
            && matches!(
                qualified.right.name.as_str(),
                "StyleXStyles" | "CompiledStyles" | "StyleXArray" | "StaticStyles"
            )
        {
            self.replace(qualified.span, "Sx");
            self.used.insert("type Sx");
        }
        walk::walk_ts_type_name(self, name);
    }

    fn visit_jsx_attribute_item(&mut self, item: &JSXAttributeItem<'a>) {
        if let JSXAttributeItem::SpreadAttribute(attribute) = item {
            self.spread(attribute);
        }
        walk::walk_jsx_attribute_item(self, item);
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        self.call(call);
        walk::walk_call_expression(self, call);
    }

    fn visit_object_property_kind(&mut self, property: &ObjectPropertyKind<'a>) {
        // Keys are visited for their values only; `default` keys are handled by `defaults`.
        if let ObjectPropertyKind::ObjectProperty(object) = property
            && matches!(&object.key, PropertyKey::StaticIdentifier(_))
        {
            walk::walk_expression(self, &object.value);
            return;
        }
        walk::walk_object_property_kind(self, property);
    }
}
