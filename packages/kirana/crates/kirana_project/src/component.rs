//! Vue, Svelte and Astro components (`design-notes/editor-components.md`), as `kirana-style check`
//! and the language server compile them. Each script block is compiled as the module the build names
//! it (`Card.vue.setup.ts`); the block the template sees is compiled with the template's `sx`
//! bindings appended as JSX (`<div sx={…} />`), so a binding is a site like any `sx` in JSX, an
//! anchor it names is applied (KF-088), and every span is mapped back into the component. An Angular
//! component's block is its `.ts` file (D-068); for an `.html` template that file is elsewhere, so
//! only the appended bindings map into the document.

use std::path::{Path, PathBuf};

use kirana_diagnostics::{Code, Diagnostic, Span};
use kirana_frontend::sfc::{Binding, Block, Framework, angular_bindings, angular_template, angular_template_url, scan};

use crate::Project;

/// One script block's module.
#[derive(Debug, Clone)]
pub struct Module {
    pub id: PathBuf,
    pub block: Block,
    /// The text the session compiled: the block, then any appended bindings.
    pub text: String,
    pub bindings: Vec<Placed>,
    /// The block's length in `text`.
    pub content: usize,
    /// The block is in another file (an Angular `.html` template's component): its own spans are
    /// not in this document.
    pub external: bool,
}

/// A template binding appended to its block's module.
#[derive(Debug, Clone)]
pub struct Placed {
    pub binding: Binding,
    /// `sx={…}` in the module text.
    pub attribute: (usize, usize),
    /// The expression in the module text.
    pub expression: (usize, usize),
}

impl Module {
    /// The component offset of a module offset. In the appended JSX, an offset in a binding's
    /// expression maps to its place in the template, one before it to the attribute's start and one
    /// after it to the attribute's end; past every binding, the block's end.
    pub fn to_component(&self, offset: usize) -> usize {
        if offset <= self.content {
            // An external block is not in this document: its offsets have no place here.
            return if self.external { 0 } else { self.block.start + offset };
        }
        let Some(placed) = self.bindings.iter().find(|placed| offset <= placed.attribute.1) else {
            return self.block.end;
        };
        if offset < placed.expression.0 {
            placed.binding.start
        } else if offset > placed.expression.1 {
            placed.binding.end
        } else {
            placed.binding.source_offset(offset - placed.expression.0)
        }
    }

    pub fn span_to_component(&self, span: Span) -> Span {
        Span::new(self.to_component(span.start as usize) as u32, self.to_component(span.end as usize) as u32)
    }

    /// Whether a module span lies in the block's own text (not in the appended bindings).
    pub fn in_block(&self, span: Span) -> bool {
        (span.end as usize) <= self.content
    }
}

impl Project {
    /// Compiles a component; returns its block modules with its own diagnostics, spans in the
    /// component.
    pub fn compile_component(&self, path: &Path, text: &str, framework: Framework) -> (Vec<Module>, Vec<Diagnostic>) {
        let component = scan(framework, text);
        let file = self.display_name(path);
        let mut modules = Vec::new();
        let mut diagnostics = Vec::new();
        for (index, block) in component.blocks.iter().enumerate() {
            let id = block.id(path);
            let content = &text[block.start..block.end];
            let bindings: &[Binding] = if component.target == Some(index) { &component.bindings } else { &[] };
            modules.push(self.compile_block(id, block.clone(), content, bindings, false, &file, &mut diagnostics));
        }
        (modules, diagnostics)
    }

    /// Compiles one block, with `bindings` appended when there are any; its diagnostics, mapped into
    /// the component, go to `diagnostics`.
    #[allow(clippy::too_many_arguments)]
    pub fn compile_block(
        &self,
        id: PathBuf,
        block: Block,
        content: &str,
        bindings: &[Binding],
        external: bool,
        file: &str,
        diagnostics: &mut Vec<Diagnostic>,
    ) -> Module {
        let mut module = Module {
            id: id.clone(),
            block,
            text: content.to_owned(),
            bindings: Vec::new(),
            content: content.len(),
            external,
        };
        let result = if bindings.is_empty() {
            self.transform(&id, content)
        } else {
            let (overlay, placed) = overlay(content, bindings);
            let result = self.transform_jsx(&id, &overlay);
            if result.diagnostics.iter().any(|diagnostic| diagnostic.code == Code::ParseError) {
                // A `<T>x` assertion does not parse as TSX: the block alone, without the template.
                self.transform(&id, content)
            } else {
                module.text = overlay;
                module.bindings = placed;
                result
            }
        };
        for mut diagnostic in result.diagnostics {
            // Diagnostics about the appended bindings are dropped: an `{#each}` item or a slot prop is
            // unresolved there by design, and the build reports nothing for the template. An external
            // block's own are its file's, not this document's.
            if external || !module.in_block(diagnostic.span) {
                continue;
            }
            diagnostic.span = module.span_to_component(diagnostic.span);
            diagnostic.file = file.to_owned();
            diagnostics.push(diagnostic);
        }
        module
    }

    /// An Angular component (D-068): a `.ts` file with `[sx]` bindings in its inline template, or an
    /// `.html` template named by a `.ts` file beside it (`read` gives that file's text), compiled with
    /// the template's bindings appended to the script; its module and diagnostics. `None` for a file
    /// that is neither.
    pub fn compile_angular(
        &self,
        path: &Path,
        text: &str,
        read: &dyn Fn(&Path) -> Option<String>,
    ) -> Option<(Module, Vec<Diagnostic>)> {
        let file = self.display_name(path);
        let mut diagnostics = Vec::new();
        let module = match path.extension().and_then(|extension| extension.to_str()) {
            Some("ts") => {
                let (start, end) = angular_template(text)?;
                let bindings = angular_bindings(&text[start..end], start);
                if bindings.is_empty() {
                    return None;
                }
                let block = Block { label: "", start: 0, end: text.len(), lang: "ts".to_owned() };
                self.compile_block(path.to_path_buf(), block, text, &bindings, false, &file, &mut diagnostics)
            }
            Some("html") => {
                let (owner, source) = template_owner(path, read)?;
                let bindings = angular_bindings(text, 0);
                let block = Block { label: "", start: usize::MAX, end: usize::MAX, lang: "ts".to_owned() };
                self.compile_block(owner, block, &source, &bindings, true, &file, &mut diagnostics)
            }
            _ => return None,
        };
        Some((module, diagnostics))
    }

    /// The project-wide diagnostics (`all`) that name one of a component's modules, in the
    /// component: a relation declared in a `<script setup>` and never read is reported where it is
    /// declared there.
    pub fn component_diagnostics(&self, modules: &[Module], file: &str, all: &[Diagnostic]) -> Vec<Diagnostic> {
        let mut out = Vec::new();
        for module in modules {
            let name = self.display_name(&module.id);
            for diagnostic in all
                .iter()
                .filter(|diagnostic| diagnostic.file == name && !module.external && module.in_block(diagnostic.span))
            {
                let mut diagnostic = diagnostic.clone();
                diagnostic.span = module.span_to_component(diagnostic.span);
                diagnostic.file = file.to_owned();
                out.push(diagnostic);
            }
        }
        out
    }
}

/// The `.ts` file beside an `.html` template whose `templateUrl` names it, and its text.
fn template_owner(template: &Path, read: &dyn Fn(&Path) -> Option<String>) -> Option<(PathBuf, String)> {
    // The template's folder (`with_file_name("")`: a path with a file name always has one).
    let directory = template.with_file_name("");
    let mut candidates: Vec<PathBuf> = std::fs::read_dir(&directory)
        .ok()?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|candidate| candidate.extension().is_some_and(|extension| extension == "ts"))
        .collect();
    candidates.sort();
    candidates.into_iter().find_map(|candidate| {
        let source = read(&candidate)?;
        let url = angular_template_url(&source)?;
        (crate::absolute(&directory.join(url)) == crate::absolute(template)).then_some((candidate, source))
    })
}

/// The block text followed by one `<div sx={…} />` per binding, and where each landed.
fn overlay(content: &str, bindings: &[Binding]) -> (String, Vec<Placed>) {
    let mut text = format!("{content}\n;");
    let mut placed = Vec::new();
    for binding in bindings {
        text.push_str("<div ");
        let attribute = text.len();
        text.push_str("sx={");
        let expression = text.len();
        text.push_str(&binding.expression);
        let expression_end = text.len();
        text.push('}');
        placed.push(Placed {
            binding: binding.clone(),
            attribute: (attribute, text.len()),
            expression: (expression, expression_end),
        });
        text.push_str(" />;\n");
    }
    (text, placed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_offsets_map_into_the_component() {
        let binding = Binding {
            start: 40,
            end: 52,
            expression_start: 45,
            expression_end: 51,
            expression: "[a, b]".to_owned(),
            shifts: Vec::new(),
        };
        let placed = Placed { binding, attribute: (13, 23), expression: (17, 22) };
        let module = Module {
            id: PathBuf::from("/a/C.vue.setup.ts"),
            block: Block { label: "setup", start: 10, end: 20, lang: "ts".to_owned() },
            text: String::new(),
            bindings: vec![placed],
            content: 10,
            external: false,
        };
        // In the block: shifted by its start.
        assert_eq!(module.to_component(4), 14);
        // In the appended JSX: the attribute's ends, the expression's characters, and past it all.
        assert_eq!(module.to_component(13), 40);
        assert_eq!(module.to_component(15), 40);
        assert_eq!(module.to_component(19), 47);
        assert_eq!(module.to_component(23), 52);
        assert_eq!(module.to_component(30), 20);
        assert_eq!(module.span_to_component(Span::new(17, 22)), Span::new(45, 50));
        // An Angular `.html` template's block is its component's script, which is not in the document.
        let external = Module { external: true, ..module };
        assert_eq!(external.to_component(4), 0);
    }
}
