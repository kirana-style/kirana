//! Stylesheet definitions that atoms and markers depend on: variable tokens, themes, keyframes,
//! position-try fallbacks and view transitions ([07](../../../../spec/07-tokens-themes-presets.md)).

use std::sync::Arc;

/// A token value as written into CSS.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum TokenValue {
    /// One value for every mode.
    Plain(String),
    /// A non-colour value per mode (colours use `light-dark()` and stay [`TokenValue::Plain`]).
    Modes { light: String, dark: String },
}

/// A token emitted as a custom property in `kirana.tokens`.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TokenDef {
    /// `--kv…`.
    pub variable: String,
    pub value: TokenValue,
    /// `namespace.path`, for diagnostics and `kirana trace`.
    pub identity: String,
    pub deps: Vec<Dep>,
    /// Set when the custom property is registered with `@property` (KRN-TOK-011).
    pub registration: Option<Registration>,
}

/// An `@property` registration: the value's syntax and whether it inherits. The token's value is the
/// initial value, so a registered token needs no `:root` declaration.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Registration {
    /// A CSS syntax string such as `<length-percentage>`.
    pub syntax: String,
    pub inherits: bool,
}

/// A scoped theme: custom-property overrides on the element carrying `class`.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ThemeDef {
    pub class: String,
    pub declarations: Vec<(String, TokenValue)>,
    pub deps: Vec<Dep>,
}

/// An `@keyframes` rule.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct KeyframesDef {
    pub name: String,
    /// `(selector, declarations)` in source order.
    pub frames: Vec<(String, Vec<(String, String)>)>,
    pub deps: Vec<Dep>,
}

/// An `@position-try` rule (KRN-API-018): a block of positioning declarations under a dashed ident.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct PositionTryDef {
    /// `--kp…`.
    pub name: String,
    /// `(property, value)` in source order, longhands expanded.
    pub declarations: Vec<(String, String)>,
    pub deps: Vec<Dep>,
}

/// One pseudo-element of a view transition (KRN-API-019).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum TransitionPart {
    Group,
    ImagePair,
    Old,
    New,
}

impl TransitionPart {
    /// Every part, in the order the stylesheet writes them.
    pub const ALL: [TransitionPart; 4] =
        [TransitionPart::Group, TransitionPart::ImagePair, TransitionPart::Old, TransitionPart::New];

    /// The authored key.
    pub fn key(self) -> &'static str {
        match self {
            TransitionPart::Group => "group",
            TransitionPart::ImagePair => "imagePair",
            TransitionPart::Old => "old",
            TransitionPart::New => "new",
        }
    }

    /// The pseudo-element, without its argument.
    pub fn pseudo_element(self) -> &'static str {
        match self {
            TransitionPart::Group => "::view-transition-group",
            TransitionPart::ImagePair => "::view-transition-image-pair",
            TransitionPart::Old => "::view-transition-old",
            TransitionPart::New => "::view-transition-new",
        }
    }
}

/// One rule of a view-transition part: its at-rule preludes, outermost first, and declarations.
pub type TransitionRule = (Vec<String>, Vec<(String, String)>);

/// A view-transition class: `.{class} { view-transition-class: {class} }` and one rule per
/// pseudo-element part, each selecting `*.{class}`.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ViewTransitionDef {
    pub class: String,
    /// The rules of each part; a part has one rule per set of at-rules it applies under.
    pub parts: Vec<(TransitionPart, Vec<TransitionRule>)>,
    pub deps: Vec<Dep>,
}

/// Something an atom or marker needs in the stylesheet.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Dep {
    Token(Arc<TokenDef>),
    Theme(Arc<ThemeDef>),
    Keyframes(Arc<KeyframesDef>),
    PositionTry(Arc<PositionTryDef>),
    ViewTransition(Arc<ViewTransitionDef>),
}

/// Adds `dep` to `deps` unless it is already present.
pub fn push_dep(deps: &mut Vec<Dep>, dep: Dep) {
    if !deps.contains(&dep) {
        deps.push(dep);
    }
}
