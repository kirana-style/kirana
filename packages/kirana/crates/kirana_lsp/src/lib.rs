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
use std::time::Duration;

use kirana_diagnostics::{Diagnostic, Severity};
use kirana_project::{Project, Site, TraceLine};
use kirana_shared::{FxHashMap, OsFs};
use lsp_server::{Connection, ErrorCode, Message, Notification, Request, Response};
use lsp_types::notification::{
    DidChangeTextDocument, DidChangeWatchedFiles, DidCloseTextDocument, DidOpenTextDocument, Exit, Notification as _,
    PublishDiagnostics,
};
use lsp_types::request::{
    CodeActionRequest, CodeLensRequest, ColorPresentationRequest, Completion, DocumentColor, DocumentHighlightRequest,
    DocumentSymbolRequest, ExecuteCommand, FoldingRangeRequest, GotoDefinition, HoverRequest, InlayHintRequest,
    InlayHintResolveRequest, References, Request as _, Shutdown, WorkspaceSymbolRequest,
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

/// What a client may turn on or off (`initializationOptions`); the summary and the code lens default
/// to on, the client capabilities to off (KRN-DX-004).
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
    components: FxHashMap<PathBuf, component::Compiled>,
    /// The component each block module belongs to, by module id: kept in step with `components`,
    /// so an origin's owner is one lookup, not a walk over every component (a hover on a shared
    /// declaration asks for thousands of origins).
    owners: FxHashMap<PathBuf, PathBuf>,
    /// Documents diagnostics were published for, to clear them when they close.
    published: BTreeSet<PathBuf>,
    /// Each file's sites as last asked for, with the project revision and the components'
    /// generation they were built at: a request asks for a document's sites several times, and a
    /// "used by" count for thousands of files', while nothing changed.
    sites: std::cell::RefCell<FxHashMap<PathBuf, CachedSites>>,
    /// Moves on whenever `components` changes, which changes a component's sites.
    generation: u64,
    /// Whether a message since the last publish may have changed the documents' diagnostics.
    publish_needed: bool,
}

/// What a notification sends back around the diagnostics it may have changed: the notifications
/// before that publish (a restart), and after it (a closed document's cleared diagnostics).
#[derive(Default)]
struct Handled {
    before: Vec<Notification>,
    after: Vec<Notification>,
}

/// A file's sites, with the project revision and the components' generation they were built at.
type CachedSites = (u64, u64, Arc<Vec<Site>>);

/// How many files' sites the server keeps before the cache starts over.
const SITES_KEPT: usize = 4096;

/// How long the server waits after its last work before it tells its host it is idle (D-123): an
/// editor sends a change per keystroke, so a second without a message is a pause.
pub const IDLE_AFTER: Duration = Duration::from_secs(1);

/// What a host does once the server has been idle for the duration given, after indexing the
/// workspace or handling a message (D-123): the Node-API binding gives back the memory the native
/// engine's allocator holds free. The server itself knows nothing of the allocator.
pub type Idle<'a> = Option<(Duration, &'a dyn Fn())>;

/// Runs the server on stdin/stdout until the client shuts it down; returns the exit code.
pub fn serve_stdio(config_json: &str, idle: Idle) -> i32 {
    let (connection, threads) = Connection::stdio();
    let result = serve(&connection, config_json, idle);
    drop(connection);
    let _ = threads.join();
    match result {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("kirana-style lsp: {error}");
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

/// Runs the server over `connection` until the client shuts it down, calling `idle` once each time
/// the client pauses after the workspace's index or a message.
pub fn serve(connection: &Connection, config_json: &str, idle: Idle) -> Result<(), String> {
    let params = connection.initialize(capabilities()).map_err(|error| error.to_string())?;
    let mut server = Server::start(config_json, &params)?;
    // Whether the server worked since the host last heard it was idle: indexing the workspace, on
    // every thread, is the most it ever frees at once.
    let mut busy = true;
    loop {
        // With no hook, or nothing done since the last pause, the server waits as long as it takes.
        let received = match idle.filter(|_| busy) {
            Some((after, idle)) => match connection.receiver.recv_timeout(after) {
                Err(error) if error.is_timeout() => {
                    idle();
                    busy = false;
                    continue;
                }
                received => received.ok(),
            },
            None => connection.receiver.recv().ok(),
        };
        // The client went away without `shutdown`.
        let Some(message) = received else { return Ok(()) };
        busy = true;
        // Everything the client has sent since is taken with it: the burst an editor sends per
        // keystroke is handled as one.
        let mut batch = vec![message];
        while let Ok(message) = connection.receiver.try_recv() {
            batch.push(message);
        }
        if handle_burst(&mut server, connection, batch)? || publish_when_paused(&mut server, connection)? {
            return Ok(());
        }
    }
}

/// How long the server waits for more of a burst before it publishes the diagnostics a change
/// left to publish: the hover, the hints and the lenses an editor sends a few milliseconds behind
/// a keystroke are answered first.
const PUBLISH_AFTER: Duration = Duration::from_millis(50);

/// The longest a client that never pauses keeps the diagnostics waiting.
const PUBLISH_WITHIN: Duration = Duration::from_millis(250);

/// Publishes the diagnostics the last burst left pending once the client has paused, handling
/// whatever arrives in the meantime first; `true` when the client asked the server to shut down or
/// went away.
pub fn publish_when_paused(server: &mut Server, connection: &Connection) -> Result<bool, String> {
    publish_when_paused_within(server, connection, PUBLISH_WITHIN)
}

/// [`publish_when_paused`], publishing after `within` at the latest, paused or not.
pub fn publish_when_paused_within(
    server: &mut Server,
    connection: &Connection,
    within: Duration,
) -> Result<bool, String> {
    let since = std::time::Instant::now();
    while server.publish_needed {
        let wait = PUBLISH_AFTER.min(within.saturating_sub(since.elapsed()));
        match connection.receiver.recv_timeout(wait) {
            Ok(message) => {
                let mut batch = vec![message];
                while let Ok(message) = connection.receiver.try_recv() {
                    batch.push(message);
                }
                if handle_burst(server, connection, batch)? {
                    return Ok(true);
                }
                if since.elapsed() < within {
                    continue;
                }
            }
            Err(error) if !error.is_timeout() => return Ok(true),
            Err(_) => {}
        }
        for out in server.publish_pending() {
            connection.sender.send(Message::Notification(out)).map_err(|error| error.to_string())?;
        }
    }
    Ok(false)
}

/// The method of a client's cancellation of a request it no longer wants answered.
const CANCEL: &str = "$/cancelRequest";

/// Handles the messages a client sent in one burst and publishes the diagnostics they left to
/// publish; `true` when the client asked the server to shut down.
pub fn handle_messages(server: &mut Server, connection: &Connection, batch: Vec<Message>) -> Result<bool, String> {
    if handle_burst(server, connection, batch)? {
        return Ok(true);
    }
    for out in server.publish_pending() {
        connection.sender.send(Message::Notification(out)).map_err(|error| error.to_string())?;
    }
    Ok(false)
}

/// Handles the messages a client sent in one burst, in their order, and sends what they get back;
/// `true` when the client asked the server to shut down. A request the burst also cancels is
/// answered as cancelled, without being computed: an editor cancels the hover and the lenses of a
/// line it has left. Of a document's changes only the last is applied, each carrying the whole
/// text; and the documents' diagnostics are left for [`publish_when_paused`], so the hover and the
/// hints a keystroke is followed by are answered before the project is checked again.
pub fn handle_burst(server: &mut Server, connection: &Connection, batch: Vec<Message>) -> Result<bool, String> {
    let send = |message: Message| connection.sender.send(message).map_err(|error| error.to_string());
    let cancelled: BTreeSet<lsp_server::RequestId> = batch
        .iter()
        .filter_map(|message| match message {
            Message::Notification(notification) if notification.method == CANCEL => {
                serde_json::from_value(notification.params.get("id")?.clone()).ok()
            }
            _ => None,
        })
        .collect();
    let mut last_change: BTreeMap<String, usize> = BTreeMap::new();
    for (index, message) in batch.iter().enumerate() {
        if let Message::Notification(notification) = message
            && notification.method == DidChangeTextDocument::METHOD
            && let Some(uri) = notification.params.pointer("/textDocument/uri").and_then(Value::as_str)
        {
            last_change.insert(uri.to_owned(), index);
        }
    }
    // The exit a client sends after its shutdown may already be in the burst; it is awaited on the
    // connection otherwise.
    let exit = batch.iter().position(
        |message| matches!(message, Message::Notification(notification) if notification.method == Exit::METHOD),
    );
    for (index, message) in batch.into_iter().enumerate() {
        match message {
            Message::Request(request) => {
                if request.method == Shutdown::METHOD && exit.is_some_and(|exit| exit > index) {
                    send(Message::Response(Response::new_ok(request.id, Value::Null)))?;
                    return Ok(true);
                }
                if connection.handle_shutdown(&request).map_err(|error| error.to_string())? {
                    return Ok(true);
                }
                let response = if cancelled.contains(&request.id) {
                    Response::new_err(
                        request.id,
                        ErrorCode::RequestCanceled as i32,
                        "cancelled by the client".to_owned(),
                    )
                } else {
                    respond(request.id.clone(), &request.method, || server.request(&request))
                };
                send(Message::Response(response))?;
            }
            Message::Notification(notification) => {
                let superseded = notification.method == DidChangeTextDocument::METHOD
                    && notification
                        .params
                        .pointer("/textDocument/uri")
                        .and_then(Value::as_str)
                        .is_some_and(|uri| last_change.get(uri).is_some_and(|last| *last != index));
                if notification.method == CANCEL || superseded {
                    continue;
                }
                let method = notification.method.clone();
                let Handled { before, after } = guarded(&method, || server.handle(notification)).unwrap_or_default();
                for out in before.into_iter().chain(after) {
                    send(Message::Notification(out))?;
                }
            }
            Message::Response(_) => {}
        }
    }
    Ok(false)
}

/// One request's response: its handler's, or an internal error when the handler panics.
pub fn respond(id: lsp_server::RequestId, method: &str, run: impl FnOnce() -> Response) -> Response {
    guarded(method, run).unwrap_or_else(|message| Response::new_err(id, ErrorCode::InternalError as i32, message))
}

/// Runs one message's handler, turning a panic into an error for that message alone.
///
/// The server usually runs on Node's main thread (`kirana-style lsp` through the Node-API binding), where
/// a panic cannot unwind past Node's frames and aborts the process: every feature would stop for
/// one bad answer. Caught here, the editor gets an error for that request and the server goes on.
pub fn guarded<T>(method: &str, run: impl FnOnce() -> T) -> Result<T, String> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(run)).map_err(|payload| {
        let reason = payload
            .downcast_ref::<&str>()
            .map(|reason| (*reason).to_owned())
            .or_else(|| payload.downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "unknown panic".to_owned());
        eprintln!("kirana-style lsp: {method} failed: {reason}");
        format!("kirana-style lsp: {method} failed: {reason}")
    })
}

impl Server {
    /// Opens the session and indexes the workspace, so tokens and relations declared anywhere are
    /// known before the first hover.
    pub fn start(config_json: &str, params: &Value) -> Result<Server, String> {
        Self::start_with(config_json, params, false)
    }

    /// [`Server::start`] for a host that asks in process from a thread that may not block: a browser
    /// page's main thread, where the WebAssembly engine runs the binding's `LanguageServer`. The
    /// project is indexed one file after another (`Project::compile_serially`, KF-065).
    pub fn start_serial(config_json: &str, params: &Value) -> Result<Server, String> {
        Self::start_with(config_json, params, true)
    }

    fn start_with(config_json: &str, params: &Value, serial: bool) -> Result<Server, String> {
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
        if serial {
            project.compile_serially();
        }
        // Scripts, and Vue, Svelte, Astro and Angular components, compiled once for the session.
        let indexed = project.compile_tree(std::slice::from_ref(&root));
        let mut module_diagnostics: BTreeMap<PathBuf, Vec<Diagnostic>> = BTreeMap::new();
        for diagnostic in indexed.diagnostics.into_iter().filter(|diagnostic| !diagnostic.file.is_empty()) {
            module_diagnostics.entry(root.join(&diagnostic.file)).or_default().push(diagnostic);
        }
        let mut components = FxHashMap::default();
        let mut owners = FxHashMap::default();
        for (path, modules, diagnostics) in indexed.components {
            module_diagnostics.insert(path.clone(), diagnostics);
            owners.extend(modules.iter().map(|module| (module.id.clone(), path.clone())));
            components.insert(path, component::Compiled { modules });
        }
        for (path, module, diagnostics) in indexed.angular {
            module_diagnostics.insert(path.clone(), diagnostics);
            owners.insert(module.id.clone(), path.clone());
            components.insert(path, component::Compiled { modules: vec![module] });
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
            owners,
            published: BTreeSet::new(),
            sites: std::cell::RefCell::default(),
            generation: 0,
            publish_needed: false,
        })
    }

    /// One request answered in process, for a host with no connection to the client: a browser,
    /// whose editor asks what an editor asks over stdio (KF-065). Its result, or its error's message;
    /// a panic is an error for this request alone, as over a connection.
    pub fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let request = Request::new(lsp_server::RequestId::from(0), method.to_owned(), params);
        respond(request.id.clone(), method, || self.request(&request)).response_result.map_err(|error| error.message)
    }

    /// One notification handled in process: what the server sends back (each document's
    /// `textDocument/publishDiagnostics`), as `{ method, params }` objects.
    pub fn notify(&mut self, method: &str, params: Value) -> Vec<Value> {
        let notification = Notification::new(method.to_owned(), params);
        let sent = guarded(method, || self.notification(notification)).unwrap_or_default();
        sent.into_iter().map(|out| json!({ "method": out.method, "params": out.params })).collect()
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

    /// Handles one notification; returns the notifications to send back, the documents' diagnostics
    /// among them when the notification changed what they may say.
    pub fn notification(&mut self, notification: Notification) -> Vec<Notification> {
        let Handled { before, after } = self.handle(notification);
        let mut out = before;
        out.extend(self.publish_pending());
        out.extend(after);
        out
    }

    /// The documents' diagnostics, when a message since the last publish may have changed them:
    /// project-wide diagnostics (relations, collisions) can change for every open document, and
    /// computing them walks every module, so a burst of changes publishes once, after the burst.
    pub fn publish_pending(&mut self) -> Vec<Notification> {
        if !std::mem::take(&mut self.publish_needed) {
            return Vec::new();
        }
        self.publish_all()
    }

    /// Handles one notification without publishing diagnostics; what it changed is published by
    /// `publish_pending`, between the notifications it sends before and after that publish.
    fn handle(&mut self, notification: Notification) -> Handled {
        match notification.method.as_str() {
            DidOpenTextDocument::METHOD => {
                if let Ok(params) = notification.extract::<DidOpenTextDocumentParams>(DidOpenTextDocument::METHOD) {
                    self.edit(&params.text_document.uri, params.text_document.text);
                }
                Handled::default()
            }
            DidChangeTextDocument::METHOD => {
                // Full synchronisation: the last change carries the whole text.
                if let Ok(params) = notification.extract::<DidChangeTextDocumentParams>(DidChangeTextDocument::METHOD)
                    && let Some(change) = params.content_changes.into_iter().last()
                {
                    self.edit(&params.text_document.uri, change.text);
                }
                Handled::default()
            }
            DidCloseTextDocument::METHOD => {
                let Ok(params) = notification.extract::<DidCloseTextDocumentParams>(DidCloseTextDocument::METHOD)
                else {
                    return Handled::default();
                };
                let Some(path) = uri_to_path(&params.text_document.uri) else { return Handled::default() };
                self.documents.remove(&path);
                // The module goes back to what is on disk.
                if let Ok(text) = std::fs::read_to_string(&path) {
                    self.transform(&path, &text);
                }
                self.publish_needed = true;
                // Its own diagnostics are cleared once the others are published.
                let after = if self.published.remove(&path) { vec![publish(&path, Vec::new())] } else { Vec::new() };
                Handled { before: Vec::new(), after }
            }
            DidChangeWatchedFiles::METHOD => {
                let Ok(params) = notification.extract::<DidChangeWatchedFilesParams>(DidChangeWatchedFiles::METHOD)
                else {
                    return Handled::default();
                };
                Handled { before: self.files_changed(params), after: Vec::new() }
            }
            THEME => {
                self.options.theme =
                    diagram::Theme::from_name(notification.params.get("theme").and_then(Value::as_str));
                Handled::default()
            }
            _ => Handled::default(),
        }
    }

    fn edit(&mut self, uri: &lsp_types::Uri, text: String) {
        let Some(path) = uri_to_path(uri) else { return };
        self.transform(&path, &text);
        self.documents.insert(path, text);
        // Project-wide diagnostics (relations, collisions) can change for every open document.
        self.publish_needed = true;
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
                        self.owners.remove(&module.id);
                    }
                }
            }
            self.owners.extend(compiled.modules.iter().map(|module| (module.id.clone(), path.to_path_buf())));
            self.components.insert(path.to_path_buf(), compiled);
            self.generation += 1;
            self.module_diagnostics.insert(path.to_path_buf(), diagnostics);
            return;
        }
        // An Angular `.ts` file whose template lost its last `[sx]` is a module again.
        self.forget_component(path);
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
        self.owners.get(path).cloned().unwrap_or_else(|| path.to_path_buf())
    }

    /// Drops a component from the session's own records, its block modules' owners with it; the
    /// modules themselves are the caller's to remove from the project.
    fn forget_component(&mut self, path: &Path) -> Option<component::Compiled> {
        let compiled = self.components.remove(path)?;
        self.generation += 1;
        for module in &compiled.modules {
            self.owners.remove(&module.id);
        }
        Some(compiled)
    }

    /// The style sites of a file, spans in its text: a module's from the session, a component's
    /// mapped from its blocks. Built once per file while the project and the components stand.
    pub(crate) fn sites(&self, path: &Path) -> Arc<Vec<Site>> {
        self.sites_kept(path, SITES_KEPT)
    }

    /// [`Server::sites`], keeping at most `kept` files' sites.
    fn sites_kept(&self, path: &Path, kept: usize) -> Arc<Vec<Site>> {
        let revision = self.project.revision();
        if let Some((at, generation, sites)) = self.sites.borrow().get(path)
            && (*at, *generation) == (revision, self.generation)
        {
            return sites.clone();
        }
        let sites = Arc::new(match self.components.get(path) {
            Some(compiled) => compiled.sites(&self.project),
            None => self.project.sites(path),
        });
        let mut cache = self.sites.borrow_mut();
        // A session asks about a few files at a time: past the bound the cache starts over.
        if cache.len() >= kept {
            cache.clear();
        }
        cache.insert(path.to_path_buf(), (revision, self.generation, sites.clone()));
        sites
    }

    /// The classes the site spanning `span` in `file` carries, as its atoms list them: a module's from
    /// the session, a component's from the block module whose site maps there.
    pub(crate) fn site_classes(&self, file: &Path, span: (usize, usize)) -> Vec<String> {
        match self.components.get(file) {
            Some(compiled) => compiled
                .modules
                .iter()
                .flat_map(|module| {
                    self.project.classes_at(&module.id, &|site| {
                        // An external block's own sites are in its file, not this document.
                        !(module.external && module.in_block(site)) && {
                            let mapped = module.span_to_component(site);
                            (mapped.start as usize, mapped.end as usize) == span
                        }
                    })
                })
                .collect(),
            None => self.project.classes_at(file, &|site| (site.start as usize, site.end as usize) == span),
        }
    }

    /// Where each of `classes` is produced, as `(file, span in its text, class)`: a block module's
    /// sites are reported in its component.
    pub(crate) fn origins(&self, classes: &BTreeSet<&str>) -> Vec<(PathBuf, (usize, usize), String)> {
        let mut out = Vec::new();
        // Origins come by module: one module's owner and block, found once, serve its run of origins.
        let mut current: Option<(PathBuf, PathBuf, Option<&component::Module>)> = None;
        for origin in self.project.origins(classes) {
            if current.as_ref().is_none_or(|(module, _, _)| module.as_os_str() != origin.path.as_os_str()) {
                let owner = self.owners.get(&origin.path);
                let block = owner
                    .and_then(|owner| self.components.get(owner))
                    .and_then(|compiled| compiled.modules.iter().find(|module| module.id == origin.path));
                current = Some((origin.path.clone(), owner.cloned().unwrap_or_else(|| origin.path.clone()), block));
            }
            let (_, owner, block) = current.as_ref().expect("set for this module");
            let span = block.map_or(origin.span, |block| block.span_to_component(origin.span));
            let span = (span.start as usize, span.end as usize);
            out.push((owner.clone(), span, origin.class));
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
                if let Some(compiled) = self.forget_component(&path) {
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
        self.publish_needed = true;
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

/// Test support: a file's sites with the cache bounded at `kept` files.
#[doc(hidden)]
pub fn sites_kept(server: &Server, path: &Path, kept: usize) -> Arc<Vec<Site>> {
    server.sites_kept(path, kept)
}

/// Test support: the component a module belongs to, as `origins` reports it; the path itself for
/// a module that is no component's block.
#[doc(hidden)]
pub fn owner_of(server: &Server, path: &Path) -> PathBuf {
    server.owner(path)
}

/// Test support: the untruncated summary of the site starting at byte `start` of `path`.
#[doc(hidden)]
pub fn summary_of_document(server: &Server, path: &Path, start: usize) -> String {
    let sites = server.sites(path);
    let span = sites.iter().map(|site| (site.span.start, site.span.end)).find(|span| span.0 as usize == start);
    span.map_or_else(String::new, |span| summary::summarize(&hover::atoms_of(&sites, span), usize::MAX))
}
