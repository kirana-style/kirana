//! `kirana-style analyze` (KRN-DX-008): what a compiled project puts in its stylesheet and why — atoms and
//! how often they are reused, bytes by layer and by module, values bridged to runtime, recipes
//! resolved at runtime, themes, relation reads no anchor proves and tokens nothing reads.
//!
//! Everything here is read from the session after `compile_paths`, so the report describes exactly
//! the stylesheet the build writes.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use kirana_diagnostics::{Code, Diagnostic, line_column};
use kirana_ir::{Atom, Dep};
use serde::Serialize;

use crate::Project;

/// How many atoms a project reuses, and how often.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Analysis {
    /// Modules that contribute to the stylesheet: atoms, or definitions such as tokens and themes.
    pub modules: usize,
    /// Style sites: `css()` calls, `sx` values and recipes.
    pub sites: usize,
    /// Distinct atoms the sites apply.
    pub atoms: usize,
    /// The minified stylesheet's size.
    pub bytes: usize,
    pub layers: Vec<LayerSize>,
    /// Atoms by how many sites apply them: `1`, `2–4`, `5–9`, `10+`.
    pub reuse: Vec<ReuseBucket>,
    /// The ten atoms the most sites apply.
    pub most_reused: Vec<AtomUse>,
    /// Modules with atoms, by the bytes of their atoms, largest first.
    pub by_module: Vec<ModuleSize>,
    /// Values set at runtime through a custom property (`dynamic-bridged`).
    pub bridged: Vec<Finding>,
    /// Recipe variants chosen at runtime (`dynamic-variant`).
    pub runtime_recipes: Vec<Finding>,
    /// Themes, and the tokens each one overrides.
    pub themes: Vec<ThemeUse>,
    /// Relations read where no compiled module applies the anchor.
    pub unproven_reads: Vec<UnprovenRead>,
    /// Variable tokens declared in the project (not in a package outside it) that no atom, theme or
    /// other token reads.
    pub unused_tokens: Vec<UnusedToken>,
}

/// One block of the stylesheet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LayerSize {
    /// `kirana.atoms`, `kirana.contextual`, `kirana.themes`, `kirana.tokens`, `@property`, or
    /// `order` for the layer statements.
    pub layer: String,
    pub bytes: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ReuseBucket {
    pub sites: &'static str,
    pub atoms: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AtomUse {
    pub class: String,
    /// `property: value`, with its conditions and target when it has them.
    pub declaration: String,
    pub sites: usize,
    pub modules: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ModuleSize {
    pub file: String,
    pub sites: usize,
    pub atoms: usize,
    /// Each atom's rule written alone, minified. Rules sharing a declaration are merged in the
    /// stylesheet, so the stylesheet is smaller than the sum over modules.
    pub bytes: usize,
    /// Of those, the bytes of atoms no other module applies: what removing the module saves.
    pub exclusive: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Finding {
    pub file: String,
    pub line: usize,
    pub column: usize,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ThemeUse {
    pub class: String,
    /// Token identities, or the custom property where no compiled module declares the token.
    pub overrides: Vec<String>,
    /// The modules that declare or apply it.
    pub files: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UnprovenRead {
    pub relation: String,
    pub read_in: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UnusedToken {
    pub identity: String,
    pub file: String,
}

const BUCKETS: [(&str, usize, usize); 4] = [("1", 1, 1), ("2–4", 2, 4), ("5–9", 5, 9), ("10+", 10, usize::MAX)];

impl Project {
    /// The analysis of every module compiled so far. `diagnostics` are the ones the compile
    /// returned; the bridged values and runtime recipes are read from them.
    pub fn analyze(&self, diagnostics: &[Diagnostic]) -> Analysis {
        let css = self.stylesheet(true);
        let relations = self.relations();
        let tokens = self.tokens();
        let state = self.state.read().expect("not poisoned");
        let names: BTreeMap<&str, &str> =
            state.relations.iter().map(|(marker, (name, _))| (marker.as_str(), name.as_str())).collect();
        let mut paths: Vec<&PathBuf> = state.modules.keys().filter(|path| !state.modules[*path].is_empty()).collect();
        paths.sort();

        // Every site's atoms, counted by class: how many sites apply it, from how many modules.
        let mut atoms: BTreeMap<String, Atom> = BTreeMap::new();
        let mut uses: BTreeMap<String, (usize, BTreeSet<&PathBuf>)> = BTreeMap::new();
        let mut sites = 0;
        let mut read = BTreeSet::new();
        let mut themes: BTreeMap<String, (Vec<String>, BTreeSet<String>)> = BTreeMap::new();
        for path in &paths {
            let record = &state.modules[*path];
            for (_, handle) in &record.handles {
                sites += 1;
                handle.marker_deps.iter().for_each(|dep| reads(dep, &mut read));
                // A handle's atoms are distinct, so each counts this site once.
                for atom in Atom::from_handle(&self.names, handle) {
                    let entry = uses.entry(atom.class.clone()).or_default();
                    entry.0 += 1;
                    entry.1.insert(path);
                    atoms.entry(atom.class.clone()).or_insert(atom);
                }
            }
            for atom in &record.atoms {
                atom.value.deps.iter().for_each(|dep| reads(dep, &mut read));
            }
            // A module's own marker deps are what it declares (its tokens are written to `:root`), not
            // what it reads; reads are the values its atoms use and the themes its sites apply.
            for dep in &record.marker_deps {
                if let Dep::Theme(theme) = dep {
                    let overrides = theme
                        .declarations
                        .iter()
                        .map(|(variable, _)| {
                            state.tokens.get(variable).map_or(variable, |token| &token.identity).clone()
                        })
                        .collect();
                    themes
                        .entry(theme.class.clone())
                        .or_insert((overrides, BTreeSet::new()))
                        .1
                        .insert(self.display_name(path));
                }
            }
        }

        let rule_bytes: BTreeMap<&str, usize> =
            atoms.iter().map(|(class, atom)| (class.as_str(), kirana_emit::atom_rule(atom, true).len())).collect();
        let reuse = BUCKETS
            .iter()
            .map(|(label, low, high)| ReuseBucket {
                sites: label,
                atoms: uses.values().filter(|(count, _)| (low..=high).contains(&count)).count(),
            })
            .collect();
        let mut most_reused: Vec<AtomUse> = uses
            .iter()
            .filter(|(_, (count, _))| *count > 1)
            .map(|(class, (count, modules))| AtomUse {
                class: class.clone(),
                declaration: declaration(&crate::inspect::site_atom(&atoms[class], 0, &names)),
                sites: *count,
                modules: modules.len(),
            })
            .collect();
        most_reused.sort_by(|a, b| b.sites.cmp(&a.sites).then(b.modules.cmp(&a.modules)).then(a.class.cmp(&b.class)));
        most_reused.truncate(10);

        let mut by_module: Vec<ModuleSize> = paths
            .iter()
            .filter(|path| !state.modules[**path].atoms.is_empty())
            .map(|path| {
                let record = &state.modules[*path];
                let size = |atom: &&Atom| rule_bytes.get(atom.class.as_str()).copied().unwrap_or(0);
                ModuleSize {
                    file: self.display_name(path),
                    sites: record.handles.len(),
                    atoms: record.atoms.len(),
                    bytes: record.atoms.iter().map(|atom| size(&atom)).sum(),
                    exclusive: record
                        .atoms
                        .iter()
                        .filter(|atom| uses.get(&atom.class).is_none_or(|(_, modules)| modules.len() == 1))
                        .map(|atom| size(&atom))
                        .sum(),
                }
            })
            .collect();
        by_module.sort_by(|a, b| b.bytes.cmp(&a.bytes).then(a.file.cmp(&b.file)));

        Analysis {
            modules: paths.len(),
            sites,
            atoms: atoms.len(),
            bytes: css.len(),
            layers: layer_sizes(&css),
            reuse,
            most_reused,
            by_module,
            bridged: self.findings(diagnostics, Code::DynamicBridged),
            runtime_recipes: self.findings(diagnostics, Code::DynamicVariant),
            themes: themes
                .into_iter()
                .map(|(class, (overrides, files))| ThemeUse { class, overrides, files: files.into_iter().collect() })
                .collect(),
            unproven_reads: relations
                .into_iter()
                .filter(|relation| relation.anchored_in.is_empty() && !relation.read_in.is_empty())
                .map(|relation| UnprovenRead { relation: relation.name, read_in: relation.read_in })
                .collect(),
            unused_tokens: tokens
                .into_iter()
                // Only the project's own: a shared package's tokens serve other projects too.
                .filter(|token| {
                    token.variable && !read.contains(&token.identity) && !Path::new(&token.file).is_absolute()
                })
                .map(|token| UnusedToken { identity: token.identity, file: token.file })
                .collect(),
        }
    }

    fn findings(&self, diagnostics: &[Diagnostic], code: Code) -> Vec<Finding> {
        let mut sources: BTreeMap<&str, String> = BTreeMap::new();
        diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == code)
            .map(|diagnostic| {
                let source = sources
                    .entry(&diagnostic.file)
                    .or_insert_with(|| self.fs.read_to_string(&self.root.join(&diagnostic.file)).unwrap_or_default());
                let (line, column) = line_column(source, diagnostic.span.start);
                Finding { file: diagnostic.file.clone(), line, column, message: diagnostic.message.clone() }
            })
            .collect()
    }
}

/// The identities of every token `dep` reads, through other tokens and themes.
fn reads(dep: &Dep, out: &mut BTreeSet<String>) {
    let inner = match dep {
        Dep::Token(token) => {
            out.insert(token.identity.clone());
            &token.deps
        }
        Dep::Theme(theme) => &theme.deps,
        Dep::Keyframes(frames) => &frames.deps,
        Dep::PositionTry(fallback) => &fallback.deps,
        Dep::ViewTransition(transition) => &transition.deps,
        Dep::CounterStyle(style) => &style.deps,
    };
    inner.iter().for_each(|dep| reads(dep, out));
}

/// `property: value`, then its target and conditions.
fn declaration(atom: &crate::SiteAtom) -> String {
    let mut out = format!("{}: {}", atom.property, atom.value);
    if !atom.target.is_empty() {
        out.push_str(&format!(" on {}", atom.target));
    }
    if !atom.conditions.is_empty() {
        out.push_str(&format!(" when {}", atom.conditions.join(" and ")));
    }
    out
}

/// The bytes of each top-level block of a stylesheet, by layer; strings are skipped so a brace in
/// `content` does not end a block.
pub fn layer_sizes(css: &str) -> Vec<LayerSize> {
    let mut sizes: Vec<LayerSize> = Vec::new();
    let bytes = css.as_bytes();
    let (mut start, mut depth, mut quote) = (0, 0usize, None);
    for (index, &byte) in bytes.iter().enumerate() {
        match (quote, byte) {
            (Some(open), _) if byte == open && bytes[index - 1] != b'\\' => quote = None,
            (Some(_), _) => {}
            (None, b'"' | b'\'') => quote = Some(byte),
            (None, b'{') => depth += 1,
            (None, b'}') => depth = depth.saturating_sub(1),
            _ => {}
        }
        let ends = quote.is_none() && ((byte == b'}' && depth == 0) || (byte == b';' && depth == 0));
        if !ends {
            continue;
        }
        let block = css[start..=index].trim();
        let layer = if block.starts_with("@property") {
            "@property".to_owned()
        } else if byte == b';' {
            "order".to_owned()
        } else {
            block.trim_start_matches("@layer").split('{').next().unwrap_or_default().trim().to_owned()
        };
        match sizes.iter_mut().find(|size| size.layer == layer) {
            Some(size) => size.bytes += block.len(),
            None => sizes.push(LayerSize { layer, bytes: block.len() }),
        }
        start = index + 1;
    }
    sizes
}
