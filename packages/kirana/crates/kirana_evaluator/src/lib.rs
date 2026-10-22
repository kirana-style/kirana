//! The restricted evaluator (KRN-CMP-003, D-022): folds style values from a closed subset of
//! JavaScript without executing user code, classifies them as static, finite dynamic or open
//! dynamic (KRN-DYN-001), and builds the Style IR for every Kirana API call.

mod api;
mod eval;
mod forwarding;
mod helpers;
pub mod ops;
mod style;
mod utility;

use std::path::Path;
use std::sync::Arc;

use kirana_config::Config;
use kirana_ir::{CounterStyleDef, Dep, KeyframesDef, Names, PositionTryDef, TokenDef, Value, ViewTransitionDef};

pub use eval::Evaluator;
pub use style::{Parts, relation_reads};

/// Which binding an import names.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImportName {
    Named(String),
    Default,
    Namespace,
}

/// What the evaluator needs from the project: other modules' exports and definitions.
pub trait Host {
    /// The portable value of an import (no spans from the other module).
    fn import(&self, from: &Path, specifier: &str, name: &ImportName) -> Value;
    /// A variable token or keyframes rule defined anywhere in the project, by emitted name.
    fn lookup_dep(&self, name: &str) -> Option<Dep>;
    /// Whether `specifier` resolves into an installed package rather than project source.
    fn is_external(&self, from: &Path, specifier: &str) -> bool;
    /// The installed package a project module's exported component spreads its props into without
    /// reading `sx`, when it does.
    fn sx_forwarded(&self, from: &Path, specifier: &str, name: &str) -> Option<String>;
}

/// Where and how a module is compiled.
#[derive(Debug, Clone, Copy)]
pub struct Context<'c> {
    pub path: &'c Path,
    /// The file name used in diagnostics (relative to the project root).
    pub file: &'c str,
    /// The owning package name; part of token, relation and keyframes identity (KRN-TOK-010).
    pub package: &'c str,
    pub names: &'c Names,
    pub config: &'c Config,
}

/// Definitions a module contributes to the project.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Definitions {
    pub tokens: Vec<Arc<TokenDef>>,
    pub keyframes: Vec<Arc<KeyframesDef>>,
    pub position_tries: Vec<Arc<PositionTryDef>>,
    pub view_transitions: Vec<Arc<ViewTransitionDef>>,
    pub counter_styles: Vec<Arc<CounterStyleDef>>,
    /// Token namespaces declared here, with the `defineTokens` call span.
    pub namespaces: Vec<(String, (u32, u32))>,
    /// Relations declared here: `(name, marker)`.
    pub relations: Vec<(String, String)>,
    /// Every token declared here, inlined or not, for tooling (hover, swatches, `prefer-token`).
    pub catalogue: Vec<TokenEntry>,
}

/// One token as written: its identity, value, whether it is a custom property, and the span of
/// its entry in `defineTokens`.
#[derive(Debug, Clone, PartialEq)]
pub struct TokenEntry {
    pub identity: String,
    pub value: kirana_ir::TokenValue,
    pub variable: bool,
    pub span: (u32, u32),
}

/// Converts a value from one module into one another module may hold: spans are meaningless
/// outside their module, so every dynamic part becomes unknown.
pub fn portable(value: &Value) -> Value {
    match value {
        Value::Dynamic(_) => Value::unknown("not static in its module"),
        Value::Array(items) => Value::Array(Arc::new(items.iter().map(portable).collect())),
        Value::Object(entries) => {
            Value::Object(Arc::new(entries.iter().map(|(key, value)| (key.clone(), portable(value))).collect()))
        }
        other => other.clone(),
    }
}
