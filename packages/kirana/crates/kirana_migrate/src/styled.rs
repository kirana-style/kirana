//! The styled-components and Emotion codemod behind `kirana-style migrate styled-components` (D-120,
//! KRN-API-013).
//!
//! A styled component becomes a `css()` handle and a component that applies it with `sx`, the shape
//! a component written for Kirana has (`({ sx, ...props }) => <button {...props} sx={[style, sx]} />`).
//! A value or a block that reads props stays in the component: a value as a `css()` in its `sx`, a
//! block (`${(p) => p.$primary && css`…`}`) as a handle of its own listed after the style. `css` and
//! `keyframes` become Kirana's, Emotion's `css` prop and `className={css…}` become `sx`.
//!
//! The CSS of a template is read by the small parser below. It only splits declarations and nested
//! blocks; every `${…}` stands in the text as a placeholder until the parts are written out again
//! as JavaScript. What it cannot carry over (a selector Kirana takes no condition for, the theme,
//! `createGlobalStyle`) stays in the file as a comment beside the style and is in the report.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use kirana_css_data::{accepts_number, is_known_property};
use kirana_shared::kebab_case;
use oxc_ast::ast::{
    Argument, ArrowFunctionExpression, BindingPattern, CallExpression, Expression, ImportDeclaration,
    ImportDeclarationSpecifier, JSXAttributeItem, JSXAttributeName, JSXAttributeValue, JSXElementName,
    JSXMemberExpressionObject, JSXOpeningElement, ObjectExpression, ObjectPropertyKind, Program, PropertyKey,
    TSSignature, TSType, TSTypeParameterInstantiation, TaggedTemplateExpression, TemplateLiteral, VariableDeclarator,
};
use oxc_ast_visit::{Visit, walk};
use oxc_span::{GetSpan, Span};
use oxc_syntax::operator::LogicalOperator;

use crate::tailwind::Environment;
use crate::{Edit, IMPORT_MARKER, Migration, Note, Piece, TYPESCRIPT, place, with_unit};

/// The libraries this codemod reads, by the specifier they are imported from.
const LIBRARIES: &[&str] = &["styled-components", "@emotion/styled", "@emotion/react", "@emotion/css"];

/// A `${…}` in a template's CSS: the expression's index between two Unicode noncharacters, which
/// no text holds (an icon font's private-use glyph may be in a `content` value).
const OPEN: char = '\u{FDD0}';
const CLOSE: char = '\u{FDD1}';

/// What a name imported from one of the libraries is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Styled,
    Css,
    Keyframes,
    Cx,
}

/// Migrates one file's source; `environment` says which imported components read `sx`.
///
/// A file that imports none of the libraries is returned as it is. A file that does not parse is
/// returned unchanged with a note. A `.ts` file that gains a component is renamed `.tsx`, since the
/// component is JSX.
pub fn migrate(path: &Path, source: &str, environment: &dyn Environment) -> Migration {
    let extension = path.extension().and_then(|extension| extension.to_str()).unwrap_or_default();
    let typescript = TYPESCRIPT.contains(&extension);
    let file = path.display().to_string();
    let parsed = kirana_frontend::with_parsed(path, &file, source, |parsed| {
        let mut survey = Survey::default();
        survey.visit_program(parsed.program);
        if survey.declarations.is_empty() {
            return None;
        }
        let mut walker = Walker::new(source, typescript, environment, survey);
        walker.pragma(parsed.program);
        walker.visit_program(parsed.program);
        Some(walker.finish())
    });
    match parsed {
        Ok(Some((rewritten, notes, jsx))) => {
            let rename = path
                .file_stem()
                .and_then(|stem| stem.to_str())
                .filter(|_| jsx && extension == "ts")
                .map(|stem| format!("{stem}.tsx"));
            Migration { source: rewritten, notes, rename }
        }
        Ok(None) => Migration { source: source.to_owned(), notes: Vec::new(), rename: None },
        Err(_) => Migration {
            source: source.to_owned(),
            notes: vec![Note { offset: 0, message: "the file does not parse; nothing was rewritten".to_owned() }],
            rename: None,
        },
    }
}

/// One import of a library: its span, its specifier, and each name with its text as written.
struct Declaration {
    span: Span,
    source: String,
    default: Option<String>,
    /// Each named import's local name and its text's span (`a`, `a as b`).
    named: Vec<(String, Span)>,
    namespace: bool,
}

/// What the rewrite needs to know before it starts: the libraries' names and their imports, every
/// other import (whether a component reads `sx`), and every name the file binds (so a new handle's
/// name is free).
#[derive(Default)]
struct Survey {
    kinds: BTreeMap<String, Kind>,
    declarations: Vec<Declaration>,
    imports: BTreeMap<String, String>,
    bound: BTreeSet<String>,
}

impl<'a> Visit<'a> for Survey {
    fn visit_import_declaration(&mut self, declaration: &ImportDeclaration<'a>) {
        let source = declaration.source.value.as_str().unwrap_or_default();
        // A type import names nothing Kirana's imports could clash with, and stays as it is.
        let library = LIBRARIES.contains(&source) && !declaration.import_kind.is_type();
        let mut found = Declaration {
            span: declaration.span,
            source: source.to_owned(),
            default: None,
            named: Vec::new(),
            namespace: false,
        };
        for specifier in declaration.specifiers.iter().flatten() {
            let local = specifier.name().to_string();
            if !library {
                self.imports.insert(local, source.to_owned());
                continue;
            }
            let imported = match specifier {
                ImportDeclarationSpecifier::ImportSpecifier(named) => {
                    found.named.push((local.clone(), named.span));
                    named.imported.name().to_string()
                }
                ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => {
                    found.default = Some(local.clone());
                    "default".to_owned()
                }
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(_) => {
                    found.namespace = true;
                    continue;
                }
            };
            let kind = match (source, imported.as_str()) {
                ("styled-components" | "@emotion/styled", "default") | ("styled-components", "styled") => {
                    Some(Kind::Styled)
                }
                (_, "css") => Some(Kind::Css),
                (_, "keyframes") => Some(Kind::Keyframes),
                ("@emotion/css", "cx") => Some(Kind::Cx),
                _ => None,
            };
            if let Some(kind) = kind {
                self.kinds.insert(local, kind);
            }
        }
        if library {
            self.declarations.push(found);
        }
        walk::walk_import_declaration(self, declaration);
    }

    fn visit_binding_identifier(&mut self, identifier: &oxc_ast::ast::BindingIdentifier<'a>) {
        self.bound.insert(identifier.name.to_string());
    }
}

/// A rule of a template's CSS, with offsets into the joined text.
#[derive(Debug)]
enum Rule {
    Declaration { property: String, value: String, at: usize },
    Block { selector: String, rules: Vec<Rule>, text: String, at: usize },
    Interpolation { index: usize, at: usize },
    Unread { text: String, at: usize },
}

/// Reads the CSS of a template, its interpolations already placeholders.
struct Parser<'t> {
    text: &'t str,
    at: usize,
}

impl Parser<'_> {
    fn rules(&mut self, nested: bool) -> Vec<Rule> {
        let mut rules = Vec::new();
        loop {
            self.skip();
            match self.text[self.at..].chars().next() {
                None => break,
                Some('}') => {
                    self.at += 1;
                    if nested {
                        break;
                    }
                    continue;
                }
                Some(';') => {
                    self.at += 1;
                    continue;
                }
                Some(_) => {}
            }
            // A placeholder alone on its line, or before a semicolon, is a block of styles.
            if let Some((index, end)) = placeholder(self.text, self.at) {
                let after = self.text[end..].trim_start_matches([' ', '\t']);
                if after.is_empty() || after.starts_with(['\n', '\r', ';', '}']) {
                    rules.push(Rule::Interpolation { index, at: self.at });
                    self.at = end;
                    continue;
                }
            }
            let start = self.at;
            let end = self.statement_end();
            let text = self.text[start..end].trim();
            if self.text[end..].starts_with('{') {
                self.at = end + 1;
                let inner = self.rules(true);
                rules.push(Rule::Block {
                    selector: text.to_owned(),
                    rules: inner,
                    text: self.text[start..self.at].to_owned(),
                    at: start,
                });
                continue;
            }
            self.at = end;
            rules.push(match split_declaration(text) {
                Some((property, value)) => Rule::Declaration { property, value, at: start },
                None => Rule::Unread { text: text.to_owned(), at: start },
            });
        }
        rules
    }

    /// Skips whitespace and comments, `//` ones included: styled-components and Emotion strip both.
    fn skip(&mut self) {
        loop {
            let rest = &self.text[self.at..];
            let trimmed = rest.trim_start();
            self.at += rest.len() - trimmed.len();
            if trimmed.starts_with("/*") {
                self.at = trimmed.find("*/").map_or(self.text.len(), |end| self.at + end + 2);
            } else if trimmed.starts_with("//") {
                self.at = trimmed.find('\n').map_or(self.text.len(), |end| self.at + end);
            } else {
                return;
            }
        }
    }

    /// Where the statement at `at` ends: its `;`, `{` or `}`, outside strings and parentheses.
    fn statement_end(&self) -> usize {
        let mut quote = None;
        let mut escaped = false;
        let mut depth = 0usize;
        for (index, character) in self.text[self.at..].char_indices() {
            if let Some(open) = quote {
                if escaped {
                    escaped = false;
                } else if character == '\\' {
                    escaped = true;
                } else if character == open {
                    quote = None;
                }
                continue;
            }
            match character {
                '"' | '\'' => quote = Some(character),
                '(' => depth += 1,
                ')' => depth = depth.saturating_sub(1),
                ';' | '{' | '}' if depth == 0 => return self.at + index,
                _ => {}
            }
        }
        self.text.len()
    }
}

/// The placeholder at `at`: the expression's index and where the placeholder ends.
fn placeholder(text: &str, at: usize) -> Option<(usize, usize)> {
    let rest = text[at..].strip_prefix(OPEN)?;
    let (index, _) = rest.split_once(CLOSE).expect("written by `joined`");
    Some((index.parse().expect("an index"), at + OPEN.len_utf8() + index.len() + CLOSE.len_utf8()))
}

/// `property: value`, split at its first colon.
fn split_declaration(text: &str) -> Option<(String, String)> {
    let (property, value) = text.split_once(':')?;
    let property = property.trim();
    if property.is_empty() || property.contains(char::is_whitespace) {
        return None;
    }
    Some((property.to_owned(), value.trim().to_owned()))
}

/// `-webkit-line-clamp` as `WebkitLineClamp`, `background-color` as `backgroundColor`.
fn camel(property: &str) -> String {
    let lower = property.to_ascii_lowercase();
    let (prefix, rest) = match lower.strip_prefix("-ms-") {
        Some(rest) => ("ms-", rest),
        None => ("", lower.strip_prefix('-').unwrap_or(&lower)),
    };
    let mut out = String::new();
    let mut upper = lower.starts_with('-') && prefix.is_empty();
    for character in prefix.chars().chain(rest.chars()) {
        if character == '-' {
            upper = true;
        } else if upper {
            out.push(character.to_ascii_uppercase());
            upper = false;
        } else {
            out.push(character);
        }
    }
    out
}

/// A JavaScript string literal holding `text`.
fn js_string(text: &str) -> String {
    let mut out = String::from("\"");
    for character in text.chars() {
        match character {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            other => out.push(other),
        }
    }
    out.push('"');
    out
}

/// Whether `text` is a plain number, as CSS writes one.
fn is_number(text: &str) -> bool {
    !text.is_empty()
        && text.chars().any(|character| character.is_ascii_digit())
        && text.chars().all(|character| character.is_ascii_digit() || character == '.' || character == '-')
        && text.parse::<f64>().is_ok()
}

/// `name` with its first letter in lower case; names here are identifiers, never empty.
fn lower_first(name: &str) -> String {
    let first = name.chars().next().unwrap_or_default();
    format!("{}{}", first.to_lowercase(), &name[first.len_utf8()..])
}

fn upper_first(name: &str) -> String {
    let first = name.chars().next().unwrap_or_default();
    format!("{}{}", first.to_uppercase(), &name[first.len_utf8()..])
}

/// Runs of whitespace as one space, so a comment or a value written over lines fits on one.
fn one_line(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// A style as it is written out: properties with their conditions, the blocks of a pseudo-element
/// or a `select` target, and what was not migrated, as comments.
#[derive(Default)]
struct Tree {
    entries: Vec<(String, String, Piece)>,
    blocks: Vec<(String, Tree)>,
    comments: Vec<String>,
}

impl Tree {
    fn is_empty(&self) -> bool {
        self.entries.is_empty() && self.blocks.is_empty() && self.comments.is_empty()
    }

    /// The block under `keys`, made when it is not there yet.
    fn at(&mut self, keys: &[String]) -> &mut Tree {
        let Some((first, rest)) = keys.split_first() else { return self };
        let index = self.blocks.iter().position(|(key, _)| key == first).unwrap_or_else(|| {
            self.blocks.push((first.clone(), Tree::default()));
            self.blocks.len() - 1
        });
        self.blocks[index].1.at(rest)
    }

    /// The style as an object literal: over lines indented by `indent` when `indent` is given, else
    /// on one line, without comments.
    fn render(&self, indent: Option<&str>) -> String {
        let mut items = Vec::new();
        for (_, key, piece) in &self.entries {
            let mut value = String::new();
            piece.render(&mut value);
            items.push(format!("{key}: {value}"));
        }
        for (key, block) in &self.blocks {
            let inner = indent.map(|indent| format!("{indent}  "));
            items.push(format!("{key}: {}", block.render(inner.as_deref())));
        }
        // Only a static style holds comments, and only a static style is written over lines.
        let Some(indent) = indent else { return format!("{{ {} }}", items.join(", ")) };
        let mut out = String::from("{\n");
        for item in &items {
            out.push_str(&format!("{indent}  {item},\n"));
        }
        for comment in &self.comments {
            out.push_str(&format!("{indent}  /* not migrated: {} */\n", comment.replace("*/", "*\\/")));
        }
        out.push_str(indent);
        out.push('}');
        out
    }
}

/// Where a rule is read: the conditions around it (key and key text) and the blocks it is in.
#[derive(Clone, Default)]
struct Scope {
    path: Vec<(String, String)>,
    blocks: Vec<String>,
    /// Whether a pseudo-class or an attribute is among the conditions: a descendant of a state is
    /// not a `select` target.
    state: bool,
}

/// What reading a styled component's style produced.
#[derive(Default)]
struct Read {
    fixed: Tree,
    dynamic: Tree,
    /// Mixins written before the first declaration, which the style overrides.
    before: Vec<String>,
    /// Mixins and conditional styles written after it, which override the style.
    after: Vec<String>,
    /// The `$` props the style reads: the component takes them out of what reaches the element.
    transient: BTreeSet<String>,
    /// The handles the conditional styles became, declared before the component.
    hoisted: Vec<String>,
    declared: bool,
    /// Interpolations at the top of the style with no declaration after them yet.
    pending: Vec<u32>,
}

/// How a function's parameter is read: the edits that make its body read the component's props.
#[derive(Default)]
struct Binding {
    edits: Vec<(Span, String)>,
}

/// What reading styles may use: the props of the component they are in, and the base of the names
/// of the handles they declare.
struct Context {
    props: bool,
    name: String,
}

/// What a styled component renders.
enum Target {
    Tag(String),
    /// A component: its text, and the local name it starts with.
    Component(String, String),
}

/// A styled component's definition before its style: what it renders, its `.attrs()`, and why it is
/// left alone when it is.
struct Form {
    local: String,
    target: Target,
    attrs: Vec<String>,
    unsupported: Option<String>,
}

/// The style of a styled component: a template, or an Emotion object (or a function returning one).
enum Style<'b, 'a> {
    Template(&'b TemplateLiteral<'a>),
    Object(&'b ObjectExpression<'a>),
    Function(&'b ArrowFunctionExpression<'a>),
}

/// A style outside a styled component.
enum Standalone<'b, 'a> {
    Template(&'b TemplateLiteral<'a>),
    Object(&'b ObjectExpression<'a>),
}

/// What a function of props returns: a value, styles chosen by props (css`…` blocks), or an Emotion
/// style object.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Body {
    Value,
    Styles,
    Object,
}

/// What a function's body reads, for [`Walker::bind`].
#[derive(Default)]
struct Scan<'b, 'a> {
    identifiers: Vec<(Span, String)>,
    members: Vec<(Span, String, String)>,
    styles: Vec<&'b TaggedTemplateExpression<'a>>,
    refused: Option<&'static str>,
}

impl Scan<'_, '_> {
    fn refuse(&mut self, reason: &'static str) {
        self.refused.get_or_insert(reason);
    }
}

struct Walker<'s, 'e> {
    source: &'s str,
    typescript: bool,
    environment: &'e dyn Environment,
    survey: Survey,
    edits: Vec<Edit>,
    notes: Vec<Note>,
    used: BTreeSet<&'static str>,
    /// Whether a component's props are typed with React's `ComponentProps`.
    component_props: bool,
    /// The start of the top-level statement being walked, where a styled component's handles go.
    statement: u32,
    hoisted: BTreeMap<u32, Vec<String>>,
    names: Vec<(u32, String)>,
    claimed: Vec<Span>,
    /// Calls of Emotion's `cx` already written as an `sx` array.
    joined: BTreeSet<u32>,
    /// Library names left in the file, whose import stays.
    kept: BTreeSet<String>,
    wrappers: BTreeSet<String>,
    polymorphic: Vec<(String, u32)>,
}

impl<'s, 'e> Walker<'s, 'e> {
    fn new(source: &'s str, typescript: bool, environment: &'e dyn Environment, survey: Survey) -> Self {
        Self {
            source,
            typescript,
            environment,
            survey,
            edits: Vec::new(),
            notes: Vec::new(),
            used: BTreeSet::new(),
            component_props: false,
            statement: 0,
            hoisted: BTreeMap::new(),
            names: Vec::new(),
            claimed: Vec::new(),
            joined: BTreeSet::new(),
            kept: BTreeSet::new(),
            wrappers: BTreeSet::new(),
            polymorphic: Vec::new(),
        }
    }

    fn text(&self, span: Span) -> &'s str {
        &self.source[span.start as usize..span.end as usize]
    }

    fn replace(&mut self, span: Span, text: impl Into<String>) {
        self.edits.push(Edit { span, text: text.into() });
    }

    fn note(&mut self, offset: u32, message: impl Into<String>) {
        self.notes.push(Note { offset, message: message.into() });
    }

    fn is_claimed(&self, span: Span) -> bool {
        self.claimed.iter().any(|claimed| claimed.start <= span.start && span.end <= claimed.end)
    }

    fn kind(&self, expression: &Expression<'_>) -> Option<Kind> {
        let Expression::Identifier(identifier) = expression else { return None };
        self.survey.kinds.get(identifier.name.as_str()).copied()
    }

    /// A name for a new handle that the file does not bind yet.
    fn fresh(&mut self, base: &str) -> String {
        let mut name = base.to_owned();
        let mut number = 2;
        while self.survey.bound.contains(&name) {
            name = format!("{base}{number}");
            number += 1;
        }
        self.survey.bound.insert(name.clone());
        name
    }

    /// Removes Emotion's JSX pragma (`/** @jsxImportSource @emotion/react */`), which the `sx` prop
    /// does not need.
    fn pragma(&mut self, program: &Program<'_>) {
        for comment in &program.comments {
            let text = self.text(comment.span);
            if text.contains("@jsxImportSource @emotion/react") || text.contains("@jsx jsx") {
                let end = comment.span.end + u32::from(self.source[comment.span.end as usize..].starts_with('\n'));
                self.replace(Span::new(comment.span.start, end), "");
            }
        }
    }

    /// `styled.button`, `styled("button")`, `styled(Button)`, and any of them with `.attrs()` or
    /// another method after it.
    fn form(&self, expression: &Expression<'_>) -> Option<Form> {
        match expression {
            Expression::StaticMemberExpression(member) => {
                let Expression::Identifier(object) = &member.object else { return None };
                (self.kind(&member.object) == Some(Kind::Styled)).then(|| Form {
                    local: object.name.to_string(),
                    target: Target::Tag(member.property.name.to_string()),
                    attrs: Vec::new(),
                    unsupported: None,
                })
            }
            Expression::CallExpression(call) => {
                if let Expression::Identifier(callee) = &call.callee
                    && self.kind(&call.callee) == Some(Kind::Styled)
                {
                    let first = call.arguments.first().and_then(Argument::as_expression)?;
                    let target = match first {
                        Expression::StringLiteral(tag) => {
                            Target::Tag(tag.value.as_str().unwrap_or_default().to_owned())
                        }
                        other => {
                            let text = self.text(other.span());
                            let root = text.split(['.', '<', '(']).next().unwrap_or(text);
                            Target::Component(text.to_owned(), root.to_owned())
                        }
                    };
                    let unsupported = (call.arguments.len() > 1).then(|| "styled()'s options".to_owned());
                    return Some(Form { local: callee.name.to_string(), target, attrs: Vec::new(), unsupported });
                }
                let Expression::StaticMemberExpression(method) = &call.callee else { return None };
                let mut form = self.form(&method.object)?;
                let attrs =
                    match (method.property.name.as_str(), call.arguments.first().and_then(Argument::as_expression)) {
                        ("attrs", Some(Expression::ObjectExpression(object))) => self.attributes(object),
                        _ => None,
                    };
                match attrs {
                    Some(attrs) => form.attrs.extend(attrs),
                    None => {
                        form.unsupported.get_or_insert_with(|| format!("`.{}()`", method.property.name));
                    }
                }
                Some(form)
            }
            _ => None,
        }
    }

    /// `.attrs({ type: "button" })` as JSX attributes; `None` for a spread or a computed key.
    fn attributes(&self, object: &ObjectExpression<'_>) -> Option<Vec<String>> {
        object
            .properties
            .iter()
            .map(|property| {
                let ObjectPropertyKind::ObjectProperty(property) = property else { return None };
                let name = crate::key_name(property)?;
                Some(match &property.value {
                    Expression::StringLiteral(value) if !value.value.contains('"') => {
                        format!("{name}={}", self.text(value.span))
                    }
                    value => format!("{name}={{{}}}", self.text(value.span())),
                })
            })
            .collect()
    }

    /// A styled component: its style's handles before the statement, and a component in its place.
    fn styled(
        &mut self,
        span: Span,
        form: Form,
        style: Style<'_, '_>,
        types: Option<&TSTypeParameterInstantiation<'_>>,
    ) {
        self.claimed.push(span);
        if let Some(reason) = &form.unsupported {
            self.note(span.start, format!("{reason} on a styled component: left as it is, to port by hand"));
            self.kept.insert(form.local);
            return;
        }
        let name = self.names.iter().find(|(at, _)| *at == span.start).map_or("Styled", |(_, name)| name).to_owned();
        let context = Context { props: true, name: lower_first(&name) };
        let mut read = Read::default();
        match style {
            Style::Template(template) => self.template(template, &context, &mut read),
            Style::Object(object) => self.object(object, &Binding::default(), &mut read, &Scope::default()),
            Style::Function(arrow) => {
                let body = arrow.get_expression().map(Expression::without_parentheses);
                match (body, self.bind(arrow, &context, &mut read, Body::Object)) {
                    (Some(Expression::ObjectExpression(object)), Ok(binding)) => {
                        self.object(object, &binding, &mut read, &Scope::default())
                    }
                    (_, Err(reason)) => {
                        self.note(
                            span.start,
                            format!("a style function that {reason}: left as it is, to port by hand"),
                        );
                        self.kept.insert(form.local);
                        return;
                    }
                    _ => {
                        self.note(
                            span.start,
                            "a style function that does not return an object: left as it is, to port by hand",
                        );
                        self.kept.insert(form.local);
                        return;
                    }
                }
            }
        }
        if let Some(Some(TSType::TSTypeLiteral(literal))) = types.map(|types| types.params.first()) {
            for member in &literal.members {
                if let TSSignature::TSPropertySignature(signature) = member
                    && let Some(key) = signature.key.static_name().and_then(|name| name.as_str().map(str::to_owned))
                    && key.starts_with('$')
                {
                    read.transient.insert(key);
                }
            }
        }
        let mut sx = std::mem::take(&mut read.before);
        let mut hoisted = Vec::new();
        if !read.fixed.is_empty() {
            let handle = self.fresh(&format!("{}Style", context.name));
            hoisted.push(format!("const {handle} = css({})", read.fixed.render(Some(""))));
            sx.push(handle);
            self.used.insert("css");
        }
        if !read.dynamic.is_empty() {
            sx.push(format!("css({})", read.dynamic.render(None)));
            self.used.insert("css");
        }
        hoisted.append(&mut read.hoisted);
        sx.append(&mut read.after);
        sx.push("sx".to_owned());
        let component = self.component(&form, types, &sx, &read.transient);
        self.replace(span, component);
        self.hoisted.entry(self.statement).or_default().extend(hoisted);
        self.wrappers.insert(name);
    }

    /// The component a styled component becomes: it takes `sx`, keeps its `$` props from the
    /// element, and applies its handles before the caller's `sx`.
    fn component(
        &mut self,
        form: &Form,
        types: Option<&TSTypeParameterInstantiation<'_>>,
        sx: &[String],
        transient: &BTreeSet<String>,
    ) -> String {
        let (element, external) = match &form.target {
            Target::Tag(tag) => (tag.clone(), false),
            Target::Component(text, root) => (
                text.clone(),
                self.survey.imports.get(root).is_some_and(|specifier| self.environment.is_external(specifier)),
            ),
        };
        let typed = if self.typescript {
            self.component_props = true;
            self.used.insert("type Sx");
            let own = types
                .and_then(|types| types.params.first())
                .map_or_else(String::new, |own| format!("{} & ", self.text(own.span())));
            let element_props = match &form.target {
                Target::Tag(tag) => format!("ComponentProps<{}>", js_string(tag)),
                Target::Component(text, _) => format!("ComponentProps<typeof {text}>"),
            };
            format!(": {own}{element_props} & {{ sx?: Sx }}")
        } else {
            String::new()
        };
        let spread = if transient.is_empty() { "props" } else { "rest" };
        let attrs: String = form.attrs.iter().map(|attribute| format!(" {attribute}")).collect();
        let styles = if external {
            self.used.insert("props as styleProps");
            format!("{{...styleProps({})}}", sx.join(", "))
        } else if sx.len() == 1 {
            "sx={sx}".to_owned()
        } else {
            format!("sx={{[{}]}}", sx.join(", "))
        };
        let rendered = format!("<{element} {{...{spread}}}{attrs} {styles} />");
        if transient.is_empty() {
            return format!("({{ sx, ...props }}{typed}) => {rendered}");
        }
        let names: Vec<&str> = transient.iter().map(String::as_str).collect();
        format!(
            "({{ sx, ...props }}{typed}) => {{\n  const {{ {}, ...rest }} = props\n  return {rendered}\n}}",
            names.join(", ")
        )
    }

    /// A template's CSS: the text with its interpolations as placeholders, then its rules.
    fn template(&mut self, template: &TemplateLiteral<'_>, context: &Context, read: &mut Read) {
        let (text, map) = joined(template);
        let rules = Parser { text: &text, at: 0 }.rules(false);
        let expressions: Vec<&Expression<'_>> = template.expressions.iter().collect();
        let source = Joined { map, expressions: &expressions };
        self.rules(&rules, &source, context, read, &Scope::default());
    }

    fn rules(
        &mut self,
        rules: &[Rule],
        joined: &Joined<'_, '_, '_>,
        context: &Context,
        read: &mut Read,
        scope: &Scope,
    ) {
        let top = scope.path.is_empty() && scope.blocks.is_empty();
        for rule in rules {
            match rule {
                Rule::Declaration { property, value, at } => {
                    let at = joined.offset(*at);
                    if top {
                        read.declared = true;
                        for pending in std::mem::take(&mut read.pending) {
                            self.note(pending, "declarations follow this interpolation: they won over it in styled-components, and now it is listed after the style, so it wins over them");
                        }
                    }
                    let result = self.declaration(property, value, joined, context, read, at);
                    self.place(read, scope, result, || format!("{property}: {value};"), joined, at);
                }
                Rule::Block { selector, rules, text, at } => {
                    let at = joined.offset(*at);
                    for selector in split_selectors(selector) {
                        match self.selector(&selector, scope) {
                            Ok(inner) => self.rules(rules, joined, context, read, &inner),
                            Err(reason) => {
                                let comment = joined.restore(self.source, text);
                                self.note(
                                    at,
                                    format!("`{}` {reason}: port it by hand", joined.restore(self.source, &selector)),
                                );
                                read.fixed.at(&scope.blocks).comments.push(one_line(&comment));
                            }
                        }
                    }
                }
                Rule::Interpolation { index, at } => {
                    let at = joined.offset(*at);
                    let expression = joined.expressions[*index];
                    match self.interpolation(expression, context, read, top) {
                        Ok(text) if read.declared => {
                            read.after.push(text);
                            read.pending.push(at);
                        }
                        Ok(text) => read.before.push(text),
                        Err(reason) => {
                            self.note(at, format!("an interpolation that {reason}: port it by hand"));
                            read.fixed
                                .at(&scope.blocks)
                                .comments
                                .push(format!("${{{}}}", one_line(self.text(expression.span()))));
                        }
                    }
                }
                Rule::Unread { text, at } => {
                    let at = joined.offset(*at);
                    let text = joined.restore(self.source, text);
                    self.note(at, format!("`{}` is not a declaration: port it by hand", one_line(&text)));
                    read.fixed.at(&scope.blocks).comments.push(one_line(&text));
                }
            }
        }
    }

    /// Puts a declaration's value into the static or the dynamic style, or its text into a comment.
    fn place(
        &mut self,
        read: &mut Read,
        scope: &Scope,
        result: Result<(String, String, bool), String>,
        original: impl FnOnce() -> String,
        joined: &Joined<'_, '_, '_>,
        at: u32,
    ) {
        match result {
            Ok((name, value, dynamic)) => {
                let tree = if dynamic { &mut read.dynamic } else { &mut read.fixed };
                place(&mut tree.at(&scope.blocks).entries, (&name, &name), &scope.path, Piece::leaf(value));
            }
            Err(reason) => {
                let text = joined.restore(self.source, &original());
                self.note(at, format!("`{}` {reason}: port it by hand", one_line(&text)));
                read.fixed.at(&scope.blocks).comments.push(one_line(&text));
            }
        }
    }

    /// A declaration of a template: its property's name in Kirana, its value, and whether the value
    /// reads props.
    fn declaration(
        &mut self,
        property: &str,
        value: &str,
        joined: &Joined<'_, '_, '_>,
        context: &Context,
        read: &mut Read,
        at: u32,
    ) -> Result<(String, String, bool), String> {
        if property.contains(OPEN) {
            return Err("has a property named by an interpolation".to_owned());
        }
        let kebab = property.to_ascii_lowercase();
        if kebab.starts_with("--") {
            return Err("sets a custom property: make it a token (`defineTokens` with `variable: true`) and set it with the token as a key".to_owned());
        }
        if !is_known_property(&kebab) {
            return Err("is not a property Kirana knows".to_owned());
        }
        let mut value = one_line(&strip_comments(value));
        if let Some(stripped) = value.strip_suffix("!important") {
            self.note(at, format!("`!important` on {property}: Kirana writes none, since its precedence ladder orders every rule; it was dropped, so check what it was overriding"));
            value = stripped.trim_end().to_owned();
        }
        if !value.contains(OPEN) {
            let text = if is_number(&value) && accepts_number(&kebab) {
                kirana_ir::number_to_string(value.parse().unwrap_or_default())
            } else {
                js_string(&value)
            };
            return Ok((camel(property), text, false));
        }
        let mut literal = String::new();
        let mut parts = Vec::new();
        let mut dynamic = false;
        let mut at_text = 0;
        while let Some(offset) = value[at_text..].find(OPEN) {
            let start = at_text + offset;
            let (index, end) = placeholder(&value, start).expect("written by `joined`");
            literal.push_str(&value[at_text..start]);
            let expression = joined.expressions[index];
            let text = match expression {
                Expression::ArrowFunctionExpression(arrow) => {
                    dynamic = true;
                    if !context.props {
                        return Err("reads props outside a styled component".to_owned());
                    }
                    let binding = self.bind(arrow, context, read, Body::Value)?;
                    let body = arrow.get_expression().expect("`bind` refuses a body");
                    self.with_edits(body.span(), &binding.edits)
                }
                Expression::FunctionExpression(_) => return Err("is a function with a body".to_owned()),
                other => self.text(other.span()).to_owned(),
            };
            parts.push((std::mem::take(&mut literal), text));
            at_text = end;
        }
        let tail = &value[at_text..];
        if parts.len() == 1 && parts[0].0.is_empty() && tail.is_empty() {
            return Ok((camel(property), parts.remove(0).1, dynamic));
        }
        let escape = |text: &str| text.replace('\\', "\\\\").replace('`', "\\`").replace("${", "\\${");
        let mut out = String::from("`");
        for (literal, expression) in &parts {
            out.push_str(&escape(literal));
            out.push_str("${");
            out.push_str(expression);
            out.push('}');
        }
        out.push_str(&escape(tail));
        out.push('`');
        Ok((camel(property), out, dynamic))
    }

    /// A nested block's selector as the scope its rules are read in.
    fn selector(&mut self, selector: &str, scope: &Scope) -> Result<Scope, String> {
        let selector = selector.trim();
        if selector.contains(OPEN) {
            return Err("is a selector built from an interpolation (a component selector)".to_owned());
        }
        let mut next = scope.clone();
        if selector.starts_with('@') {
            kirana_ir::parse_condition_key(selector)
                .map_err(|error| format!("is not a condition Kirana takes ({error})"))?;
            let key = one_line(selector);
            next.path.push((key.clone(), js_string(&key)));
            return Ok(next);
        }
        let attached = match selector.strip_prefix('&') {
            Some(rest) if rest.starts_with([':', '[']) => Some(rest),
            Some(_) => None,
            None if selector.starts_with(':') => Some(selector),
            None => None,
        };
        if let Some(compound) = attached {
            let compound = legacy_pseudo_element(compound);
            let (conditions, pseudo) = match compound.find("::") {
                Some(at) => (&compound[..at], Some(&compound[at..])),
                None => (compound.as_str(), None),
            };
            if !conditions.is_empty() {
                kirana_ir::parse_condition_key(conditions)
                    .map_err(|error| format!("is not a condition Kirana takes ({error})"))?;
                next.path.push((conditions.to_owned(), js_string(conditions)));
                next.state = true;
            }
            if let Some(pseudo) = pseudo {
                if !scope.blocks.is_empty() {
                    return Err("is a pseudo-element inside another block".to_owned());
                }
                next.blocks.push(js_string(pseudo));
            }
            return Ok(next);
        }
        let (target, own) = match selector.strip_prefix('&') {
            Some(rest) => (rest.trim_start(), !rest.starts_with(char::is_whitespace)),
            None => (selector, false),
        };
        // `&&` only raised the rule's specificity, which Kirana's ladder makes no use of.
        if target.chars().all(|character| character == '&') {
            return Ok(next);
        }
        let (target, child) = match target.strip_prefix('>') {
            Some(rest) => (rest.trim_start(), true),
            None => (target, false),
        };
        if own && !child {
            return Err("styles the element itself by a class or a tag; Kirana's class names are hashes, so use a data attribute or a prop".to_owned());
        }
        if target.is_empty() || target.contains(['&', '+', '~', '>', ' ', ',']) {
            return Err("is a selector Kirana takes no condition for".to_owned());
        }
        if scope.state {
            return Err(
                "reaches a descendant only in a state; a `select` target cannot wait for the parent's state".to_owned()
            );
        }
        if !scope.blocks.is_empty() {
            return Err("is a descendant inside another block".to_owned());
        }
        self.used.insert("select");
        next.blocks.push(format!("[select.{}({})]", if child { "child" } else { "descendant" }, js_string(target)));
        Ok(next)
    }

    /// An interpolation between declarations: a mixin's handle, or a function choosing styles by
    /// props, as an entry of `sx`.
    fn interpolation(
        &mut self,
        expression: &Expression<'_>,
        context: &Context,
        read: &mut Read,
        top: bool,
    ) -> Result<String, String> {
        if !top {
            return Err("sits inside a nested block".to_owned());
        }
        if !context.props {
            return Err("adds a style inside a style; list both in `sx` instead".to_owned());
        }
        match expression {
            Expression::Identifier(_) | Expression::StaticMemberExpression(_) => {
                Ok(self.text(expression.span()).to_owned())
            }
            Expression::ArrowFunctionExpression(arrow) => {
                let binding = self.bind(arrow, context, read, Body::Styles)?;
                let body = arrow.get_expression().expect("`bind` refuses a body");
                if !styles_only(body, &self.survey.kinds) {
                    return Err("returns CSS text rather than a css`…` block".to_owned());
                }
                Ok(one_line(&self.with_edits(body.span(), &binding.edits)))
            }
            _ => Err("is not a mixin or a function of props".to_owned()),
        }
    }

    /// How an arrow function's parameter reads as the component's props: `p.$x` and a destructured
    /// `$x` as the `$x` the component takes out of its props, any other prop as `props.x`. When it
    /// returns styles, each css`…` block in it becomes a handle declared before the component.
    fn bind(
        &mut self,
        arrow: &ArrowFunctionExpression<'_>,
        context: &Context,
        read: &mut Read,
        body_kind: Body,
    ) -> Result<Binding, String> {
        let Some(body) = arrow.get_expression() else { return Err("has a body".to_owned()) };
        if arrow.params.items.len() > 1 || arrow.params.rest.is_some() {
            return Err("takes more than props".to_owned());
        }
        let mut scan = Scan::default();
        match body.without_parentheses() {
            // An Emotion style function's object: a spread or a computed key in it is reported by
            // [`Walker::object`], and the rest is still read.
            Expression::ObjectExpression(object) if body_kind == Body::Object => {
                for property in &object.properties {
                    if let ObjectPropertyKind::ObjectProperty(property) = property
                        && !property.computed
                    {
                        scan_expression(&property.value, &self.survey.kinds, &mut scan);
                    }
                }
            }
            body => scan_expression(body, &self.survey.kinds, &mut scan),
        }
        if let Some(reason) = scan.refused {
            return Err(reason.to_owned());
        }
        let mut binding = Binding::default();
        let mut prop = None;
        match arrow.params.items.first().map(|parameter| &parameter.pattern) {
            None => {}
            Some(BindingPattern::BindingIdentifier(parameter)) => {
                let name = parameter.name.as_str();
                for (span, object, property) in &scan.members {
                    if object != name {
                        continue;
                    }
                    if property == "theme" {
                        return Err("reads the theme".to_owned());
                    }
                    prop.get_or_insert_with(|| property.clone());
                    if property.starts_with('$') {
                        read.transient.insert(property.clone());
                        binding.edits.push((*span, property.clone()));
                    } else {
                        binding.edits.push((*span, format!("props.{property}")));
                    }
                }
                for (span, identifier) in &scan.identifiers {
                    if identifier == name {
                        binding.edits.push((*span, "props".to_owned()));
                    }
                }
            }
            Some(BindingPattern::ObjectPattern(pattern)) => {
                if pattern.rest.is_some() {
                    return Err("collects the rest of the props".to_owned());
                }
                for property in &pattern.properties {
                    let (true, BindingPattern::BindingIdentifier(identifier)) = (property.shorthand, &property.value)
                    else {
                        return Err("renames a prop or gives it a default".to_owned());
                    };
                    let name = identifier.name.to_string();
                    if name == "theme" {
                        return Err("reads the theme".to_owned());
                    }
                    prop.get_or_insert_with(|| name.clone());
                    if name.starts_with('$') {
                        read.transient.insert(name);
                        continue;
                    }
                    for (span, identifier) in &scan.identifiers {
                        if *identifier == name {
                            binding.edits.push((*span, format!("props.{name}")));
                        }
                    }
                }
            }
            Some(_) => return Err("takes its props in a pattern".to_owned()),
        }
        if scan.styles.is_empty() {
            return Ok(binding);
        }
        if body_kind != Body::Styles {
            return Err("holds a css`…` block inside a value".to_owned());
        }
        let base =
            format!("{}{}", context.name, upper_first(prop.as_deref().unwrap_or("style").trim_start_matches('$')));
        for style in scan.styles {
            let mut inner = Read::default();
            let quiet = Context { props: false, name: context.name.clone() };
            self.template(&style.quasi, &quiet, &mut inner);
            let handle = self.fresh(&base);
            read.hoisted.push(format!("const {handle} = css({})", inner.fixed.render(Some(""))));
            self.used.insert("css");
            binding.edits.push((style.span, handle));
        }
        Ok(binding)
    }

    /// The source of `span` with the edits made inside it.
    fn with_edits(&self, span: Span, edits: &[(Span, String)]) -> String {
        let mut inside: Vec<&(Span, String)> =
            edits.iter().filter(|(edit, _)| span.start <= edit.start && edit.end <= span.end).collect();
        inside.sort_by_key(|(edit, _)| edit.start);
        let mut out = String::new();
        let mut at = span.start;
        for (edit, text) in inside {
            out.push_str(&self.source[at as usize..edit.start as usize]);
            out.push_str(text);
            at = edit.end;
        }
        out.push_str(&self.source[at as usize..span.end as usize]);
        out
    }

    /// An Emotion style object: its properties, its nested blocks, each value read through
    /// `binding` when it is the body of a style function.
    fn object(&mut self, object: &ObjectExpression<'_>, binding: &Binding, read: &mut Read, scope: &Scope) {
        for property in &object.properties {
            let ObjectPropertyKind::ObjectProperty(property) = property else {
                self.note(property.span().start, "a spread in a style: port it by hand");
                read.fixed.at(&scope.blocks).comments.push(one_line(self.text(property.span())));
                continue;
            };
            let Some(key) = crate::key_name(property) else {
                self.note(property.span.start, "a computed key in a style: port it by hand");
                read.fixed.at(&scope.blocks).comments.push(one_line(self.text(property.span)));
                continue;
            };
            if let Expression::ObjectExpression(block) = &property.value {
                match self.selector(&key, scope) {
                    Ok(inner) => self.object(block, binding, read, &inner),
                    Err(reason) => {
                        self.note(property.span.start, format!("`{key}` {reason}: port it by hand"));
                        read.fixed.at(&scope.blocks).comments.push(one_line(self.text(property.span)));
                    }
                }
                continue;
            }
            let result = self.value(&key, &property.value, binding);
            let text = self.text(property.span).to_owned();
            let at = property.span.start;
            let joined = Joined { map: Vec::new(), expressions: &[] };
            self.place(read, scope, result, || text, &joined, at);
        }
    }

    /// A value of a style object, and whether it reads props.
    fn value(
        &mut self,
        key: &str,
        value: &Expression<'_>,
        binding: &Binding,
    ) -> Result<(String, String, bool), String> {
        if key.starts_with("--") {
            return Err("sets a custom property: make it a token (`defineTokens` with `variable: true`) and set it with the token as a key".to_owned());
        }
        let name = if key.contains('-') { camel(key) } else { key.to_owned() };
        if !is_known_property(&kebab_case(&name)) {
            return Err("is not a property Kirana knows".to_owned());
        }
        if let Expression::StringLiteral(text) = value
            && let Some(stripped) = text.value.as_str().and_then(|text| text.strip_suffix("!important"))
        {
            self.note(value.span().start, format!("`!important` on {name}: Kirana writes none, since its precedence ladder orders every rule; it was dropped, so check what it was overriding"));
            return Ok((name, js_string(stripped.trim_end()), false));
        }
        if let Some(text) = with_unit(&name, value) {
            return Ok((name, text, false));
        }
        let span = value.span();
        let dynamic = binding.edits.iter().any(|(edit, _)| span.start <= edit.start && edit.end <= span.end);
        Ok((name, self.with_edits(span, &binding.edits), dynamic))
    }

    /// `css`…`` and `css({…})` outside a styled component: a handle, its blocks lifted into its
    /// properties. Only static styles: a function of props has no props here.
    fn standalone(&mut self, span: Span, style: Standalone<'_, '_>, indent: &str) {
        self.claimed.push(span);
        let context = Context { props: false, name: String::new() };
        let mut read = Read::default();
        match style {
            Standalone::Template(template) => self.template(template, &context, &mut read),
            Standalone::Object(object) => self.object(object, &Binding::default(), &mut read, &Scope::default()),
        }
        self.used.insert("css");
        self.replace(span, format!("css({})", read.fixed.render(Some(indent))));
    }

    /// `keyframes`…`` and `keyframes({…})`: each frame a style of its own.
    fn keyframes(&mut self, span: Span, frames: Vec<(String, Read)>, unread: Vec<String>, indent: &str) {
        self.claimed.push(span);
        self.used.insert("keyframes");
        let mut tree = Tree::default();
        for (selector, read) in frames {
            let key = if selector == "from" || selector == "to" { selector } else { js_string(&selector) };
            tree.blocks.push((key, read.fixed));
        }
        tree.comments = unread;
        self.replace(span, format!("keyframes({})", tree.render(Some(indent))));
    }

    fn keyframes_template(&mut self, span: Span, template: &TemplateLiteral<'_>, indent: &str) {
        let (text, map) = joined(template);
        let rules = Parser { text: &text, at: 0 }.rules(false);
        let expressions: Vec<&Expression<'_>> = template.expressions.iter().collect();
        let source = Joined { map, expressions: &expressions };
        let context = Context { props: false, name: String::new() };
        let mut frames = Vec::new();
        let mut unread = Vec::new();
        for rule in &rules {
            match rule {
                Rule::Block { selector, rules, .. } => {
                    let mut read = Read::default();
                    self.rules(rules, &source, &context, &mut read, &Scope::default());
                    frames.push((one_line(selector), read));
                }
                Rule::Declaration { property, value, at } => {
                    unread.push(self.outside_frames(&source, &format!("{property}: {value};"), *at));
                }
                Rule::Interpolation { index, at } => {
                    let text = format!("${{{}}}", self.text(source.expressions[*index].span()));
                    unread.push(self.outside_frames(&source, &text, *at));
                }
                Rule::Unread { text, at } => unread.push(self.outside_frames(&source, text, *at)),
            }
        }
        self.keyframes(span, frames, unread, indent);
    }

    /// A rule of a keyframes template outside its frames, reported, as the comment it stays as.
    fn outside_frames(&mut self, joined: &Joined<'_, '_, '_>, text: &str, at: usize) -> String {
        self.note(joined.offset(at), "keyframes hold frames only: port this by hand");
        one_line(&joined.restore(self.source, text))
    }

    /// The indentation of the line `at` is on.
    fn indent(&self, at: u32) -> String {
        let line = self.source[..at as usize].rfind('\n').map_or(0, |start| start + 1);
        self.source[line..].chars().take_while(|character| *character == ' ' || *character == '\t').collect()
    }

    /// Whether the element a JSX attribute is on is a component from an installed package.
    fn is_external(&self, element: &JSXOpeningElement<'_>) -> bool {
        let local = match &element.name {
            JSXElementName::IdentifierReference(reference) => reference.name.as_str(),
            JSXElementName::MemberExpression(member) => match &member.object {
                JSXMemberExpressionObject::IdentifierReference(reference) => reference.name.as_str(),
                _ => return false,
            },
            _ => return false,
        };
        self.survey.imports.get(local).is_some_and(|specifier| self.environment.is_external(specifier))
    }

    /// Writes `attribute` as `sx={value}`, or `{...styleProps(value)}` on a component that does not
    /// read `sx`, leaving the value's own text (and the rewrites inside it) where it is.
    fn as_sx(&mut self, element: &JSXOpeningElement<'_>, attribute: Span, value: Span) {
        if self.is_external(element) {
            self.used.insert("props as styleProps");
            self.replace(Span::new(attribute.start, value.start), "{...styleProps(");
            self.replace(Span::new(value.end, attribute.end), ")}");
        } else {
            self.replace(Span::new(attribute.start, value.start), "sx={");
        }
    }

    /// Emotion's `css` prop: an object becomes a `css()` call, an array its items, anything else
    /// is passed as it is.
    fn css_prop(&mut self, element: &JSXOpeningElement<'_>, span: Span, value: &Expression<'_>) {
        if matches!(value, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)) {
            self.note(span.start, "a `css` prop that reads the theme: port it by hand");
            return;
        }
        let indent = self.indent(span.start);
        self.objects(value, &indent);
        self.as_sx(element, span, value.span());
    }

    /// Each style object `value` may be, as a `css()` call: the value itself, an item of an array,
    /// or a branch of `&&`, `||`, `??` or a conditional.
    fn objects(&mut self, value: &Expression<'_>, indent: &str) {
        match value {
            Expression::ObjectExpression(object) => self.standalone(object.span, Standalone::Object(object), indent),
            Expression::ArrayExpression(array) => {
                for item in array.elements.iter().filter_map(|item| item.as_expression()) {
                    self.objects(item, indent);
                }
            }
            Expression::LogicalExpression(logical) => {
                self.objects(&logical.left, indent);
                self.objects(&logical.right, indent);
            }
            Expression::ConditionalExpression(conditional) => {
                self.objects(&conditional.consequent, indent);
                self.objects(&conditional.alternate, indent);
            }
            Expression::ParenthesizedExpression(inner) => self.objects(&inner.expression, indent),
            _ => {}
        }
    }
}

/// Splits a selector list at its top-level commas.
fn split_selectors(selector: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut depth = 0usize;
    let mut start = 0;
    for (index, character) in selector.char_indices() {
        match character {
            '(' | '[' => depth += 1,
            ')' | ']' => depth = depth.saturating_sub(1),
            ',' if depth == 0 => {
                out.push(selector[start..index].trim().to_owned());
                start = index + 1;
            }
            _ => {}
        }
    }
    out.push(selector[start..].trim().to_owned());
    out
}

/// `:before` and the other pseudo-elements CSS 2 wrote with one colon, with two.
fn legacy_pseudo_element(compound: &str) -> String {
    for name in [":before", ":after", ":first-line", ":first-letter"] {
        if let Some(at) = compound.find(name)
            && !compound[..at].ends_with(':')
        {
            return format!("{}:{}", &compound[..at], &compound[at..]);
        }
    }
    compound.to_owned()
}

/// `text` without its `/* … */` comments.
fn strip_comments(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(start) = rest.find("/*") {
        out.push_str(&rest[..start]);
        rest = rest[start..].find("*/").map_or("", |end| &rest[start + end + 2..]);
    }
    out.push_str(rest);
    out
}

/// Whether what a function of props returns is always a style: a css`…` block, a mixin, or
/// nothing, chosen by `&&`, `||`, `??` or a conditional.
fn styles_only(expression: &Expression<'_>, kinds: &BTreeMap<String, Kind>) -> bool {
    match expression.without_parentheses() {
        Expression::TaggedTemplateExpression(tagged) => {
            matches!(&tagged.tag, Expression::Identifier(tag) if kinds.get(tag.name.as_str()) == Some(&Kind::Css))
        }
        Expression::ConditionalExpression(conditional) => {
            styles_only(&conditional.consequent, kinds) && styles_only(&conditional.alternate, kinds)
        }
        Expression::LogicalExpression(logical) if logical.operator == LogicalOperator::And => {
            styles_only(&logical.right, kinds)
        }
        Expression::LogicalExpression(logical) => {
            styles_only(&logical.left, kinds) && styles_only(&logical.right, kinds)
        }
        Expression::Identifier(_)
        | Expression::StaticMemberExpression(_)
        | Expression::NullLiteral(_)
        | Expression::BooleanLiteral(_) => true,
        Expression::StringLiteral(text) => text.value.as_str() == Some(""),
        _ => false,
    }
}

/// What a function of props reads: identifiers, members of an identifier, and css`…` blocks, which
/// are not entered. The first thing this codemod does not read is kept as the reason to refuse it.
fn scan_expression<'b, 'a>(expression: &'b Expression<'a>, kinds: &BTreeMap<String, Kind>, scan: &mut Scan<'b, 'a>) {
    match expression {
        Expression::Identifier(identifier) => scan.identifiers.push((identifier.span, identifier.name.to_string())),
        Expression::StaticMemberExpression(member) => match &member.object {
            Expression::Identifier(object) => {
                scan.members.push((member.span, object.name.to_string(), member.property.name.to_string()))
            }
            object => scan_expression(object, kinds, scan),
        },
        Expression::ComputedMemberExpression(member) => {
            scan_expression(&member.object, kinds, scan);
            scan_expression(&member.expression, kinds, scan);
        }
        Expression::ConditionalExpression(conditional) => {
            scan_expression(&conditional.test, kinds, scan);
            scan_expression(&conditional.consequent, kinds, scan);
            scan_expression(&conditional.alternate, kinds, scan);
        }
        Expression::LogicalExpression(logical) => {
            scan_expression(&logical.left, kinds, scan);
            scan_expression(&logical.right, kinds, scan);
        }
        Expression::BinaryExpression(binary) => {
            scan_expression(&binary.left, kinds, scan);
            scan_expression(&binary.right, kinds, scan);
        }
        Expression::UnaryExpression(unary) => scan_expression(&unary.argument, kinds, scan),
        Expression::ParenthesizedExpression(inner) => scan_expression(&inner.expression, kinds, scan),
        Expression::TemplateLiteral(template) => {
            for inner in &template.expressions {
                scan_expression(inner, kinds, scan);
            }
        }
        Expression::CallExpression(call) => {
            scan_expression(&call.callee, kinds, scan);
            for argument in &call.arguments {
                match argument.as_expression() {
                    Some(argument) => scan_expression(argument, kinds, scan),
                    None => scan.refuse("spreads arguments"),
                }
            }
        }
        Expression::ObjectExpression(object) => {
            for property in &object.properties {
                let ObjectPropertyKind::ObjectProperty(property) = property else {
                    scan.refuse("spreads an object");
                    continue;
                };
                if property.computed
                    && let Some(key) = property.key.as_expression()
                {
                    scan_expression(key, kinds, scan);
                }
                if let (PropertyKey::StaticIdentifier(key), true) = (&property.key, property.shorthand) {
                    scan.identifiers.push((key.span, key.name.to_string()));
                    continue;
                }
                scan_expression(&property.value, kinds, scan);
            }
        }
        Expression::TaggedTemplateExpression(tagged) if matches!(&tagged.tag, Expression::Identifier(tag) if kinds.get(tag.name.as_str()) == Some(&Kind::Css)) => {
            scan.styles.push(tagged)
        }
        Expression::StringLiteral(_)
        | Expression::NumericLiteral(_)
        | Expression::BooleanLiteral(_)
        | Expression::NullLiteral(_) => {}
        _ => scan.refuse("is an expression this codemod does not read"),
    }
}

/// A template's text with each interpolation as a placeholder, and where each part starts in the
/// source: (offset in the text, offset in the source).
fn joined(template: &TemplateLiteral<'_>) -> (String, Vec<(usize, u32)>) {
    let mut text = String::new();
    let mut map = Vec::new();
    for (index, quasi) in template.quasis.iter().enumerate() {
        map.push((text.len(), quasi.span.start));
        text.push_str(quasi.value.cooked.and_then(|cooked| cooked.as_str()).unwrap_or(&quasi.value.raw));
        if let Some(expression) = template.expressions.get(index) {
            map.push((text.len(), expression.span().start));
            text.push(OPEN);
            text.push_str(&index.to_string());
            text.push(CLOSE);
        }
    }
    (text, map)
}

/// A template's interpolations, and how its joined text maps back to the source.
struct Joined<'m, 'b, 'a> {
    map: Vec<(usize, u32)>,
    expressions: &'m [&'b Expression<'a>],
}

impl Joined<'_, '_, '_> {
    /// The source offset of `at` in the joined text.
    fn offset(&self, at: usize) -> u32 {
        self.map
            .iter()
            .rev()
            .find(|(start, _)| *start <= at)
            .map_or(0, |(start, source)| source + u32::try_from(at - start).unwrap_or(0))
    }

    /// `text` with its placeholders written back as `${…}`.
    fn restore(&self, source: &str, text: &str) -> String {
        let mut out = String::new();
        let mut at = 0;
        while let Some(offset) = text[at..].find(OPEN) {
            let start = at + offset;
            out.push_str(&text[at..start]);
            let (index, end) = placeholder(text, start).expect("written by `joined`");
            let span = self.expressions[index].span();
            out.push_str("${");
            out.push_str(&source[span.start as usize..span.end as usize]);
            out.push('}');
            at = end;
        }
        out.push_str(&text[at..]);
        out
    }
}

impl Walker<'_, '_> {
    /// Applies the edits from the end, and writes the imports: Kirana's where the first library
    /// import was, and what is left of each library's.
    fn finish(mut self) -> (String, Vec<Note>, bool) {
        let jsx = !self.wrappers.is_empty();
        for (name, at) in std::mem::take(&mut self.polymorphic) {
            if self.wrappers.contains(&name) {
                self.note(at, format!("`as` on {name}: the component always renders its own element; give the other element a component of its own with the same handles"));
            }
        }
        let residuals: Vec<(u32, String)> = self
            .survey
            .declarations
            .iter()
            .flat_map(|declaration| {
                declaration
                    .named
                    .iter()
                    .filter(|(local, _)| !self.survey.kinds.contains_key(local))
                    .map(|(local, _)| (declaration.span.start, residual(local, &declaration.source)))
            })
            .collect();
        for (at, message) in residuals {
            self.note(at, message);
        }
        if self.edits.is_empty() {
            self.notes.sort_by_key(|note| note.offset);
            return (self.source.to_owned(), self.notes, false);
        }
        for (at, declarations) in std::mem::take(&mut self.hoisted) {
            let mut text = declarations.join("\n");
            text.push_str("\n\n");
            self.edits.push(Edit { span: Span::new(at, at), text });
        }
        let declarations = std::mem::take(&mut self.survey.declarations);
        for (index, declaration) in declarations.iter().enumerate() {
            let marker = if index == 0 { IMPORT_MARKER } else { "" };
            if declaration.namespace {
                self.note(
                    declaration.span.start,
                    format!("a namespace import of {}: port its uses by hand", declaration.source),
                );
                if !marker.is_empty() {
                    self.edits.push(Edit {
                        span: Span::new(declaration.span.start, declaration.span.start),
                        text: format!("{marker}\n"),
                    });
                }
                continue;
            }
            let keep = |local: &String| !self.survey.kinds.contains_key(local) || self.kept.contains(local);
            let default = declaration.default.clone().filter(keep);
            let named: Vec<String> = declaration
                .named
                .iter()
                .filter(|(local, _)| keep(local))
                .map(|(_, span)| self.text(*span).to_owned())
                .collect();
            let mut text = marker.to_owned();
            if default.is_some() || !named.is_empty() {
                if !text.is_empty() {
                    text.push('\n');
                }
                let mut parts = Vec::new();
                parts.extend(default);
                if !named.is_empty() {
                    parts.push(format!("{{ {} }}", named.join(", ")));
                }
                text.push_str(&format!("import {} from {}", parts.join(", "), js_string(&declaration.source)));
            }
            let mut end = declaration.span.end;
            if text.is_empty() && self.source[end as usize..].starts_with('\n') {
                end += 1;
            }
            self.edits.push(Edit { span: Span::new(declaration.span.start, end), text });
        }
        self.edits.sort_by(|a, b| b.span.start.cmp(&a.span.start).then(b.span.end.cmp(&a.span.end)));
        // No two edits overlap: a rewrite claims what it writes again whole, and the visitors stop
        // at a claimed span.
        let mut out = self.source.to_owned();
        for edit in &self.edits {
            out.replace_range(edit.span.start as usize..edit.span.end as usize, &edit.text);
        }
        let names: Vec<&str> = self.used.iter().copied().collect();
        let mut import = if names.is_empty() {
            String::new()
        } else {
            format!("import {{ {} }} from \"@kirana-style/core\"", names.join(", "))
        };
        if self.component_props {
            import.push_str("\nimport type { ComponentProps } from \"react\"");
        }
        out = out.replacen(IMPORT_MARKER, &import, 1);
        self.notes.sort_by_key(|note| note.offset);
        (out, self.notes, jsx)
    }
}

/// What to do with a name a library exports and Kirana has no counterpart for.
fn residual(local: &str, library: &str) -> String {
    let advice = match local {
        "createGlobalStyle" | "injectGlobal" | "Global" => {
            "global styles go in a stylesheet: Kirana writes rules for elements that use a style, never global ones"
        }
        "ThemeProvider" | "useTheme" | "withTheme" | "ThemeContext" => {
            "a theme is tokens in Kirana (`defineTokens`, `defineTheme`), read where they are used"
        }
        _ => "Kirana has no counterpart",
    };
    format!("`{local}` from {library} stays: {advice}; port its uses by hand")
}

impl<'a> Visit<'a> for Walker<'_, '_> {
    fn visit_program(&mut self, program: &Program<'a>) {
        for statement in &program.body {
            self.statement = statement.span().start;
            self.visit_statement(statement);
        }
    }

    fn visit_variable_declarator(&mut self, declarator: &VariableDeclarator<'a>) {
        if let (Some(name), Some(init)) = (declarator.id.get_identifier_name(), declarator.init.as_ref()) {
            self.names.push((init.span().start, name.to_string()));
        }
        walk::walk_variable_declarator(self, declarator);
    }

    fn visit_tagged_template_expression(&mut self, tagged: &TaggedTemplateExpression<'a>) {
        if self.is_claimed(tagged.span) {
            return;
        }
        let indent = self.indent(tagged.span.start);
        match self.kind(&tagged.tag) {
            Some(Kind::Css) => return self.standalone(tagged.span, Standalone::Template(&tagged.quasi), &indent),
            Some(Kind::Keyframes) => return self.keyframes_template(tagged.span, &tagged.quasi, &indent),
            _ => {}
        }
        if let Some(form) = self.form(&tagged.tag) {
            return self.styled(tagged.span, form, Style::Template(&tagged.quasi), tagged.type_arguments.as_deref());
        }
        walk::walk_tagged_template_expression(self, tagged);
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if self.is_claimed(call.span) {
            return;
        }
        let first = call.arguments.first().and_then(Argument::as_expression);
        let indent = self.indent(call.span.start);
        match (self.kind(&call.callee), first) {
            (Some(Kind::Css), Some(Expression::ObjectExpression(object))) if call.arguments.len() == 1 => {
                return self.standalone(call.span, Standalone::Object(object), &indent);
            }
            (Some(Kind::Css), _) => {
                // Emotion composes with `css(a, b)`; an `sx` array is the same list.
                for argument in call.arguments.iter().filter_map(Argument::as_expression) {
                    self.objects(argument, &indent);
                }
                let open = call.arguments.first().map_or(call.span.end, |argument| argument.span().start);
                let close = call.arguments.last().map_or(call.span.end, |argument| argument.span().end);
                self.replace(Span::new(call.span.start, open), "[");
                self.replace(Span::new(close, call.span.end), "]");
                return walk::walk_call_expression(self, call);
            }
            (Some(Kind::Keyframes), Some(Expression::ObjectExpression(object))) => {
                let mut frames = Vec::new();
                for frame in &object.properties {
                    if let ObjectPropertyKind::ObjectProperty(frame) = frame
                        && let (Some(key), Expression::ObjectExpression(style)) = (crate::key_name(frame), &frame.value)
                    {
                        let mut read = Read::default();
                        self.object(style, &Binding::default(), &mut read, &Scope::default());
                        frames.push((key, read));
                    }
                }
                return self.keyframes(call.span, frames, Vec::new(), &indent);
            }
            (Some(Kind::Cx), _) if !self.joined.contains(&call.span.start) => {
                self.used.insert("cx");
            }
            _ => {}
        }
        if let Some(form) = self.form(&call.callee)
            && call.arguments.len() == 1
        {
            let style = match first {
                Some(Expression::ObjectExpression(object)) => Some(Style::Object(object)),
                Some(Expression::ArrowFunctionExpression(arrow)) => Some(Style::Function(arrow)),
                _ => None,
            };
            if let Some(style) = style {
                return self.styled(call.span, form, style, call.type_arguments.as_deref());
            }
        }
        walk::walk_call_expression(self, call);
    }

    fn visit_jsx_opening_element(&mut self, element: &JSXOpeningElement<'a>) {
        for item in &element.attributes {
            let JSXAttributeItem::Attribute(attribute) = item else { continue };
            let JSXAttributeName::Identifier(name) = &attribute.name else { continue };
            let value = match &attribute.value {
                Some(JSXAttributeValue::ExpressionContainer(container)) => container.expression.as_expression(),
                _ => None,
            };
            match (name.name.as_str(), value) {
                ("css", Some(value)) => self.css_prop(element, attribute.span, value),
                ("className", Some(Expression::TaggedTemplateExpression(tagged)))
                    if self.kind(&tagged.tag) == Some(Kind::Css) =>
                {
                    self.as_sx(element, attribute.span, tagged.span);
                }
                ("className", Some(Expression::CallExpression(call))) => match self.kind(&call.callee) {
                    Some(Kind::Css) => self.as_sx(element, attribute.span, call.span),
                    Some(Kind::Cx) => {
                        // `cx(a, b)` is an `sx` array of the same handles.
                        self.joined.insert(call.span.start);
                        let open = call.arguments.first().map_or(call.span.end - 1, |argument| argument.span().start);
                        let close = call.arguments.last().map_or(call.span.end - 1, |argument| argument.span().end);
                        let external = self.is_external(element);
                        if external {
                            self.used.insert("props as styleProps");
                        }
                        self.replace(
                            Span::new(attribute.span.start, open),
                            if external { "{...styleProps(" } else { "sx={[" },
                        );
                        self.replace(Span::new(close, attribute.span.end), if external { ")}" } else { "]}" });
                    }
                    _ => {}
                },
                ("as", _) => {
                    if let JSXElementName::IdentifierReference(reference) = &element.name {
                        self.polymorphic.push((reference.name.to_string(), attribute.span.start));
                    }
                }
                _ => {}
            }
        }
        walk::walk_jsx_opening_element(self, element);
    }
}
