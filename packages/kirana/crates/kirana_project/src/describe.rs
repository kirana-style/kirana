//! Entries as data, for `kirana-style trace --format json` and `kirana-style export`'s definitions:
//! each condition with its kind, a relation by its name, the target by what selects it.

use std::collections::BTreeMap;

use kirana_ir::{Condition, ConditionSet, RelationKind, Target};
use serde::Serialize;

/// One condition of an entry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ConditionInfo {
    /// `pseudo`, `attribute`, `media`, `container`, `supports` or `relation`.
    pub kind: &'static str,
    /// The condition as written in CSS: `:hover`, `[data-state="open"]`, `(min-width: 40rem)`,
    /// `card (width > 30rem)`; for a relation, the anchor's own state (`:hover`, or empty).
    pub text: String,
    /// The relation read, by its name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relation: Option<String>,
    /// Where the reader sits: `within`, `after` or `before` the anchor.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placement: Option<&'static str>,
}

/// Each condition of `set`; `relations` names a relation by its marker class.
pub(crate) fn conditions(set: &ConditionSet, relations: &BTreeMap<String, String>) -> Vec<ConditionInfo> {
    set.conditions()
        .iter()
        .map(|condition| {
            let plain =
                |kind, text: &str| ConditionInfo { kind, text: text.to_owned(), relation: None, placement: None };
            match condition {
                Condition::Pseudo(text) => plain("pseudo", text),
                Condition::Attribute(text) => plain("attribute", text),
                Condition::Media(query) => plain("media", query),
                Condition::Container { name, query } => {
                    plain("container", &name.as_ref().map_or_else(|| query.clone(), |name| format!("{name} {query}")))
                }
                Condition::Supports(query) => plain("supports", query),
                Condition::Relation { marker, kind, state } => ConditionInfo {
                    kind: "relation",
                    text: state.clone(),
                    // A marker the session no longer declares reads as itself.
                    relation: Some(relations.get(marker).unwrap_or(marker).clone()),
                    placement: Some(match kind {
                        RelationKind::Within => "within",
                        RelationKind::Parent => "parent",
                        RelationKind::After => "after",
                        RelationKind::Before => "before",
                    }),
                },
            }
        })
        .collect()
}

/// Each relation the session knows, by its marker class.
pub(crate) fn relation_names(state: &crate::State) -> BTreeMap<String, String> {
    state.relations.iter().map(|(marker, (name, _))| (marker.clone(), name.clone())).collect()
}

/// What an entry styles other than the element itself: `::after`, `> svg` for a child,
/// `svg` for a descendant, with a pseudo-element after it.
pub(crate) fn target(target: &Target) -> Option<String> {
    match target {
        Target::Element => None,
        Target::PseudoElement(name) => Some(name.clone()),
        Target::Contextual { child, selector, pseudo_element } => {
            Some(format!("{}{selector}{}", if *child { "> " } else { "" }, pseudo_element.as_deref().unwrap_or("")))
        }
    }
}
