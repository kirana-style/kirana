//! The Kirana language server (KRN-DX-001 … KRN-DX-007): LSP over stdio on the same
//! `kirana_project` session the build uses, so the editor never disagrees with the build. It runs
//! beside the TypeScript server and answers styling questions only.
//!
//! The server is synchronous: one thread reads messages and answers them in order. Transforming
//! one module takes a few milliseconds, so there is nothing to gain from concurrency that would
//! justify a second copy of the session.

mod actions;
mod brand;
mod card;
mod colors;
mod completion;
mod component;
mod diagram;
mod hover;
mod inspect;
mod model;
mod navigation;
mod outline;
mod summary;
pub mod text;

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use kirana_diagnostics::{Diagnostic, Severity};
use kirana_project::{Project, Site, TraceLine};
use kirana_shared::OsFs;
use lsp_server::{Connection, ErrorCode, Message, Notification, Request, Response};
use lsp_types::notification::{
    DidChangeTextDocument, DidChangeWatchedFiles, DidCloseTextDocument, DidOpenTextDocument, Notification as _,
    PublishDiagnostics,
};
use lsp_types::request::{
    CodeActionRequest, CodeLensRequest, ColorPresentationRequest, Completion, DocumentColor, DocumentHighlightRequest,
    DocumentSymbolRequest, ExecuteCommand, FoldingRangeRequest, GotoDefinition, HoverRequest, InlayHintRequest,
    InlayHintResolveRequest, References, Request as _, WorkspaceSymbolRequest,
};
use lsp_types::{
    DiagnosticSeverity, DidChangeTextDocumentParams, DidChangeWatchedFilesParams, DidCloseTextDocumentParams,
    DidOpenTextDocumentParams, FileChangeType, NumberOrString, PublishDiagnosticsParams,
};
use serde_json::{Value, json};

use crate::text::{LineIndex, path_to_uri, uri_to_path};

/// The commands the server executes (`workspace/executeCommand`).
pub const COMMANDS: &[&str] = &[actions::SHOW_CSS, actions::EXPLAIN, actions::CONVERT, actions::SHOW_USES];

/// A notification a client sends when its colour theme changes: `{ "theme": "light" | "dark" }`.
pub const THEME: &str = "kirana/theme";

/// A notification the server sends when `kirana.config.*` changes: the configuration is evaluated in
/// JavaScript, so a client restarts the server rather than the server reloading it.
pub const RESTART: &str = "kirana/restart";

/// What a client may turn off (`initializationOptions`); both default to on (KRN-DX-004).
#[derive(Debug, Clone, Copy)]
pub(crate) struct Options {
    /// The inline summary after `sx={…}`.
    pub summary: bool,
    /// The code lens on `css()` and `recipe()`.
    pub code_lens: bool,
    /// Pixels per `rem`, for the pixel equivalents (`rootFontSize`, default 16).
    pub root_font_size: f64,
    /// The client renders images in hovers (`images`): drawings are SVG, else text.
    pub images: bool,
    /// The client runs `command:` links in hovers (`commandLinks`).
    pub commands: bool,
    /// The client renders the safe HTML VS Code allows in hovers (`html`): tables side by side,
    /// colour on text.
    pub html: bool,
    /// The longest inline summary, in characters (`summaryLength`, default 100; 0 for no limit).
    pub summary_length: usize,
    /// The client's colour theme (`theme`; `kirana/theme` changes it).
    pub theme: diagram::Theme,
}

/// One language server session.
pub struct Server {
    pub(crate) options: Options,
    pub(crate) project: Project,
    pub(crate) root: PathBuf,
    /// Open documents' current text.
    pub(crate) documents: BTreeMap<PathBuf, String>,
    /// Each module's own diagnostics from its last transform; a component's are under its own path.
    module_diagnostics: BTreeMap<PathBuf, Vec<Diagnostic>>,
    /// Vue, Svelte and Astro components, by path.
    components: BTreeMap<PathBuf, component::Compiled>,
    /// Documents diagnostics were published for, to clear them when they close.
    published: BTreeSet<PathBuf>,
}

/// Runs the server on stdin/stdout until the client shuts it down; returns the exit code.
pub fn serve_stdio(config_json: &str) -> i32 {
    let (connection, threads) = Connection::stdio();
    let result = serve(&connection, config_json);
    drop(connection);
    let _ = threads.join();
    match result {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("kirana lsp: {error}");
            1
        }
    }
}

/// The server's capabilities, as `initialize` returns them.
pub fn capabilities() -> Value {
    json!({
        "positionEncoding": "utf-16",
        "textDocumentSync": { "openClose": true, "change": 1 },
        "hoverProvider": true,
        "colorProvider": true,
        "inlayHintProvider": { "resolveProvider": true },
        "codeLensProvider": { "resolveProvider": false },
        "completionProvider": { "triggerCharacters": ["\"", "'", "`", ":", "@", "[", ".", " ", "-"] },
        "definitionProvider": true,
        "referencesProvider": true,
        "workspaceSymbolProvider": true,
        "documentSymbolProvider": true,
        "documentHighlightProvider": true,
        "foldingRangeProvider": true,
        "codeActionProvider": {
            "codeActionKinds": ["quickfix", "refactor.extract", "refactor.inline", "refactor.rewrite", "source"]
        },
        "executeCommandProvider": { "commands": COMMANDS },
    })
}

/// Runs the server over `connection` until the client shuts it down.
pub fn serve(connection: &Connection, config_json: &str) -> Result<(), String> {
    let params = connection.initialize(capabilities()).map_err(|error| error.to_string())?;
    let mut server = Server::start(config_json, &params)?;
    for message in &connection.receiver {
        match message {
            Message::Request(request) => {
                if connection.handle_shutdown(&request).map_err(|error| error.to_string())? {
                    return Ok(());
                }
                let response = respond(request.id.clone(), &request.method, || server.request(&request));
                connection.sender.send(Message::Response(response)).map_err(|error| error.to_string())?;
            }
            Message::Notification(notification) => {
                let method = notification.method.clone();
                for out in guarded(&method, || server.notification(notification)).unwrap_or_default() {
                    connection.sender.send(Message::Notification(out)).map_err(|error| error.to_string())?;
                }
            }
            Message::Response(_) => {}
        }
    }
    Ok(())
}

/// One request's response: its handler's, or an internal error when the handler panics.
pub fn respond(id: lsp_server::RequestId, method: &str, run: impl FnOnce() -> Response) -> Response {
    guarded(method, run).unwrap_or_else(|message| Response::new_err(id, ErrorCode::InternalError as i32, message))
}

/// Runs one message's handler, turning a panic into an error for that message alone.
///
/// The server usually runs on Node's main thread (`kirana lsp` through the Node-API binding), where
/// a panic cannot unwind past Node's frames and aborts the process: every feature would stop for
/// one bad answer. Caught here, the editor gets an error for that request and the server goes on.
pub fn guarded<T>(method: &str, run: impl FnOnce() -> T) -> Result<T, String> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(run)).map_err(|payload| {
        let reason = payload
            .downcast_ref::<&str>()
            .map(|reason| (*reason).to_owned())
            .or_else(|| payload.downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "unknown panic".to_owned());
        eprintln!("kirana lsp: {method} failed: {reason}");
        format!("kirana lsp: {method} failed: {reason}")
    })
}

impl Server {
    /// Opens the session and indexes the workspace, so tokens and relations declared anywhere are
    /// known before the first hover.
    pub fn start(config_json: &str, params: &Value) -> Result<Server, String> {
        let mut config: Value = serde_json::from_str(config_json).map_err(|error| error.to_string())?;
        if config.get("root").is_none_or(|root| root.as_str().is_none_or(str::is_empty)) {
            let from_params = params
                .get("rootUri")
                .and_then(Value::as_str)
                .and_then(|uri| uri.parse().ok())
                .and_then(|uri| uri_to_path(&uri))
                .or_else(|| std::env::current_dir().ok())
                .unwrap_or_default();
            config["root"] = Value::String(from_params.to_string_lossy().into_owned());
        }
        let root = PathBuf::from(config["root"].as_str().unwrap_or_default());
        let project = Project::new(&config.to_string(), Arc::new(OsFs)).map_err(|diagnostics| {
            diagnostics.iter().map(|diagnostic| diagnostic.message.clone()).collect::<Vec<_>>().join("; ")
        })?;
        let (indexed, _) = project.compile_paths(std::slice::from_ref(&root));
        let mut module_diagnostics: BTreeMap<PathBuf, Vec<Diagnostic>> = BTreeMap::new();
        for diagnostic in indexed.into_iter().filter(|diagnostic| !diagnostic.file.is_empty()) {
            module_diagnostics.entry(root.join(&diagnostic.file)).or_default().push(diagnostic);
        }
        let mut components = BTreeMap::new();
        let mut files = Vec::new();
        kirana_project::collect_sources(&root, &mut files, kirana_frontend::sfc::COMPONENT_EXTENSIONS);
        // Every collected file has a component's extension; one that cannot be read is skipped.
        let readable = files.into_iter().filter_map(|path| {
            let framework = kirana_frontend::sfc::framework_of(&path).unwrap_or(kirana_frontend::sfc::Framework::Vue);
            std::fs::read_to_string(&path).ok().map(|text| (path, text, framework))
        });
        for (path, text, framework) in readable {
            let (compiled, diagnostics) = component::compile(&project, &path, &text, framework);
            module_diagnostics.insert(path.clone(), diagnostics);
            components.insert(path, compiled);
        }
        // Angular components (D-068): `.ts` files with `[sx]` in an inline template, and `.html`
        // templates. Only files that mention `[sx]` are read twice.
        let mut angular = Vec::new();
        kirana_project::collect_sources(&root, &mut angular, &["ts", "html"]);
        let disk = |file: &Path| std::fs::read_to_string(file).ok();
        let marked = angular.into_iter().filter_map(|path| {
            disk(&path).filter(|text| text.contains("sx]") || text.contains("bind-sx")).map(|text| (path, text))
        });
        for (path, text) in marked {
            if let Some((compiled, diagnostics)) = component::angular(&project, &path, &text, &disk) {
                module_diagnostics.insert(path.clone(), diagnostics);
                components.insert(path, compiled);
            }
        }
        let option = |name: &str| params.pointer(&format!("/initializationOptions/{name}")).and_then(Value::as_bool);
        let options = Options {
            summary: option("summary").unwrap_or(true),
            code_lens: option("codeLens").unwrap_or(true),
            root_font_size: params
                .pointer("/initializationOptions/rootFontSize")
                .and_then(Value::as_f64)
                .filter(|size| *size > 0.0)
                .unwrap_or(16.0),
            images: option("images").unwrap_or(false),
            commands: option("commandLinks").unwrap_or(false),
            html: option("html").unwrap_or(false),
            summary_length: match params.pointer("/initializationOptions/summaryLength").and_then(Value::as_u64) {
                Some(0) => usize::MAX,
                Some(length) => length as usize,
                None => 100,
            },
            theme: diagram::Theme::from_name(params.pointer("/initializationOptions/theme").and_then(Value::as_str)),
        };
        Ok(Server {
            options,
            project,
            root,
            documents: BTreeMap::new(),
            module_diagnostics,
            components,
            published: BTreeSet::new(),
        })
    }

    /// The current text of a file: the open document, else the file on disk.
    pub(crate) fn source(&self, path: &Path) -> Option<String> {
        self.documents.get(path).cloned().or_else(|| std::fs::read_to_string(path).ok())
    }

    /// Answers one request.
    pub fn request(&mut self, request: &Request) -> Response {
        let id = request.id.clone();
        let params = &request.params;
        let result = match request.method.as_str() {
            HoverRequest::METHOD => hover::hover(self, params),
            DocumentColor::METHOD => colors::document_colors(self, params),
            ColorPresentationRequest::METHOD => colors::presentations(self, params),
            InlayHintRequest::METHOD => summary::inlay_hints(self, params),
            InlayHintResolveRequest::METHOD => summary::resolve_hint(self, params),
            CodeLensRequest::METHOD => summary::code_lenses(self, params),
            Completion::METHOD => completion::complete(self, params),
            GotoDefinition::METHOD => navigation::definition(self, params),
            References::METHOD => navigation::references(self, params),
            WorkspaceSymbolRequest::METHOD => navigation::symbols(self, params),
            CodeActionRequest::METHOD => actions::code_actions(self, params),
            ExecuteCommand::METHOD => actions::execute(self, params),
            DocumentSymbolRequest::METHOD => outline::document_symbols(self, params),
            DocumentHighlightRequest::METHOD => outline::highlights(self, params),
            FoldingRangeRequest::METHOD => outline::folding_ranges(self, params),
            inspect::INSPECT => inspect::inspect(self, params),
            inspect::STYLE_RANGES => outline::style_ranges(self, params),
            inspect::STATS => Ok(inspect::stats(self)),
            _ => {
                return Response::new_err(
                    id,
                    ErrorCode::MethodNotFound as i32,
                    format!("unhandled request {}", request.method),
                );
            }
        };
        match result {
            Ok(value) => Response::new_ok(id, value),
            Err(message) => Response::new_err(id, ErrorCode::InvalidParams as i32, message),
        }
    }

    /// Handles one notification; returns the notifications to send back.
    pub fn notification(&mut self, notification: Notification) -> Vec<Notification> {
        match notification.method.as_str() {
            DidOpenTextDocument::METHOD => {
                let Ok(params) = notification.extract::<DidOpenTextDocumentParams>(DidOpenTextDocument::METHOD) else {
                    return Vec::new();
                };
                self.edit(&params.text_document.uri, params.text_document.text)
            }
            DidChangeTextDocument::METHOD => {
                let Ok(params) = notification.extract::<DidChangeTextDocumentParams>(DidChangeTextDocument::METHOD)
                else {
                    return Vec::new();
                };
                // Full synchronisation: the last change carries the whole text.
                match params.content_changes.into_iter().last() {
                    Some(change) => self.edit(&params.text_document.uri, change.text),
                    None => Vec::new(),
                }
            }
            DidCloseTextDocument::METHOD => {
                let Ok(params) = notification.extract::<DidCloseTextDocumentParams>(DidCloseTextDocument::METHOD)
                else {
                    return Vec::new();
                };
                let Some(path) = uri_to_path(&params.text_document.uri) else { return Vec::new() };
                self.documents.remove(&path);
                // The module goes back to what is on disk.
                if let Ok(text) = std::fs::read_to_string(&path) {
                    self.transform(&path, &text);
                }
                let mut out = self.publish_all();
                if self.published.remove(&path) {
                    out.push(publish(&path, Vec::new()));
                }
                out
            }
            DidChangeWatchedFiles::METHOD => {
                let Ok(params) = notification.extract::<DidChangeWatchedFilesParams>(DidChangeWatchedFiles::METHOD)
                else {
                    return Vec::new();
                };
                self.files_changed(params)
            }
            THEME => {
                self.options.theme =
                    diagram::Theme::from_name(notification.params.get("theme").and_then(Value::as_str));
                Vec::new()
            }
            _ => Vec::new(),
        }
    }

    fn edit(&mut self, uri: &lsp_types::Uri, text: String) -> Vec<Notification> {
        let Some(path) = uri_to_path(uri) else { return Vec::new() };
        self.transform(&path, &text);
        self.documents.insert(path, text);
        // Project-wide diagnostics (relations, collisions) can change for every open document.
        self.publish_all()
    }

    fn transform(&mut self, path: &Path, text: &str) {
        let documents = &self.documents;
        let read = |file: &Path| documents.get(file).cloned().or_else(|| std::fs::read_to_string(file).ok());
        let angular = component::angular(&self.project, path, text, &read);
        let compiled = match kirana_frontend::sfc::framework_of(path) {
            Some(framework) => Some(component::compile(&self.project, path, text, framework)),
            None => angular.or_else(|| component::template(&self.project, path, text)),
        };
        if let Some((compiled, diagnostics)) = compiled {
            // A block the component no longer has leaves the session.
            if let Some(previous) = self.components.get(path) {
                for module in &previous.modules {
                    if !compiled.modules.iter().any(|current| current.id == module.id) {
                        self.project.remove(&module.id);
                    }
                }
            }
            self.components.insert(path.to_path_buf(), compiled);
            self.module_diagnostics.insert(path.to_path_buf(), diagnostics);
            return;
        }
        // An Angular `.ts` file whose template lost its last `[sx]` is a module again.
        self.components.remove(path);
        // An `.html` file that is no Angular component's template, or a server template that names
        // no style, has nothing to compile.
        // Only scripts are modules: a `.php` file opened as PHP is not one.
        let script = path
            .extension()
            .is_some_and(|extension| kirana_project::SCRIPT_EXTENSIONS.iter().any(|known| extension == *known));
        if !script {
            self.module_diagnostics.remove(path);
            return;
        }
        let result = self.project.transform(path, text);
        self.module_diagnostics.insert(path.to_path_buf(), result.diagnostics);
    }

    /// The component a block module belongs to; the path itself for any other module.
    fn owner(&self, path: &Path) -> PathBuf {
        self.components
            .iter()
            .find(|(_, compiled)| compiled.modules.iter().any(|module| module.id == path))
            .map_or_else(|| path.to_path_buf(), |(component, _)| component.clone())
    }

    /// The style sites of a file, spans in its text: a module's from the session, a component's
    /// mapped from its blocks.
    pub(crate) fn sites(&self, path: &Path) -> Vec<Site> {
        match self.components.get(path) {
            Some(compiled) => compiled.sites(&self.project),
            None => self.project.sites(path),
        }
    }

    /// Where each of `classes` is produced, as `(file, span in its text, class)`: a block module's
    /// sites are reported in its component.
    pub(crate) fn origins(&self, classes: &BTreeSet<&str>) -> Vec<(PathBuf, (usize, usize), String)> {
        let mut out = Vec::new();
        for origin in self.project.origins(classes) {
            let owner = self.owner(&origin.path);
            let span = match self.components.get(&owner) {
                Some(compiled) => compiled.map(&origin.path, origin.span),
                None => (origin.span.start as usize, origin.span.end as usize),
            };
            out.push((owner, span, origin.class));
        }
        out
    }

    /// How many Vue, Svelte and Astro components the session compiled.
    pub(crate) fn component_count(&self) -> usize {
        self.components.len()
    }

    /// Whether a path is a Vue, Svelte or Astro component the session compiled.
    pub(crate) fn is_component(&self, path: &Path) -> bool {
        self.components.contains_key(path)
    }

    /// Traces `property` at a 1-based line of a file; in a component, of the block holding it.
    pub(crate) fn trace(&self, path: &Path, text: &str, line: usize, property: &str) -> Vec<TraceLine> {
        let Some(compiled) = self.components.get(path) else { return self.project.trace(path, text, line, property) };
        let index = LineIndex::new(text);
        let offset = index.offset(lsp_types::Position::new(line.saturating_sub(1) as u32, 0));
        let line_end = text[offset..].find('\n').map_or(text.len(), |end| offset + end);
        let Some((module, inner)) = compiled.module_at(offset).or_else(|| compiled.module_at(line_end)) else {
            return Vec::new();
        };
        let module_line = LineIndex::new(&module.text).position(inner).line as usize + 1;
        self.project.trace(&module.id, &module.text, module_line, property)
    }

    fn files_changed(&mut self, params: DidChangeWatchedFilesParams) -> Vec<Notification> {
        let mut out = Vec::new();
        let mut affected = BTreeSet::new();
        for change in params.changes {
            let Some(path) = uri_to_path(&change.uri) else { continue };
            let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
            if name.starts_with("kirana.config.") {
                out.push(Notification::new(RESTART.to_owned(), json!({ "reason": "configuration changed" })));
                continue;
            }
            affected.extend(self.project.invalidate(&path));
            if change.typ == FileChangeType::DELETED {
                self.project.remove(&path);
                self.module_diagnostics.remove(&path);
                if let Some(compiled) = self.components.remove(&path) {
                    for module in &compiled.modules {
                        self.project.remove(&module.id);
                    }
                }
            } else if !self.documents.contains_key(&path) && self.module_diagnostics.contains_key(&path) {
                affected.insert(path);
            }
        }
        let affected: BTreeSet<PathBuf> = affected.iter().map(|path| self.owner(path)).collect();
        for path in affected {
            if let Some(text) = self.source(&path) {
                self.transform(&path, &text);
            }
        }
        out.extend(self.publish_all());
        out
    }

    /// The diagnostics of one file: its own and the project-wide ones that name it.
    pub(crate) fn diagnostics_of(&self, path: &Path) -> Vec<Diagnostic> {
        self.diagnostics_with(path, &self.project.diagnostics())
    }

    /// [`Self::diagnostics_of`] with the project-wide diagnostics already computed: they walk every
    /// module, so a publish to every open document computes them once.
    fn diagnostics_with(&self, path: &Path, project: &[Diagnostic]) -> Vec<Diagnostic> {
        let file = self.project.display_name(path);
        let mut out = self.module_diagnostics.get(path).cloned().unwrap_or_default();
        out.extend(project.iter().filter(|diagnostic| diagnostic.file == file).cloned());
        if let Some(compiled) = self.components.get(path) {
            out.extend(compiled.project_diagnostics(&self.project, &file, project));
        }
        out
    }

    fn publish_all(&mut self) -> Vec<Notification> {
        let project = self.project.diagnostics();
        let out: Vec<Notification> = self
            .documents
            .iter()
            .map(|(path, text)| {
                let index = LineIndex::new(text);
                let diagnostics = self.diagnostics_with(path, &project);
                publish(path, diagnostics.iter().map(|diagnostic| to_lsp(diagnostic, &index)).collect())
            })
            .collect();
        self.published.extend(self.documents.keys().cloned());
        out
    }
}

fn publish(path: &Path, diagnostics: Vec<lsp_types::Diagnostic>) -> Notification {
    Notification::new(
        PublishDiagnostics::METHOD.to_owned(),
        PublishDiagnosticsParams { uri: path_to_uri(path), diagnostics, version: None },
    )
}

/// An engine diagnostic as LSP shows it; the help lines follow the message, which every client
/// displays (related information is not shown by all of them).
pub(crate) fn to_lsp(diagnostic: &Diagnostic, index: &LineIndex<'_>) -> lsp_types::Diagnostic {
    let mut message = diagnostic.message.clone();
    for help in &diagnostic.help {
        message.push_str("\nhelp: ");
        message.push_str(help);
    }
    lsp_types::Diagnostic {
        range: index.range(diagnostic.span.start as usize, diagnostic.span.end as usize),
        severity: Some(match diagnostic.severity {
            Severity::Error => DiagnosticSeverity::ERROR,
            Severity::Warning => DiagnosticSeverity::WARNING,
            Severity::Info => DiagnosticSeverity::INFORMATION,
        }),
        code: Some(NumberOrString::String(diagnostic.code.name().to_owned())),
        source: Some("kirana".to_owned()),
        message,
        data: Some(json!({ "code": diagnostic.code.code(), "help": diagnostic.help })),
        ..lsp_types::Diagnostic::default()
    }
}

/// Reads `textDocument.uri` and `position` from request parameters; returns the path, its text and
/// the cursor's byte offset.
pub(crate) fn document_position(server: &Server, params: &Value) -> Result<(PathBuf, String, usize), String> {
    let (path, text) = document(server, params)?;
    let position: lsp_types::Position =
        serde_json::from_value(params.get("position").cloned().unwrap_or_default()).map_err(|e| e.to_string())?;
    let offset = LineIndex::new(&text).offset(position);
    Ok((path, text, offset))
}

/// Reads `textDocument.uri` from request parameters; returns the path and its current text.
pub(crate) fn document(server: &Server, params: &Value) -> Result<(PathBuf, String), String> {
    let uri: lsp_types::Uri = serde_json::from_value(params.pointer("/textDocument/uri").cloned().unwrap_or_default())
        .map_err(|error| error.to_string())?;
    let path = uri_to_path(&uri).ok_or("not a file URI")?;
    let text = server.source(&path).ok_or_else(|| format!("cannot read {}", path.display()))?;
    Ok((path, text))
}

/// Test support: the untruncated summary of the site starting at byte `start` of `path`.
#[doc(hidden)]
pub fn summary_of_document(server: &Server, path: &Path, start: usize) -> String {
    let sites = server.sites(path);
    let span = sites.iter().map(|site| (site.span.start, site.span.end)).find(|span| span.0 as usize == start);
    span.map_or_else(String::new, |span| summary::summarize(&hover::atoms_of(&sites, span), usize::MAX))
}
