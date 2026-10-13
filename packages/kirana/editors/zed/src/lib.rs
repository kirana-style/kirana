//! The Kirana extension for Zed (D-064): registers `kirana lsp` for TypeScript, TSX, JavaScript, and
//! Vue, Svelte and Astro components (their language extensions provide the languages), Angular
//! templates in HTML files, and server templates — Blade, ERB, Twig and HEEx (D-069).
//! The server is the project's own `node_modules/.bin/kirana`, so the editor runs the engine the
//! build does; `lsp.kirana.binary` in Zed's settings overrides it, and a `kirana` on `PATH` is the
//! last resort.

use zed_extension_api::{self as zed, LanguageServerId, Result, settings::LspSettings};

/// Where the binary comes from, in the order they are tried.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Found {
    pub command: String,
    pub args: Vec<String>,
}

/// Chooses the server command: the configured binary (with its arguments, or `lsp`), the
/// worktree's `node_modules/.bin/kirana` when it exists, else `kirana` on `PATH`.
pub fn locate(
    root: &str,
    configured: Option<(String, Option<Vec<String>>)>,
    local_exists: bool,
    on_path: Option<String>,
) -> std::result::Result<Found, String> {
    let lsp = || vec!["lsp".to_owned()];
    if let Some((command, args)) = configured {
        return Ok(Found { command, args: args.unwrap_or_else(lsp) });
    }
    if local_exists {
        return Ok(Found { command: format!("{}/node_modules/.bin/kirana", root.trim_end_matches('/')), args: lsp() });
    }
    on_path.map(|command| Found { command, args: lsp() }).ok_or_else(|| {
        "kirana not found: install @kirana-style/compiler in this project, or set lsp.kirana.binary.path".to_owned()
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
        let local = worktree.read_text_file("node_modules/.bin/kirana").is_ok();
        let found = locate(&worktree.root_path(), configured, local, worktree.which("kirana"))?;
        Ok(zed::Command { command: found.command, args: found.args, env: worktree.shell_env() })
    }
}

zed::register_extension!(Kirana);
