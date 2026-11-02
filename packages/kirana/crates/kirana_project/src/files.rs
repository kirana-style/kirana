//! Source discovery and whole-tree compilation, shared by `kirana-style check`, the language server's
//! indexing and the lint plugin's project pass.

use std::fs;
use std::path::{Path, PathBuf};

use kirana_diagnostics::Diagnostic;
use kirana_frontend::sfc::{COMPONENT_EXTENSIONS, framework_of};
use kirana_shared::FxHashSet;

use crate::Project;
use crate::component::Module;

pub fn absolute(path: &Path) -> PathBuf {
    // The resolved form, as imports resolve to it: `apps/x/../../packages/ui/a.ts` and the
    // resolver's path to the same file must be one module, or its token namespaces collide with
    // themselves. A path that does not exist stays as given, and fails to read like any missing file.
    fs::canonicalize(path).map(plain_path).unwrap_or_else(|_| std::path::absolute(path).unwrap_or_default())
}

/// The plain form of a Windows verbatim path: `canonicalize` there returns `\\?\D:\app\a.tsx`, from which
/// tsconfig discovery finds no `paths` and every `@/…` import would be unresolved. `\\?\UNC\…` network
/// paths and every other path are returned as they are.
#[doc(hidden)]
pub fn plain_path(path: PathBuf) -> PathBuf {
    match path.to_str().and_then(|text| text.strip_prefix(r"\\?\")) {
        Some(rest) if !rest.starts_with(r"UNC\") => PathBuf::from(rest),
        _ => path,
    }
}

/// Script files a check compiles.
pub const SCRIPT_EXTENSIONS: &[&str] = &["ts", "tsx", "js", "jsx", "mts", "mjs"];

/// Appends the files under `path` (a file or a directory) with one of `extensions`, resolved, skipping
/// `node_modules`, `dist`, hidden directories and declaration files.
pub fn collect_sources(path: &Path, files: &mut Vec<PathBuf>, extensions: &[&str]) {
    if path.is_dir() {
        for entry in fs::read_dir(path).into_iter().flatten().flatten() {
            let child = entry.path();
            let name = entry.file_name();
            if name == "node_modules" || name == "dist" || name.to_string_lossy().starts_with('.') {
                continue;
            }
            collect_sources(&child, files, extensions);
        }
    } else if path.extension().is_some_and(|extension| extensions.iter().any(|known| extension == *known))
        && !path.to_string_lossy().ends_with(".d.ts")
    {
        files.push(absolute(path));
    }
}

/// What [`Project::compile_tree`] compiled.
#[derive(Debug, Default)]
pub struct Tree {
    /// Every diagnostic, project-wide ones included; a component's are placed in the component.
    pub diagnostics: Vec<Diagnostic>,
    /// The source of each file that has any.
    pub sources: Vec<(String, String)>,
    /// Each Vue, Svelte or Astro component: its block modules and its own diagnostics.
    pub components: Vec<(PathBuf, Vec<Module>, Vec<Diagnostic>)>,
}

impl Project {
    /// Compiles every source file under `paths` (files or directories); returns every diagnostic,
    /// project-wide ones included, and the source of each file that has any. `kirana-style check`, the
    /// lint plugin's project pass and `Driver.check()` share it.
    pub fn compile_paths(&self, paths: &[PathBuf]) -> (Vec<Diagnostic>, Vec<(String, String)>) {
        let tree = self.compile_tree(paths);
        (tree.diagnostics, tree.sources)
    }

    /// [`Project::compile_paths`], with the components it compiled, as the language server indexes.
    /// A Vue, Svelte or Astro component compiles as the build compiles it: its script blocks, the one
    /// the template sees with the template's `sx` bindings, so a relation anchored or read in a
    /// component counts, and its blocks' diagnostics are reported in it.
    pub fn compile_tree(&self, paths: &[PathBuf]) -> Tree {
        let mut files = Vec::new();
        let mut components = Vec::new();
        for path in paths {
            collect_sources(path, &mut files, SCRIPT_EXTENSIONS);
            collect_sources(path, &mut components, COMPONENT_EXTENSIONS);
        }
        self.walked.store(true, std::sync::atomic::Ordering::Relaxed);
        let mut tree = Tree::default();
        for (path, result) in self.build(&files) {
            match result {
                Ok(transformed) => {
                    if !transformed.diagnostics.is_empty() {
                        tree.sources.push((self.display_name(&path), fs::read_to_string(&path).unwrap_or_default()));
                    }
                    tree.diagnostics.extend(transformed.diagnostics);
                }
                Err(error) => tree.diagnostics.push(Diagnostic::new(
                    kirana_diagnostics::Code::ParseError,
                    self.display_name(&path),
                    kirana_diagnostics::Span::default(),
                    error,
                )),
            }
        }
        // A component that cannot be read has no blocks, as one with no script.
        let compiled = self.each(&components, |path| {
            let text = self.fs.read_to_string(path).unwrap_or_default();
            let framework = framework_of(path).expect("collected by a component's extension");
            let (modules, diagnostics) = self.compile_component(path, &text, framework);
            (path.clone(), text, modules, diagnostics)
        });
        // A project-wide diagnostic that names a component's block is reported in the component.
        let all = self.diagnostics();
        let blocks: FxHashSet<String> = compiled
            .iter()
            .flat_map(|(_, _, modules, _)| modules.iter().map(|module| self.display_name(&module.id)))
            .collect();
        let mut placed = Vec::new();
        for (path, text, modules, own) in compiled {
            let file = self.display_name(&path);
            let project = self.component_diagnostics(&modules, &file, &all);
            if !own.is_empty() || !project.is_empty() {
                tree.sources.push((file, text));
            }
            tree.diagnostics.extend(own.iter().cloned());
            placed.extend(project);
            tree.components.push((path, modules, own));
        }
        tree.diagnostics.extend(all.into_iter().filter(|diagnostic| !blocks.contains(&diagnostic.file)));
        tree.diagnostics.extend(placed);
        tree
    }
}
