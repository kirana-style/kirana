//! The Kirana extension for Zed (D-064): registers `kirana-style lsp` for TypeScript, TSX, JavaScript, and
//! Vue, Svelte and Astro components (their language extensions provide the languages), Angular
//! templates in HTML files, and server templates — Blade, ERB, Twig and HEEx (D-069).
//! The server is the project's own `node_modules/.bin/kirana-style`, so the editor runs the engine
//! the build does; `lsp.kirana.binary` in Zed's settings overrides it, and a `kirana-style` on `PATH`
//! is the last resort, where an older install's `kirana`, the command's name before it was
//! `kirana-style`, is tried after it.
//!
//! Zed reads only the files it indexes, and it does not index git-ignored folders such as
//! `node_modules`, so the project's binary is found through `package.json`: a project that lists
//! `kirana-style` has it in `node_modules/.bin`.

use zed_extension_api::{self as zed, LanguageServerId, Result, serde_json, settings::LspSettings};

/// Where the binary comes from, in the order they are tried.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Found {
    pub command: String,
    pub args: Vec<String>,
}

/// The command's names, newest first: `kirana-style`, then its earlier name `kirana`.
pub const NAMES: [&str; 2] = ["kirana-style", "kirana"];

/// The package that installs the command into `node_modules/.bin`.
pub const PACKAGE: &str = "kirana-style";

/// Whether a `package.json` lists [`PACKAGE`] among its dependencies or dev dependencies.
pub fn lists_kirana(package_json: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(package_json).is_ok_and(|manifest| {
        ["dependencies", "devDependencies"].iter().any(|field| manifest[field].get(PACKAGE).is_some())
    })
}

/// Chooses the server command: the configured binary (with its arguments, or `lsp`), the
/// worktree's `node_modules/.bin/<local>` when its `package.json` lists [`PACKAGE`], else one of
/// [`NAMES`] on `PATH`.
pub fn locate(
    root: &str,
    configured: Option<(String, Option<Vec<String>>)>,
    local: Option<&str>,
    on_path: Option<String>,
) -> std::result::Result<Found, String> {
    let lsp = || vec!["lsp".to_owned()];
    if let Some((command, args)) = configured {
        return Ok(Found { command, args: args.unwrap_or_else(lsp) });
    }
    if let Some(name) = local {
        return Ok(Found { command: format!("{}/node_modules/.bin/{name}", root.trim_end_matches('/')), args: lsp() });
    }
    on_path.map(|command| Found { command, args: lsp() }).ok_or_else(|| {
        "kirana-style not found: install kirana-style in this project, or set lsp.kirana.binary.path".to_owned()
    })
}

struct Kirana;

impl zed::Extension for Kirana {
    fn new() -> Self {
        Kirana
    }

    fn language_server_command(&mut self, id: &LanguageServerId, worktree: &zed::Worktree) -> Result<zed::Command> {
        let binary = LspSettings::for_worktree(id.as_ref(), worktree).ok().and_then(|settings| settings.binary);
        let configured = binary.and_then(|binary| binary.path.map(|path| (path, binary.arguments)));
        let local =
            worktree.read_text_file("package.json").is_ok_and(|manifest| lists_kirana(&manifest)).then_some(PACKAGE);
        let on_path = NAMES.into_iter().find_map(|name| worktree.which(name));
        let found = locate(&worktree.root_path(), configured, local, on_path)?;
        Ok(zed::Command { command: found.command, args: found.args, env: worktree.shell_env() })
    }
}

zed::register_extension!(Kirana);
