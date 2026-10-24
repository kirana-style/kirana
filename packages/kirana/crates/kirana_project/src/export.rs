//! `kirana-style export` (KRN-DX-011): the project's design system as data — tokens, themes, recipes,
//! relations and named definitions, each with the file that declares it — for agents, design tools
//! and review. It holds names, values and project-relative origins, never source text, and is
//! sorted so that the file diffs cleanly.

use std::collections::BTreeMap;
use std::path::PathBuf;

use kirana_diagnostics::line_column;
use kirana_ir::{Dep, Handle, Key, Op, Value};
use serde::Serialize;

use crate::Project;
use crate::describe::{ConditionInfo, conditions, target};
use crate::inspect::RelationInfo;
use crate::resolve::ModuleHost;
use crate::trace::RecipePart;

/// Everything `kirana-style export` describes, apart from what the configuration says.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct DesignSystem {
    pub tokens: Vec<TokenExport>,
    pub themes: Vec<ThemeExport>,
    pub recipes: Vec<RecipeExport>,
    pub relations: Vec<RelationExport>,
    pub keyframes: Vec<NamedExport>,
    #[serde(rename = "positionTries")]
    pub position_tries: Vec<NamedExport>,
    #[serde(rename = "viewTransitions")]
    pub view_transitions: Vec<NamedExport>,
    #[serde(rename = "counterStyles")]
    pub counter_styles: Vec<NamedExport>,
    /// Every exported `css()` handle with what it evaluates to; only with definitions asked for.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub styles: Option<Vec<StyleExport>>,
}

/// An exported `css()` handle (or one inside an exported object, `styles.root`) and its entries.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StyleExport {
    pub name: String,
    pub origin: String,
    #[serde(flatten)]
    pub definition: Definition,
}

/// What a handle evaluates to (KF-023): its entries in merge order, and the relations it anchors.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct Definition {
    pub entries: Vec<EntryExport>,
    /// Relations an element with this style anchors, by name.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub anchors: Vec<String>,
}

/// One entry of a handle: a declaration, or a `null` that removes one when the handle is merged.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct EntryExport {
    /// As CSS writes it; a custom property a token assigns is that token's `--kv…`.
    pub property: String,
    /// The CSS value; `None` (JSON `null`) for an entry that removes the property under its
    /// conditions, or under every condition when `conditions` is `None` too.
    pub value: Option<String>,
    /// `None` only for a removal of the property under every condition (`property: null`).
    pub conditions: Option<Vec<ConditionInfo>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    /// The variable tokens the value reads, by identity (an inlined token is written as its value).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tokens: Vec<String>,
    /// The variable token whose custom property the entry assigns (`[theme.accent]: …`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assigns: Option<String>,
    /// The keyframes the value names.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub keyframes: Vec<String>,
    /// The atom class the entry compiles to.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class: Option<String>,
}

/// One part of a recipe and its definition.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RecipePartExport {
    #[serde(flatten)]
    pub part: RecipePart,
    #[serde(flatten)]
    pub definition: Definition,
}

/// One token: what code writes (`identity`), the package that declares it, its value, and where it
/// is declared. Two packages may declare one group name; `package` tells their tokens apart.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TokenExport {
    pub identity: String,
    /// Empty, and left out, for a file outside any package.
    #[serde(skip_serializing_if = "String::is_empty")]
    pub package: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub light: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dark: Option<String>,
    /// Read through a custom property, so a theme can override it.
    pub variable: bool,
    /// `file:line`.
    pub origin: String,
}

/// An exported `defineTheme()`: the class that applies it and the tokens it overrides.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ThemeExport {
    pub name: String,
    pub origin: String,
    pub class: String,
    pub overrides: Vec<String>,
}

/// A `relation()`: where it is declared, anchored and read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RelationExport {
    pub name: String,
    #[serde(rename = "declaredIn")]
    pub declared_in: Vec<String>,
    #[serde(rename = "anchoredIn")]
    pub anchored_in: Vec<String>,
    #[serde(rename = "readIn")]
    pub read_in: Vec<String>,
}

/// An exported `recipe()`: what a call may choose.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RecipeExport {
    pub name: String,
    pub origin: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slots: Option<Vec<String>>,
    /// Group → its options in declaration order; groups by name.
    pub variants: BTreeMap<String, Vec<String>>,
    pub defaults: BTreeMap<String, String>,
    #[serde(rename = "compoundVariants")]
    pub compound_variants: usize,
    /// Each part's definition, base first, slot by slot; only with definitions asked for.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parts: Option<Vec<RecipePartExport>>,
}

/// An exported keyframes, `positionTry()`, `viewTransition()` or `counterStyle()`: the export and what
/// CSS names it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct NamedExport {
    pub name: String,
    pub origin: String,
    pub css: String,
}

impl Project {
    /// The design system declared by the modules under `paths` (compile them first, so that the
    /// tokens and relations they read are known).
    pub fn design_system(&self, paths: &[PathBuf]) -> DesignSystem {
        self.design_system_with(paths, false)
    }

    /// What `kirana-style export` prints for `paths` (the project root when empty), compiling them
    /// first, and the diagnostics of that compile: the schema version, the engine, the class prefix
    /// and the design system.
    pub fn export(
        &self,
        paths: &[PathBuf],
        definitions: bool,
    ) -> (serde_json::Value, Vec<kirana_diagnostics::Diagnostic>) {
        let paths = if paths.is_empty() { vec![self.root.clone()] } else { paths.to_vec() };
        let (diagnostics, _) = self.compile_paths(&paths);
        let mut description = serde_json::json!({
            "schema": 1,
            "engine": env!("CARGO_PKG_VERSION"),
            "prefix": self.config().names.prefix,
        });
        let design = serde_json::to_value(self.design_system_with(&paths, definitions)).expect("serializable");
        description.as_object_mut().expect("an object").extend(design.as_object().expect("an object").clone());
        (description, diagnostics)
    }

    /// [`Project::design_system`], with each exported style's and recipe's evaluated definition when
    /// `definitions` is set (`kirana-style export --definitions`).
    pub fn design_system_with(&self, paths: &[PathBuf], definitions: bool) -> DesignSystem {
        let mut files = Vec::new();
        for path in paths {
            crate::collect_sources(path, &mut files, crate::SCRIPT_EXTENSIONS);
        }
        let mut sources: BTreeMap<String, String> = BTreeMap::new();
        let mut source = |file: &str| -> String {
            sources
                .entry(file.to_owned())
                .or_insert_with(|| self.fs.read_to_string(&self.root.join(file)).unwrap_or_default())
                .clone()
        };
        let relations = self.relations().into_iter().map(|relation: RelationInfo| RelationExport {
            name: relation.name,
            declared_in: relation.declared_in,
            anchored_in: relation.anchored_in,
            read_in: relation.read_in,
        });
        let mut out = DesignSystem { relations: relations.collect(), ..DesignSystem::default() };
        out.tokens = self
            .tokens()
            .into_iter()
            .map(|token| TokenExport {
                origin: format!("{}:{}", token.file, line_column(&source(&token.file), token.span.start).0),
                identity: token.identity,
                package: token.package,
                value: token.value,
                light: token.light,
                dark: token.dark,
                variable: token.variable,
            })
            .collect();
        let (identities, relation_names): (BTreeMap<String, String>, BTreeMap<String, String>) = {
            let state = self.state.read().expect("not poisoned");
            (
                state.tokens.values().map(|token| (token.variable.clone(), token.identity.clone())).collect(),
                crate::describe::relation_names(&state),
            )
        };
        let describer =
            definitions.then_some(Describer { project: self, identities: &identities, relations: &relation_names });
        if describer.is_some() {
            out.styles = Some(Vec::new());
        }
        for path in &files {
            // A file that cannot be read has no exports; compiling it reported why.
            if let Some(exports) = ModuleHost::new(self, Vec::new()).exports_of(path) {
                let file = self.display_name(path);
                let text = source(&file);
                let mut names: Vec<&String> = exports.values.keys().collect();
                names.sort();
                for name in names {
                    let origin = declared_at(&text, name).map_or_else(|| file.clone(), |line| format!("{file}:{line}"));
                    describe(&mut out, name, &origin, &exports.values[name], &identities, describer.as_ref());
                }
            }
        }
        out
    }
}

/// The line of `name`'s declaration in `source`, when it is declared there by name.
fn declared_at(source: &str, name: &str) -> Option<usize> {
    let declares = |line: &str| {
        let words: Vec<&str> = line.split(|c: char| !(c.is_alphanumeric() || c == '_' || c == '$')).collect();
        words.windows(2).any(|pair| matches!(pair[0], "const" | "let" | "var" | "function") && pair[1] == name)
    };
    source.lines().position(declares).map(|index| index + 1)
}

/// Adds one export to `out` when it is part of the design system.
fn describe(
    out: &mut DesignSystem,
    name: &str,
    origin: &str,
    value: &Value,
    identities: &BTreeMap<String, String>,
    describer: Option<&Describer<'_>>,
) {
    let named = |css: &str| NamedExport { name: name.to_owned(), origin: origin.to_owned(), css: css.to_owned() };
    match value {
        Value::Recipe(recipe) => out.recipes.push(RecipeExport {
            name: name.to_owned(),
            origin: origin.to_owned(),
            slots: recipe.slots.clone(),
            variants: recipe
                .variants
                .iter()
                .map(|(group, options)| (group.clone(), options.iter().map(|(option, _)| option.clone()).collect()))
                .collect(),
            defaults: recipe.defaults.iter().cloned().collect(),
            compound_variants: recipe.compounds.len(),
            parts: describer.map(|describer| {
                crate::trace::recipe_parts(recipe)
                    .into_iter()
                    .map(|(handle, part)| RecipePartExport { part, definition: describer.definition(handle) })
                    .collect()
            }),
        }),
        Value::Keyframes(definition) => out.keyframes.push(named(&definition.name)),
        Value::PositionTry(definition) => out.position_tries.push(named(&definition.name)),
        Value::CounterStyle(definition) => out.counter_styles.push(named(&definition.name)),
        Value::Object(entries) => {
            for (key, value) in entries.iter() {
                if let Key::Str(key) = key
                    && matches!(value, Value::Handle(_) | Value::Object(_))
                {
                    describe(out, &format!("{name}.{key}"), origin, value, identities, describer);
                }
            }
        }
        Value::Handle(handle) => {
            if let (Some(describer), Some(styles)) = (describer, out.styles.as_mut())
                && !handle.ops.is_empty()
            {
                styles.push(StyleExport {
                    name: name.to_owned(),
                    origin: origin.to_owned(),
                    definition: describer.definition(handle),
                });
            }
            for dep in &handle.marker_deps {
                if let Dep::Theme(theme) = dep {
                    out.themes.push(ThemeExport {
                        name: name.to_owned(),
                        origin: origin.to_owned(),
                        class: theme.class.clone(),
                        overrides: theme
                            .declarations
                            .iter()
                            .filter_map(|(variable, _)| identities.get(variable).cloned())
                            .collect(),
                    });
                }
                if let Dep::ViewTransition(transition) = dep {
                    out.view_transitions.push(named(&transition.class));
                }
            }
        }
        _ => {}
    }
}

/// Turns handles into [`Definition`]s, naming tokens and relations as code writes them.
struct Describer<'d> {
    project: &'d Project,
    identities: &'d BTreeMap<String, String>,
    relations: &'d BTreeMap<String, String>,
}

impl Describer<'_> {
    fn definition(&self, handle: &Handle) -> Definition {
        let entry = |property: &kirana_ir::Property, value: Option<String>, conditions, target| EntryExport {
            assigns: property.name.strip_prefix("--").and_then(|_| self.identities.get(&property.name).cloned()),
            property: property.name.clone(),
            value,
            conditions,
            target,
            tokens: Vec::new(),
            keyframes: Vec::new(),
            class: None,
        };
        let entries = handle
            .ops
            .iter()
            .filter_map(|op| match op {
                Op::Set(key, value) => {
                    let mut out = entry(
                        &key.property,
                        Some(kirana_ir::readable_value(&value.css)),
                        Some(conditions(&key.conditions, self.relations)),
                        target(&key.target),
                    );
                    for dep in &value.deps {
                        match dep {
                            Dep::Token(token) => out.tokens.push(token.identity.clone()),
                            Dep::Keyframes(frames) => out.keyframes.push(frames.name.clone()),
                            _ => {}
                        }
                    }
                    out.class = Some(self.project.names.class(op));
                    Some(out)
                }
                Op::Remove(key) => Some(entry(
                    &key.property,
                    None,
                    Some(conditions(&key.conditions, self.relations)),
                    target(&key.target),
                )),
                Op::RemoveProperty(on, property) => Some(entry(property, None, None, target(on))),
                // An unfold only rewrites earlier entries of this handle; it sets nothing itself.
                Op::Unfold { .. } => None,
            })
            .collect();
        let anchors = handle.markers.iter().filter_map(|marker| self.relations.get(marker).cloned()).collect();
        Definition { entries, anchors }
    }
}
