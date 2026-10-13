//! Precedence tracing (KRN-CAS-008): which value wins for one property at one site, and why.

use std::cmp::Ordering;
use std::path::Path;

use kirana_ir::{Atom, ConditionClass, ladder_order};

use crate::Project;

/// One entry of a trace, strongest first.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TraceLine {
    pub value: String,
    pub conditions: String,
    pub layer: &'static str,
    pub class: String,
    /// Why this entry beats the next one; empty for the last entry.
    pub reason: String,
}

fn reason(stronger: &Atom, weaker: &Atom) -> String {
    let (a, b) = (&stronger.key.conditions, &weaker.key.conditions);
    if a.len() != b.len() {
        return format!("step 2 ({} condition{} > {})", a.len(), if a.len() == 1 { "" } else { "s" }, b.len());
    }
    let classes = |set: &kirana_ir::ConditionSet| {
        let mut classes: Vec<ConditionClass> = set.conditions().iter().map(kirana_ir::Condition::class).collect();
        classes.sort_by(|x, y| y.cmp(x));
        classes
    };
    if classes(a) != classes(b) {
        return "step 3 (stronger condition class)".to_owned();
    }
    if kirana_ir::compare_sets(a, b) != Ordering::Equal {
        return "step 4 (stronger within its class)".to_owned();
    }
    // Entries of one property share its rank, so only the longhand count can differ at step 5.
    if stronger.value.longhands != weaker.value.longhands {
        return format!(
            "step 5 (set {} longhand{} < {})",
            stronger.value.longhands,
            if stronger.value.longhands == 1 { "" } else { "s" },
            weaker.value.longhands
        );
    }
    "step 6 (deterministic tie-break; see ambiguous-precedence)".to_owned()
}

impl Project {
    /// Traces `property` (kebab-case) for the sites of `path` that cover `line` (1-based).
    pub fn trace(&self, path: &Path, source: &str, line: usize, property: &str) -> Vec<TraceLine> {
        let state = self.state.read().expect("not poisoned");
        let Some(record) = state.modules.get(path) else { return Vec::new() };
        let mut atoms: Vec<Atom> = Vec::new();
        for (span, handle) in &record.handles {
            let (start, _) = kirana_diagnostics::line_column(source, span.0);
            let (end, _) = kirana_diagnostics::line_column(source, span.1);
            if line < start || line > end {
                continue;
            }
            for atom in Atom::from_handle(&self.names, handle) {
                // A shorthand atom takes part for each of its longhands (D-045).
                let covers = atom.key.property.name == property
                    || atom.key.property.rank == kirana_css_data::PropertyRank::Shorthand
                        && kirana_cascade::longhands_of(&atom.key.property.name)
                            .is_ok_and(|longhands| longhands.iter().any(|longhand| longhand.name == property));
                if covers && !atoms.iter().any(|existing| existing.class == atom.class) {
                    atoms.push(atom);
                }
            }
        }
        atoms.sort_by(|a, b| {
            b.key.target.is_contextual().cmp(&a.key.target.is_contextual()).reverse().then_with(|| ladder_order(b, a))
        });
        (0..atoms.len())
            .map(|index| TraceLine {
                value: kirana_ir::readable_value(&atoms[index].value.css),
                conditions: if atoms[index].key.conditions.is_empty() {
                    "base".to_owned()
                } else {
                    atoms[index].key.conditions.canonical()
                },
                layer: if atoms[index].key.target.is_contextual() { "kirana.contextual" } else { "kirana.atoms" },
                class: atoms[index].class.clone(),
                reason: atoms.get(index + 1).map_or_else(String::new, |next| {
                    if atoms[index].key.target.is_contextual() == next.key.target.is_contextual() {
                        reason(&atoms[index], next)
                    } else {
                        "step 1 (own style beats contextual)".to_owned()
                    }
                }),
            })
            .collect()
    }
}
