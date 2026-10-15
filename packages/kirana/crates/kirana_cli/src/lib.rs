//! The `kirana-style` command line ([12-tooling-and-dx](../../../../spec/12-tooling-and-dx.md)).
//! The binary is shipped through the native addon (`runCli`), so one artifact serves the bundler
//! adapters and the command line.

mod analyze;
mod report;

use std::collections::BTreeSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use clap::{Parser, Subcommand, ValueEnum};
use kirana_diagnostics::{Diagnostic, Severity, render_github, render_human, render_json};
use kirana_project::Project;
pub use kirana_project::plain_path;
use kirana_shared::OsFs;

#[derive(Parser, Debug)]
#[command(name = "kirana-style", version, about = "Styling, compiled.")]
struct Cli {
    /// Resolved configuration as JSON (the Driver loads kirana.config.* and passes it here).
    #[arg(long, global = true, default_value = "{}")]
    config_json: String,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Compile files and directories and write the stylesheet.
    Build {
        paths: Vec<PathBuf>,
        /// Where to write the stylesheet.
        #[arg(long)]
        out: PathBuf,
        /// Write minified CSS.
        #[arg(long)]
        minify: bool,
    },
    /// Report diagnostics without writing anything.
    Check {
        paths: Vec<PathBuf>,
        #[arg(long, value_enum, default_value_t = Format::Human)]
        format: Format,
        /// Fail when more than this many warnings are reported, as when an error is.
        #[arg(long)]
        max_warnings: Option<usize>,
        /// Also report how much work the engine did (E-02, KRN-PERF-002).
        #[arg(long)]
        stats: bool,
    },
    /// Report what the stylesheet holds and why: atoms and reuse, bytes by layer and by module,
    /// runtime values and recipes, themes, unproven relation reads, tokens nothing reads.
    Analyze {
        paths: Vec<PathBuf>,
        /// Print JSON instead of the summary.
        #[arg(long, conflicts_with = "html")]
        json: bool,
        /// Write a self-contained HTML report to this file.
        #[arg(long)]
        html: Option<PathBuf>,
    },
    /// Describe the design system as JSON: tokens, themes, recipes, relations and named definitions,
    /// each with the file that declares it (KRN-DX-011).
    Export {
        /// Sources to read; the project root when none are given.
        paths: Vec<PathBuf>,
        /// Write the JSON to this file instead of printing it.
        #[arg(long)]
        out: Option<PathBuf>,
    },
    /// What a bug report needs from the engine, as JSON (`kirana-style doctor --report` runs it).
    #[command(hide = true)]
    Report {
        /// Sources to compile; the project root when none are given.
        paths: Vec<PathBuf>,
    },
    /// Explain which value wins for a property at `file:line`.
    Trace { location: String, property: String },
    /// Start the language server on stdin/stdout (KRN-DX-001); editors run it, people rarely do.
    Lsp,
    /// Rewrite sources from another styling system (KRN-API-013).
    Migrate {
        #[command(subcommand)]
        from: From,
    },
}

/// How `kirana-style check` prints its diagnostics.
#[derive(ValueEnum, Clone, Copy, Debug, PartialEq, Eq)]
enum Format {
    /// For a terminal, with the source line.
    Human,
    /// One JSON array.
    Json,
    /// GitHub Actions workflow commands, which annotate the pull request's files.
    Github,
}

#[derive(Subcommand, Debug)]
enum From {
    /// Rewrite StyleX sources. Prints a diff and a report; `--write` applies it.
    Stylex {
        paths: Vec<PathBuf>,
        /// Apply the rewrite instead of only showing it.
        #[arg(long)]
        write: bool,
        /// Also write the report to this file.
        #[arg(long)]
        report: Option<PathBuf>,
    },
    /// Rewrite Tailwind class strings into css() objects, with the configured utility grammar.
    /// Prints a diff and a report; `--write` applies it.
    Tailwind {
        /// Sources, and the CSS files whose `@custom-variant`s and `@utility`s they use.
        paths: Vec<PathBuf>,
        /// Apply the rewrite instead of only showing it.
        #[arg(long)]
        write: bool,
        /// Also write the report to this file.
        #[arg(long)]
        report: Option<PathBuf>,
    },
}

/// Runs the command line; returns the exit code. Output goes to `out`.
pub fn run(args: &[String], out: &mut dyn Write) -> i32 {
    let cli = match Cli::try_parse_from(args) {
        Ok(cli) => cli,
        Err(error) => {
            let _ = write!(out, "{error}");
            return if error.use_stderr() { 2 } else { 0 };
        }
    };
    let mut config: serde_json::Value = match serde_json::from_str(&cli.config_json) {
        Ok(value) => value,
        Err(error) => {
            let _ = writeln!(out, "invalid --config-json: {error}");
            return 2;
        }
    };
    if config.get("root").is_none() {
        let root = std::env::current_dir().map(|dir| dir.to_string_lossy().into_owned()).unwrap_or_default();
        config["root"] = serde_json::Value::String(root);
    }
    let project = match Project::new(&config.to_string(), Arc::new(OsFs)) {
        Ok(project) => project,
        Err(diagnostics) => {
            print_diagnostics(out, &diagnostics, Format::Human, &[]);
            return 2;
        }
    };
    match cli.command {
        // The server owns stdin and stdout, and opens its own session; `out` stays empty.
        Command::Lsp => kirana_lsp::serve_stdio(&config.to_string()),
        Command::Build { paths, out: target, minify } => {
            let (mut diagnostics, mut sources) = project.compile_paths(&paths);
            // The class map compiles its modules first, so the stylesheet holds their atoms (D-069).
            let map = project.class_map();
            // A module both in `paths` and in `classes.modules` reports once.
            for diagnostic in map.iter().flat_map(|map| &map.diagnostics) {
                if !diagnostics.contains(diagnostic) {
                    let text = fs::read_to_string(project.root().join(&diagnostic.file)).unwrap_or_default();
                    sources.push((diagnostic.file.clone(), text));
                    diagnostics.push(diagnostic.clone());
                }
            }
            print_diagnostics(out, &diagnostics, Format::Human, &sources);
            let css = project.stylesheet(minify);
            let mut writes = vec![(target, css)];
            writes.extend(map.map(|map| (map.out, map.json)));
            for (file, text) in writes {
                // The folder the file goes in (`with_file_name("")`: empty for a bare file name).
                let _ = fs::create_dir_all(file.with_file_name(""));
                if let Err(error) = fs::write(&file, text) {
                    let _ = writeln!(out, "cannot write {}: {error}", file.display());
                    return 1;
                }
            }
            exit_code(&diagnostics)
        }
        Command::Check { paths, format, max_warnings, stats } => {
            let (diagnostics, sources) = project.compile_paths(&paths);
            print_diagnostics(out, &diagnostics, format, &sources);
            if stats {
                let work = project.work();
                let share = if work.seen == 0 {
                    0.0
                } else {
                    f64::from(u32::try_from(work.prefiltered).unwrap_or(u32::MAX)) * 100.0
                        / f64::from(u32::try_from(work.seen).unwrap_or(u32::MAX))
                };
                let _ = writeln!(
                    out,
                    "{} module(s) seen, {} rejected by the prefilter ({share:.1} %), {} parsed, {} parsed for imports",
                    work.seen, work.prefiltered, work.parsed, work.resolved
                );
            }
            let warnings = diagnostics.iter().filter(|diagnostic| diagnostic.severity == Severity::Warning).count();
            match max_warnings {
                Some(max) if warnings > max => {
                    if format == Format::Human {
                        let _ = writeln!(out, "{warnings} warning(s), more than --max-warnings {max}");
                    }
                    1
                }
                _ => exit_code(&diagnostics),
            }
        }
        Command::Analyze { paths, json, html } => {
            let (diagnostics, _) = project.compile_paths(&paths);
            let analysis = project.analyze(&diagnostics);
            if json {
                let _ = writeln!(out, "{}", serde_json::to_string_pretty(&analysis).expect("serializable"));
            } else if let Some(target) = html {
                // The report is titled by the project's directory.
                let root = config["root"].as_str().unwrap_or_default();
                let name = root.rsplit(['/', '\\']).find(|part| !part.is_empty()).unwrap_or("Project");
                if let Err(error) = fs::write(&target, analyze::html(&analysis, name)) {
                    let _ = writeln!(out, "cannot write {}: {error}", target.display());
                    return 1;
                }
                let _ = writeln!(out, "wrote {}", target.display());
            } else {
                let _ = write!(out, "{}", analyze::human(&analysis));
            }
            exit_code(&diagnostics)
        }
        Command::Export { mut paths, out: target } => {
            if paths.is_empty() {
                paths.push(project.root().to_path_buf());
            }
            let (diagnostics, _) = project.compile_paths(&paths);
            let mut description = serde_json::json!({
                "schema": 1,
                "engine": env!("CARGO_PKG_VERSION"),
                "prefix": project.config().names.prefix,
            });
            let design = serde_json::to_value(project.design_system(&paths)).expect("serializable");
            description.as_object_mut().expect("an object").extend(design.as_object().expect("an object").clone());
            let text = format!("{}\n", serde_json::to_string_pretty(&description).expect("serializable"));
            match target {
                Some(file) => {
                    if let Err(error) = fs::write(&file, text) {
                        let _ = writeln!(out, "cannot write {}: {error}", file.display());
                        return 1;
                    }
                    let _ = writeln!(out, "wrote {}", file.display());
                }
                None => {
                    let _ = write!(out, "{text}");
                }
            }
            exit_code(&diagnostics)
        }
        Command::Report { mut paths } => {
            if paths.is_empty() {
                paths.push(project.root().to_path_buf());
            }
            let (diagnostics, sources) = project.compile_paths(&paths);
            let analysis = project.analyze(&diagnostics);
            let report = report::report(&diagnostics, &sources, &project.work(), &analysis);
            let _ = writeln!(out, "{}", serde_json::to_string_pretty(&report).expect("serializable"));
            0
        }
        Command::Trace { location, property } => {
            let Some((file, line)) =
                location.rsplit_once(':').and_then(|(file, line)| Some((file, line.parse::<usize>().ok()?)))
            else {
                let _ = writeln!(out, "expected <file>:<line>, got {location:?}");
                return 2;
            };
            let path = kirana_project::absolute(Path::new(file));
            let Ok(source) = fs::read_to_string(&path) else {
                let _ = writeln!(out, "cannot read {file}");
                return 2;
            };
            project.transform(&path, &source);
            // Accepts the authored spelling (`justifyContent`) as well as CSS's.
            let lines = project.trace(&path, &source, line, &kirana_shared::kebab_case(&property));
            if lines.is_empty() {
                let _ = writeln!(out, "no {property} declarations at {location}");
                return 1;
            }
            let _ = writeln!(out, "{property} at {location}");
            for (index, line) in lines.iter().enumerate() {
                let mark = if index == 0 { "✓" } else { " " };
                let _ = writeln!(
                    out,
                    "  {mark} {:<24} {:<32} {:<18} {}",
                    line.value, line.conditions, line.layer, line.reason
                );
            }
            0
        }
        Command::Migrate { from: From::Stylex { paths, write, report } } => {
            migrate_files(out, &paths, write, report.as_deref(), kirana_migrate::migrate)
        }
        Command::Migrate { from: From::Tailwind { paths, write, report } } => {
            let Some(grammar) = project.config().utilities.clone() else {
                let _ = writeln!(
                    out,
                    "kirana-style migrate tailwind needs a utility grammar: add `presets: [scales()]` from \
                     `@kirana-style/preset-scales/preset` to kirana.config, and your theme's scales under `utilities`"
                );
                return 2;
            };
            let (custom_variants, custom_utilities) = custom_declarations(&paths);
            let empty = kirana_migrate::tailwind::ProjectMap::default();
            let mut options = kirana_migrate::tailwind::Options {
                grammar: &grammar,
                custom_variants: &custom_variants,
                custom_utilities: &custom_utilities,
                project: &empty,
            };
            // First pass: which file anchors each relation, and which read it elsewhere.
            let mut relations = kirana_migrate::tailwind::ProjectMap::default();
            let mut files = Vec::new();
            for path in &paths {
                kirana_project::collect_sources(path, &mut files, kirana_project::SCRIPT_EXTENSIONS);
            }
            for file in &files {
                let source = fs::read_to_string(file).unwrap_or_default();
                let environment = kirana_migrate::environment::ProjectEnvironment { project: &project, file };
                relations.add(file, &kirana_migrate::tailwind::survey(file, &source, &options, &environment));
            }
            options.project = &relations;
            migrate_files(out, &paths, write, report.as_deref(), |file, source| {
                let environment = kirana_migrate::environment::ProjectEnvironment { project: &project, file };
                kirana_migrate::tailwind::migrate(file, source, &options, &environment)
            })
        }
    }
}

/// The project as a Tailwind migration reads it: scales imported the way `file` would import them.
/// The names of the `@custom-variant`s and `@utility`s declared in the CSS files under `paths`.
fn custom_declarations(paths: &[PathBuf]) -> (BTreeSet<String>, BTreeSet<String>) {
    let mut files = Vec::new();
    for path in paths {
        kirana_project::collect_sources(path, &mut files, &["css"]);
    }
    let (mut variants, mut utilities) = (BTreeSet::new(), BTreeSet::new());
    for file in files {
        let source = fs::read_to_string(&file).unwrap_or_default();
        for (at_rule, names) in [("@custom-variant ", &mut variants), ("@utility ", &mut utilities)] {
            for (index, _) in source.match_indices(at_rule) {
                let rest = &source[index + at_rule.len()..];
                let name: String = rest
                    .chars()
                    .take_while(|character| !character.is_whitespace() && !"({;".contains(*character))
                    .collect();
                if !name.is_empty() {
                    names.insert(name);
                }
            }
        }
    }
    (variants, utilities)
}

/// `kirana-style migrate stylex` and `kirana-style migrate tailwind`: rewrite, or show what the rewrite would be.
///
/// Nothing is written without `--write`, because a codemod over someone's source is the kind of
/// thing that should be read before it happens. The report is printed either way: it is the part a
/// person still has to do, and it is the reason the command does not simply claim success.
fn migrate_files(
    out: &mut dyn Write,
    paths: &[PathBuf],
    write: bool,
    report: Option<&Path>,
    migrate: impl Fn(&Path, &str) -> kirana_migrate::Migration,
) -> i32 {
    let mut files = Vec::new();
    for path in paths {
        kirana_project::collect_sources(path, &mut files, kirana_project::SCRIPT_EXTENSIONS);
    }
    files.sort();
    let mut notes = Vec::new();
    let mut changed = 0usize;
    for file in &files {
        let Ok(source) = fs::read_to_string(file) else {
            let _ = writeln!(out, "cannot read {}", file.display());
            continue;
        };
        let migration = migrate(file, &source);
        for note in &migration.notes {
            let (line, column) = kirana_diagnostics::line_column(&source, note.offset);
            notes.push(format!("{}:{line}:{column}: {}", file.display(), note.message));
        }
        if !migration.changed(&source) {
            continue;
        }
        changed += 1;
        let target = match &migration.rename {
            Some(name) => file.with_file_name(name),
            None => file.clone(),
        };
        if write {
            // The rename is part of applying the rewrite: written under the new name, removed
            // under the old one, and either failing is the same failure to report.
            let applied = fs::write(&target, &migration.source)
                .and_then(|()| if target == *file { Ok(()) } else { fs::remove_file(file) });
            if let Err(error) = applied {
                let _ = writeln!(out, "cannot write {}: {error}", target.display());
                return 1;
            }
        } else {
            let _ = write!(out, "{}", diff(&file.display().to_string(), &source, &migration.source));
            if target != *file {
                let _ = writeln!(out, "  rename to {}", target.display());
            }
        }
    }
    let _ = writeln!(
        out,
        "{} file(s), {changed} {}, {} report item(s)",
        files.len(),
        if write { "rewritten" } else { "to rewrite" },
        notes.len()
    );
    for note in &notes {
        let _ = writeln!(out, "  {note}");
    }
    if let Some(path) = report
        && let Err(error) = fs::write(path, notes.join("\n"))
    {
        let _ = writeln!(out, "cannot write {}: {error}", path.display());
        return 1;
    }
    0
}

/// A line diff, enough to read a codemod's change without a dependency.
///
/// Lines are matched from both ends, which is what a rewrite of this shape produces: a changed
/// region with untouched text around it.
fn diff(file: &str, before: &str, after: &str) -> String {
    let (old, new): (Vec<&str>, Vec<&str>) = (before.lines().collect(), after.lines().collect());
    let head = old.iter().zip(&new).take_while(|(a, b)| a == b).count();
    let tail = old[head..].iter().rev().zip(new[head..].iter().rev()).take_while(|(a, b)| a == b).count();
    let mut out = format!("--- {file}\n");
    for line in &old[head..old.len() - tail] {
        out.push_str(&format!("- {line}\n"));
    }
    for line in &new[head..new.len() - tail] {
        out.push_str(&format!("+ {line}\n"));
    }
    out
}

fn print_diagnostics(out: &mut dyn Write, diagnostics: &[Diagnostic], format: Format, sources: &[(String, String)]) {
    let source = |file: &str| sources.iter().find(|(name, _)| name == file).map(|(_, text)| text.as_str());
    match format {
        Format::Json => {
            let _ = writeln!(out, "{}", render_json(diagnostics));
            return;
        }
        Format::Github => {
            for diagnostic in diagnostics {
                let _ = writeln!(out, "{}", render_github(diagnostic, source(&diagnostic.file)));
            }
            return;
        }
        Format::Human => {}
    }
    for diagnostic in diagnostics {
        let _ = write!(out, "{}", render_human(diagnostic, source(&diagnostic.file)));
    }
    let errors = diagnostics.iter().filter(|diagnostic| diagnostic.severity == Severity::Error).count();
    let _ = writeln!(out, "{} diagnostic(s), {errors} error(s)", diagnostics.len());
}

fn exit_code(diagnostics: &[Diagnostic]) -> i32 {
    i32::from(diagnostics.iter().any(|diagnostic| diagnostic.severity == Severity::Error))
}
