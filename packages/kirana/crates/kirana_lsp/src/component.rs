//! Components in the editor (`design-notes/editor-components.md`): a component compiles as
//! `kirana_project::component` compiles it for `kirana-style check`, its script blocks as the modules
//! the build names them with the template's `sx` bindings appended as JSX; here are what only the
//! editor needs of it (sites, positions), Angular components (D-068) and server templates (D-069).

use std::path::{Path, PathBuf};

use kirana_diagnostics::{Code, Diagnostic, Span};
use kirana_frontend::sfc::{Binding, Block, Framework};
use kirana_frontend::templates::{is_template, style_names};
pub(crate) use kirana_project::component::Module;
use kirana_project::{Project, Site};

/// A component as the session compiled it.
#[derive(Debug, Clone)]
pub(crate) struct Compiled {
    pub modules: Vec<Module>,
}

/// Compiles a component; returns it with its own diagnostics, spans in the component.
pub(crate) fn compile(project: &Project, path: &Path, text: &str, framework: Framework) -> (Compiled, Vec<Diagnostic>) {
    let (modules, diagnostics) = project.compile_component(path, text, framework);
    (Compiled { modules }, diagnostics)
}

/// An Angular component (D-068), as `Project::compile_angular` compiles it. `None` for a file that is
/// neither an Angular component with `[sx]` in its inline template nor a template one names.
pub(crate) fn angular(
    project: &Project,
    path: &Path,
    text: &str,
    read: &dyn Fn(&Path) -> Option<String>,
) -> Option<(Compiled, Vec<Diagnostic>)> {
    let (module, diagnostics) = project.compile_angular(path, text, read)?;
    Some((Compiled { modules: vec![module] }, diagnostics))
}

/// A server template (D-069): a Blade, Twig, ERB, HEEx or Edge file whose `kirana(…)` calls name
/// styles from the class map. Its module imports each name's export from the class-map module that
/// has it, and holds one `sx` binding per name, placed on the name's literal, so hover, colours and
/// definitions work as they do in components. A name no module exports is `unknown-class-name`.
/// `None` for a file that is not a template, or names nothing.
pub(crate) fn template(project: &Project, path: &Path, text: &str) -> Option<(Compiled, Vec<Diagnostic>)> {
    if !is_template(path) {
        return None;
    }
    let found = style_names(text);
    if found.is_empty() {
        return None;
    }
    let known = project.class_names();
    let file = project.display_name(path);
    let mut diagnostics = Vec::new();
    let mut imports: Vec<(PathBuf, String)> = Vec::new();
    let mut bindings = Vec::new();
    for name in &found {
        let Some((_, module)) = known.iter().find(|(known, _)| *known == name.name) else {
            diagnostics.push(
                Diagnostic::new(
                    Code::UnknownClassName,
                    &file,
                    Span::new(name.start as u32, name.end as u32),
                    format!("`{}` is not a style the class map lists", name.name),
                )
                .with_help("export it from a module in `classes.modules`, or check its spelling"),
            );
            continue;
        };
        let mut segments = name.name.split('.');
        let head = segments.next().unwrap_or_default().to_owned();
        let index = imports.iter().position(|entry| entry.0 == *module && entry.1 == head).unwrap_or_else(|| {
            imports.push((module.clone(), head));
            imports.len() - 1
        });
        let expression = segments.fold(format!("__kirana{index}"), |expression, key| format!("{expression}[{key:?}]"));
        bindings.push(Binding {
            start: name.start,
            end: name.end,
            expression_start: name.start + 1,
            expression_end: name.end - usize::from(text[name.start..].starts_with(['"', '\''])),
            expression,
            shifts: Vec::new(),
        });
    }
    let content: String = imports
        .iter()
        .enumerate()
        .map(|(index, (module, head))| {
            format!("import {{ {head} as __kirana{index} }} from {:?};\n", module.to_string_lossy())
        })
        .collect();
    let block = Block { label: "", start: usize::MAX, end: usize::MAX, lang: "ts".to_owned() };
    let id = PathBuf::from(format!("{}.kirana.ts", path.display()));
    let module = project.compile_block(id, block, &content, &bindings, true, &file, &mut diagnostics);
    Some((Compiled { modules: vec![module] }, diagnostics))
}

impl Compiled {
    /// The session's sites for the component, spans in the component, in source order.
    pub fn sites(&self, project: &Project) -> Vec<Site> {
        let mut out: Vec<Site> = self
            .modules
            .iter()
            .flat_map(|module| {
                project
                    .sites(&module.id)
                    .into_iter()
                    // An external block's own sites are in its file, not this document.
                    .filter(|site| !(module.external && module.in_block(site.span)))
                    .map(|site| Site { span: module.span_to_component(site.span), atoms: site.atoms })
            })
            .collect();
        out.sort_by_key(|site| (site.span.start, site.span.end));
        out
    }

    /// The project-wide diagnostics that name one of the component's modules, mapped into it.
    pub fn project_diagnostics(&self, project: &Project, file: &str, all: &[Diagnostic]) -> Vec<Diagnostic> {
        project.component_diagnostics(&self.modules, file, all)
    }

    /// A span of one of the component's modules, in the component; the component's start for a
    /// module it does not have.
    pub fn map(&self, module: &Path, span: Span) -> (usize, usize) {
        self.modules.iter().find(|candidate| candidate.id == module).map_or((0, 0), |module| {
            let span = module.span_to_component(span);
            (span.start as usize, span.end as usize)
        })
    }

    /// The module whose block holds a component offset, with the offset in its text.
    pub fn module_at(&self, offset: usize) -> Option<(&Module, usize)> {
        self.modules
            .iter()
            .find(|module| module.block.start <= offset && offset <= module.block.end)
            .map(|module| (module, offset - module.block.start))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_module_span_maps_into_its_component() {
        let module = Module {
            id: PathBuf::from("/a/C.vue.setup.ts"),
            block: Block { label: "setup", start: 10, end: 20, lang: "ts".to_owned() },
            text: String::new(),
            bindings: Vec::new(),
            content: 10,
            external: false,
        };
        let compiled = Compiled { modules: vec![module] };
        assert_eq!(compiled.map(Path::new("/a/C.vue.setup.ts"), Span::new(1, 2)), (11, 12));
        assert_eq!(compiled.map(Path::new("/a/other.ts"), Span::new(1, 2)), (0, 0));
    }
}
