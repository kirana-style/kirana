//! The StyleX codemod behind `kirana-style migrate stylex` (KRN-API-013, D-003).
//!
//! It rewrites the mechanical half of a migration and reports the half a hand port gets wrong
//! (`!important`, a selector Kirana takes no condition for, a `stylex.when` with no equivalent,
//! the default marker's import). A `default: null` entry is dropped, not translated: Kirana's
//! `base: null` removes an earlier handle's value (D-013). Inside a style, values are written as
//! StyleX read them (KF-074).

pub mod environment;
pub mod tailwind;

use std::collections::BTreeSet;
use std::path::Path;

use kirana_css_data::{accepts_number, is_known_property};
use kirana_shared::kebab_case;
use oxc_ast::ast::{
    Argument, ArrayExpression, ArrowFunctionBody, CallExpression, ComputedMemberExpression, Expression,
    ImportDeclaration, JSXAttributeItem, JSXSpreadAttribute, ObjectExpression, ObjectProperty, ObjectPropertyKind,
    PropertyKey, StaticMemberExpression, TSTypeName, VariableDeclarator,
};
use oxc_ast_visit::{Visit, walk};
use oxc_span::{GetSpan, Span};
use oxc_syntax::operator::UnaryOperator;

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
    /// The name the file should take: `theme.stylex.ts` becomes `theme.ts`, and so on for every
    /// script extension.
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

/// Stands where the StyleX import was until the walk knows which names the rewritten file imports.
const IMPORT_MARKER: &str = "/*__KIRANA_IMPORT__*/";

/// StyleX's own names for properties CSS names otherwise (its plugin's aliases), and the standard
/// property each one stands for. A name Kirana knows is left as written.
const ALIASES: &[(&str, &str)] = &[
    ("borderHorizontalWidth", "borderInlineWidth"),
    ("borderHorizontalStyle", "borderInlineStyle"),
    ("borderHorizontalColor", "borderInlineColor"),
    ("borderVerticalWidth", "borderBlockWidth"),
    ("borderVerticalStyle", "borderBlockStyle"),
    ("borderVerticalColor", "borderBlockColor"),
    ("borderStartColor", "borderInlineStartColor"),
    ("borderEndColor", "borderInlineEndColor"),
    ("borderStartStyle", "borderInlineStartStyle"),
    ("borderEndStyle", "borderInlineEndStyle"),
    ("borderStartWidth", "borderInlineStartWidth"),
    ("borderEndWidth", "borderInlineEndWidth"),
    ("borderTopStartRadius", "borderStartStartRadius"),
    ("borderTopEndRadius", "borderStartEndRadius"),
    ("borderBottomStartRadius", "borderEndStartRadius"),
    ("borderBottomEndRadius", "borderEndEndRadius"),
    ("gridGap", "gap"),
    ("gridRowGap", "rowGap"),
    ("gridColumnGap", "columnGap"),
    ("marginStart", "marginInlineStart"),
    ("marginEnd", "marginInlineEnd"),
    ("marginHorizontal", "marginInline"),
    ("marginVertical", "marginBlock"),
    ("paddingStart", "paddingInlineStart"),
    ("paddingEnd", "paddingInlineEnd"),
    ("paddingHorizontal", "paddingInline"),
    ("paddingVertical", "paddingBlock"),
    ("start", "insetInlineStart"),
    ("end", "insetInlineEnd"),
];

/// The properties StyleX gives a bare number `ms` rather than `px`.
const DURATIONS: &[&str] = &["animationDelay", "animationDuration", "transitionDelay", "transitionDuration"];

/// The condition a StyleX theme value names for dark mode, which a Kirana mode object calls `dark`.
const DARK_SCHEME: &str = "@media (prefers-color-scheme: dark)";

/// A file the parser reads as TypeScript, which `as const` may be written into.
const TYPESCRIPT: &[&str] = &["ts", "tsx", "mts", "cts"];

/// The extensions a StyleX token file (`theme.stylex.js`) loses `.stylex` before.
const SCRIPTS: &[&str] = &["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];

/// Migrates one file's source.
///
/// A file that does not parse is returned unchanged with a note: a codemod that half-rewrites a
/// file it could not read is worse than one that declines.
pub fn migrate(path: &Path, source: &str) -> Migration {
    let rename = path.file_name().and_then(|name| name.to_str()).and_then(|name| {
        let (stem, extension) = name.rsplit_once(".stylex.")?;
        SCRIPTS.contains(&extension).then(|| format!("{stem}.{extension}"))
    });
    let typescript = path.extension().and_then(|extension| extension.to_str()).is_some_and(|e| TYPESCRIPT.contains(&e));
    let file = path.display().to_string();
    let parsed = kirana_frontend::with_parsed(path, &file, source, |parsed| {
        let mut survey = Survey::default();
        survey.visit_program(parsed.program);
        let mut walker = Walker::new(source, typescript, survey);
        walker.visit_program(parsed.program);
        walker.finish()
    });
    match parsed {
        Ok((rewritten, notes)) => Migration { source: rewritten, notes, rename },
        Err(_) => {
            // StyleX code is often Flow (KF-074), which the parser does not read.
            let message = if is_flow(source) {
                "the file is Flow, which this codemod cannot read: strip its types first (`npx flow-remove-types --pretty`), then run it again"
            } else {
                "the file does not parse; nothing was rewritten"
            };
            Migration {
                source: source.to_owned(),
                notes: vec![Note { offset: 0, message: message.to_owned() }],
                rename: None,
            }
        }
    }
}

/// Whether a file declares itself Flow: an `@flow` pragma in its leading comments.
fn is_flow(source: &str) -> bool {
    source
        .lines()
        .map(str::trim)
        .take_while(|line| line.is_empty() || line.starts_with("//") || line.starts_with("/*") || line.starts_with('*'))
        .any(|line| line.contains("@flow"))
}

/// What the rewrite needs to know before it starts: the constants holding the dark-scheme condition
/// (`const DARK = "@media (…dark)"`), so a theme value keyed `[DARK]` reads as dark mode, and the
/// constants a theme's values are declared in (`createTheme(colors, systemTheme)`).
#[derive(Default)]
struct Survey {
    dark: Vec<String>,
    themes: Vec<String>,
}

impl<'a> Visit<'a> for Survey {
    fn visit_variable_declarator(&mut self, declarator: &VariableDeclarator<'a>) {
        if let (Some(name), Some(Expression::StringLiteral(value))) =
            (declarator.id.get_identifier_name(), &declarator.init)
            && value.value == DARK_SCHEME
        {
            self.dark.push(name.to_string());
        }
        walk::walk_variable_declarator(self, declarator);
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        let values = match member_of(&call.callee, "stylex") {
            Some("defineVars") => call.arguments.first(),
            Some("createTheme") => call.arguments.get(1),
            _ => None,
        };
        if let Some(Expression::Identifier(name)) = values.and_then(Argument::as_expression) {
            self.themes.push(name.name.to_string());
        }
        walk::walk_call_expression(self, call);
    }
}

/// A key's name when it has one: `color`, `"color"`, `":hover"`; `None` for `[key]`.
fn key_name(property: &ObjectProperty<'_>) -> Option<String> {
    if property.computed {
        return None;
    }
    property.key.static_name().and_then(|name| name.as_str().map(str::to_owned))
}

/// StyleX's condition keys: a pseudo-class (not a pseudo-element) or an at-rule.
fn is_condition(name: &str) -> bool {
    (name.starts_with(':') && !name.starts_with("::")) || name.starts_with('@')
}

/// The standard property a StyleX alias stands for, when Kirana does not know the name itself.
fn standard_name(name: &str) -> Option<&'static str> {
    if is_known_property(&kebab_case(name)) {
        return None;
    }
    ALIASES.iter().find(|(alias, _)| *alias == name).map(|(_, standard)| *standard)
}

/// A bare number as StyleX wrote it out, where Kirana would refuse it (`unitless-length`): with `ms`
/// on a duration and `px` on anything else. Zero, and a number the property takes, stay as they are.
fn with_unit(name: &str, value: &Expression<'_>) -> Option<String> {
    let number = match value {
        Expression::NumericLiteral(literal) => literal.value,
        Expression::UnaryExpression(unary) if unary.operator == UnaryOperator::UnaryNegation => match &unary.argument {
            Expression::NumericLiteral(literal) => -literal.value,
            _ => return None,
        },
        _ => return None,
    };
    let kebab = kebab_case(name);
    if number == 0.0 || !is_known_property(&kebab) || accepts_number(&kebab) {
        return None;
    }
    let unit = if DURATIONS.contains(&name) { "ms" } else { "px" };
    Some(format!("\"{}{unit}\"", kirana_ir::number_to_string(number)))
}

/// One property's value in a style rebuilt when its condition blocks move into its properties: its
/// value at rest, its conditions, or both.
#[derive(Default)]
struct Piece {
    base: Option<String>,
    conditions: Vec<(String, String, Piece)>,
}

impl Piece {
    fn leaf(text: String) -> Self {
        Self { base: Some(text), conditions: Vec::new() }
    }

    /// Writes the value as it was when it has no conditions, and `{ base: …, condition: … }` when
    /// it has, nested conditions on the same line.
    fn render(&self, out: &mut String) {
        if let (Some(base), true) = (&self.base, self.conditions.is_empty()) {
            out.push_str(base);
            return;
        }
        out.push('{');
        let mut separator = " ";
        if let Some(base) = &self.base {
            out.push_str(" base: ");
            out.push_str(base);
            separator = ", ";
        }
        for (_, key, piece) in &self.conditions {
            out.push_str(separator);
            out.push_str(key);
            out.push_str(": ");
            piece.render(out);
            separator = ", ";
        }
        out.push_str(" }");
    }
}

/// Puts `piece` under `property` at the conditions of `path`, merging with what is there: a value
/// at rest replaces the one before it and conditions join, the later winning where both set one,
/// as in StyleX. Entries are matched by name; each keeps the key text it came with.
fn place(
    entries: &mut Vec<(String, String, Piece)>,
    (name, key): (&str, &str),
    path: &[(String, String)],
    piece: Piece,
) {
    let at = entries.iter().position(|(existing, _, _)| existing == name).unwrap_or_else(|| {
        entries.push((name.to_owned(), key.to_owned(), Piece::default()));
        entries.len() - 1
    });
    let target = &mut entries[at].2;
    match path.split_first() {
        Some(((condition, condition_key), rest)) => {
            place(&mut target.conditions, (condition, condition_key), rest, piece)
        }
        None => {
            if piece.base.is_some() {
                target.base = piece.base;
            }
            for (name, key, inner) in piece.conditions {
                place(&mut target.conditions, (&name, &key), &[], inner);
            }
        }
    }
}

/// A style to write again once every edit inside it is known, its condition blocks lifted into its
/// properties. It holds spans, not the tree: rewrites inside it (`stylex.firstThatWorks`, a marker)
/// are made after it is planned.
struct Lift {
    span: Span,
    entries: Vec<Entry>,
}

/// An entry at the top of a lifted style, or of a block inside it.
enum Entry {
    Property { name: String, key: Span, plan: Plan },
    Block { condition: String, key: Span, entries: Vec<Entry> },
}

/// How a property's value is written again.
enum Plan {
    /// As it is, with the edits made inside it.
    Text(Span),
    /// A conditions object, entry by entry: `default` written `base` (its key `None`), `default:
    /// null` gone, as everywhere else in this codemod.
    Conditions(Vec<(String, Option<Span>, Plan)>),
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
    /// Whether the file is TypeScript, so `as const` may be written.
    typescript: bool,
    /// The constants holding the dark-scheme condition, and those a theme's values are declared in.
    survey: Survey,
    /// Styles to write again with their condition blocks lifted, once the walk is done.
    lifts: Vec<Lift>,
    /// The theme constants whose values became mode objects, so the file's reads of them follow.
    converted: Vec<String>,
}

/// `stylex.<name>`, when the callee is exactly that.
fn member_of<'a>(expression: &'a Expression<'a>, object: &str) -> Option<&'a str> {
    let member = expression.as_member_expression()?;
    let identifier = member.object().get_identifier_reference()?;
    (identifier.name.as_str() == object).then(|| member.static_property_name()).flatten().and_then(|name| name.as_str())
}

/// `stylex.when.<name>`.
fn when_of<'a>(expression: &'a Expression<'a>) -> Option<&'a str> {
    let member = expression.as_member_expression()?;
    let inner = member.object().as_member_expression()?;
    let identifier = inner.object().get_identifier_reference()?;
    (identifier.name.as_str() == "stylex" && inner.static_property_name().is_some_and(|name| name == "when"))
        .then(|| member.static_property_name())
        .flatten()
        .and_then(|name| name.as_str())
}

impl<'s> Walker<'s> {
    fn new(source: &'s str, typescript: bool, survey: Survey) -> Self {
        Self {
            source,
            edits: Vec::new(),
            notes: Vec::new(),
            used: BTreeSet::new(),
            claimed: Vec::new(),
            names: Vec::new(),
            default_marker: false,
            typescript,
            survey,
            lifts: Vec::new(),
            converted: Vec::new(),
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
        // Inner styles first (a pseudo-element's block), so an outer one takes their new text.
        let mut lifts = std::mem::take(&mut self.lifts);
        lifts.sort_by_key(|lift| lift.span.end - lift.span.start);
        for lift in lifts {
            self.lift(&lift);
        }
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
                    self.style(value, true);
                }
                Expression::ArrowFunctionExpression(arrow)
                    if !matches!(arrow.body, ArrowFunctionBody::FunctionBody(_)) =>
                {
                    // A dynamic style: `(size) => ({ … })` becomes `(size) => css({ … })`. The
                    // body's own parenthesis is the place to put the name.
                    let body = arrow.body.span();
                    self.insert(body.start, "css");
                    self.defaults(arrow.span);
                    if let Some(Expression::ParenthesizedExpression(inner)) = arrow.body.as_expression()
                        && let Expression::ObjectExpression(value) = &inner.expression
                    {
                        self.style(value, true);
                    }
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
                self.modes(call.arguments.first().and_then(Argument::as_expression));
            }
            "defineConsts" => {
                if let Some(first) = first {
                    self.replace(Span::new(call.span.start, first.start), "");
                    // `as const` is TypeScript: a JavaScript file keeps the plain object.
                    self.replace(Span::new(first.end, call.span.end), if self.typescript { " as const" } else { "" });
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
                // Each frame is a style of its own, with no conditions to lift.
                if let Some(Expression::ObjectExpression(frames)) =
                    call.arguments.first().and_then(Argument::as_expression)
                {
                    for frame in &frames.properties {
                        if let ObjectPropertyKind::ObjectProperty(frame) = frame
                            && let Expression::ObjectExpression(style) = &frame.value
                        {
                            self.style(style, false);
                        }
                    }
                }
            }
            "createTheme" => {
                self.replace(callee, "defineTheme");
                self.used.insert("defineTheme");
                self.modes(call.arguments.get(1).and_then(Argument::as_expression));
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

    /// One style (an entry of `stylex.create`, a dynamic style's body, a keyframe, a pseudo-element's
    /// block): each property as StyleX read it and, with `lift`, a plan to move the condition blocks
    /// at its top into its properties.
    fn style(&mut self, style: &ObjectExpression<'_>, lift: bool) {
        let mut blocks = false;
        for entry in &style.properties {
            let ObjectPropertyKind::ObjectProperty(property) = entry else { continue };
            let Some(name) = key_name(property) else { continue };
            match &property.value {
                Expression::ObjectExpression(block) if name.starts_with("::") => self.style(block, lift),
                Expression::ObjectExpression(block) if is_condition(&name) => {
                    blocks |= self.portable(&name, property.key.span().start);
                    self.block(block);
                }
                _ => self.property(property, &name),
            }
        }
        if blocks && lift {
            match self.plan(style) {
                Some(entries) => self.lifts.push(Lift { span: style.span, entries }),
                None => self.note(
                    style.span.start,
                    "condition blocks this cannot move (beside a spread or a computed key, or holding a pseudo-element): move each into the properties it sets by hand",
                ),
            }
        }
    }

    /// The properties of a condition block, and the blocks inside it.
    fn block(&mut self, block: &ObjectExpression<'_>) {
        for entry in &block.properties {
            let ObjectPropertyKind::ObjectProperty(property) = entry else { continue };
            let Some(name) = key_name(property) else { continue };
            match &property.value {
                Expression::ObjectExpression(inner) if is_condition(&name) => {
                    self.portable(&name, property.key.span().start);
                    self.block(inner);
                }
                _ => self.property(property, &name),
            }
        }
    }

    /// Whether Kirana takes `condition`; reported when it does not, since only a hand port can say
    /// what such a selector (`":autofill + label"`) should become.
    fn portable(&mut self, condition: &str, offset: u32) -> bool {
        match kirana_ir::parse_condition_key(condition) {
            Ok(_) => true,
            Err(error) => {
                self.note(
                    offset,
                    format!("`{condition}` is not a condition Kirana takes ({error}): port this selector by hand"),
                );
                false
            }
        }
    }

    /// One property: StyleX's own name for it becomes the standard one, and its value is read as
    /// StyleX read it.
    fn property(&mut self, property: &ObjectProperty<'_>, name: &str) {
        let standard = standard_name(name).filter(|_| !property.shorthand);
        if let Some(standard) = standard {
            self.replace(property.key.span(), standard);
        }
        self.value(standard.unwrap_or(name), &property.value);
    }

    /// A property's value, and each value of its conditions object.
    fn value(&mut self, name: &str, value: &Expression<'_>) {
        match value {
            Expression::ArrayExpression(array) => self.fallbacks(name, array),
            Expression::ObjectExpression(conditions) => {
                for entry in &conditions.properties {
                    let ObjectPropertyKind::ObjectProperty(entry) = entry else { continue };
                    if let Some(condition) = key_name(entry).filter(|key| key != "default") {
                        self.portable(&condition, entry.key.span().start);
                    }
                    self.value(name, &entry.value);
                }
            }
            Expression::StringLiteral(text) => {
                let Some(value) = text.value.as_str() else { return };
                self.important(name, value, text.span.start);
                // StyleX's logical `float` values, standard since: `start` is `inline-start`.
                let logical = match value {
                    "start" => Some("inline-start"),
                    "end" => Some("inline-end"),
                    _ => None,
                };
                if let Some(logical) = logical.filter(|_| name == "float") {
                    self.replace(text.span, format!("{logical:?}"));
                }
            }
            Expression::TemplateLiteral(template) => {
                for quasi in &template.quasis {
                    self.important(name, &quasi.value.raw, template.span.start);
                }
            }
            _ => {
                if let Some(text) = with_unit(name, value) {
                    self.replace(value.span(), text);
                }
            }
        }
    }

    /// Reports `!important`: Kirana's precedence ladder orders every rule, so it writes none, and
    /// dropping it changes what the rule beats.
    fn important(&mut self, name: &str, text: &str, offset: u32) {
        if text.contains("!important") {
            self.note(offset, format!("`!important` on {name}: Kirana writes none, since its precedence ladder orders every rule; remove it and check what it was overriding"));
        }
    }

    /// StyleX's fallback array (`["100vh", "100dvh"]`: the later value where it works) as
    /// `firstThatWorks("100dvh", "100vh")`, which prefers the first.
    fn fallbacks(&mut self, name: &str, array: &ArrayExpression<'_>) {
        let mut members = Vec::new();
        for element in &array.elements {
            match element.as_expression() {
                Some(expression @ Expression::StringLiteral(_)) => {
                    members.push(self.text(expression.span()).to_owned())
                }
                Some(expression @ (Expression::NumericLiteral(_) | Expression::UnaryExpression(_))) => {
                    members
                        .push(with_unit(name, expression).unwrap_or_else(|| self.text(expression.span()).to_owned()));
                }
                _ => return,
            }
        }
        if members.len() < 2 {
            return;
        }
        members.reverse();
        self.replace(array.span, format!("firstThatWorks({})", members.join(", ")));
        self.used.insert("firstThatWorks");
    }

    /// A StyleX theme value `{ default: x, "@media (prefers-color-scheme: dark)": y }` as Kirana's
    /// mode object `{ light: x, dark: y }`, in `defineVars` and `createTheme`. The dark key may be a
    /// constant holding the condition (`[DARK]`). Any other pair of conditions is left as written.
    fn modes(&mut self, values: Option<&Expression<'_>>) -> bool {
        let Some(Expression::ObjectExpression(values)) = values else { return false };
        let mut converted = false;
        for entry in &values.properties {
            let ObjectPropertyKind::ObjectProperty(entry) = entry else { continue };
            let Expression::ObjectExpression(value) = &entry.value else { continue };
            let pairs: Vec<&ObjectProperty<'_>> = value
                .properties
                .iter()
                .filter_map(|pair| match pair {
                    ObjectPropertyKind::ObjectProperty(pair) => Some(&**pair),
                    ObjectPropertyKind::SpreadProperty(_) => None,
                })
                .collect();
            if pairs.len() != 2 || value.properties.len() != 2 {
                continue;
            }
            let light = pairs.iter().find(|pair| key_name(pair).as_deref() == Some("default"));
            let dark = pairs.iter().find(|pair| self.is_dark(pair));
            let (Some(light), Some(dark)) = (light, dark) else { continue };
            self.replace(light.key.span(), "light");
            // A computed key's brackets go with it.
            let end = if dark.computed {
                let after = dark.key.span().end as usize;
                (after + self.source[after..].find(']').map_or(0, |at| at + 1)) as u32
            } else {
                dark.key.span().end
            };
            let start = if dark.computed { dark.span.start } else { dark.key.span().start };
            self.replace(Span::new(start, end), "dark");
            converted = true;
        }
        converted
    }

    /// `systemTheme["--accent"]`: one token's value in a theme whose values became mode objects.
    fn reads_theme(&self, object: &Expression<'_>) -> bool {
        object
            .as_member_expression()
            .and_then(|member| member.object().get_identifier_reference())
            .is_some_and(|theme| self.converted.iter().any(|name| name == theme.name.as_str()))
    }

    /// Whether a theme value's key is the dark-scheme condition, written out or held in a constant.
    fn is_dark(&self, pair: &ObjectProperty<'_>) -> bool {
        match &pair.key {
            PropertyKey::StringLiteral(literal) => literal.value == DARK_SCHEME,
            key if pair.computed => key
                .as_expression()
                .and_then(Expression::get_identifier_reference)
                .is_some_and(|reference| self.survey.dark.iter().any(|name| name == reference.name.as_str())),
            _ => false,
        }
    }

    /// The plan for lifting `style`'s condition blocks, or `None` when an entry has no name to
    /// place it by (a spread, a computed key).
    fn plan(&self, style: &ObjectExpression<'_>) -> Option<Vec<Entry>> {
        style.properties.iter().map(|entry| self.entry(entry, false)).collect()
    }

    /// One entry of the plan; `in_block` says it sits inside a condition block, where a
    /// pseudo-element has no property to go into.
    fn entry(&self, entry: &ObjectPropertyKind<'_>, in_block: bool) -> Option<Entry> {
        let ObjectPropertyKind::ObjectProperty(property) = entry else { return None };
        let name = key_name(property)?;
        let key = property.key.span();
        if in_block && name.starts_with("::") {
            return None;
        }
        Some(match &property.value {
            Expression::ObjectExpression(block)
                if is_condition(&name) && kirana_ir::parse_condition_key(&name).is_ok() =>
            {
                let entries = block.properties.iter().map(|entry| self.entry(entry, true)).collect::<Option<_>>()?;
                Entry::Block { condition: name, key, entries }
            }
            // A pseudo-element's block stays a block; its own conditions were planned with it.
            value if name.starts_with("::") || is_condition(&name) => {
                Entry::Property { name, key, plan: Plan::Text(value.span()) }
            }
            value => {
                let name = standard_name(&name).filter(|_| !property.shorthand).map_or(name, str::to_owned);
                Entry::Property { name, key, plan: Self::plan_of(value)? }
            }
        })
    }

    /// How a property's value is written again: a conditions object entry by entry, so a lifted
    /// block's value joins it; anything else as it is. `None` for a conditions object holding a
    /// spread or a computed key (`[stylex.when.ancestor(…)]`), which no block's value can join.
    fn plan_of(value: &Expression<'_>) -> Option<Plan> {
        let Expression::ObjectExpression(conditions) = value else { return Some(Plan::Text(value.span())) };
        let mut entries = Vec::new();
        for entry in &conditions.properties {
            let ObjectPropertyKind::ObjectProperty(entry) = entry else { return None };
            let name = key_name(entry)?;
            match (name.as_str(), &entry.value) {
                ("default", Expression::NullLiteral(_)) => {}
                ("default", inner) => entries.push(("base".to_owned(), None, Self::plan_of(inner)?)),
                (_, inner) => entries.push((name, Some(entry.key.span()), Self::plan_of(inner)?)),
            }
        }
        Some(Plan::Conditions(entries))
    }

    /// Writes a planned style again: each block's properties placed under its conditions, every
    /// piece with the edits made inside it, on one line per property when the style had several.
    fn lift(&mut self, lift: &Lift) {
        // Two rewrites over one range inside the style: it stays as written, and `finish` reports them.
        let mut inside: Vec<Span> = self
            .edits
            .iter()
            .map(|edit| edit.span)
            .filter(|span| lift.span.start <= span.start && span.end <= lift.span.end)
            .collect();
        inside.sort_by_key(|span| (span.start, span.end));
        if inside.windows(2).any(|pair| pair[1].start < pair[0].end) {
            self.note(
                lift.span.start,
                "rewrites inside this style overlap, so its condition blocks were left where they are",
            );
            return;
        }
        let mut entries = Vec::new();
        self.place_entries(&mut entries, &lift.entries, &[]);
        let style = self.text(lift.span);
        let mut out = String::from("{");
        if style.contains('\n') {
            let line = |at: u32| self.source[..at as usize].rfind('\n').map_or(0, |start| start + 1);
            let indent_of =
                |at: usize| self.source[at..].chars().take_while(|c| *c == ' ' || *c == '\t').collect::<String>();
            let first = lift.entries.first().map_or(lift.span.start, |entry| match entry {
                Entry::Property { key, .. } | Entry::Block { key, .. } => key.start,
            });
            let (indent, close) = (indent_of(line(first)), indent_of(line(lift.span.start)));
            for (_, key, piece) in &entries {
                out.push('\n');
                out.push_str(&indent);
                out.push_str(key);
                out.push_str(": ");
                piece.render(&mut out);
                out.push(',');
            }
            out.push('\n');
            out.push_str(&close);
        } else {
            for (index, (_, key, piece)) in entries.iter().enumerate() {
                out.push_str(if index == 0 { " " } else { ", " });
                out.push_str(key);
                out.push_str(": ");
                piece.render(&mut out);
            }
            out.push(' ');
        }
        out.push('}');
        // Everything inside the style is in the new text now, but the `css(` and `)` around it.
        let span = lift.span;
        self.edits.retain(|edit| {
            let inside = span.start <= edit.span.start && edit.span.end <= span.end;
            let boundary =
                edit.span.start == edit.span.end && (edit.span.start == span.start || edit.span.start == span.end);
            !inside || boundary
        });
        self.replace(span, out);
    }

    fn place_entries(&self, into: &mut Vec<(String, String, Piece)>, entries: &[Entry], path: &[(String, String)]) {
        for entry in entries {
            match entry {
                Entry::Property { name, key, plan } => {
                    place(into, (name, &self.rendered(*key)), path, self.piece(plan));
                }
                Entry::Block { condition, key, entries } => {
                    let mut inner = path.to_vec();
                    inner.push((condition.clone(), self.text(*key).to_owned()));
                    self.place_entries(into, entries, &inner);
                }
            }
        }
    }

    fn piece(&self, plan: &Plan) -> Piece {
        match plan {
            Plan::Text(span) => Piece::leaf(self.rendered(*span)),
            Plan::Conditions(entries) => {
                let mut piece = Piece::default();
                for (name, key, plan) in entries {
                    let inner = self.piece(plan);
                    match key {
                        Some(key) => piece.conditions.push((name.clone(), self.text(*key).to_owned(), inner)),
                        None => {
                            let mut base = String::new();
                            inner.render(&mut base);
                            piece.base = Some(base);
                        }
                    }
                }
                piece
            }
        }
    }

    /// The source of `span` with the edits made inside it.
    fn rendered(&self, span: Span) -> String {
        let mut inside: Vec<&Edit> =
            self.edits.iter().filter(|edit| span.start <= edit.span.start && edit.span.end <= span.end).collect();
        inside.sort_by_key(|edit| (edit.span.start, edit.span.end));
        let mut out = String::new();
        let mut at = span.start;
        // `lift` has made sure none of them overlap.
        for edit in inside {
            out.push_str(&self.source[at as usize..edit.span.start as usize]);
            out.push_str(&edit.text);
            at = edit.span.end;
        }
        out.push_str(&self.source[at as usize..span.end as usize]);
        out
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

/// `from "./theme.stylex"` becomes `from "./theme"`, and `"./theme.stylex.js"` becomes
/// `"./theme.js"`, for the files this codemod renames.
fn strip_stylex_specifiers(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let mut rest = source;
    while let Some(offset) = rest.find(".stylex") {
        let after = &rest[offset + ".stylex".len()..];
        let quoted = after.starts_with(['"', '\'']);
        let extension = after.strip_prefix('.').and_then(|tail| {
            SCRIPTS
                .iter()
                .find(|extension| tail.starts_with(*extension) && tail[extension.len()..].starts_with(['"', '\'']))
        });
        out.push_str(&rest[..offset]);
        if !quoted && extension.is_none() {
            out.push_str(".stylex");
        }
        rest = after;
    }
    out.push_str(rest);
    out
}

impl<'a> Visit<'a> for Walker<'a> {
    fn visit_variable_declarator(&mut self, declarator: &VariableDeclarator<'a>) {
        if let (Some(name), Some(init)) = (declarator.id.get_identifier_name(), declarator.init.as_ref()) {
            self.names.push((init.span().start, name.to_string()));
            // A theme's values declared apart from the call that takes them.
            if self.survey.themes.iter().any(|theme| theme == name.as_str()) && self.modes(Some(init)) {
                self.converted.push(name.to_string());
            }
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

    /// A read of a converted theme value's `default` is its `light`.
    fn visit_static_member_expression(&mut self, member: &StaticMemberExpression<'a>) {
        if member.property.name == "default" && self.reads_theme(&member.object) {
            self.replace(member.property.span, "light");
        }
        walk::walk_static_member_expression(self, member);
    }

    /// A read of a converted theme value's dark-scheme condition (`[DARK]`) is its `dark`.
    fn visit_computed_member_expression(&mut self, member: &ComputedMemberExpression<'a>) {
        let dark = match &member.expression {
            Expression::StringLiteral(literal) => literal.value == DARK_SCHEME,
            Expression::Identifier(name) => self.survey.dark.iter().any(|dark| dark == name.name.as_str()),
            _ => false,
        };
        if dark && self.reads_theme(&member.object) {
            self.replace(Span::new(member.object.span().end, member.span.end), ".dark");
        }
        walk::walk_computed_member_expression(self, member);
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
