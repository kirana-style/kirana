//! Diagnostics (KRN-CMP-011): a stable catalogue, one diagnostic type, and renderers that the CLI,
//! the Vite adapter and (later) the language server share.

use std::fmt::Write as _;

use serde::{Deserialize, Serialize};

/// How serious a diagnostic is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Warning,
    Error,
}

impl Severity {
    fn label(self) -> &'static str {
        match self {
            Severity::Info => "info",
            Severity::Warning => "warning",
            Severity::Error => "error",
        }
    }
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
    RelationWithoutAnchor = "KRN1401", "relation-without-anchor", Error;
    RelationUnused = "KRN1402", "relation-unused", Warning;
    RelationPlacement = "KRN1403", "relation-placement", Error;
    RelationNameCollision = "KRN1404", "relation-name-collision", Error;
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

/// 1-based line and column of a byte offset.
pub fn line_column(source: &str, offset: u32) -> (usize, usize) {
    let offset = (offset as usize).min(source.len());
    let before = &source[..offset];
    let line = before.matches('\n').count() + 1;
    let column = before.rsplit('\n').next().map_or(0, |text| text.chars().count()) + 1;
    (line, column)
}

/// Renders a diagnostic for a terminal, with the source line and a caret underline.
pub fn render_human(diagnostic: &Diagnostic, source: Option<&str>) -> String {
    let mut out = String::new();
    let _ = writeln!(
        out,
        "{}[{}] {}: {}",
        diagnostic.severity.label(),
        diagnostic.code.code(),
        diagnostic.code.name(),
        diagnostic.message
    );
    match source {
        Some(text) if !diagnostic.file.is_empty() && diagnostic.span != Span::default() => {
            let (line, column) = line_column(text, diagnostic.span.start);
            let _ = writeln!(out, "  --> {}:{line}:{column}", diagnostic.file);
            let line_text = text.lines().nth(line - 1).unwrap_or_default();
            let width = (diagnostic.span.end.saturating_sub(diagnostic.span.start) as usize)
                .clamp(1, line_text.chars().count().saturating_sub(column - 1).max(1));
            let gutter = line.to_string();
            let _ = writeln!(out, "{} |", " ".repeat(gutter.len()));
            let _ = writeln!(out, "{gutter} | {line_text}");
            let _ = writeln!(out, "{} | {}{}", " ".repeat(gutter.len()), " ".repeat(column - 1), "^".repeat(width));
        }
        _ if !diagnostic.file.is_empty() => {
            let _ = writeln!(out, "  --> {}", diagnostic.file);
        }
        _ => {}
    }
    for help in &diagnostic.help {
        let _ = writeln!(out, "help: {help}");
    }
    out
}

/// Renders a diagnostic as a GitHub Actions workflow command, which annotates the file in a pull
/// request: `::error file=src/a.tsx,line=3,col=5,title=KRN1201 unknown-property::message`.
pub fn render_github(diagnostic: &Diagnostic, source: Option<&str>) -> String {
    let level = match diagnostic.severity {
        Severity::Error => "error",
        Severity::Warning => "warning",
        Severity::Info => "notice",
    };
    let mut properties = Vec::new();
    if !diagnostic.file.is_empty() {
        properties.push(format!("file={}", github_property(&diagnostic.file)));
        if let Some(text) = source.filter(|_| diagnostic.span != Span::default()) {
            let (line, column) = line_column(text, diagnostic.span.start);
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
