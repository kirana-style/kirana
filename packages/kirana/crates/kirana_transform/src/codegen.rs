//! Runtime code for compiled values.

use std::sync::Arc;

use kirana_ir::{Dep, Dynamic, Handle, Recipe, StylePart, Value};

use crate::Piece;

/// Accumulates generated code and the handles it materializes.
#[derive(Default)]
pub(crate) struct Code {
    pub pieces: Vec<Piece>,
    pub handles: Vec<Arc<Handle>>,
    pub marker_deps: Vec<Dep>,
    pub runtime: bool,
}

impl Code {
    pub fn text(&mut self, text: impl AsRef<str>) {
        match self.pieces.last_mut() {
            Some(Piece::Text(last)) => last.push_str(text.as_ref()),
            _ => self.pieces.push(Piece::Text(text.as_ref().to_owned())),
        }
    }

    pub fn source(&mut self, span: (u32, u32)) {
        self.pieces.push(Piece::Source(span.0, span.1));
    }

    fn string(&mut self, text: &str) {
        self.text(serde_json::to_string(text).expect("strings serialize"));
    }

    /// A class string literal for a handle, recording the handle.
    pub fn handle(&mut self, names: &kirana_ir::Names, handle: &Handle) {
        self.string(&names.class_string(handle));
        self.record(handle);
    }

    /// A class literal for a host element (no tombstones), recording the handle.
    pub fn dom_handle(&mut self, names: &kirana_ir::Names, handle: &Handle) {
        self.string(&names.dom_class_string(handle));
        self.record(handle);
    }

    pub fn record(&mut self, handle: &Handle) {
        if !handle.is_empty() {
            for dep in &handle.marker_deps {
                if !self.marker_deps.contains(dep) {
                    self.marker_deps.push(dep.clone());
                }
            }
            self.handles.push(Arc::new(handle.clone()));
        }
    }

    /// Style parts as a list of runtime arguments.
    pub fn parts(&mut self, names: &kirana_ir::Names, parts: &[StylePart]) {
        for (index, part) in parts.iter().enumerate() {
            if index > 0 {
                self.text(", ");
            }
            match part {
                StylePart::Static(handle) => self.handle(names, handle),
                StylePart::Conditional { test, consequent, alternate } => {
                    self.text("(");
                    self.source(*test);
                    self.text(") ? ");
                    self.handle(names, consequent);
                    self.text(" : ");
                    self.handle(names, alternate);
                }
                StylePart::Runtime(span) => {
                    self.text("(");
                    self.source(*span);
                    self.text(")");
                }
                StylePart::Spread(span) => {
                    self.text("...(");
                    self.source(*span);
                    self.text(")");
                }
                StylePart::Bridge { handle, variable, value } => {
                    self.runtime = true;
                    self.text("__k.b(");
                    self.handle(names, handle);
                    self.text(", ");
                    self.string(variable);
                    self.text(", (");
                    self.source(*value);
                    self.text("))");
                }
            }
        }
    }

    /// Code for a value a Kirana call produced. Returns `false` when the call should stay as is.
    pub fn value(&mut self, names: &kirana_ir::Names, value: &Value) -> bool {
        match value {
            Value::Handle(handle) => self.handle(names, handle),
            Value::Dynamic(dynamic) => {
                // An open or conditional result is a runtime call that stays as written.
                let Dynamic::Style(parts) = &**dynamic else { return false };
                self.runtime = true;
                self.text("__k.cx(");
                self.parts(names, parts);
                self.text(")");
            }
            Value::Recipe(recipe) => self.recipe(names, recipe),
            Value::Object(entries) => {
                self.text("{");
                for (index, (key, value)) in entries.iter().enumerate() {
                    if index > 0 {
                        self.text(", ");
                    }
                    self.string(key.as_str().expect("only static keys reach runtime objects"));
                    self.text(": ");
                    // Runtime objects hold tokens and handles only, which always render.
                    let rendered = self.value(names, value);
                    debug_assert!(rendered);
                }
                self.text("}");
            }
            Value::Token(token) => self.string(&token.css),
            Value::Keyframes(frames) => self.string(&frames.name),
            Value::PositionTry(fallback) => self.string(&fallback.name),
            // Outside a style, a run is its preferred value: what a browser that knows it keeps.
            Value::Fallbacks(members) => {
                self.string(&kirana_evaluator::ops::to_string(&members[0]).expect("members are css-bearing"));
            }
            Value::Conditions(conditions) => {
                let text = conditions.iter().map(kirana_ir::Condition::canonical).collect::<Vec<_>>().join(" & ");
                self.string(&text);
            }
            Value::Select(target) => self.string(&format!("{target:?}")),
            Value::Relation(relation) => {
                self.text("{\"name\": ");
                self.string(&relation.name);
                self.text(", \"anchor\": ");
                self.string(&relation.marker);
                self.text("}");
            }
            // An unknown result has already been reported; the other values never result from a
            // Kirana call.
            _ => self.text("undefined"),
        }
        true
    }

    fn slot_list(&mut self, names: &kirana_ir::Names, handles: &[Handle]) {
        self.text("[");
        for (index, handle) in handles.iter().enumerate() {
            if index > 0 {
                self.text(", ");
            }
            self.handle(names, handle);
        }
        self.text("]");
    }

    fn selections(&mut self, selections: &[(String, String)]) {
        self.text("{");
        for (index, (group, option)) in selections.iter().enumerate() {
            if index > 0 {
                self.text(", ");
            }
            self.string(group);
            self.text(": ");
            self.string(option);
        }
        self.text("}");
    }

    /// `__k.recipe({ s, b, v, c, d })`: slots, base, variants, compounds, defaults.
    fn recipe(&mut self, names: &kirana_ir::Names, recipe: &Recipe) {
        self.runtime = true;
        self.text("__k.recipe({\"s\": ");
        match &recipe.slots {
            Some(slots) => {
                self.text("[");
                for (index, slot) in slots.iter().enumerate() {
                    if index > 0 {
                        self.text(", ");
                    }
                    self.string(slot);
                }
                self.text("]");
            }
            None => self.text("null"),
        }
        self.text(", \"b\": ");
        self.slot_list(names, &recipe.base);
        self.text(", \"v\": {");
        for (group_index, (group, options)) in recipe.variants.iter().enumerate() {
            if group_index > 0 {
                self.text(", ");
            }
            self.string(group);
            self.text(": {");
            for (option_index, (option, handles)) in options.iter().enumerate() {
                if option_index > 0 {
                    self.text(", ");
                }
                self.string(option);
                self.text(": ");
                self.slot_list(names, handles);
            }
            self.text("}");
        }
        self.text("}, \"c\": [");
        for (index, (selections, handles)) in recipe.compounds.iter().enumerate() {
            if index > 0 {
                self.text(", ");
            }
            self.text("[");
            self.selections(selections);
            self.text(", ");
            self.slot_list(names, handles);
            self.text("]");
        }
        self.text("], \"d\": ");
        self.selections(&recipe.defaults);
        self.text("})");
    }
}
