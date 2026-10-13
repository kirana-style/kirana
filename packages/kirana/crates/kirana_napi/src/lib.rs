//! The Node-API binding (tier 4). A long-lived `Compiler` session; every call crosses the
//! boundary once with compact values (engineering rule 5 in doc 13).

use std::path::{Path, PathBuf};
use std::sync::Arc;

use kirana_diagnostics::render_json;
use kirana_frontend::sfc;
use kirana_project::Project;
use kirana_shared::OsFs;
use napi_derive::napi;

/// The result of one module transform.
#[napi(object)]
pub struct TransformResult {
    pub code: Option<String>,
    pub map: Option<String>,
    /// Diagnostics as a JSON array.
    pub diagnostics: String,
    pub css_changed: bool,
    pub dependencies: Vec<String>,
}

/// The class map for server templates (D-069).
#[napi(object)]
pub struct ClassMapResult {
    /// Where to write it.
    pub out: String,
    pub json: String,
    /// Diagnostics as a JSON array.
    pub diagnostics: String,
}

/// A compilation session.
#[napi]
pub struct Compiler {
    project: Project,
}

#[napi]
impl Compiler {
    /// Creates a session from resolved configuration JSON; invalid configuration throws with the
    /// diagnostics JSON as the message.
    #[napi(constructor)]
    pub fn new(config_json: String) -> napi::Result<Self> {
        Project::new(&config_json, Arc::new(OsFs))
            .map(|project| Compiler { project })
            .map_err(|diagnostics| napi::Error::from_reason(render_json(&diagnostics)))
    }

    #[napi]
    pub fn transform(&self, id: String, code: String) -> TransformResult {
        let result = self.project.transform(Path::new(&id), &code);
        TransformResult {
            code: result.code,
            map: result.map,
            diagnostics: render_json(&result.diagnostics),
            css_changed: result.css_changed,
            dependencies: result.dependencies.iter().map(|path| path.to_string_lossy().into_owned()).collect(),
        }
    }

    #[napi]
    pub fn stylesheet(&self, minify: bool) -> String {
        self.project.stylesheet(minify)
    }

    /// The class map of `classes.modules`, compiling them first; `None` without `classes`.
    #[napi]
    pub fn class_map(&self) -> Option<ClassMapResult> {
        self.project.class_map().map(|map| ClassMapResult {
            out: map.out.to_string_lossy().into_owned(),
            json: map.json,
            diagnostics: render_json(&map.diagnostics),
        })
    }

    /// Project-wide diagnostics as JSON.
    #[napi]
    pub fn diagnostics(&self) -> String {
        render_json(&self.project.diagnostics())
    }

    /// Marks a file changed; returns the modules to re-transform.
    #[napi]
    pub fn invalidate(&self, id: String) -> Vec<String> {
        self.project.invalidate(Path::new(&id)).iter().map(|path| path.to_string_lossy().into_owned()).collect()
    }

    /// Removes a module from the build graph; returns whether the stylesheet changed.
    #[napi]
    pub fn remove(&self, id: String) -> bool {
        self.project.remove(Path::new(&id))
    }

    /// Compiles every source file under `paths` (files or directories) into the session; returns
    /// every diagnostic as JSON, project-wide ones included, as `kirana check` reports them.
    #[napi]
    pub fn check(&self, paths: Vec<String>) -> String {
        let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
        render_json(&self.project.compile_paths(&paths).0)
    }

    /// The style sites of a transformed module as JSON (byte spans).
    #[napi]
    pub fn sites(&self, id: String) -> String {
        to_json(&self.project.sites(Path::new(&id)))
    }

    /// Every token the session has evaluated, as JSON.
    #[napi]
    pub fn tokens(&self) -> String {
        to_json(&self.project.tokens())
    }

    /// The file `specifier` resolves to from the module `from`, as the build resolves it; `None` for
    /// an installed package or a specifier that does not resolve.
    #[napi]
    pub fn resolve(&self, from: String, specifier: String) -> Option<String> {
        let from = Path::new(&from);
        if self.project.is_external(from, &specifier) {
            return None;
        }
        self.project.resolve(from, &specifier).map(|path| path.to_string_lossy().into_owned())
    }

    /// Every relation the session has seen declared, as JSON.
    #[napi]
    pub fn relations(&self) -> String {
        to_json(&self.project.relations())
    }
}

fn to_json(value: &impl serde::Serialize) -> String {
    serde_json::to_string(value).expect("inspection values serialize")
}

/// Where a Vue, Svelte or Astro component's script blocks and `sx` bindings are, as the language
/// server's scanner finds them (`kirana_frontend::sfc`), as JSON with UTF-16 offsets like
/// JavaScript strings; `null` for any other file. The test holding it to the frameworks' own parsers
/// is `test/sfc-scan.test.ts`.
#[napi]
pub fn scan_component(file: String, source: String) -> String {
    let Some(framework) = sfc::framework_of(Path::new(&file)) else { return "null".to_owned() };
    let component = sfc::scan(framework, &source);
    let utf16 = |offset: usize| source[..offset].encode_utf16().count();
    let blocks: Vec<serde_json::Value> = component
        .blocks
        .iter()
        .map(|block| {
            serde_json::json!({ "label": block.label, "start": utf16(block.start), "end": utf16(block.end), "lang": block.lang })
        })
        .collect();
    let bindings: Vec<serde_json::Value> = component
        .bindings
        .iter()
        .map(|binding| {
            serde_json::json!({
                "start": utf16(binding.start),
                "end": utf16(binding.end),
                "expression": binding.expression,
            })
        })
        .collect();
    let target = component.target.map(|index| component.blocks[index].label);
    serde_json::json!({ "blocks": blocks, "bindings": bindings, "target": target }).to_string()
}

/// Runs the language server on this process's stdin and stdout until the client shuts it down;
/// returns the exit code. It blocks: `kirana lsp` is a process of its own.
#[napi]
pub fn run_lsp(config_json: String) -> i32 {
    kirana_lsp::serve_stdio(&config_json)
}

/// Runs the `kirana` command line; returns `[exitCode, output]`.
#[napi]
pub fn run_cli(args: Vec<String>) -> (i32, String) {
    let mut output = Vec::new();
    let code = kirana_cli::run(&args, &mut output);
    (code, String::from_utf8_lossy(&output).into_owned())
}
