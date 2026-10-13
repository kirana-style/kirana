//! The class map for server templates (D-069, `design-notes/class-maps.md`). A Blade, ERB, HEEx,
//! Twig or Edge template cannot call `css()`, so a server app keeps its styles in modules and the
//! class map lists every handle they export, by name, as the class string a compiled module would
//! hold. The template helpers merge those strings with the runtime's rules, whose two numbers the
//! map carries (`families`).

use std::collections::BTreeMap;
use std::path::PathBuf;

use kirana_css_data::generated::{FAMILY_2_END, FAMILY_4_END};
use kirana_diagnostics::{Code, Diagnostic, Span};
use kirana_ir::{Key, Names, Value};
use serde::Serialize;

use crate::files::{SCRIPT_EXTENSIONS, collect_sources};
use crate::{Project, resolve};

/// A class map, ready to write.
#[derive(Debug, Clone, PartialEq)]
pub struct ClassMap {
    /// Where to write it: `classes.out`, resolved against the root.
    pub out: PathBuf,
    /// The file's text.
    pub json: String,
    /// The modules' own diagnostics, and one `classes-not-static` per export with no class string.
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Serialize)]
struct Families {
    four: usize,
    two: usize,
}

#[derive(Serialize)]
struct File<'a> {
    version: u32,
    prefix: &'a str,
    families: Families,
    classes: BTreeMap<String, String>,
}

impl Project {
    /// The class map of the configured `classes.modules`, or `None` without a `classes` entry. Each
    /// module is transformed first, so its atoms are in the stylesheet whatever paths a build was
    /// given.
    pub fn class_map(&self) -> Option<ClassMap> {
        let config = self.config.classes.as_ref()?;
        let files = self.class_modules();
        let mut classes = BTreeMap::new();
        let mut diagnostics = Vec::new();
        for path in files {
            // A collected file that was deleted since reads as empty, and lists nothing.
            let source = self.fs.read_to_string(&path).unwrap_or_default();
            diagnostics.extend(self.transform(&path, &source).diagnostics);
            let file = self.display_name(&path);
            for (name, value) in resolve::ModuleHost::new(self, Vec::new()).exported(&path) {
                flatten(&self.names, &name, &value, &file, &mut classes, &mut diagnostics);
            }
        }
        let map = File {
            version: 1,
            prefix: &self.names.prefix,
            families: Families { four: FAMILY_4_END, two: FAMILY_2_END },
            classes,
        };
        let json = serde_json::to_string_pretty(&map).expect("strings and numbers serialize") + "\n";
        Some(ClassMap { out: self.root.join(&config.out), json, diagnostics })
    }

    /// Every name the class map lists, with the module that exports its first segment — what a
    /// template's `kirana('card.active')` refers to, for the language server. Nothing is
    /// transformed, and nothing is reported.
    pub fn class_names(&self) -> Vec<(String, PathBuf)> {
        let mut names = Vec::new();
        for path in self.class_modules() {
            for (name, value) in resolve::ModuleHost::new(self, Vec::new()).exported(&path) {
                let mut classes = BTreeMap::new();
                flatten(&self.names, &name, &value, "", &mut classes, &mut Vec::new());
                names.extend(classes.into_keys().map(|name| (name, path.clone())));
            }
        }
        names
    }

    /// The files under `classes.modules`, sorted; none without a `classes` entry.
    fn class_modules(&self) -> Vec<PathBuf> {
        let mut files = Vec::new();
        for module in self.config.classes.iter().flat_map(|classes| &classes.modules) {
            collect_sources(&self.root.join(module), &mut files, SCRIPT_EXTENSIONS);
        }
        files.sort();
        files.dedup();
        files
    }
}

/// Adds `value` under `name`: a handle as its class string, an object's entries under dotted names.
/// Tokens, keyframes, relations, functions and plain values are not classes and are left out; a
/// value with no static class string is reported.
fn flatten(
    names: &Names,
    name: &str,
    value: &Value,
    file: &str,
    classes: &mut BTreeMap<String, String>,
    diagnostics: &mut Vec<Diagnostic>,
) {
    match value {
        Value::Handle(handle) => {
            classes.insert(name.to_owned(), names.class_string(handle));
        }
        Value::Object(entries) => {
            for (key, inner) in entries.iter() {
                if let Key::Str(key) = key {
                    flatten(names, &format!("{name}.{key}"), inner, file, classes, diagnostics);
                }
            }
        }
        Value::Recipe(_) | Value::Dynamic(_) | Value::Unknown(_) | Value::Array(_) => {
            diagnostics.push(
                Diagnostic::new(
                    Code::ClassesNotStatic,
                    file,
                    Span::default(),
                    format!("`{name}` has no class string a template can use"),
                )
                .with_help(
                    "a class map lists handles, and objects of handles, whose styles are known at build time; \
                     keep recipes and runtime values in scripts",
                ),
            );
        }
        _ => {}
    }
}
