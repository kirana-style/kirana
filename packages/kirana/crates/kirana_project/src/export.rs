//! `kirana-style export` (KRN-DX-011): the project's design system as data — tokens, themes, recipes,
//! relations and named definitions, each with the file that declares it — for agents, design tools
//! and review. It holds names, values and project-relative origins, never source text, and is
//! sorted so that the file diffs cleanly.

use std::collections::BTreeMap;
use std::path::PathBuf;

use kirana_diagnostics::line_column;
use kirana_ir::{Dep, Value};
use serde::Serialize;

use crate::Project;
use crate::inspect::RelationInfo;
use crate::resolve::ModuleHost;

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
}

/// One token: what code writes (`identity`), its value, and where it is declared.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TokenExport {
    pub identity: String,
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
}

/// An exported keyframes, `positionTry()` or `viewTransition()`: the export and what CSS names it.
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
                value: token.value,
                light: token.light,
                dark: token.dark,
                variable: token.variable,
            })
            .collect();
        let identities: BTreeMap<String, String> = {
            let state = self.state.read().expect("not poisoned");
            state.tokens.values().map(|token| (token.variable.clone(), token.identity.clone())).collect()
        };
        for path in &files {
            // A file that cannot be read has no exports; compiling it reported why.
            if let Some(exports) = ModuleHost::new(self, Vec::new()).exports_of(path) {
                let file = self.display_name(path);
                let text = source(&file);
                let mut names: Vec<&String> = exports.values.keys().collect();
                names.sort();
                for name in names {
                    let origin = declared_at(&text, name).map_or_else(|| file.clone(), |line| format!("{file}:{line}"));
                    describe(&mut out, name, &origin, &exports.values[name], &identities);
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
fn describe(out: &mut DesignSystem, name: &str, origin: &str, value: &Value, identities: &BTreeMap<String, String>) {
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
        }),
        Value::Keyframes(definition) => out.keyframes.push(named(&definition.name)),
        Value::PositionTry(definition) => out.position_tries.push(named(&definition.name)),
        Value::Handle(handle) => {
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
