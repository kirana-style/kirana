//! The project-backed [`Environment`](crate::tailwind::Environment) the Tailwind codemod reads.

use std::fs;
use std::path::{Path, PathBuf};

use kirana_project::Project;

/// The migration engine's view of a project, from the file being migrated: what an import of it
/// evaluates to, which specifiers are installed packages it does not compile (a listed library's
/// components read `sx`), and how it imports another file. `kirana
/// migrate tailwind` and the language server's "Convert Tailwind classes" share it.
pub struct ProjectEnvironment<'p> {
    pub project: &'p Project,
    pub file: &'p Path,
}

impl crate::tailwind::Environment for ProjectEnvironment<'_> {
    fn export(&self, module: &str, export: &str) -> kirana_ir::Value {
        self.project.import_value(self.file, module, export)
    }

    fn is_external(&self, specifier: &str) -> bool {
        self.project.is_external(self.file, specifier)
    }

    fn specifier(&self, target: &Path) -> String {
        import_specifier(self.file, target)
    }

    fn resolve(&self, specifier: &str) -> Option<PathBuf> {
        self.project.resolve(self.file, specifier)
    }

    fn token(&self, variable: &str) -> Option<std::sync::Arc<kirana_ir::TokenDef>> {
        self.project.token_definition(variable)
    }
}

/// The nearest directory holding a `package.json`, and that file's contents.
fn package_of(file: &Path) -> Option<(PathBuf, serde_json::Value)> {
    file.ancestors().skip(1).find_map(|directory| {
        let text = fs::read_to_string(directory.join("package.json")).ok()?;
        Some((directory.to_path_buf(), serde_json::from_str(&text).unwrap_or_default()))
    })
}

/// How `from` imports `target`: a relative path within one package, and across packages the
/// target package's name with the `exports` entry that maps to the file (`./components/*` →
/// `@workspace/ui/components/sidebar`), else a relative path. Extensions are dropped.
fn import_specifier(from: &Path, target: &Path) -> String {
    let stem = |path: &str| {
        [".tsx", ".ts", ".jsx", ".js"]
            .iter()
            .find_map(|extension| path.strip_suffix(extension))
            .unwrap_or(path)
            .to_owned()
    };
    let target_package = package_of(target);
    if let Some((root, manifest)) =
        target_package.filter(|(root, _)| package_of(from).map(|(own, _)| own) != Some(root.clone()))
        && let (Some(name), Some(exports)) = (manifest["name"].as_str(), manifest["exports"].as_object())
    {
        let inside = format!("./{}", target.strip_prefix(&root).unwrap_or(target).to_string_lossy().replace('\\', "/"));
        for (key, value) in exports {
            let Some(value) = value.as_str() else { continue };
            let matched = match value.split_once('*') {
                Some((prefix, suffix)) => inside
                    .strip_prefix(prefix)
                    .and_then(|rest| rest.strip_suffix(suffix))
                    .map(|middle| key.replacen('*', middle, 1)),
                None => (value == inside).then(|| key.clone()),
            };
            if let Some(subpath) = matched {
                return stem(&format!("{name}{}", subpath.trim_start_matches('.')));
            }
        }
    }
    let directory = from.parent().unwrap_or(Path::new(""));
    let relative = relative(directory, target);
    let text = stem(&relative.to_string_lossy().replace('\\', "/"));
    if text.starts_with('.') { text } else { format!("./{text}") }
}

/// `target` relative to the directory `from`.
fn relative(from: &Path, target: &Path) -> PathBuf {
    let from: Vec<_> = from.components().collect();
    let target: Vec<_> = target.components().collect();
    let shared = from.iter().zip(&target).take_while(|(a, b)| a == b).count();
    let mut out = PathBuf::new();
    for _ in shared..from.len() {
        out.push("..");
    }
    for component in &target[shared..] {
        out.push(component.as_os_str());
    }
    out
}
