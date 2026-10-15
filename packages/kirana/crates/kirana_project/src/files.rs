//! Source discovery and whole-tree compilation, shared by `kirana-style check`, the language server's
//! indexing and the lint plugin's project pass.

use std::fs;
use std::path::{Path, PathBuf};

use kirana_diagnostics::Diagnostic;

use crate::Project;

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

impl Project {
    /// Compiles every source file under `paths` (files or directories); returns every diagnostic,
    /// project-wide ones included, and the source of each file that has any. `kirana-style check`, the
    /// language server's indexing and the lint plugin's project pass share it.
    pub fn compile_paths(&self, paths: &[PathBuf]) -> (Vec<Diagnostic>, Vec<(String, String)>) {
        let mut files = Vec::new();
        for path in paths {
            collect_sources(path, &mut files, SCRIPT_EXTENSIONS);
        }
        let mut diagnostics = Vec::new();
        let mut sources = Vec::new();
        for (path, result) in self.build(&files) {
            match result {
                Ok(transformed) => {
                    if !transformed.diagnostics.is_empty() {
                        sources.push((self.display_name(&path), fs::read_to_string(&path).unwrap_or_default()));
                    }
                    diagnostics.extend(transformed.diagnostics);
                }
                Err(error) => diagnostics.push(Diagnostic::new(
                    kirana_diagnostics::Code::ParseError,
                    self.display_name(&path),
                    kirana_diagnostics::Span::default(),
                    error,
                )),
            }
        }
        diagnostics.extend(self.diagnostics());
        (diagnostics, sources)
    }
}
