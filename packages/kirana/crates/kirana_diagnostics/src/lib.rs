//! Diagnostics (KRN-CMP-011): a stable catalogue, one diagnostic type, and renderers that the CLI,
//! the bundler adapters and the language server share.

use std::{borrow::Cow, fmt::Write as _};

use oxc_diagnostics::{GraphicalReportHandler, GraphicalTheme, LabeledSpan, SourceCode};
use serde::{Deserialize, Serialize};

/// How serious a diagnostic is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Warning,
    Error,
}

macro_rules! catalogue {
    ($($variant:ident = $code:literal, $name:literal, $severity:ident;)*) => {
        /// Every diagnostic Kirana can report. Codes and names never change meaning once released.
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
        pub enum Code {
            $($variant,)*
        }

        impl Code {
            /// All codes, in catalogue order.
            pub const ALL: &'static [Code] = &[$(Code::$variant,)*];

            /// The stable `KRN####` code.
            pub fn code(self) -> &'static str {
                match self { $(Code::$variant => $code,)* }
            }

            /// The stable kebab-case name.
            pub fn name(self) -> &'static str {
                match self { $(Code::$variant => $name,)* }
            }

            /// The catalogue severity.
            pub fn default_severity(self) -> Severity {
                match self { $(Code::$variant => Severity::$severity,)* }
            }
        }
    };
}

catalogue! {
    ParseError = "KRN1001", "parse-error", Error;
    NotEvaluable = "KRN1101", "not-evaluable", Error;
    UnsupportedSyntax = "KRN1102", "unsupported-syntax", Error;
    UnresolvedImport = "KRN1103", "unresolved-import", Warning;
    ImportCycle = "KRN1104", "import-cycle", Warning;
    UnknownProperty = "KRN1201", "unknown-property", Error;
    InvalidValue = "KRN1202", "invalid-value", Error;
    UnitlessLength = "KRN1203", "unitless-length", Error;
    UnsplittableShorthand = "KRN1204", "unsplittable-shorthand", Warning;
    MixedLogicalPhysical = "KRN1205", "mixed-logical-physical", Warning;
    InvalidFallback = "KRN1206", "invalid-fallback", Error;
    FallbackOnVariable = "KRN1207", "fallback-on-variable", Warning;
    InvalidPositionTry = "KRN1208", "invalid-position-try", Error;
    InvalidViewTransition = "KRN1209", "invalid-view-transition", Error;
    InvalidCounterStyle = "KRN1210", "invalid-counter-style", Error;
    UnknownCondition = "KRN1301", "unknown-condition", Error;
    AmbiguousPrecedence = "KRN1302", "ambiguous-precedence", Warning;
    UnsupportedContextualTarget = "KRN1303", "unsupported-contextual-target", Error;
    SelectStateOnParent = "KRN1304", "select-state-on-parent", Info;
    UnreachableEntry = "KRN1305", "unreachable-entry", Info;
    RelationWithoutAnchor = "KRN1401", "relation-without-anchor", Error;
    RelationUnused = "KRN1402", "relation-unused", Warning;
    RelationPlacement = "KRN1403", "relation-placement", Error;
    RelationNameCollision = "KRN1404", "relation-name-collision", Error;
    RelationReadOnAnchor = "KRN1405", "relation-read-on-anchor", Info;
    UnknownToken = "KRN1501", "unknown-token", Error;
    TokenNamespaceCollision = "KRN1502", "token-namespace-collision", Error;
    VariableDefaultScope = "KRN1503", "variable-default-scope", Warning;
    DynamicToken = "KRN1504", "dynamic-token", Error;
    UnsupportedDtcgType = "KRN1505", "unsupported-dtcg-type", Error;
    TokenNotVariable = "KRN1506", "token-not-variable", Error;
    TokenNamespaceShared = "KRN1507", "token-namespace-shared", Info;
    DynamicBridged = "KRN1601", "dynamic-bridged", Info;
    BranchBudgetExceeded = "KRN1602", "branch-budget-exceeded", Error;
    DynamicKey = "KRN1603", "dynamic-key", Error;
    DynamicSpread = "KRN1604", "dynamic-spread", Error;
    DynamicVariant = "KRN1605", "dynamic-variant", Info;
    UnusedSx = "KRN1701", "unused-sx", Warning;
    UtilitySurfaceDisabled = "KRN1702", "utility-surface-disabled", Error;
    SxOnExternalComponent = "KRN1703", "sx-on-external-component", Warning;
    UnknownUtility = "KRN1704", "unknown-utility", Error;
    UnknownUtilityVariant = "KRN1705", "unknown-utility-variant", Error;
    UtilityNotStatic = "KRN1706", "utility-not-static", Error;
    UtilityUnsupported = "KRN1707", "utility-unsupported", Error;
    UnknownVariant = "KRN1801", "unknown-variant", Error;
    UnknownSlot = "KRN1802", "unknown-slot", Error;
    InvalidConfig = "KRN1901", "invalid-config", Error;
    TargetLowering = "KRN1902", "target-lowering", Info;
    ClassNameCollision = "KRN1903", "class-name-collision", Error;
    ClassesNotStatic = "KRN1904", "classes-not-static", Error;
    UnknownClassName = "KRN1905", "unknown-class-name", Error;
}

impl Code {
    /// Looks a code up by its kebab-case name.
    pub fn from_name(name: &str) -> Option<Code> {
        Code::ALL.iter().copied().find(|code| code.name() == name)
    }
}

/// A byte range in a source file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub struct Span {
    pub start: u32,
    pub end: u32,
}

impl Span {
    pub const fn new(start: u32, end: u32) -> Self {
        Self { start, end }
    }
}

/// One structured compiler message.
#[derive(Debug, Clone, PartialEq)]
pub struct Diagnostic {
    pub code: Code,
    pub severity: Severity,
    /// The module the span points into; empty for project-wide diagnostics.
    pub file: String,
    pub span: Span,
    pub message: String,
    /// Concrete fixes (KRN-DYN-006).
    pub help: Vec<String>,
}

impl Serialize for Diagnostic {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        #[derive(Serialize)]
        struct Wire<'a> {
            code: &'static str,
            name: &'static str,
            severity: Severity,
            file: &'a str,
            span: Span,
            message: &'a str,
            help: &'a [String],
        }
        Wire {
            code: self.code.code(),
            name: self.code.name(),
            severity: self.severity,
            file: &self.file,
            span: self.span,
            message: &self.message,
            help: &self.help,
        }
        .serialize(serializer)
    }
}

/// The shape [`Serialize`] writes, read back: a host hands the engine's diagnostics back to be
/// rendered (`renderDiagnostics`). The name says which diagnostic it is; the code follows from it.
impl<'de> Deserialize<'de> for Diagnostic {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        struct Wire {
            name: String,
            severity: Severity,
            file: String,
            span: Span,
            message: String,
            help: Vec<String>,
        }
        let wire = Wire::deserialize(deserializer)?;
        let code = Code::from_name(&wire.name)
            .ok_or_else(|| serde::de::Error::custom(format!("unknown diagnostic `{}`", wire.name)))?;
        Ok(Self {
            code,
            severity: wire.severity,
            file: wire.file,
            span: wire.span,
            message: wire.message,
            help: wire.help,
        })
    }
}

impl Diagnostic {
    /// A diagnostic at its catalogue severity.
    pub fn new(code: Code, file: impl Into<String>, span: Span, message: impl Into<String>) -> Self {
        Self {
            code,
            severity: code.default_severity(),
            file: file.into(),
            span,
            message: message.into(),
            help: Vec::new(),
        }
    }

    /// Adds a fix suggestion.
    #[must_use]
    pub fn with_help(mut self, help: impl Into<String>) -> Self {
        self.help.push(help.into());
        self
    }
}

/// A configured severity for a diagnostic name.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Off,
    Info,
    Warning,
    Error,
}

/// Why a severity override was rejected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OverrideError {
    UnknownName(String),
    /// Errors mean the output would be wrong, so they cannot be re-levelled (doc 11).
    ErrorNotAdjustable(String),
}

/// Applies configured levels. Returns `None` when the diagnostic is switched off.
pub fn apply_level(mut diagnostic: Diagnostic, level: Option<Level>) -> Option<Diagnostic> {
    match level {
        None => Some(diagnostic),
        Some(Level::Off) => None,
        Some(Level::Info) => {
            diagnostic.severity = Severity::Info;
            Some(diagnostic)
        }
        Some(Level::Warning) => {
            diagnostic.severity = Severity::Warning;
            Some(diagnostic)
        }
        Some(Level::Error) => {
            diagnostic.severity = Severity::Error;
            Some(diagnostic)
        }
    }
}

/// Checks that an override names a real, adjustable diagnostic.
pub fn validate_override(name: &str) -> Result<Code, OverrideError> {
    let code = Code::from_name(name).ok_or_else(|| OverrideError::UnknownName(name.to_owned()))?;
    if code.default_severity() == Severity::Error {
        return Err(OverrideError::ErrorNotAdjustable(name.to_owned()));
    }
    Ok(code)
}

/// 1-based line and column of a byte offset. Walks the text to the offset: to place many offsets in
/// one text, build its [`LineIndex`] once.
pub fn line_column(source: &str, offset: u32) -> (usize, usize) {
    let offset = (offset as usize).min(source.len());
    let before = &source[..offset];
    let line = before.matches('\n').count() + 1;
    let column = before.rsplit('\n').next().map_or(0, |text| text.chars().count()) + 1;
    (line, column)
}

/// Where each line of a text starts, so an offset's line is a binary search rather than a walk
/// from the start of the text: placing each of a large file's diagnostics by walking it took 10 s of
/// a 12 s `kirana-style check` (one 6.6 MB module, 2,600 diagnostics; KF-028). It holds no text:
/// each method takes the text it was built from.
pub struct LineIndex(Vec<usize>);

impl LineIndex {
    pub fn new(text: &str) -> Self {
        Self(std::iter::once(0).chain(text.match_indices('\n').map(|(at, _)| at + 1)).collect())
    }

    /// The 1-based line of a byte offset.
    pub fn line(&self, offset: u32) -> usize {
        self.0.partition_point(|start| *start <= offset as usize)
    }

    /// 1-based line and column of a byte offset in `text`, as [`line_column`] counts them.
    pub fn line_column(&self, text: &str, offset: u32) -> (usize, usize) {
        let offset = (offset as usize).min(text.len());
        let line = self.line(offset as u32);
        (line, text[self.0[line - 1]..offset].chars().count() + 1)
    }
}

/// A line longer than this, in bytes, stays out of a frame, which would print it whole: minified or
/// generated code. The location goes after the message instead.
const LONG_LINE: usize = 1_000;

/// A frame stays a glance: a span over more lines than this is underlined on its first line.
const SPAN_LINES: usize = 6;

/// Renders diagnostics for a terminal as Oxc's graphical report, the one oxlint prints (D-116): the
/// severity, code, name and message, the span underlined among the lines around it in a frame headed
/// `file:line:column`, then the help. A diagnostic with a file and no span names the file after its
/// message, and one on a line too long to draw names `file:line:column` there. `source` gives a
/// file's text; one file's diagnostics share one line index, so a module with thousands of them is
/// read once (KF-028). `colour` adds ANSI colours, for a terminal that shows them. Each report is
/// its own string, starting with a blank line and ending with a line break.
pub fn render_human<'a>(
    diagnostics: &'a [Diagnostic],
    source: &dyn Fn(&str) -> Option<&'a str>,
    colour: bool,
) -> Vec<String> {
    let mut indexes: std::collections::HashMap<&str, LineIndex> = std::collections::HashMap::new();
    let reports: Vec<Report<'a>> = diagnostics
        .iter()
        .map(|diagnostic| {
            let (file, span) = (diagnostic.file.as_str(), diagnostic.span);
            let mut report = Report {
                title: diagnostic.message.clone(),
                code: format!("{} {}", diagnostic.code.code(), diagnostic.code.name()),
                severity: match diagnostic.severity {
                    Severity::Error => oxc_diagnostics::Severity::Error,
                    Severity::Warning => oxc_diagnostics::Severity::Warning,
                    Severity::Info => oxc_diagnostics::Severity::Advice,
                },
                help: (!diagnostic.help.is_empty()).then(|| diagnostic.help.join("\n")),
                labels: Vec::new(),
                source: None,
                column: None,
            };
            let text = Some(span)
                .filter(|span| *span != Span::default() && !file.is_empty())
                .and_then(|span| source(file).filter(|text| within(text, span)));
            match text {
                None if !file.is_empty() => {
                    let _ = write!(report.title, " ({file})");
                }
                None => {}
                Some(text) => {
                    let lines = indexes.entry(file).or_insert_with(|| LineIndex::new(text));
                    let (line, column) = lines.line_column(text, span.start);
                    match frame(text.as_bytes(), span) {
                        None => {
                            let _ = write!(report.title, " ({file}:{line}:{column})");
                        }
                        Some((line_start, end)) => {
                            report.labels.push(LabeledSpan::new(None, span.start, end - span.start));
                            report.source = Some(Source { name: file, text });
                            // The handler counts the header's column in bytes; an editor, and every
                            // other location Kirana prints, in characters.
                            let bytes = span.start as usize - line_start + 1;
                            if bytes != column {
                                report.column = Some((format!(":{line}:{bytes}]"), format!(":{line}:{column}]")));
                            }
                        }
                    }
                }
            }
            report
        })
        .collect();
    let theme = if colour { GraphicalTheme::unicode() } else { GraphicalTheme::unicode_nocolor() };
    let handler = GraphicalReportHandler::new_themed(theme).with_links(false).with_width(400);
    let mut out: Vec<String> = Vec::with_capacity(reports.len());
    // Writing to a `String` cannot fail, and `within` keeps every span inside its text, the only
    // other reason a report stops.
    let _ = handler.render_reports_until(
        reports.iter().map(|report| report as &dyn oxc_diagnostics::Diagnostic),
        &mut |_, text| {
            out.push(match &reports[out.len()].column {
                Some((bytes, characters)) => {
                    let header = text.find("─[").unwrap_or_default();
                    format!("{}{}", &text[..header], text[header..].replacen(bytes.as_str(), characters, 1))
                }
                None => text.to_owned(),
            });
            true
        },
    );
    out
}

/// Whether terminal reports get colours: `FORCE_COLOR` turns them on unless it is `0` or `false`,
/// else a non-empty `NO_COLOR` turns them off, else a terminal gets them (force-color.org,
/// no-color.org).
pub fn colour(is_terminal: bool, force_colour: Option<&str>, no_colour: Option<&str>) -> bool {
    match (force_colour, no_colour) {
        (Some(force), _) => !matches!(force, "0" | "false"),
        (None, Some(no)) if !no.is_empty() => false,
        _ => is_terminal,
    }
}

/// Whether a span lies in `text` on character boundaries.
fn within(text: &str, span: Span) -> bool {
    span.start <= span.end && text.is_char_boundary(span.start as usize) && text.is_char_boundary(span.end as usize)
}

/// Where a span's frame starts and its underline ends: the start of its first line, and the span's
/// end, or its first line's when the span is long ([`SPAN_LINES`]). `None` when a line the frame
/// would print, the span's own or one beside them, is longer than [`LONG_LINE`]. No scan goes past
/// that limit, so a module that is one long line costs each diagnostic no more.
fn frame(bytes: &[u8], span: Span) -> Option<(usize, u32)> {
    let start = span.start as usize;
    let first = line_start(bytes, start)?;
    if first > 0 {
        line_start(bytes, first - 1)?;
    }
    let first_end = line_end(bytes, start)?;
    let end = span.end as usize;
    let whole =
        end - start <= LONG_LINE && bytes[start..end].iter().filter(|byte| **byte == b'\n').count() < SPAN_LINES;
    let (end, last) = if whole { (end, line_end(bytes, end)?) } else { (first_end, first_end) };
    if last < bytes.len() {
        line_end(bytes, last + 1)?;
    }
    Some((first, end as u32))
}

/// The start of the line that holds `at`, when it is at most [`LONG_LINE`] bytes back.
fn line_start(bytes: &[u8], at: usize) -> Option<usize> {
    let from = at.saturating_sub(LONG_LINE);
    match bytes[from..at].iter().rposition(|byte| *byte == b'\n') {
        Some(index) => Some(from + index + 1),
        None => (from == 0).then_some(0),
    }
}

/// The end of the line that holds `at` (its line break, or the end of the text), when it is at most
/// [`LONG_LINE`] bytes on.
fn line_end(bytes: &[u8], at: usize) -> Option<usize> {
    let to = (at + LONG_LINE).min(bytes.len());
    match bytes[at..to].iter().position(|byte| *byte == b'\n') {
        Some(index) => Some(at + index),
        None => (to == bytes.len()).then_some(to),
    }
}

/// A file's text, named, for the graphical handler. Reports of one file hold the same text, which
/// is how the handler knows to keep its line index.
#[derive(Debug)]
struct Source<'a> {
    name: &'a str,
    text: &'a str,
}

impl SourceCode for Source<'_> {
    fn data(&self) -> &[u8] {
        self.text.as_bytes()
    }

    fn name(&self) -> Option<&str> {
        Some(self.name)
    }
}

/// One diagnostic as the graphical handler reads it.
#[derive(Debug)]
struct Report<'a> {
    title: String,
    code: String,
    severity: oxc_diagnostics::Severity,
    help: Option<String>,
    labels: Vec<LabeledSpan>,
    source: Option<Source<'a>>,
    /// The frame's `:line:column]` as the handler writes it, and as Kirana counts it.
    column: Option<(String, String)>,
}

impl std::fmt::Display for Report<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.title)
    }
}

impl std::error::Error for Report<'_> {}

impl oxc_diagnostics::Diagnostic for Report<'_> {
    fn code(&self) -> Option<Cow<'_, str>> {
        Some(Cow::Borrowed(&self.code))
    }

    fn severity(&self) -> Option<oxc_diagnostics::Severity> {
        Some(self.severity)
    }

    fn help(&self) -> Option<Cow<'_, str>> {
        self.help.as_deref().map(Cow::Borrowed)
    }

    fn source_code(&self) -> Option<&dyn SourceCode> {
        self.source.as_ref().map(|source| source as &dyn SourceCode)
    }

    fn labels(&self) -> &[LabeledSpan] {
        &self.labels
    }
}

/// Renders a diagnostic as a GitHub Actions workflow command, which annotates the file in a pull
/// request: `::error file=src/a.tsx,line=3,col=5,title=KRN1201 unknown-property::message`.
pub fn render_github(diagnostic: &Diagnostic, source: Option<(&str, &LineIndex)>) -> String {
    let level = match diagnostic.severity {
        Severity::Error => "error",
        Severity::Warning => "warning",
        Severity::Info => "notice",
    };
    let mut properties = Vec::new();
    if !diagnostic.file.is_empty() {
        properties.push(format!("file={}", github_property(&diagnostic.file)));
        if let Some((text, lines)) = source.filter(|_| diagnostic.span != Span::default()) {
            let (line, column) = lines.line_column(text, diagnostic.span.start);
            properties.push(format!("line={line},col={column}"));
        }
    }
    properties
        .push(format!("title={}", github_property(&format!("{} {}", diagnostic.code.code(), diagnostic.code.name()))));
    let mut message = diagnostic.message.clone();
    for help in &diagnostic.help {
        message.push_str("\nhelp: ");
        message.push_str(help);
    }
    format!("::{level} {}::{}", properties.join(","), github_data(&message))
}

/// A workflow command's message: `%`, carriage returns and newlines are escaped.
fn github_data(text: &str) -> String {
    text.replace('%', "%25").replace('\r', "%0D").replace('\n', "%0A")
}

/// A workflow command's property value: also `:` and `,`, which separate properties.
fn github_property(text: &str) -> String {
    github_data(text).replace(':', "%3A").replace(',', "%2C")
}

/// Renders diagnostics as a JSON array.
pub fn render_json(diagnostics: &[Diagnostic]) -> String {
    serde_json::to_string(diagnostics).expect("diagnostics serialize")
}
