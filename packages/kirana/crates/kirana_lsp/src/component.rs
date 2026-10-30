//! Vue, Svelte and Astro components (`design-notes/editor-components.md`). Each script block is
//! compiled as the module the build names it (`Card.vue.setup.ts`); the block the template sees is
//! compiled with the template's `sx` bindings appended as JSX (`<div sx={…} />`), so a binding is a
//! site like any `sx` in JSX, and every span is mapped back into the component. An Angular
//! component's block is its `.ts` file (D-068); for an `.html` template that file is elsewhere, so
//! only the appended bindings map into the document.

use std::path::{Path, PathBuf};

use kirana_diagnostics::{Code, Diagnostic, Span};
use kirana_frontend::sfc::{Binding, Block, Framework, angular_bindings, angular_template, angular_template_url, scan};
use kirana_frontend::templates::{is_template, style_names};
use kirana_project::{Project, Site};

/// A component as the session compiled it.
#[derive(Debug, Clone)]
pub(crate) struct Compiled {
    pub modules: Vec<Module>,
}

/// One script block's module.
#[derive(Debug, Clone)]
pub(crate) struct Module {
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
pub(crate) struct Placed {
    pub binding: Binding,
    /// `sx={…}` in the module text.
    pub attribute: (usize, usize),
    /// The expression in the module text.
    pub expression: (usize, usize),
}

impl Module {
    fn content_length(&self) -> usize {
        self.content
    }

    /// The component offset of a module offset. In the appended JSX, an offset in a binding's
    /// expression maps to its place in the template, one before it to the attribute's start and one
    /// after it to the attribute's end; past every binding, the block's end.
    pub fn to_component(&self, offset: usize) -> usize {
        if offset <= self.content_length() {
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
        (span.end as usize) <= self.content_length()
    }
}

/// Compiles a component; returns it with its own diagnostics, spans in the component.
pub(crate) fn compile(project: &Project, path: &Path, text: &str, framework: Framework) -> (Compiled, Vec<Diagnostic>) {
    let component = scan(framework, text);
    let file = project.display_name(path);
    let mut modules = Vec::new();
    let mut diagnostics = Vec::new();
    for (index, block) in component.blocks.iter().enumerate() {
        let id = block.id(path);
        let content = &text[block.start..block.end];
        let bindings: &[Binding] = if component.target == Some(index) { &component.bindings } else { &[] };
        let module = compile_block(project, id, block.clone(), content, bindings, false, &file, &mut diagnostics);
        modules.push(module);
    }
    (Compiled { modules }, diagnostics)
}

/// Compiles one block, with `bindings` appended when there are any; its diagnostics, mapped into the
/// component, go to `diagnostics`.
#[allow(clippy::too_many_arguments)]
fn compile_block(
    project: &Project,
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
        project.transform(&id, content)
    } else {
        let (overlay, placed) = overlay(content, bindings);
        let result = project.transform_jsx(&id, &overlay);
        if result.diagnostics.iter().any(|diagnostic| diagnostic.code == Code::ParseError) {
            // A `<T>x` assertion does not parse as TSX: the block alone, without the template.
            project.transform(&id, content)
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
/// `.html` template named by a `.ts` file beside it (`read` gives that file's text). `None` for a
/// file that is neither.
pub(crate) fn angular(
    project: &Project,
    path: &Path,
    text: &str,
    read: &dyn Fn(&Path) -> Option<String>,
) -> Option<(Compiled, Vec<Diagnostic>)> {
    let file = project.display_name(path);
    let mut diagnostics = Vec::new();
    let module = match path.extension().and_then(|extension| extension.to_str()) {
        Some("ts") => {
            let (start, end) = angular_template(text)?;
            let bindings = angular_bindings(&text[start..end], start);
            if bindings.is_empty() {
                return None;
            }
            let block = Block { label: "", start: 0, end: text.len(), lang: "ts".to_owned() };
            compile_block(project, path.to_path_buf(), block, text, &bindings, false, &file, &mut diagnostics)
        }
        Some("html") => {
            let (owner, source) = template_owner(path, read)?;
            let bindings = angular_bindings(text, 0);
            let block = Block { label: "", start: usize::MAX, end: usize::MAX, lang: "ts".to_owned() };
            compile_block(project, owner, block, &source, &bindings, true, &file, &mut diagnostics)
        }
        _ => return None,
    };
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
    let module = compile_block(project, id, block, &content, &bindings, true, &file, &mut diagnostics);
    Some((Compiled { modules: vec![module] }, diagnostics))
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
        (kirana_project::absolute(&directory.join(url)) == kirana_project::absolute(template))
            .then_some((candidate, source))
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
        let mut out = Vec::new();
        for module in &self.modules {
            let name = project.display_name(&module.id);
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

    fn module(bindings: Vec<Placed>) -> Module {
        Module {
            id: PathBuf::from("/a/C.vue.setup.ts"),
            block: Block { label: "setup", start: 10, end: 20, lang: "ts".to_owned() },
            text: String::new(),
            bindings,
            content: 10,
            external: false,
        }
    }

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
        let module = module(vec![placed]);
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
        let external = Module { external: true, ..module.clone() };
        assert_eq!(external.to_component(4), 0);
        let compiled = Compiled { modules: vec![module] };
        assert_eq!(compiled.map(Path::new("/a/C.vue.setup.ts"), Span::new(1, 2)), (11, 12));
        assert_eq!(compiled.map(Path::new("/a/other.ts"), Span::new(1, 2)), (0, 0));
    }
}
