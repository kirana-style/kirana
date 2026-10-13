//! The utility surface's lowering (KRN-API-012, D-057): a utility such as `hover:bg-blue-600/90`
//! to the declarations it stands for, under the conditions its variants name.
//!
//! It is shared by the engine, which turns each value into the token it names, and by
//! `kirana migrate tailwind`, which turns it into source (`color.blue[600]`), so which utilities
//! exist and what they set is decided in one place (`design-notes/migrate-tailwind.md`). Values are
//! therefore symbolic: an [`Expr`] says where a value came from, and each caller renders it.

use kirana_config::{Grammar, Rule, ScaleRule};
use kirana_diagnostics::Code;
use kirana_ir::Value;

/// Where scale values come from: an export of a module, read the way an `import` would read it.
pub trait Scales {
    fn export(&self, module: &str, export: &str) -> Value;
}

/// A declaration's value, symbolically.
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    /// Literal CSS text: a keyword, a bracketed value, a fraction.
    Text(String),
    /// A key of a scale: `path` inside `export` of `module`, and the value found there.
    Token { module: String, export: String, path: Vec<String>, value: Value },
    /// `calc(<value> * -1)`.
    Negate(Box<Expr>),
    /// `color-mix(in oklab, <value> <percent>%, transparent)`.
    Alpha(Box<Expr>, f64),
    /// Text and tokens side by side: `{compose.ring-shadow}, {compose.shadow}`.
    Concat(Vec<Expr>),
    /// A value a rule's `pair` set (`text-sm`'s line height), which yields to the same property set
    /// directly by another utility — Tailwind's `line-height: var(--tw-leading, <pair>)`.
    Paired(Box<Expr>),
}

/// Drops each paired value ([`Expr::Paired`]) of a property another declaration of the same block
/// sets directly: `text-sm leading-snug` keeps `leading-snug`'s line height whatever the order or
/// the conditions of either. The pairs that stay are their values.
pub fn settle_pairs(declarations: Vec<Declaration>) -> Vec<Declaration> {
    let direct: Vec<(Option<String>, String)> = declarations
        .iter()
        .filter(|declaration| !matches!(declaration.value, Expr::Paired(_)))
        .map(|declaration| (declaration.block.clone(), declaration.property.clone()))
        .collect();
    declarations
        .into_iter()
        .filter(|declaration| {
            !matches!(declaration.value, Expr::Paired(_))
                || !direct.contains(&(declaration.block.clone(), declaration.property.clone()))
        })
        .collect()
}

/// One declaration of a utility, under its conditions (outermost first), on the element itself or
/// on one of its pseudo-elements (`::after`).
#[derive(Debug, Clone, PartialEq)]
pub struct Declaration {
    pub block: Option<String>,
    pub conditions: Vec<String>,
    pub property: String,
    pub value: Expr,
}

/// Why a utility could not be lowered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Failure {
    pub code: Code,
    pub message: String,
    pub help: Option<String>,
}

fn fail(code: Code, message: impl Into<String>, help: Option<String>) -> Failure {
    Failure { code, message: message.into(), help }
}

/// A utility taken apart: `md:hover:-mt-2` is variants `md`, `hover`, negative, name `mt-2`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Parsed<'u> {
    pub variants: Vec<&'u str>,
    pub important: bool,
    pub negative: bool,
    pub name: &'u str,
}

/// Splits a utility into its variants and its name.
pub fn parse(utility: &str) -> Parsed<'_> {
    let mut parts = split_outside_brackets(utility, ':');
    let name = parts.pop().unwrap_or_default();
    // `!p-4` (Tailwind 3) and `p-4!` (Tailwind 4).
    let (important, name) = match name.strip_prefix('!').or_else(|| name.strip_suffix('!')) {
        Some(rest) => (true, rest),
        None => (false, name),
    };
    let (negative, name) = match name.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, name),
    };
    Parsed { variants: parts, important, negative, name }
}

/// One property's value and its conditional values, as an object literal nests them.
#[derive(Debug)]
pub struct Tree<T> {
    pub base: Option<T>,
    pub conditions: Vec<(String, Tree<T>)>,
}

impl<T> Default for Tree<T> {
    fn default() -> Self {
        Self { base: None, conditions: Vec::new() }
    }
}

impl<T> Tree<T> {
    /// Sets the value under `conditions`; a later value replaces an earlier one, as in `css()`.
    pub fn set(&mut self, conditions: &[String], value: T) {
        match conditions.split_first() {
            None => self.base = Some(value),
            Some((first, rest)) => {
                let index = match self.conditions.iter().position(|(key, _)| key == first) {
                    Some(index) => index,
                    None => {
                        self.conditions.push((first.clone(), Tree::default()));
                        self.conditions.len() - 1
                    }
                };
                self.conditions[index].1.set(rest, value);
            }
        }
    }
}

/// Declarations grouped by property, in first-seen order, each property a [`Tree`].
pub fn group<T>(declarations: impl IntoIterator<Item = (Vec<String>, String, T)>) -> Vec<(String, Tree<T>)> {
    let mut properties: Vec<(String, Tree<T>)> = Vec::new();
    for (conditions, property, value) in declarations {
        let index = match properties.iter().position(|(name, _)| *name == property) {
            Some(index) => index,
            None => {
                properties.push((property, Tree::default()));
                properties.len() - 1
            }
        };
        properties[index].1.set(&conditions, value);
    }
    properties
}

/// `text` split on `separator` outside `[…]`.
pub fn split_outside_brackets(text: &str, separator: char) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut depth = 0usize;
    let mut start = 0;
    for (index, character) in text.char_indices() {
        match character {
            '[' => depth += 1,
            ']' => depth = depth.saturating_sub(1),
            _ if character == separator && depth == 0 => {
                parts.push(&text[start..index]);
                start = index + character.len_utf8();
            }
            _ => {}
        }
    }
    parts.push(&text[start..]);
    parts
}

/// The utilities in a string: separated by whitespace, except inside `[…]`, where a space can only
/// belong to the value (`bg-[rgb(1, 2, 3)]`; Tailwind would need `_` there, which works too).
pub fn utilities(text: &str) -> impl Iterator<Item = &str> {
    let mut depth = 0usize;
    text.split(move |character: char| {
        match character {
            '[' => depth += 1,
            ']' => depth = depth.saturating_sub(1),
            _ => {}
        }
        character.is_whitespace() && depth == 0
    })
    .filter(|utility| !utility.is_empty())
}

/// `[3px]` → `3px`, with `_` standing for a space and spaces around `+` and `-` inside math
/// functions, as Tailwind decodes it: `[calc(100%-1px)]` is `calc(100% - 1px)`.
pub fn arbitrary(value: &str) -> Option<String> {
    let inner = value.strip_prefix('[')?.strip_suffix(']')?;
    (!inner.is_empty()).then(|| spaced_math(&inner.replace('_', " ")))
}

/// Spaces around `+` and `-` operators inside `calc()`, `min()`, `max()` and `clamp()`: an operator
/// follows a number, a unit, a `%` or a `)`, never a `(`, another operator or the start of a name.
fn spaced_math(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    // For each open parenthesis: whether it belongs to a math function.
    let mut math: Vec<bool> = Vec::new();
    let mut word = String::new();
    for character in text.chars() {
        match character {
            '(' => {
                // A bare parenthesis groups inside the math around it: `calc((a - b) * 2)`.
                let grouping = word.is_empty() && math.last() == Some(&true);
                math.push(grouping || matches!(word.as_str(), "calc" | "min" | "max" | "clamp"));
                word.clear();
                out.push(character);
            }
            ')' => {
                math.pop();
                word.clear();
                out.push(character);
            }
            '+' | '-' if math.last() == Some(&true) => {
                let previous = out.chars().last();
                let operand = previous
                    .is_some_and(|previous| previous.is_ascii_digit() || previous == '%' || previous == ')')
                    || (previous.is_some_and(|previous| previous.is_ascii_alphabetic())
                        && word.starts_with(|first: char| first.is_ascii_digit()));
                if operand {
                    out.push_str(&format!(" {character} "));
                } else {
                    out.push(character);
                }
                word.clear();
            }
            _ => {
                if character.is_ascii_alphanumeric() || character == '.' {
                    word.push(character);
                } else {
                    word.clear();
                }
                out.push(character);
            }
        }
    }
    out
}

/// A value written as is: `[3px]`, or Tailwind 4's `(--gap)` for `var(--gap)`.
fn written(value: &str) -> Option<String> {
    arbitrary(value).or_else(|| {
        let inner = value.strip_prefix("(--")?.strip_suffix(')')?;
        (!inner.is_empty()).then(|| format!("var(--{inner})"))
    })
}

/// A value written as is, with Tailwind's `--spacing(4)` as that many steps of the `space` scale's
/// `1` (`calc(<space[1]> * 4)`), as Tailwind resolves it inside any bracket value.
pub fn written_expr(grammar: &Grammar, scales: &dyn Scales, text: String) -> Expr {
    let Some(step) = grammar.scales.contains_key("space").then(|| scale_value(grammar, scales, "space", "1")).flatten()
    else {
        return Expr::Text(text);
    };
    let mut parts = Vec::new();
    let mut rest = text.as_str();
    while let Some(start) = rest.find("--spacing(") {
        let open = start + "--spacing(".len();
        // The call's own closing parenthesis: `--spacing(var(--gap))` holds one of its own.
        let mut depth = 1;
        let Some(close) = rest[open..].char_indices().find_map(|(index, character)| {
            depth += match character {
                '(' => 1,
                ')' => -1,
                _ => 0,
            };
            (depth == 0).then_some(open + index)
        }) else {
            break;
        };
        parts.push(Expr::Text(format!("{}calc(", &rest[..start])));
        parts.push(step.clone());
        parts.push(Expr::Text(format!(" * {})", &rest[open..close])));
        rest = &rest[close + 1..];
    }
    if parts.is_empty() {
        return Expr::Text(text);
    }
    parts.push(Expr::Text(rest.to_owned()));
    Expr::Concat(parts.into_iter().filter(|part| *part != Expr::Text(String::new())).collect())
}

/// Whether an arbitrary value is a colour, to pick between a root's colour and non-colour rules.
fn looks_like_colour(value: &str) -> bool {
    kirana_css_data::is_colour_keyword(value)
        || value.starts_with('#')
        || ["rgb(", "rgba(", "hsl(", "hsla(", "oklch(", "oklab(", "lab(", "lch(", "color(", "color-mix(", "var(--"]
            .iter()
            .any(|prefix| value.starts_with(prefix))
}

/// A utility with its variants, as the engine lowers it: everything the grammar cannot say is a
/// failure.
pub fn lower(grammar: &Grammar, scales: &dyn Scales, utility: &str) -> Result<Vec<Declaration>, Failure> {
    let parsed = parse(utility);
    if parsed.important {
        return Err(fail(
            Code::UtilityUnsupported,
            format!("`{utility}`: `!important` has no place in Kirana's cascade"),
            Some("the precedence ladder decides which value wins; see `kirana trace`".to_owned()),
        ));
    }
    let mut block = None;
    let mut conditions = Vec::new();
    for variant in &parsed.variants {
        let condition = self::variant(grammar, variant, utility)?;
        if !is_pseudo_element(&condition) {
            conditions.push(condition);
        } else if block.replace(condition).is_some() {
            return Err(fail(Code::UtilityUnsupported, format!("`{utility}`: two pseudo-elements"), None));
        }
    }
    let declarations = self::declarations(grammar, scales, parsed.name, parsed.negative, utility)?;
    Ok(declarations
        .into_iter()
        .map(|(property, value)| Declaration { block: block.clone(), conditions: conditions.clone(), property, value })
        .collect())
}

/// Whether a variant's condition is a pseudo-element (`::after`), which is a block of its own in
/// `css()`, not a condition.
pub fn is_pseudo_element(condition: &str) -> bool {
    condition.starts_with("::")
}

/// The distinct condition paths among a block's declarations, first-seen order; just the
/// unconditional one when any declaration has no condition, since that covers the rest.
pub fn condition_paths<'c>(paths: impl Iterator<Item = &'c Vec<String>>) -> Vec<Vec<String>> {
    let mut distinct: Vec<Vec<String>> = Vec::new();
    for path in paths {
        if path.is_empty() {
            return vec![Vec::new()];
        }
        if !distinct.contains(path) {
            distinct.push(path.clone());
        }
    }
    distinct
}

/// Whether a pseudo-element block needs `content` to render: Tailwind gives `before:` and `after:`
/// an empty one unless a utility sets it.
pub fn needs_content(block: &str) -> bool {
    block == "::before" || block == "::after"
}

/// A named or arbitrary container query: `@md/card` is `@container card (width >= 28rem)` when the
/// grammar's `@md` is `@container (width >= 28rem)`; `@[250px]/card` is `@container card (width >= 250px)`.
fn container(grammar: &Grammar, variant: &str) -> Option<String> {
    let rest = variant.strip_prefix('@')?;
    let (size, name) = match split_outside_brackets(rest, '/').as_slice() {
        [size, name] => (*size, Some(*name)),
        [size] => (*size, None),
        _ => return None,
    };
    let query = match arbitrary(size) {
        Some(width) => format!("(width >= {width})"),
        None => grammar.variants.get(&format!("@{size}"))?.strip_prefix("@container ")?.to_owned(),
    };
    Some(match name {
        Some(name) => format!("@container {name} {query}"),
        None => format!("@container {query}"),
    })
}

/// Whether a condition is a selector on the element itself, which `:has()` and `:not()` can hold.
fn is_selector(condition: &str) -> bool {
    condition.starts_with(':') || condition.starts_with('[')
}

/// Whether a selector is one compound — no combinator outside brackets and parentheses — so it
/// selects the element itself: `[data-open]:hover` is, `[data-open]>button` is not.
fn is_compound(selector: &str) -> bool {
    let mut depth = 0usize;
    for character in selector.chars() {
        match character {
            '[' | '(' => depth += 1,
            ']' | ')' => depth = depth.saturating_sub(1),
            ' ' | '>' | '+' | '~' | ',' if depth == 0 => return false,
            _ => {}
        }
    }
    true
}

/// A variant's condition key: the grammar's, or one of Tailwind's built-in forms — `data-open` and
/// `data-[state=open]`, `aria-invalid` and `aria-[sort=ascending]`, `has-*`, `not-*`, and a bracketed
/// selector on the element itself (`[&:nth-child(2)]`, `[@media(hover:hover)]`, `[a]`).
pub fn variant(grammar: &Grammar, variant: &str, utility: &str) -> Result<String, Failure> {
    if let Some(condition) = grammar.variants.get(variant) {
        return Ok(condition.clone());
    }
    if let Some(condition) = container(grammar, variant) {
        return Ok(condition);
    }
    for (prefix, pseudo) in [
        ("nth-last-of-type-", "nth-last-of-type"),
        ("nth-of-type-", "nth-of-type"),
        ("nth-last-", "nth-last-child"),
        ("nth-", "nth-child"),
    ] {
        if let Some(rest) = variant.strip_prefix(prefix) {
            let argument =
                arbitrary(rest).or_else(|| rest.bytes().all(|byte| byte.is_ascii_digit()).then(|| rest.to_owned()));
            if let Some(argument) = argument.filter(|argument| !argument.is_empty()) {
                return Ok(format!(":{pseudo}({argument})"));
            }
        }
    }
    if let Some(rest) = variant.strip_prefix("supports-") {
        // `supports-[display:grid]` as written; `supports-backdrop-filter` asks for the property.
        let query = arbitrary(rest).unwrap_or_else(|| rest.to_owned());
        return Ok(if query.contains(':') || query.contains('(') {
            format!("@supports ({query})")
        } else {
            format!("@supports ({query}: var(--tw))")
        });
    }
    for prefix in ["data", "aria"] {
        let Some(rest) = variant.strip_prefix(prefix).and_then(|rest| rest.strip_prefix('-')) else { continue };
        if let Some(inner) = arbitrary(rest) {
            return Ok(match inner.split_once('=') {
                Some((name, value)) => format!("[{prefix}-{name}=\"{}\"]", value.trim_matches(['"', '\''])),
                None => format!("[{prefix}-{inner}]"),
            });
        }
        if let Some((name, value)) = rest.split_once('=') {
            // Tailwind 4.1: `data-side=left` is `[data-side="left"]`.
            return Ok(format!("[{prefix}-{name}=\"{value}\"]"));
        }
        if !rest.is_empty() && rest.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-') {
            // Tailwind 4: `data-open` is `[data-open]`, `aria-invalid` is `[aria-invalid="true"]`.
            return Ok(if prefix == "data" { format!("[data-{rest}]") } else { format!("[aria-{rest}=\"true\"]") });
        }
    }
    for (prefix, pseudo) in [("has-", ":has"), ("not-", ":not")] {
        let Some(rest) = variant.strip_prefix(prefix) else { continue };
        let (inner, written) = match arbitrary(rest) {
            Some(selector) => (selector, true),
            None => (self::variant(grammar, rest, utility)?, false),
        };
        if pseudo == ":has" || written || is_selector(&inner) {
            return Ok(format!("{pseudo}({inner})"));
        }
    }
    if let Some(inner) = arbitrary(variant) {
        if let Some(own) = inner.strip_prefix('&').filter(|own| is_selector(own) && is_compound(own)) {
            return Ok(own.to_owned());
        }
        if inner.starts_with('@') {
            return Ok(inner);
        }
        if !inner.contains('&') {
            return Ok(format!(":is({inner})"));
        }
    }
    if variant.starts_with("group") || variant.starts_with("peer") {
        return Err(fail(
            Code::UtilityUnsupported,
            format!("`{utility}`: `{variant}:` reads another element's state"),
            Some("declare a relation and read it in css(): relation(\"…\").within(…)".to_owned()),
        ));
    }
    if variant.starts_with('[') {
        return Err(fail(
            Code::UtilityUnsupported,
            format!("`{utility}`: arbitrary selector variants are not utilities"),
            Some("style descendants with select.* in css()".to_owned()),
        ));
    }
    Err(fail(
        Code::UnknownUtilityVariant,
        format!("`{utility}`: no variant `{variant}`"),
        nearest(grammar.variants.keys(), variant),
    ))
}

/// The declarations of a utility name without variants.
pub fn declarations(
    grammar: &Grammar,
    scales: &dyn Scales,
    name: &str,
    negative: bool,
    utility: &str,
) -> Result<Vec<(String, Expr)>, Failure> {
    // `@container/card` is `@container` with a name.
    if let Some(container) = name.strip_prefix("@container/").filter(|container| !container.is_empty()) {
        let mut declarations = self::declarations(grammar, scales, "@container", negative, utility)?;
        declarations.push(("containerName".to_owned(), Expr::Text(container.to_owned())));
        return Ok(declarations);
    }
    // Longest root first: `rounded-t-lg` is `rounded-t` with `lg`, not `rounded` with `t-lg`.
    let mut splits: Vec<usize> = name.match_indices('-').map(|(index, _)| index).collect();
    splits.push(name.len());
    let mut known_root = false;
    for &end in splits.iter().rev() {
        let root = &name[..end];
        let Some(rules) = grammar.utilities.get(root) else { continue };
        known_root = true;
        let value = name.get(end + 1..).unwrap_or("");
        // A root with both colour and other rules (`text`): a bracketed value's shape picks one.
        let colour = |rule: &Rule| matches!(rule, Rule::Scale(scale) if scale.alpha);
        let mixed = rules.iter().any(colour) && rules.iter().any(|rule| !colour(rule));
        for rule in rules {
            if let Some(declarations) = apply(grammar, scales, rule, value, negative, mixed) {
                // A property written `{scale.key}` must name a token this module can reach.
                if let Some((property, _)) = declarations.iter().find(|(property, _)| {
                    property.starts_with('{') && property_token(grammar, scales, property).is_none()
                }) {
                    return Err(fail(
                        Code::UnknownUtility,
                        format!("`{utility}`: the token {property} cannot be reached from here"),
                        Some("the module declaring it must be a dependency of this package".to_owned()),
                    ));
                }
                return Ok(declarations);
            }
        }
    }
    Err(if known_root {
        fail(Code::UnknownUtility, format!("`{utility}`: no such value"), None)
    } else {
        fail(Code::UnknownUtility, format!("`{utility}` is not a utility"), nearest(grammar.utilities.keys(), name))
    })
}

/// Grammar text with its references resolved: `{scale.key}` is that token, and `{value}` the
/// utility's own value. `None` when a reference does not resolve.
fn text_expr(grammar: &Grammar, scales: &dyn Scales, text: &str, value: Option<&Expr>) -> Option<Expr> {
    if !text.contains('{') {
        return Some(Expr::Text(text.to_owned()));
    }
    let mut parts = Vec::new();
    let mut rest = text;
    while let Some(start) = rest.find('{') {
        let end = start + rest[start..].find('}')?;
        if start > 0 {
            parts.push(Expr::Text(rest[..start].to_owned()));
        }
        let reference = &rest[start + 1..end];
        parts.push(match reference.split_once('.') {
            None if reference == "value" => value?.clone(),
            Some((scale, key)) if grammar.scales.contains_key(scale) => scale_value(grammar, scales, scale, key)?,
            _ => return None,
        });
        rest = &rest[end + 1..];
    }
    if !rest.is_empty() {
        parts.push(Expr::Text(rest.to_owned()));
    }
    Some(if parts.len() == 1 { parts.remove(0) } else { Expr::Concat(parts) })
}

/// The token a property written `{scale.key}` names, which the declaration sets (a custom property
/// the grammar composes, as Tailwind composes `--tw-ring-shadow`).
pub fn property_token(grammar: &Grammar, scales: &dyn Scales, property: &str) -> Option<Expr> {
    let (scale, key) = property.strip_prefix('{')?.strip_suffix('}')?.split_once('.')?;
    grammar.scales.contains_key(scale).then(|| scale_value(grammar, scales, scale, key)).flatten()
}

/// Declarations as written in the grammar, references resolved.
fn written_declarations<'r>(
    grammar: &Grammar,
    scales: &dyn Scales,
    declarations: impl IntoIterator<Item = (&'r String, &'r String)>,
) -> Option<Vec<(String, Expr)>> {
    declarations
        .into_iter()
        .map(|(property, text)| Some((property.clone(), text_expr(grammar, scales, text, None)?)))
        .collect()
}

/// A rule's declarations for `value`, or `None` when the rule does not take it.
fn apply(
    grammar: &Grammar,
    scales: &dyn Scales,
    rule: &Rule,
    value: &str,
    negative: bool,
    mixed: bool,
) -> Option<Vec<(String, Expr)>> {
    match rule {
        Rule::Static(rule) => {
            if !value.is_empty() || negative {
                return None;
            }
            written_declarations(grammar, scales, &rule.declarations)
        }
        Rule::Keyword(rule) => {
            if negative {
                return None;
            }
            let value = match rule.values.get(value) {
                Some(value) => text_expr(grammar, scales, value, None)?,
                None => {
                    written_expr(grammar, scales, written(value).filter(|value| !(mixed && looks_like_colour(value)))?)
                }
            };
            let mut declarations: Vec<(String, Expr)> =
                rule.properties.iter().map(|property| (property.clone(), value.clone())).collect();
            declarations.extend(written_declarations(grammar, scales, &rule.also)?);
            Some(declarations)
        }
        Rule::Scale(rule) => apply_scale(grammar, scales, rule, value, negative, mixed),
    }
}

fn apply_scale(
    grammar: &Grammar,
    scales: &dyn Scales,
    rule: &ScaleRule,
    value: &str,
    negative: bool,
    mixed: bool,
) -> Option<Vec<(String, Expr)>> {
    if value.is_empty() || (negative && !rule.negative) {
        return None;
    }
    let (key, alpha, modifier) = match split_outside_brackets(value, '/').as_slice() {
        [key, alpha] if rule.alpha => (*key, Some(*alpha), None),
        // `text-sm/relaxed`: the pair's value named by the utility that sets it (`leading-relaxed`).
        [key, modifier] if !rule.pair.is_empty() => (*key, None, Some(*modifier)),
        _ => (value, None, None),
    };
    let key_written = written(key);
    let mut resolved = if let Some(text) = key_written.clone() {
        if mixed && rule.alpha != looks_like_colour(&text) {
            return None;
        }
        written_expr(grammar, scales, text)
    } else if let Some(fraction) = rule.fractions.then(|| fraction(value)).flatten() {
        Expr::Text(fraction)
    } else if let Some(found) = rule
        .scale
        .as_ref()
        .and_then(|scale| scale_value(grammar, scales, scale, rule.aliases.get(key).map_or(key, String::as_str)))
    {
        found
    } else {
        Expr::Text(number(rule.number.as_ref()?, key)?)
    };
    if negative {
        resolved = Expr::Negate(Box::new(resolved));
    }
    if let Some(alpha) = alpha {
        let percent = alpha.parse::<f64>().ok().filter(|percent| (0.0..=100.0).contains(percent))?;
        resolved = Expr::Alpha(Box::new(resolved), percent);
    }
    if let Some(format) = &rule.format {
        resolved = text_expr(grammar, scales, format, Some(&resolved))?;
    }
    let mut declarations: Vec<(String, Expr)> =
        rule.properties.iter().map(|property| (property.clone(), resolved.clone())).collect();
    for (property, scale) in &rule.pair {
        match modifier {
            Some(modifier) => {
                declarations.push((property.clone(), pair_modifier(grammar, scales, property, modifier)?))
            }
            None if key_written.is_none() => {
                if let Some(paired) = scale_value(grammar, scales, scale, key) {
                    declarations.push((property.clone(), Expr::Paired(Box::new(paired))));
                }
            }
            None => {}
        }
    }
    declarations.extend(written_declarations(grammar, scales, &rule.also)?);
    Some(declarations)
}

/// A pair's value written as a modifier (`/relaxed`, `/6`, `/[1.1]`): what the root whose rules set
/// that property alone makes of it — `leading-relaxed` for a line height.
fn pair_modifier(grammar: &Grammar, scales: &dyn Scales, property: &str, modifier: &str) -> Option<Expr> {
    grammar.utilities.iter().find_map(|(root, rules)| {
        let sets = rules.iter().any(|rule| match rule {
            Rule::Scale(rule) => rule.properties == [property],
            Rule::Keyword(rule) => rule.properties == [property],
            Rule::Static(_) => false,
        });
        let declarations = sets
            .then(|| declarations(grammar, scales, &format!("{root}-{modifier}"), false, ""))
            .and_then(Result::ok)?;
        declarations.into_iter().find_map(|(name, expr)| (name == property).then_some(expr))
    })
}

/// A key's value in a scale: `600` in `color.blue` is written `blue-600`.
fn scale_value(grammar: &Grammar, scales: &dyn Scales, scale: &str, key: &str) -> Option<Expr> {
    // The configuration validated that every scale a rule names exists.
    grammar.scales[scale].iter().find_map(|source| {
        let exported = scales.export(&source.module, &source.export);
        let (path, value) = lookup(&exported, key)?;
        Some(Expr::Token { module: source.module.clone(), export: source.export.clone(), path, value })
    })
}

/// `50` with a step of `0.25` and unit `rem` → `12.5rem`.
fn number(rule: &kirana_config::NumberRule, key: &str) -> Option<String> {
    let digits = |text: &str| !text.is_empty() && text.bytes().all(|byte| byte.is_ascii_digit());
    let valid = match key.split_once('.') {
        Some((whole, fraction)) => digits(whole) && digits(fraction),
        None => digits(key),
    };
    let value = key.parse::<f64>().ok().filter(|_| valid)? * rule.step;
    // `95 × 0.01` is `0.9500000000000001` in binary; CSS never needs more than six places.
    let value = (value * 1e6).round() / 1e6;
    Some(format!("{value}{}", rule.unit))
}

/// `1/2` → `calc(1/2 * 100%)`, as Tailwind v4 writes it.
fn fraction(value: &str) -> Option<String> {
    let (numerator, denominator) = value.split_once('/')?;
    let digits = |text: &str| !text.is_empty() && text.bytes().all(|byte| byte.is_ascii_digit());
    (digits(numerator) && digits(denominator)).then(|| format!("calc({numerator}/{denominator} * 100%)"))
}

/// `primary-foreground` → `primaryForeground`: how a token group written in JavaScript names it.
fn camel_case(key: &str) -> String {
    let mut out = String::with_capacity(key.len());
    let mut upper = false;
    for character in key.chars() {
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

/// `key` in a token group, descending into nested groups at a `-`: the path taken and the value.
/// A kebab-case key also finds its camelCase token (`primary-foreground`, `primaryForeground`).
fn lookup(value: &Value, key: &str) -> Option<(Vec<String>, Value)> {
    let camel = camel_case(key);
    let direct =
        value.get(key).map(|found| (key, found)).or_else(|| value.get(&camel).map(|found| (camel.as_str(), found)));
    if let Some((key, found)) = direct {
        return match found {
            Value::Object(_) => {
                found.get("DEFAULT").map(|inner| (vec![key.to_owned(), "DEFAULT".to_owned()], inner.clone()))
            }
            other => Some((vec![key.to_owned()], other.clone())),
        };
    }
    key.match_indices('-').find_map(|(index, _)| {
        let (mut path, found) = lookup(value.get(&key[..index])?, &key[index + 1..])?;
        path.insert(0, key[..index].to_owned());
        Some((path, found))
    })
}

/// Up to three known names sharing the longest prefix with `name`.
pub fn nearest<'n>(known: impl Iterator<Item = &'n String>, name: &str) -> Option<String> {
    let shared = |candidate: &str| candidate.chars().zip(name.chars()).take_while(|(a, b)| a == b).count();
    let mut candidates: Vec<(&String, usize)> =
        known.map(|candidate| (candidate, shared(candidate))).filter(|(_, count)| *count > 0).collect();
    candidates.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(b.0)));
    let names: Vec<String> = candidates.into_iter().take(3).map(|(candidate, _)| format!("`{candidate}`")).collect();
    (!names.is_empty()).then(|| format!("did you mean {}?", names.join(", ")))
}
