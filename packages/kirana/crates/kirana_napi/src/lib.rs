//! The Node-API binding (tier 4). A long-lived `Compiler` session; every call crosses the
//! boundary once with compact values (engineering rule 5 in doc 13).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use kirana_diagnostics::{Diagnostic, render_human, render_json};
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
    /// The module's previous transform, answered again.
    pub reused: bool,
    /// The engine answers the same source with this transform until something it read changes.
    pub reusable: bool,
}

/// One question for `Compiler.trace`: which value wins for `property` at `file:line` (1-based).
#[napi(object)]
pub struct TraceQuery {
    pub file: String,
    pub line: u32,
    pub property: String,
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

/// Dense-name edits (D-084) for a text, in UTF-16 offsets as JavaScript strings index:
/// `starts[i]..ends[i]` becomes `texts[i]`.
#[napi(object)]
pub struct DenseEdits {
    pub starts: Vec<u32>,
    pub ends: Vec<u32>,
    pub texts: Vec<String>,
}

/// A variable token a finished stylesheet left out (D-086).
#[napi(object)]
pub struct PrunedToken {
    pub variable: String,
    /// `namespace.path`, as `defineTokens` wrote it.
    pub identity: String,
}

/// A finished bundle's stylesheet (D-086): the CSS, and the variable tokens left out of it.
#[napi(object)]
pub struct FinishedStylesheet {
    pub css: String,
    pub pruned: Vec<PrunedToken>,
}

/// A compilation session. The project is shared with transforms running on worker threads.
#[napi]
pub struct Compiler {
    /// Taken out once, by `Drop`, which frees it off the main thread.
    project: std::mem::ManuallyDrop<Arc<Project>>,
}

impl Drop for Compiler {
    /// A session's project is freed on a thread of its own when this was its last holder. Node
    /// collects a session when it chooses, on the main thread, inside whatever is running then; a
    /// session that compiled a thousand styles holds a thousand values and their atoms, a millisecond
    /// or more of frees, which a benchmark that opens a session per sample otherwise pays inside a
    /// later sample. A worker still holding the project (`transformAsync`) frees it when it is done,
    /// whichever of the two lets go last. With no thread to be had, it is freed here, as before. The
    /// WASI engine's threads are Workers, far dearer to start than the frees they would take off the
    /// main thread, so it frees in place.
    fn drop(&mut self) {
        // SAFETY: the project is taken here once, and nothing reads the field after `drop`.
        let project = unsafe { std::mem::ManuallyDrop::take(&mut self.project) };
        #[cfg(not(target_family = "wasm"))]
        let _ = std::thread::Builder::new().name("kirana-teardown".to_owned()).spawn(move || drop(project));
        #[cfg(target_family = "wasm")]
        drop(project);
    }
}

fn transform_result(result: kirana_project::Transformed) -> TransformResult {
    TransformResult {
        code: result.code,
        map: result.map,
        diagnostics: render_json(&result.diagnostics),
        css_changed: result.css_changed,
        dependencies: result.dependencies.iter().map(|path| path.to_string_lossy().into_owned()).collect(),
        reused: result.reused,
        reusable: result.reusable,
    }
}

/// One module's transform, run on the Node.js worker pool (`Compiler::transform_async`).
pub struct TransformTask {
    project: Arc<Project>,
    id: String,
    code: String,
    maps: bool,
}

impl napi::Task for TransformTask {
    type Output = kirana_project::Transformed;
    type JsValue = TransformResult;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        Ok(self.project.transform_with(Path::new(&self.id), &self.code, self.maps))
    }

    fn resolve(&mut self, _env: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(transform_result(output))
    }
}

#[napi]
impl Compiler {
    /// Creates a session from resolved configuration JSON; invalid configuration throws with the
    /// diagnostics JSON as the message.
    #[napi(constructor)]
    pub fn new(config_json: String) -> napi::Result<Self> {
        Project::new(&config_json, Arc::new(OsFs))
            .map(|project| Compiler { project: std::mem::ManuallyDrop::new(Arc::new(project)) })
            .map_err(|diagnostics| napi::Error::from_reason(render_json(&diagnostics)))
    }

    /// `map` false leaves the source map out, for a host that writes none.
    #[napi]
    pub fn transform(&self, id: String, code: String, map: Option<bool>) -> TransformResult {
        transform_result(self.project.transform_with(Path::new(&id), &code, map.unwrap_or(true)))
    }

    /// `transform` on a worker thread: a bundler that runs module hooks concurrently compiles
    /// modules in parallel, and its own thread stays free. The registry is shared and the
    /// stylesheet is written in path order, so the order transforms finish in changes nothing.
    #[napi(ts_return_type = "Promise<TransformResult>")]
    pub fn transform_async(
        &self,
        id: String,
        code: String,
        map: Option<bool>,
    ) -> napi::bindgen_prelude::AsyncTask<TransformTask> {
        napi::bindgen_prelude::AsyncTask::new(TransformTask {
            project: Arc::clone(&self.project),
            id,
            code,
            maps: map.unwrap_or(true),
        })
    }

    #[napi]
    pub fn stylesheet(&self, minify: bool) -> String {
        self.project.stylesheet(minify)
    }

    /// The stylesheet of a finished bundle (D-086): `named` is every variable token its chunks and
    /// other stylesheets still name.
    #[napi]
    pub fn finished_stylesheet(&self, minify: bool, named: Vec<String>) -> FinishedStylesheet {
        let (css, pruned) = self.project.finished_stylesheet(minify, &named);
        FinishedStylesheet {
            css,
            pruned: pruned.into_iter().map(|(variable, identity)| PrunedToken { variable, identity }).collect(),
        }
    }

    /// From now on, a transform of unchanged input returns the previous one: a build, watch build or
    /// dev server compiles the same modules for more than one environment, and sends unchanged ones
    /// again (KF-063).
    #[napi]
    pub fn reuse_transforms(&self) {
        self.project.reuse_transforms();
    }

    /// From now on, transforms mark the names they write, for a dense build (D-084).
    #[napi]
    pub fn mark_dense(&self) {
        self.project.mark_dense();
    }

    /// The edits that give `code` dense names (D-084), against the codes the session has assigned
    /// so far; assigning any the build needs first.
    #[napi]
    pub fn dense_edits(&self, code: String) -> DenseEdits {
        let edits = self.project.dense_edits(&code);
        let mut out = DenseEdits { starts: Vec::new(), ends: Vec::new(), texts: Vec::new() };
        // Byte offsets to UTF-16 ones, in one pass: edits arrive in order.
        let (mut byte, mut unit) = (0usize, 0u32);
        let mut advance = |to: usize| {
            unit += code[byte..to].encode_utf16().count() as u32;
            byte = to;
            unit
        };
        for edit in edits {
            out.starts.push(advance(edit.start));
            out.ends.push(advance(edit.end));
            out.texts.push(edit.text);
        }
        out
    }

    /// `code` with dense names (D-084), renamed here in one pass for a build that writes no source
    /// map; `None` when it names no Kirana class.
    #[napi]
    pub fn dense_chunk(&self, code: String) -> Option<String> {
        self.project.dense_chunk(&code)
    }

    /// A finished stylesheet with dense names (D-084), its definitions included unless `named` (what
    /// the bundle's chunks and other assets name) holds them.
    #[napi]
    pub fn dense_stylesheet(&self, text: String, named: Vec<String>) -> String {
        self.project.dense_stylesheet(&text, &named)
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
    /// every diagnostic as JSON, project-wide ones included, as `kirana-style check` reports them.
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
    /// an installed package the application does not compile (one not in `libraries`) or a specifier
    /// that does not resolve.
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

    /// Answers each query as `kirana-style trace --format json` does, as JSON, compiling each file
    /// once (KF-022).
    #[napi]
    pub fn trace(&self, queries: Vec<TraceQuery>) -> String {
        let queries: Vec<kirana_project::TraceQuery> = queries
            .into_iter()
            .map(|query| kirana_project::TraceQuery {
                file: query.file,
                line: query.line as usize,
                property: query.property,
            })
            .collect();
        to_json(&self.project.trace_all(&queries))
    }

    /// What `kirana-style export` prints for `paths`, with each style's and recipe's definition when
    /// `definitions` is set (KF-023), as JSON.
    #[napi]
    pub fn export(&self, paths: Vec<String>, definitions: bool) -> String {
        let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
        to_json(&self.project.export(&paths, definitions).0)
    }

    /// A Tailwind class string lowered as `kirana-style migrate tailwind` lowers it in `file`
    /// (KF-004), as JSON; throws without a utility grammar.
    #[napi]
    pub fn lower_tailwind(&self, file: String, classes: String) -> napi::Result<String> {
        let lowering =
            kirana_cli::lower_tailwind(&self.project, Path::new(&file), &classes).map_err(napi::Error::from_reason)?;
        Ok(serde_json::json!({
            "style": lowering.style,
            "module": lowering.module,
            "anchors": lowering.anchors,
            "left": lowering.left,
            "notes": lowering.notes,
        })
        .to_string())
    }

    /// Gives the memory the engine has freed back to the system (D-123), for every session in this
    /// process. mimalloc keeps freed pages to reuse them, which is where its speed comes from, so a
    /// session that stays open (a dev server, a watch build) calls this when it goes idle. It frees the
    /// empty pages of the calling thread's heap and purges every arena; with the arenas committed on
    /// demand (`MI_DEFAULT_ARENA_EAGER_COMMIT=0`, set by `scripts/build-native.ts` on Linux), that brings
    /// even a build compiled on worker threads back to the system allocator's memory. A no-op on WASI.
    #[napi]
    pub fn release_memory(&self) {
        release_memory();
    }
}

fn to_json(value: &impl serde::Serialize) -> String {
    serde_json::to_string(value).expect("inspection values serialize")
}

/// The expressions of an Angular component's `[sx]` bindings (D-068), from its inline template or
/// from the `.html` file its `templateUrl` names beside `file`, as a JSON array; empty for any other
/// file. A host appends the anchors they name to the component's module (KF-090).
#[napi]
pub fn angular_bindings(file: String, source: String) -> String {
    let template = match sfc::angular_template(&source) {
        Some((start, end)) => Some(source[start..end].to_owned()),
        None => sfc::angular_template_url(&source)
            .and_then(|url| std::fs::read_to_string(Path::new(&file).with_file_name("").join(url)).ok()),
    };
    let expressions: Vec<String> = template
        .map(|template| sfc::angular_bindings(&template, 0).into_iter().map(|binding| binding.expression).collect())
        .unwrap_or_default();
    to_json(&expressions)
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

/// The language server in process (KF-065): a host with no stdin and stdout to give it, a page with
/// the WebAssembly engine among them, asks it what an editor asks over LSP, as JSON.
#[napi]
pub struct LanguageServer {
    server: kirana_lsp::Server,
}

#[napi]
impl LanguageServer {
    /// Opens a session as `initialize` does: `config_json` is the engine's configuration, and
    /// `initialize_params` the client's `initialize` parameters (`initializationOptions` among them).
    #[napi(constructor)]
    pub fn new(config_json: String, initialize_params: String) -> napi::Result<Self> {
        let params = json_value(&initialize_params)?;
        // A page runs it on its main thread, which may not block (KF-065).
        let server = kirana_lsp::Server::start_serial(&config_json, &params).map_err(napi::Error::from_reason)?;
        Ok(Self { server })
    }

    /// A request (`textDocument/inlayHint`, `textDocument/hover` …): its result as JSON. Its error
    /// is thrown.
    #[napi]
    pub fn request(&mut self, method: String, params_json: String) -> napi::Result<String> {
        let params = json_value(&params_json)?;
        self.server.call(&method, params).map(|result| result.to_string()).map_err(napi::Error::from_reason)
    }

    /// A notification (`textDocument/didOpen`, `didChange`, `didClose` …): the notifications the
    /// server sends back, as a JSON array of `{ method, params }`.
    #[napi]
    pub fn notify(&mut self, method: String, params_json: String) -> napi::Result<String> {
        let params = json_value(&params_json)?;
        Ok(serde_json::Value::Array(self.server.notify(&method, params)).to_string())
    }
}

/// A JSON argument, or the error a caller sees for text that is not JSON.
fn json_value(text: &str) -> napi::Result<serde_json::Value> {
    serde_json::from_str(text).map_err(|error| napi::Error::from_reason(error.to_string()))
}

/// Runs the language server on this process's stdin and stdout until the client shuts it down;
/// returns the exit code. It blocks: `kirana-style lsp` is a process of its own. Each time the editor
/// pauses, the memory the engine freed goes back to the system (D-123).
#[napi]
pub fn run_lsp(config_json: String) -> i32 {
    kirana_lsp::serve_stdio(&config_json, Some((kirana_lsp::IDLE_AFTER, &release_memory)))
}

/// Runs the `kirana-style` command line; returns `[exitCode, output]`. `colour` adds ANSI colours to
/// its diagnostics, for a terminal that shows them.
#[napi]
pub fn run_cli(args: Vec<String>, colour: Option<bool>) -> (i32, String) {
    let mut output = Vec::new();
    let code = kirana_cli::run_coloured(&args, &mut output, colour.unwrap_or(false));
    (code, String::from_utf8_lossy(&output).into_owned())
}

/// Renders diagnostics, as the engine reports them in JSON, the way the command line prints them
/// (D-116): one report each. `sources` holds the text of each file they name, read once for all of
/// that file's reports.
#[napi]
pub fn render_diagnostics(
    diagnostics_json: String,
    sources: HashMap<String, String>,
    colour: bool,
) -> napi::Result<Vec<String>> {
    let diagnostics: Vec<Diagnostic> =
        serde_json::from_str(&diagnostics_json).map_err(|error| napi::Error::from_reason(error.to_string()))?;
    Ok(render_human(&diagnostics, &|file| sources.get(file).map(String::as_str), colour))
}

// PERF: mimalloc allocates for the native engine (D-123): a compile in the engine is 13 to 26 % faster
// than with the system's allocator, since allocation and frees are about a quarter of one, and 5 to
// 9 % through the Driver. The WASI engine keeps wasi-libc's, which emnapi's runtime allocates through
// as well.
#[cfg(not(target_family = "wasm"))]
#[global_allocator]
static ALLOCATOR: mimalloc::MiMalloc = mimalloc::MiMalloc;

/// What `Compiler::release_memory` does, and what the language server calls after a pause.
fn release_memory() {
    #[cfg(not(target_family = "wasm"))]
    // SAFETY: `mi_collect` only walks mimalloc's own free lists and arenas; it takes no pointer.
    unsafe {
        libmimalloc_sys::mi_collect(true);
    }
}
