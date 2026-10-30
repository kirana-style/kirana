//! Precedence tracing (KRN-CAS-008): which value wins for one property at one site, and why.

use std::cmp::Ordering;
use std::collections::BTreeMap;
use std::path::Path;

use kirana_diagnostics::LineIndex;
use kirana_ir::{Atom, ConditionClass, Handle, Recipe, ladder_order};
use serde::Serialize;

use crate::Project;
use crate::describe::{ConditionInfo, conditions, target};

/// One entry of a trace, strongest first.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TraceLine {
    pub value: String,
    pub conditions: Vec<ConditionInfo>,
    pub layer: &'static str,
    /// What the entry styles other than the element: a pseudo-element or a `select` target.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    pub class: String,
    /// The part of a `recipe()` the entry belongs to.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub part: Option<RecipePart>,
    /// The ladder step that ranks this entry above the next one, or 0 where a recipe's merge
    /// decides (a later part of one slot replaces an entry of the same key); `None` for the last.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step: Option<u8>,
    /// Why this entry beats the next one; empty for the last entry.
    pub reason: String,
    /// The conditions as one line (`base` without any), as the human format prints them.
    #[serde(skip)]
    pub condition_text: String,
}

/// Where in a recipe an entry is declared.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RecipePart {
    /// The slot, for a recipe with slots.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slot: Option<String>,
    /// The options that apply it: none for the base, one for a variant option, every option of a
    /// compound variant.
    pub options: BTreeMap<String, String>,
    pub compound: bool,
}

impl TraceLine {
    /// The conditions as one line, and the recipe part after them: `:hover [size: sm]`.
    pub fn context(&self) -> String {
        match &self.part {
            Some(part) => format!("{} [{}]", self.condition_text, part.label()),
            None => self.condition_text.clone(),
        }
    }
}

impl RecipePart {
    /// `base`, `size: sm`, `size: sm + tone: danger (compound)`, with the slot first.
    pub fn label(&self) -> String {
        let options = if self.options.is_empty() {
            "base".to_owned()
        } else {
            self.options.iter().map(|(group, option)| format!("{group}: {option}")).collect::<Vec<_>>().join(" + ")
        };
        let options = if self.compound { format!("{options} (compound)") } else { options };
        match &self.slot {
            Some(slot) => format!("{slot} · {options}"),
            None => options,
        }
    }
}

fn reason(stronger: &Atom, weaker: &Atom) -> (u8, String) {
    let (a, b) = (&stronger.key.conditions, &weaker.key.conditions);
    if a.len() != b.len() {
        return (2, format!("step 2 ({} condition{} > {})", a.len(), if a.len() == 1 { "" } else { "s" }, b.len()));
    }
    let classes = |set: &kirana_ir::ConditionSet| {
        let mut classes: Vec<ConditionClass> = set.conditions().iter().map(kirana_ir::Condition::class).collect();
        classes.sort_by(|x, y| y.cmp(x));
        classes
    };
    if classes(a) != classes(b) {
        return (3, "step 3 (stronger condition class)".to_owned());
    }
    if kirana_ir::compare_sets(a, b) != Ordering::Equal {
        return (4, "step 4 (stronger within its class)".to_owned());
    }
    // Entries of one property share its rank, so only the longhand count can differ at step 5.
    if stronger.value.longhands != weaker.value.longhands {
        return (
            5,
            format!(
                "step 5 (set {} longhand{} < {})",
                stronger.value.longhands,
                if stronger.value.longhands == 1 { "" } else { "s" },
                weaker.value.longhands
            ),
        );
    }
    (6, "step 6 (deterministic tie-break; see ambiguous-precedence)".to_owned())
}

/// Whether two entries are parts of one recipe slot with the same key, so that the recipe's merge
/// keeps only the later one rather than the cascade choosing.
fn merged(a: &(Atom, Option<RecipePart>, usize), b: &(Atom, Option<RecipePart>, usize)) -> bool {
    match (&a.1, &b.1) {
        (Some(first), Some(second)) => first.slot == second.slot && a.0.key == b.0.key,
        _ => false,
    }
}

/// Every handle of `recipe` with the part it belongs to, slot by slot.
pub(crate) fn recipe_parts(recipe: &Recipe) -> Vec<(&Handle, RecipePart)> {
    let slot = |index: usize| recipe.slots.as_ref().map(|slots| slots[index].clone());
    let part = |index: usize, options: &[(String, String)], compound: bool| RecipePart {
        slot: slot(index),
        options: options.iter().cloned().collect(),
        compound,
    };
    let mut parts = Vec::new();
    for (index, handle) in recipe.base.iter().enumerate() {
        parts.push((handle, part(index, &[], false)));
    }
    for (group, options) in &recipe.variants {
        for (option, handles) in options {
            for (index, handle) in handles.iter().enumerate() {
                parts.push((handle, part(index, &[(group.clone(), option.clone())], false)));
            }
        }
    }
    for (selections, handles) in &recipe.compounds {
        for (index, handle) in handles.iter().enumerate() {
            parts.push((handle, part(index, selections, true)));
        }
    }
    parts
}

impl Project {
    /// Traces `property` (kebab-case) for the sites of `path` that cover `line` (1-based).
    pub fn trace(&self, path: &Path, source: &str, line: usize, property: &str) -> Vec<TraceLine> {
        self.trace_lines(path, &LineIndex::new(source), line, property)
    }

    fn trace_lines(&self, path: &Path, lines: &LineIndex, line: usize, property: &str) -> Vec<TraceLine> {
        let state = self.state.read().expect("not poisoned");
        let Some(record) = state.modules.get(path) else { return Vec::new() };
        let covers_line = |span: &(u32, u32)| lines.line(span.0) <= line && line <= lines.line(span.1);
        // A recipe's handles are read part by part, so each entry says which part it comes from.
        let mut handles: Vec<(&Handle, Option<RecipePart>)> = Vec::new();
        for (_, recipe) in record.recipes.iter().filter(|(span, _)| covers_line(span)) {
            handles.extend(recipe_parts(recipe).into_iter().map(|(handle, part)| (handle, Some(part))));
        }
        for (span, handle) in &record.handles {
            if covers_line(span) && !record.recipes.iter().any(|(recipe_span, _)| recipe_span == span) {
                handles.push((handle, None));
            }
        }
        // Each part's place in the recipe's merge order, base first.
        let mut atoms: Vec<(Atom, Option<RecipePart>, usize)> = Vec::new();
        for (order, (handle, part)) in handles.into_iter().enumerate() {
            for atom in Atom::from_handle(&self.names, handle) {
                // A shorthand atom takes part for each of its longhands (D-045).
                let covers = atom.key.property.name == property
                    || atom.key.property.rank == kirana_css_data::PropertyRank::Shorthand
                        && kirana_cascade::longhands_of(&atom.key.property.name)
                            .is_ok_and(|longhands| longhands.iter().any(|longhand| longhand.name == property));
                // One class appears once, unless two parts of a recipe both declare it.
                if covers && !atoms.iter().any(|(existing, other, _)| existing.class == atom.class && *other == part) {
                    atoms.push((atom, part.clone(), order));
                }
            }
        }
        let relations = crate::describe::relation_names(&state);
        atoms.sort_by(|a, b| {
            let merged = merged(a, b);
            b.0.key
                .target
                .is_contextual()
                .cmp(&a.0.key.target.is_contextual())
                .reverse()
                .then_with(|| if merged { b.2.cmp(&a.2) } else { ladder_order(&b.0, &a.0) })
        });
        (0..atoms.len())
            .map(|index| {
                let (atom, part, _) = &atoms[index];
                let (step, reason) = atoms.get(index + 1).map_or((None, String::new()), |next| {
                    if merged(&atoms[index], next) {
                        let label =
                            |part: &Option<RecipePart>| part.as_ref().map(RecipePart::label).unwrap_or_default();
                        (Some(0), format!("merge ({} replaces {})", label(part), label(&next.1)))
                    } else if atom.key.target.is_contextual() == next.0.key.target.is_contextual() {
                        let next = &next.0;
                        let (step, reason) = reason(atom, next);
                        (Some(step), reason)
                    } else {
                        (Some(1), "step 1 (own style beats contextual)".to_owned())
                    }
                });
                TraceLine {
                    value: kirana_ir::readable_value(&atom.value.css),
                    conditions: conditions(&atom.key.conditions, &relations),
                    layer: if atom.key.target.is_contextual() { "kirana.contextual" } else { "kirana.atoms" },
                    target: target(&atom.key.target),
                    class: atom.class.clone(),
                    part: part.clone(),
                    step,
                    reason,
                    condition_text: if atom.key.conditions.is_empty() {
                        "base".to_owned()
                    } else {
                        atom.key.conditions.canonical()
                    },
                }
            })
            .collect()
    }
}

/// One question for [`Project::trace_all`]: which value wins for `property` at `file:line`.
#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize)]
pub struct TraceQuery {
    pub file: String,
    /// 1-based.
    pub line: usize,
    /// As CSS writes it or as a style object does (`justifyContent`).
    pub property: String,
}

/// The answer to one [`TraceQuery`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TraceAnswer {
    pub file: String,
    pub line: usize,
    pub property: String,
    /// Strongest first; empty when nothing on the line sets the property.
    pub entries: Vec<TraceLine>,
    /// Why the file could not be traced.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl Project {
    /// Answers every query, compiling each file once however many queries name it (KF-022): a tool
    /// that checks thousands of entries asks once.
    pub fn trace_all(&self, queries: &[TraceQuery]) -> Vec<TraceAnswer> {
        let mut sources: BTreeMap<std::path::PathBuf, Option<LineIndex>> = BTreeMap::new();
        queries
            .iter()
            .map(|query| {
                let path = crate::absolute(Path::new(&query.file));
                let source = sources
                    .entry(path.clone())
                    .or_insert_with(|| {
                        let source = self.fs.read_to_string(&path).ok()?;
                        self.transform(&path, &source);
                        Some(LineIndex::new(&source))
                    })
                    .as_ref();
                let property = kirana_shared::kebab_case(&query.property);
                TraceAnswer {
                    file: query.file.clone(),
                    line: query.line,
                    property: query.property.clone(),
                    entries: source
                        .map_or_else(Vec::new, |lines| self.trace_lines(&path, lines, query.line, &property)),
                    error: source.is_none().then(|| format!("cannot read {}", query.file)),
                }
            })
            .collect()
    }
}
