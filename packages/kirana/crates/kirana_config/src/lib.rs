//! The resolved configuration the engine receives (KRN-CMP-013). The Driver loads
//! `kirana.config.*` and hands over plain JSON; the engine never evaluates configuration code.
//! Keys and defaults are owned by [11-integrations](../../../../spec/11-integrations.md#configuration).

use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};

use kirana_diagnostics::{Code, Diagnostic, Level, OverrideError, Span, validate_override};
use serde::Deserialize;

/// A browser version: a major number or `"major.minor"`.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Version {
    Major(u32),
    Text(String),
}

/// Browser targets (KRN-OUT-002).
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Targets {
    pub chrome: Option<Version>,
    pub safari: Option<Version>,
    pub firefox: Option<Version>,
}

/// A target as `(major << 16) | (minor << 8)`, Lightning CSS's encoding.
pub fn encode_version(version: &Version) -> Option<u32> {
    match version {
        Version::Major(major) => Some(major << 16),
        Version::Text(text) => {
            let (major, minor) = text.split_once('.').unwrap_or((text, "0"));
            // A third part leaves a `.` in `minor`, which does not parse.
            let (major, minor): (u32, u32) = (major.parse().ok()?, minor.parse().ok()?);
            if minor > 255 {
                return None;
            }
            Some((major << 16) | (minor << 8))
        }
    }
}

/// The default floor: Chrome 123, Safari 17.5, Firefox 120 (D-026).
pub const FLOOR: (u32, u32, u32) = (123 << 16, (17 << 16) | (5 << 8), 120 << 16);

#[derive(Debug, Clone, Deserialize, PartialEq, Default)]
#[serde(deny_unknown_fields)]
pub struct Layers {
    #[serde(default)]
    pub before: Vec<String>,
    #[serde(default)]
    pub after: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Dynamic {
    #[serde(default = "default_branch_budget")]
    pub branch_budget: u32,
}

fn default_branch_budget() -> u32 {
    16
}

impl Default for Dynamic {
    fn default() -> Self {
        Self { branch_budget: default_branch_budget() }
    }
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Names {
    #[serde(default = "default_prefix")]
    pub prefix: String,
}

fn default_prefix() -> String {
    "k".to_owned()
}

impl Default for Names {
    fn default() -> Self {
        Self { prefix: default_prefix() }
    }
}

/// Which attribute `sx` compiles to on host elements (KRN-INT-004).
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Jsx {
    /// `className`, as React's DOM props spell it.
    #[default]
    React,
    /// `class`: Preact renders `className` only through `preact/compat`.
    Preact,
    /// `class`: Solid's JSX has no `className`.
    Solid,
    /// `class`: Qwik's JSX takes the HTML attribute (D-067).
    Qwik,
}

impl Jsx {
    /// The host element attribute that carries classes.
    #[must_use]
    pub const fn class_attribute(self) -> &'static str {
        match self {
            Self::React => "className",
            Self::Preact | Self::Solid | Self::Qwik => "class",
        }
    }
}

/// The resolved configuration.
#[derive(Debug, Clone, Deserialize, PartialEq, Default)]
#[serde(deny_unknown_fields)]
pub struct Config {
    /// Absolute project root; scopes `kirana-style build` and relative file names in diagnostics.
    #[serde(default)]
    pub root: String,
    pub targets: Option<Targets>,
    #[serde(default)]
    pub layers: Layers,
    #[serde(default)]
    pub dynamic: Dynamic,
    #[serde(default)]
    pub names: Names,
    #[serde(default)]
    pub jsx: Jsx,
    #[serde(default)]
    pub diagnostics: BTreeMap<String, Level>,
    #[serde(default)]
    pub conditions: Conditions,
    /// Installed packages whose styles this application compiles, as it compiles its own
    /// (KRN-INT-008, D-054): a published Kirana library ships its `css()` calls uncompiled.
    #[serde(default)]
    pub libraries: Vec<String>,
    /// The utility grammar string `sx` values lower through (KRN-API-012,
    /// `design-notes/utility-surface.md`): the presets' grammars and the project's own, merged by the
    /// Driver. Without one, a string `sx` is `utility-surface-disabled`.
    #[serde(default)]
    pub utilities: Option<Grammar>,
    /// The class map for server templates (D-069): the modules whose exported handles templates
    /// name, and the JSON file their class strings are written to.
    #[serde(default)]
    pub classes: Option<Classes>,
    /// Specifier prefixes the bundler provides and Node.js resolution cannot find (Ember's
    /// `@ember/` and `@glimmer/`): imports from them are runtime values, without `unresolved-import`.
    #[serde(default)]
    pub externals: Vec<String>,
}

/// Where a server app's template styles live, and where their class map goes (D-069).
#[derive(Debug, Clone, Deserialize, PartialEq, Default)]
#[serde(deny_unknown_fields)]
pub struct Classes {
    /// Files or directories, relative to the root, whose exports the class map lists.
    pub modules: Vec<String>,
    /// The class map file, relative to the root.
    pub out: String,
}

/// A utility grammar: where scale values come from, what each utility root sets, and what each
/// variant is. Data only; a preset declares it and the engine interprets it.
#[derive(Debug, Clone, Deserialize, PartialEq, Default)]
#[serde(deny_unknown_fields)]
pub struct Grammar {
    /// Scale name → the modules exporting it, searched in order.
    #[serde(default)]
    pub scales: BTreeMap<String, Vec<ScaleSource>>,
    /// Utility root (`p`, `text`, `rounded-t`) → alternatives, tried in order.
    #[serde(default)]
    pub utilities: BTreeMap<String, Vec<Rule>>,
    /// Variant name (`hover`, `md`) → the condition key `css()` accepts (`:hover`, `@media …`).
    #[serde(default)]
    pub variants: BTreeMap<String, String>,
}

/// One export of one module holding a scale's values, read as an import would read it.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ScaleSource {
    pub module: String,
    pub export: String,
}

/// What one utility root sets.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Rule {
    /// The root alone, with no value: `flex` → `{ display: "flex" }`.
    Static(StaticRule),
    /// Values from a scale: `p-4` → `{ padding: space[4] }`.
    Scale(ScaleRule),
    /// Values from a fixed table: `items-center` → `{ alignItems: "center" }`.
    Keyword(KeywordRule),
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct StaticRule {
    #[serde(rename = "static")]
    pub declarations: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct ScaleRule {
    pub properties: Vec<String>,
    /// The scale keys come from. A rule with only `number` takes numbers alone (`line-clamp-3`).
    #[serde(default)]
    pub scale: Option<String>,
    /// A number that is not a key: `w-50` is 50 steps of `0.25rem`, `z-1` is `1`.
    #[serde(default)]
    pub number: Option<NumberRule>,
    /// Properties set from other scales at the same key: `text-sm` also sets its line height.
    #[serde(default)]
    pub pair: BTreeMap<String, String>,
    /// A colour: `/90` mixes it with `transparent`.
    #[serde(default)]
    pub alpha: bool,
    /// `-mt-2` negates the value.
    #[serde(default)]
    pub negative: bool,
    /// `w-1/2` is a percentage.
    #[serde(default)]
    pub fractions: bool,
    /// Utility keys spelled differently from the scale's: `in-out` → `inOut`.
    #[serde(default)]
    pub aliases: BTreeMap<String, String>,
    /// Declarations set alongside, as written: `border-2` also makes the border solid.
    #[serde(default)]
    pub also: BTreeMap<String, String>,
    /// The value inside other text: `brightness({value})`.
    #[serde(default)]
    pub format: Option<String>,
}

/// How a bare number becomes a value: `step` times the number, then `unit`.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct NumberRule {
    #[serde(default = "one")]
    pub step: f64,
    #[serde(default)]
    pub unit: String,
}

fn one() -> f64 {
    1.0
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct KeywordRule {
    pub properties: Vec<String>,
    pub values: BTreeMap<String, String>,
    /// Declarations set alongside, as written.
    #[serde(default)]
    pub also: BTreeMap<String, String>,
}

/// What the project knows about its conditions that selectors cannot say.
#[derive(Debug, Clone, Deserialize, PartialEq, Default)]
#[serde(deny_unknown_fields)]
pub struct Conditions {
    /// Groups of simple conditions no two of which match one element at the same time, such as a
    /// library's `[data-starting-style]` and `[data-ending-style]`. `ambiguous-precedence` treats
    /// them as exclusive (KRN-CAS-003). Normalized to condition text when parsed.
    #[serde(default)]
    pub exclusive: Vec<Vec<String>>,
    /// One vocabulary per library a design system writes its components for, such as each
    /// library's state attributes from `@kirana-style/states`' `exclusiveAcross()`: a component is
    /// built on one library, so two conditions no vocabulary holds together are exclusive (KF-015).
    #[serde(default, rename = "exclusiveAcross")]
    pub exclusive_across: Vec<Vec<String>>,
    /// Attributes the project's own components write (`data-side` on a sheet), whatever library
    /// they are built on: a key on one is never taken for a vocabulary's, so `exclusiveAcross`
    /// keeps nothing apart by it (KF-042).
    #[serde(default, rename = "ownAttributes")]
    pub own_attributes: Vec<String>,
}

impl Config {
    /// Parses and validates configuration JSON. Every problem is an `invalid-config` diagnostic
    /// naming the key path.
    pub fn from_json(json: &str) -> Result<Config, Vec<Diagnostic>> {
        let mut config: Config = serde_json::from_str(json).map_err(|error| vec![invalid(format!("{error}"))])?;
        let mut problems = Vec::new();
        if config.names.prefix.is_empty()
            || config.names.prefix.len() > 4
            || !config.names.prefix.bytes().all(|byte| byte.is_ascii_lowercase())
        {
            problems.push(invalid(format!(
                "names.prefix must be 1–4 lowercase ASCII letters, got {:?}",
                config.names.prefix
            )));
        }
        if config.dynamic.branch_budget == 0 {
            problems.push(invalid("dynamic.branchBudget must be at least 1".to_owned()));
        }
        if let Some(targets) = &config.targets {
            for (browser, version) in
                [("chrome", &targets.chrome), ("safari", &targets.safari), ("firefox", &targets.firefox)]
            {
                if let Some(version) = version
                    && encode_version(version).is_none()
                {
                    problems.push(invalid(format!("targets.{browser} is not a version: {version:?}")));
                }
            }
        }
        for layer in config.layers.before.iter().chain(&config.layers.after) {
            if layer == "kirana" || !is_ident(layer) {
                problems.push(invalid(format!("layers: {layer:?} is not a usable layer name")));
            }
        }
        for name in config.diagnostics.keys() {
            match validate_override(name) {
                Ok(_) => {}
                Err(OverrideError::UnknownName(name)) => {
                    problems.push(invalid(format!("diagnostics.{name} is not a Kirana diagnostic")));
                }
                Err(OverrideError::ErrorNotAdjustable(name)) => problems.push(invalid(format!(
                    "diagnostics.{name} is an error and cannot be re-levelled: it means the output would be wrong"
                ))),
            }
        }
        if let Some(grammar) = &mut config.utilities {
            validate_grammar(grammar, &mut problems);
            // A relative module is relative to the project root, wherever the importing file is.
            for source in grammar.scales.values_mut().flatten() {
                if !config.root.is_empty() && (source.module.starts_with("./") || source.module.starts_with("../")) {
                    source.module = normalize(&Path::new(&config.root).join(&source.module));
                }
            }
        }
        for name in &config.libraries {
            if !is_package_name(name) {
                problems.push(invalid(format!("libraries: {name:?} is not a package name")));
            }
        }
        for (index, group) in config.conditions.exclusive.iter_mut().enumerate() {
            if group.len() < 2 {
                problems.push(invalid(format!("conditions.exclusive[{index}] needs at least two conditions")));
            }
            normalize_conditions(group, &format!("conditions.exclusive[{index}]"), &mut problems);
        }
        if config.conditions.exclusive_across.len() == 1 {
            problems.push(invalid("conditions.exclusiveAcross needs at least two vocabularies".to_owned()));
        }
        for (index, vocabulary) in config.conditions.exclusive_across.iter_mut().enumerate() {
            normalize_conditions(vocabulary, &format!("conditions.exclusiveAcross[{index}]"), &mut problems);
        }
        for (index, name) in config.conditions.own_attributes.iter().enumerate() {
            if !kirana_ir::is_attribute_name(name) {
                problems.push(invalid(format!(
                    "conditions.ownAttributes[{index}] must be an attribute name such as \"data-side\", got {name:?}"
                )));
            }
        }
        if problems.is_empty() { Ok(config) } else { Err(problems) }
    }

    /// Whether the configured targets are at or above the default floor, so no lowering is needed.
    pub fn targets_at_floor(&self) -> bool {
        let Some(targets) = &self.targets else { return true };
        let at_least = |version: &Option<Version>, floor: u32| {
            version.as_ref().and_then(encode_version).is_none_or(|value| value >= floor)
        };
        at_least(&targets.chrome, FLOOR.0) && at_least(&targets.safari, FLOOR.1) && at_least(&targets.firefox, FLOOR.2)
    }

    /// The configured level for a diagnostic, if any.
    pub fn level(&self, code: Code) -> Option<Level> {
        self.diagnostics.get(code.name()).copied()
    }
}

fn is_ident(text: &str) -> bool {
    text.chars().next().is_some_and(|first| first.is_ascii_alphabetic() || first == '_')
        && text.chars().all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
}

/// Every scale a rule names exists, and every rule sets something.
fn validate_grammar(grammar: &Grammar, problems: &mut Vec<Diagnostic>) {
    for (root, rules) in &grammar.utilities {
        for rule in rules {
            let properties = match rule {
                Rule::Static(rule) if rule.declarations.is_empty() => {
                    problems.push(invalid(format!("utilities.utilities.{root}: a static rule sets nothing")));
                    continue;
                }
                Rule::Static(_) => continue,
                Rule::Scale(rule) => {
                    if rule.scale.is_none() && rule.number.is_none() {
                        problems.push(invalid(format!("utilities.utilities.{root}: a rule needs a scale or a number")));
                    }
                    if rule.number.as_ref().is_some_and(|number| number.step.is_nan() || number.step <= 0.0) {
                        problems.push(invalid(format!("utilities.utilities.{root}: a number's step must be positive")));
                    }
                    for scale in rule.scale.iter().chain(rule.pair.values()) {
                        if !grammar.scales.contains_key(scale) {
                            problems.push(invalid(format!("utilities.utilities.{root}: no scale named {scale:?}")));
                        }
                    }
                    &rule.properties
                }
                Rule::Keyword(rule) => &rule.properties,
            };
            if properties.is_empty() {
                problems.push(invalid(format!("utilities.utilities.{root}: a rule needs at least one property")));
            }
        }
    }
}

/// `/a/b/../c/./d` → `/a/c/d`, without touching the file system.
fn normalize(path: &Path) -> String {
    let mut out = PathBuf::new();
    for component in path.components().filter(|component| *component != Component::CurDir) {
        if component == Component::ParentDir {
            out.pop();
        } else {
            out.push(component.as_os_str());
        }
    }
    out.to_string_lossy().into_owned()
}

/// An npm package name: `name` or `@scope/name`, lowercase, URL-safe.
/// Each condition of `list` as condition text, or a problem naming it under `path`.
fn normalize_conditions(list: &mut [String], path: &str, problems: &mut Vec<Diagnostic>) {
    for condition in list.iter_mut() {
        match kirana_ir::parse_simple_selectors(condition).as_deref() {
            Ok([single]) if single.is_selector() => *condition = single.canonical(),
            _ => {
                problems.push(invalid(format!("{path}: {condition:?} is not one attribute or pseudo-class condition")))
            }
        }
    }
}

fn is_package_name(name: &str) -> bool {
    let part = |text: &str| {
        !text.is_empty()
            && !text.starts_with(['.', '_'])
            && text.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || b"-._~".contains(&byte))
    };
    match name.strip_prefix('@').map(|rest| rest.split_once('/')) {
        Some(Some((scope, bare))) => part(scope) && part(bare),
        Some(None) => false,
        None => part(name),
    }
}

fn invalid(message: String) -> Diagnostic {
    Diagnostic::new(Code::InvalidConfig, "", Span::default(), message)
}
