//! `kirana-style analyze`'s three renderings of [`Analysis`]: a terminal summary, JSON, and one
//! self-contained HTML page.

use kirana_project::{Analysis, Finding};

/// The terminal summary.
pub fn human(analysis: &Analysis) -> String {
    let mut out = format!(
        "{} module(s), {} site(s), {} atom(s), {} stylesheet\n",
        analysis.modules,
        analysis.sites,
        analysis.atoms,
        size(analysis.bytes)
    );
    out.push_str("\nStylesheet by layer\n");
    for layer in &analysis.layers {
        out.push_str(&format!("  {:<20} {:>10}\n", layer.layer, size(layer.bytes)));
    }
    out.push_str("\nAtoms by the number of sites applying them\n");
    for bucket in &analysis.reuse {
        out.push_str(&format!("  {:<6} {:>6} atom(s)\n", bucket.sites, bucket.atoms));
    }
    if !analysis.most_reused.is_empty() {
        out.push_str("\nMost reused\n");
        for atom in &analysis.most_reused {
            out.push_str(&format!(
                "  {:>4} site(s) in {:>3} module(s)  {}  {}\n",
                atom.sites, atom.modules, atom.class, atom.declaration
            ));
        }
    }
    out.push_str("\nLargest modules (bytes of their rules, and of rules only they use)\n");
    for module in analysis.by_module.iter().take(10) {
        out.push_str(&format!(
            "  {:>10} {:>10} exclusive  {}\n",
            size(module.bytes),
            size(module.exclusive),
            module.file
        ));
    }
    section(&mut out, "Values bridged to runtime (dynamic-bridged)", &analysis.bridged);
    section(&mut out, "Recipes resolved at runtime (dynamic-variant)", &analysis.runtime_recipes);
    if !analysis.themes.is_empty() {
        out.push_str(&format!("\nThemes ({})\n", analysis.themes.len()));
        for theme in analysis.themes.iter().take(LIMIT) {
            out.push_str(&format!(
                "  {}  overrides {}  in {}\n",
                theme.class,
                theme.overrides.join(", "),
                theme.files.join(", ")
            ));
        }
        more(&mut out, analysis.themes.len());
    }
    if !analysis.unproven_reads.is_empty() {
        out.push_str(&format!("\nRelation reads without an anchor ({})\n", analysis.unproven_reads.len()));
        for read in analysis.unproven_reads.iter().take(LIMIT) {
            out.push_str(&format!("  {}  read in {}\n", read.relation, read.read_in.join(", ")));
        }
        more(&mut out, analysis.unproven_reads.len());
    }
    if !analysis.unused_tokens.is_empty() {
        out.push_str(&format!("\nTokens nothing reads ({})\n", analysis.unused_tokens.len()));
        for token in analysis.unused_tokens.iter().take(LIMIT) {
            out.push_str(&format!("  {}  {}\n", token.identity, token.file));
        }
        more(&mut out, analysis.unused_tokens.len());
    }
    out
}

fn section(out: &mut String, title: &str, findings: &[Finding]) {
    if findings.is_empty() {
        return;
    }
    out.push_str(&format!("\n{title} ({})\n", findings.len()));
    for finding in findings.iter().take(LIMIT) {
        out.push_str(&format!("  {}:{}:{}  {}\n", finding.file, finding.line, finding.column, finding.message));
    }
    more(out, findings.len());
}

/// How many entries a terminal list shows; `--json` and `--html` show all.
const LIMIT: usize = 20;

fn more(out: &mut String, count: usize) {
    if count > LIMIT {
        out.push_str(&format!("  … and {} more (--json or --html for all)\n", count - LIMIT));
    }
}

/// `1234` → `1.2 kB`.
fn size(bytes: usize) -> String {
    if bytes < 1000 { format!("{bytes} B") } else { format!("{:.1} kB", bytes as f64 / 1000.0) }
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// A page with no external requests, readable in light and dark.
pub fn html(analysis: &Analysis, project: &str) -> String {
    let mut body = String::new();
    let stats = [
        ("Modules", analysis.modules.to_string()),
        ("Sites", analysis.sites.to_string()),
        ("Atoms", analysis.atoms.to_string()),
        ("Stylesheet", size(analysis.bytes)),
    ];
    body.push_str("<div class=\"cells\">");
    for (label, value) in stats {
        body.push_str(&format!("<div><span>{label}</span><b>{value}</b></div>"));
    }
    body.push_str("</div>");

    let total = analysis.layers.iter().map(|layer| layer.bytes).sum::<usize>().max(1);
    body.push_str("<h2>Stylesheet by layer</h2><div class=\"bar\">");
    for (index, layer) in analysis.layers.iter().enumerate() {
        body.push_str(&format!(
            "<i class=\"c{}\" style=\"flex:{}\" title=\"{} · {}\"></i>",
            index % 6,
            layer.bytes,
            escape(&layer.layer),
            size(layer.bytes)
        ));
    }
    body.push_str("</div><div class=\"scroll\"><table>");
    for (index, layer) in analysis.layers.iter().enumerate() {
        body.push_str(&format!(
            "<tr><td><i class=\"dot c{}\"></i>{}</td><td>{}</td><td>{:.0} %</td></tr>",
            index % 6,
            escape(&layer.layer),
            size(layer.bytes),
            layer.bytes as f64 * 100.0 / total as f64
        ));
    }
    body.push_str("</table></div>");

    let most = analysis.reuse.iter().map(|bucket| bucket.atoms).max().unwrap_or(0).max(1);
    body.push_str("<h2>Atoms by the number of sites applying them</h2><div class=\"scroll\"><table>");
    for bucket in &analysis.reuse {
        body.push_str(&format!(
            "<tr><td>{}</td><td class=\"wide\"><i class=\"meter\" style=\"width:{:.1}%\"></i></td><td>{}</td></tr>",
            bucket.sites,
            bucket.atoms as f64 * 100.0 / most as f64,
            bucket.atoms
        ));
    }
    body.push_str("</table></div>");

    table(
        &mut body,
        "Most reused atoms",
        &["Sites", "Modules", "Class", "Declaration"],
        analysis.most_reused.iter().map(|atom| {
            vec![atom.sites.to_string(), atom.modules.to_string(), code(&atom.class), escape(&atom.declaration)]
        }),
    );
    table(
        &mut body,
        "Modules",
        &["Module", "Sites", "Atoms", "Bytes", "Only here"],
        analysis.by_module.iter().map(|module| {
            vec![
                code(&module.file),
                module.sites.to_string(),
                module.atoms.to_string(),
                size(module.bytes),
                size(module.exclusive),
            ]
        }),
    );
    for (title, findings) in
        [("Values bridged to runtime", &analysis.bridged), ("Recipes resolved at runtime", &analysis.runtime_recipes)]
    {
        table(
            &mut body,
            title,
            &["Where", "What"],
            findings.iter().map(|finding| {
                vec![code(&format!("{}:{}:{}", finding.file, finding.line, finding.column)), escape(&finding.message)]
            }),
        );
    }
    table(
        &mut body,
        "Themes",
        &["Class", "Overrides", "Declared or applied in"],
        analysis.themes.iter().map(|theme| {
            vec![code(&theme.class), escape(&theme.overrides.join(", ")), escape(&theme.files.join(", "))]
        }),
    );
    table(
        &mut body,
        "Relation reads without an anchor",
        &["Relation", "Read in"],
        analysis.unproven_reads.iter().map(|read| vec![code(&read.relation), escape(&read.read_in.join(", "))]),
    );
    table(
        &mut body,
        "Tokens nothing reads",
        &["Token", "Declared in"],
        analysis.unused_tokens.iter().map(|token| vec![code(&token.identity), code(&token.file)]),
    );
    format!(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" \
         content=\"width=device-width,initial-scale=1\"><title>Kirana analysis</title><style>{STYLE}</style></head>\
         <body><main><p class=\"eyebrow\">kirana-style analyze</p><h1>{}</h1>{body}</main></body></html>\n",
        escape(project)
    )
}

fn code(text: &str) -> String {
    format!("<code>{}</code>", escape(text))
}

/// A section with a table, or a line saying there is nothing in it.
fn table(body: &mut String, title: &str, head: &[&str], rows: impl Iterator<Item = Vec<String>>) {
    let rows: Vec<Vec<String>> = rows.collect();
    body.push_str(&format!("<h2>{title} <small>{}</small></h2>", rows.len()));
    if rows.is_empty() {
        body.push_str("<p class=\"none\">None.</p>");
        return;
    }
    body.push_str("<div class=\"scroll\"><table><tr>");
    for cell in head {
        body.push_str(&format!("<th>{cell}</th>"));
    }
    body.push_str("</tr>");
    for row in rows {
        body.push_str("<tr>");
        for cell in row {
            body.push_str(&format!("<td>{cell}</td>"));
        }
        body.push_str("</tr>");
    }
    body.push_str("</table></div>");
}

const STYLE: &str = ":root{color-scheme:light dark;--bg:light-dark(#fbfaf8,#141413);--fg:light-dark(#1d1c1a,#ecebe8);\
--muted:light-dark(#6b6862,#a19e97);--line:light-dark(#e4e1db,#2e2d2a);--card:light-dark(#fff,#1b1a19);\
--c0:light-dark(#2f6fde,#6b9cf0);--c1:light-dark(#1f9d6b,#4cc795);--c2:light-dark(#d9822b,#f0a35c);\
--c3:light-dark(#8a5cd6,#b08ef0);--c4:light-dark(#1c9fb5,#53c6d9);--c5:light-dark(#b8961c,#dcbd4a)}\
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}\
main{max-width:960px;margin:0 auto;padding:40px 16px}h1{margin:0 0 24px;font-size:28px}\
h2{margin:36px 0 12px;font-size:16px}h2 small{color:var(--muted);font-weight:400}\
.eyebrow{margin:0;color:var(--muted);font:12px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}\
.cells{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:var(--line);\
border:1px solid var(--line);border-radius:10px;overflow:hidden}.cells div{background:var(--card);padding:14px 16px}\
.cells span{display:block;color:var(--muted);font-size:12px}.cells b{font-size:22px}\
.bar{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px;margin-bottom:8px}\
.c0{background:var(--c0)}.c1{background:var(--c1)}.c2{background:var(--c2)}.c3{background:var(--c3)}\
.c4{background:var(--c4)}.c5{background:var(--c5)}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}\
.scroll{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow-x:auto}\
table{width:100%;border-collapse:collapse}tr{border-top:1px solid var(--line)}tr:first-child{border-top:0}\
th{text-align:left;color:var(--muted);font-weight:500;font-size:12px}th,td{padding:8px 12px;vertical-align:top}\
td.wide{width:100%}.meter{display:block;height:8px;border-radius:4px;background:var(--c0)}\
code{font:12px ui-monospace,monospace;overflow-wrap:anywhere}.none{color:var(--muted)}";
