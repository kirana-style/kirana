//! The CSS Modules codemod behind `kirana-style migrate css-modules` (D-121, KRN-API-013).
//!
//! A CSS module becomes a module of handles beside it (`Button.module.css` → `Button.styles.ts`): one
//! exported `css()` per class, its rules lifted into conditions inside each property, a `composes`
//! as the handles the `css()` starts from, a `@keyframes` as `keyframes()`. The scripts that import
//! it read the handles: `className={styles.root}` becomes `sx={styles.root}`, a class list (a
//! template, `clsx`, `[…].join(" ")`) an `sx` array, and any other read `styleProps(…).className`,
//! the class string it was.
//!
//! What CSS decided that `sx` decides another way is reported: two classes on one element that set
//! the same property, where the file's order chose the winner and `sx` takes the list's.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use kirana_css_data::{accepts_number, is_known_property};
use oxc_ast::ast::{
    Expression, ImportDeclaration, ImportDeclarationSpecifier, JSXAttributeItem, JSXAttributeName, JSXAttributeValue,
    JSXElementName, JSXOpeningElement, LogicalExpression, ObjectPropertyKind,
};
use oxc_ast_visit::{Visit, walk};
use oxc_span::{GetSpan, Span};

use crate::css_text::{Parser, Rule, Tree, camel, is_number, js_string, one_line, split_selectors, strip_comments};
use crate::tailwind::Environment;
use crate::{Edit, Migration, Note, Piece, place};

/// The functions that join class names, whose arguments become an `sx` array.
const JOINERS: &[&str] = &["clsx", "classnames", "classNames", "cn", "cx"];

/// Names a class cannot be exported as, which get `Style` after them.
const RESERVED: &[&str] = &[
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
];

/// What a converted module holds, for the scripts that import it.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Module {
    /// Each class in the order the file first names it, with its export and the properties set.
    pub classes: Vec<Class>,
    /// The name of the module of handles, without its extension: `Button.styles`.
    pub stem: String,
}

/// One class of a CSS module.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Class {
    pub name: String,
    pub export: String,
    pub properties: BTreeSet<String>,
}

impl Module {
    /// The CSS file it was, for the report.
    fn file(&self) -> String {
        format!("{}.module.css", self.stem.trim_end_matches(".styles"))
    }

    fn class(&self, name: &str) -> Option<(usize, &Class)> {
        self.classes.iter().enumerate().find(|(_, class)| class.name == name)
    }
}

/// The converted modules of a run, by their path.
pub type Modules = BTreeMap<PathBuf, Module>;

/// Whether `path` is a CSS module, `*.module.css`.
pub fn is_module(path: &Path) -> bool {
    path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.ends_with(".module.css"))
}

/// The export a class becomes: `primary-button` as `primaryButton`, a reserved word with `Style`.
fn export_name(class: &str) -> String {
    let name = camel(class);
    if RESERVED.contains(&name.as_str()) { format!("{name}Style") } else { name }
}

/// Converts one CSS module into its module of handles, written as `.ts` when `typescript`, else `.js`.
pub fn convert(path: &Path, css: &str, typescript: bool) -> (Migration, Module) {
    let name = path.file_name().and_then(|name| name.to_str()).unwrap_or_default();
    let stem = format!("{}.styles", name.trim_end_matches(".module.css"));
    let mut converter = Converter { source: css, ..Converter::default() };
    let rules = Parser { text: css, at: 0 }.rules(false);
    converter.survey(&rules);
    converter.rules(&rules, &[], &[]);
    let source = converter.render();
    let module = Module {
        classes: converter
            .classes
            .iter()
            .map(|class| Class {
                name: class.name.clone(),
                export: export_name(&class.name),
                properties: class.properties.clone(),
            })
            .collect(),
        stem: stem.clone(),
    };
    let extension = if typescript { "ts" } else { "js" };
    let mut notes = converter.notes;
    notes.sort_by_key(|note| note.offset);
    (Migration { source, notes, rename: Some(format!("{stem}.{extension}")) }, module)
}

/// One class while its rules are read.
#[derive(Default)]
struct Rules {
    name: String,
    tree: Tree,
    composes: Vec<String>,
    properties: BTreeSet<String>,
}

/// Where a selector's declarations go: a class, the conditions on it, and the block they are in (a
/// pseudo-element's or a `select` target's).
#[derive(Clone)]
struct Target {
    class: String,
    conditions: Vec<(String, String)>,
    blocks: Vec<String>,
}

#[derive(Default)]
struct Converter<'s> {
    source: &'s str,
    notes: Vec<Note>,
    classes: Vec<Rules>,
    keyframes: Vec<(String, Tree)>,
    names: BTreeSet<String>,
    /// Handles composed from other modules, by the specifier of their module of handles.
    imports: BTreeMap<String, BTreeSet<String>>,
    comments: Vec<String>,
    used: BTreeSet<&'static str>,
}

impl Converter<'_> {
    fn note(&mut self, at: usize, message: impl Into<String>) {
        self.notes.push(Note { offset: u32::try_from(at).unwrap_or(u32::MAX), message: message.into() });
    }

    /// Leaves `text` as a comment at the end of the module, reported.
    fn unread(&mut self, at: usize, text: &str, reason: &str) {
        let text = one_line(&strip_comments(text));
        self.note(at, format!("`{text}` {reason}: port it by hand"));
        self.comments.push(text);
    }

    /// The class named `name`, added in the order the file names it.
    fn class(&mut self, name: &str) -> &mut Rules {
        let index = self.classes.iter().position(|class| class.name == name).unwrap_or_else(|| {
            self.classes.push(Rules { name: name.to_owned(), ..Rules::default() });
            self.classes.len() - 1
        });
        &mut self.classes[index]
    }

    /// The keyframes' names, so a value naming one before it is declared still reads it.
    fn survey(&mut self, rules: &[Rule]) {
        for rule in rules {
            if let Rule::Block { selector, .. } = rule
                && let Some(name) = keyframes_name(selector)
            {
                self.names.insert(name);
            }
        }
    }

    /// The rules under `parents` (each enclosing rule's selector with its target), inside the
    /// at-rule conditions of `path`.
    fn rules(&mut self, rules: &[Rule], parents: &[(String, Target)], path: &[(String, String)]) {
        for rule in rules {
            match rule {
                Rule::Declaration { property, value, at } if parents.is_empty() => {
                    self.unread(*at, &format!("{property}: {value};"), "is outside any rule");
                }
                Rule::Declaration { property, value, at } => {
                    for (_, target) in parents {
                        self.declaration(target, property, value, path, *at);
                    }
                }
                Rule::Block { selector, rules, text, at } if selector.starts_with('@') => {
                    self.at_rule(selector, rules, text, *at, parents, path);
                }
                Rule::Block { selector, rules, at, .. } => {
                    let mut inner = Vec::new();
                    for selector in nest(parents, selector) {
                        match self.target(&selector) {
                            Ok(target) => inner.push((selector, target)),
                            Err(reason) => self.unread(*at, &format!("{selector} {{ … }}"), &reason),
                        }
                    }
                    if !inner.is_empty() {
                        self.rules(rules, &inner, path);
                    }
                }
                Rule::Interpolation { at, .. } | Rule::Unread { at, .. } => {
                    let line = self.source[*at..].lines().next().unwrap_or_default().to_owned();
                    self.unread(*at, &line, "is not a rule");
                }
            }
        }
    }

    fn at_rule(
        &mut self,
        selector: &str,
        rules: &[Rule],
        text: &str,
        at: usize,
        parents: &[(String, Target)],
        path: &[(String, String)],
    ) {
        if let Some(name) = keyframes_name(selector) {
            if !parents.is_empty() || !path.is_empty() {
                return self.unread(at, text, "is a @keyframes inside another rule");
            }
            let mut frames = Tree::default();
            for rule in rules {
                let (selector, rules) = match rule {
                    Rule::Block { selector, rules, .. } => (selector, rules),
                    Rule::Declaration { at, .. } | Rule::Interpolation { at, .. } | Rule::Unread { at, .. } => {
                        let line = self.source[*at..].lines().next().unwrap_or_default().to_owned();
                        self.unread(*at, &line, "is not a frame");
                        continue;
                    }
                };
                let key = one_line(selector);
                let key = if key == "from" || key == "to" { key } else { js_string(&key) };
                let mut frame = Tree::default();
                for rule in rules {
                    match rule {
                        Rule::Declaration { property, value, at } => match self.value(property, value, *at) {
                            Ok((name, value)) => {
                                place(&mut frame.entries, (&name, &name), &[], Piece::leaf(value));
                            }
                            Err(reason) => self.unread(*at, &format!("{property}: {value};"), &reason),
                        },
                        Rule::Block { text, at, .. } => self.unread(*at, text, "is a block inside a frame"),
                        Rule::Interpolation { at, .. } | Rule::Unread { at, .. } => {
                            let line = self.source[*at..].lines().next().unwrap_or_default().to_owned();
                            self.unread(*at, &line, "is not a declaration");
                        }
                    }
                }
                frames.blocks.push((key, frame));
            }
            self.used.insert("keyframes");
            self.keyframes.push((name, frames));
            return;
        }
        match kirana_ir::parse_condition_key(selector) {
            Ok(_) => {
                let key = one_line(selector);
                let mut inner = path.to_vec();
                inner.push((key.clone(), js_string(&key)));
                self.rules(rules, parents, &inner);
            }
            Err(error) => self.unread(at, text, &format!("is not a condition Kirana takes ({error})")),
        }
    }

    /// One declaration of a rule: a `composes`, or a property placed under the rule's conditions.
    fn declaration(&mut self, target: &Target, property: &str, value: &str, path: &[(String, String)], at: usize) {
        if property == "composes" {
            if !target.conditions.is_empty() || !target.blocks.is_empty() || !path.is_empty() {
                return self.unread(at, &format!("composes: {value};"), "is not in a rule of the class alone");
            }
            return self.composes(&target.class, value, at);
        }
        match self.value(property, value, at) {
            Ok((name, value)) => {
                let mut conditions = path.to_vec();
                conditions.extend(target.conditions.iter().cloned());
                let class = self.class(&target.class);
                class.properties.insert(name.clone());
                place(&mut class.tree.at(&target.blocks).entries, (&name, &name), &conditions, Piece::leaf(value));
            }
            Err(reason) => {
                let text = format!("{property}: {value};");
                let text = one_line(&strip_comments(&text));
                self.note(at, format!("`{text}` {reason}: port it by hand"));
                self.class(&target.class).tree.at(&target.blocks).comments.push(text);
            }
        }
    }

    /// `composes: a b;` and `composes: a from "./other.module.css";`.
    fn composes(&mut self, class: &str, value: &str, at: usize) {
        let (names, from) = match value.split_once(" from ") {
            Some((names, from)) => (names, Some(from.trim().trim_matches(['"', '\'']))),
            None => (value, None),
        };
        let names: Vec<String> = names.split_whitespace().map(str::to_owned).collect();
        match from {
            None => {
                for name in &names {
                    self.class(name);
                }
                self.class(class).composes.extend(names.iter().map(|name| export_name(name)));
            }
            Some("global") => self.unread(at, &format!("composes: {value};"), "composes a global class"),
            Some(module) if module.ends_with(".module.css") => {
                let specifier = format!("{}.styles", module.trim_end_matches(".module.css"));
                let exports: Vec<String> = names.iter().map(|name| export_name(name)).collect();
                self.imports.entry(specifier).or_default().extend(exports.iter().cloned());
                self.class(class).composes.extend(exports);
            }
            Some(_) => self.unread(at, &format!("composes: {value};"), "composes from a file that is not a CSS module"),
        }
    }

    /// A property's name in Kirana and its value, as a JavaScript expression.
    fn value(&mut self, property: &str, value: &str, at: usize) -> Result<(String, String), String> {
        let kebab = property.to_ascii_lowercase();
        if kebab.starts_with("--") {
            return Err("sets a custom property: make it a token (`defineTokens` with `variable: true`) and set it with the token as a key".to_owned());
        }
        if !is_known_property(&kebab) {
            return Err("is not a property Kirana knows".to_owned());
        }
        let mut value = one_line(&strip_comments(value));
        if let Some(stripped) = value.strip_suffix("!important") {
            self.note(at, format!("`!important` on {property}: Kirana writes none, since its precedence ladder orders every rule; it was dropped, so check what it was overriding"));
            value = stripped.trim_end().to_owned();
        }
        if value.contains("url(") && !value.contains("url(data:") && !value.contains("://") {
            self.note(at, format!("a relative url() in {property}: the stylesheet Kirana writes is elsewhere, so import the file and use its URL"));
        }
        let name = camel(property);
        if is_number(&value) && accepts_number(&kebab) {
            return Ok((name, kirana_ir::number_to_string(value.parse().unwrap_or_default())));
        }
        if kebab == "animation" || kebab == "animation-name" {
            // A keyframes name is the module's own (CSS Modules scope it), now a constant.
            let mut parts = Vec::new();
            let mut named = false;
            for word in value.split(' ') {
                let bare = word.trim_end_matches(',');
                if self.names.contains(bare) {
                    named = true;
                    parts.push(format!("${{{bare}}}{}", &word[bare.len()..]));
                } else {
                    parts.push(word.replace('`', "\\`"));
                }
            }
            if named {
                return Ok((name, format!("`{}`", parts.join(" "))));
            }
        }
        Ok((name, js_string(&value)))
    }

    /// Where a selector's declarations go, or why there is nowhere.
    fn target(&mut self, selector: &str) -> Result<Target, String> {
        let compounds = compounds(selector);
        let (first, rest) = compounds.split_first().expect("a selector has a compound");
        let (classes, conditions, pseudo) = parts(&first.1)?;
        let [class] = classes.as_slice() else {
            return Err(if classes.is_empty() {
                "names no class of the module (a global rule)".to_owned()
            } else {
                "joins two classes on one element; give the combination a class of its own".to_owned()
            });
        };
        let mut target = Target { class: class.clone(), conditions: Vec::new(), blocks: Vec::new() };
        if !conditions.is_empty() {
            kirana_ir::parse_condition_key(&conditions)
                .map_err(|error| format!("is not a condition Kirana takes ({error})"))?;
            target.conditions.push((conditions.clone(), js_string(&conditions)));
        }
        match (rest, pseudo) {
            ([(_, inner)], _) if inner.is_empty() => {
                return Err("is a selector Kirana takes no condition for".to_owned());
            }
            ([], Some(pseudo)) => target.blocks.push(js_string(&pseudo)),
            ([], None) => {}
            ([(combinator @ (' ' | '>'), inner)], None) if conditions.is_empty() => {
                if inner.contains('.') {
                    return Err("styles another class of the module inside this one; give that class the style, reading this one through a relation".to_owned());
                }
                if inner.contains("::") {
                    return Err("styles a pseudo-element of a descendant".to_owned());
                }
                let method = if *combinator == '>' { "child" } else { "descendant" };
                self.used.insert("select");
                target.blocks.push(format!("[select.{method}({})]", js_string(inner)));
            }
            ([(' ' | '>', _)], None) => {
                return Err(
                    "reaches a descendant only in a state; a `select` target cannot wait for the parent's state"
                        .to_owned(),
                );
            }
            _ => return Err("is a selector Kirana takes no condition for".to_owned()),
        }
        let name = target.class.clone();
        self.class(&name);
        Ok(target)
    }

    /// The module of handles: keyframes first, then each class after the classes it composes.
    fn render(&mut self) -> String {
        let mut order = Vec::new();
        for index in 0..self.classes.len() {
            self.visit(index, &mut order, &mut BTreeSet::new());
        }
        if !self.classes.is_empty() {
            self.used.insert("css");
        }
        let names: Vec<&str> = self.used.iter().copied().collect();
        let mut out = String::new();
        if !names.is_empty() {
            out.push_str(&format!("import {{ {} }} from \"@kirana-style/core\"\n", names.join(", ")));
        }
        for (specifier, names) in &self.imports {
            let names: Vec<&str> = names.iter().map(String::as_str).collect();
            out.push_str(&format!("import {{ {} }} from {}\n", names.join(", "), js_string(specifier)));
        }
        for (name, frames) in &self.keyframes {
            out.push_str(&format!("\nexport const {name} = keyframes({})\n", frames.render(Some(""))));
        }
        for index in order {
            let class = &self.classes[index];
            let mut parts = class.composes.clone();
            if !class.tree.is_empty() {
                parts.push(class.tree.render(Some("")));
            } else if parts.is_empty() {
                parts.push("{}".to_owned());
            }
            out.push_str(&format!("\nexport const {} = css({})\n", export_name(&class.name), parts.join(", ")));
        }
        for comment in &self.comments {
            out.push_str(&format!("\n/* not migrated: {} */\n", comment.replace("*/", "*\\/")));
        }
        out
    }

    /// Puts the class at `index` in `order` after the classes of this file it composes.
    fn visit(&self, index: usize, order: &mut Vec<usize>, seen: &mut BTreeSet<usize>) {
        if order.contains(&index) || !seen.insert(index) {
            return;
        }
        for composed in &self.classes[index].composes {
            if let Some(dependency) = self.classes.iter().position(|class| export_name(&class.name) == *composed) {
                self.visit(dependency, order, seen);
            }
        }
        order.push(index);
    }
}

/// The name of a `@keyframes` rule.
fn keyframes_name(selector: &str) -> Option<String> {
    let rest = selector.strip_prefix("@keyframes").or_else(|| selector.strip_prefix("@-webkit-keyframes"))?;
    Some(rest.trim().to_owned())
}

/// A nested rule's selectors written out: `&` is each parent, and a selector without one is a
/// descendant of it, as in CSS nesting.
fn nest(parents: &[(String, Target)], selector: &str) -> Vec<String> {
    let children = split_selectors(selector);
    if parents.is_empty() {
        return children;
    }
    let mut out = Vec::new();
    for (parent, _) in parents {
        for child in &children {
            out.push(if child.contains('&') { child.replace('&', parent) } else { format!("{parent} {child}") });
        }
    }
    out
}

/// A selector's compound selectors, each with the combinator before it (`' '` for the first).
fn compounds(selector: &str) -> Vec<(char, String)> {
    let mut out: Vec<(char, String)> = Vec::new();
    let mut current = String::new();
    let mut combinator = ' ';
    let mut depth = 0usize;
    for character in selector.trim().chars() {
        match character {
            '(' | '[' => depth += 1,
            ')' | ']' => depth = depth.saturating_sub(1),
            _ => {}
        }
        if depth == 0 && (character.is_whitespace() || matches!(character, '>' | '+' | '~')) {
            if !current.is_empty() {
                out.push((combinator, std::mem::take(&mut current)));
                combinator = ' ';
            }
            if !character.is_whitespace() {
                combinator = character;
            }
            continue;
        }
        current.push(character);
    }
    out.push((combinator, current));
    out
}

/// A compound selector's classes, its pseudo-classes and attributes as one condition, and its
/// pseudo-element; an error for what a module's handle cannot hold.
fn parts(compound: &str) -> Result<(Vec<String>, String, Option<String>), String> {
    let mut classes = Vec::new();
    let mut conditions = String::new();
    let mut pseudo = None;
    let mut rest = compound;
    while let Some(first) = rest.chars().next() {
        match first {
            '.' => {
                let end = rest[1..]
                    .find(|c: char| !(c.is_alphanumeric() || c == '-' || c == '_'))
                    .map_or(rest.len(), |end| end + 1);
                classes.push(rest[1..end].to_owned());
                rest = &rest[end..];
            }
            '[' => {
                let end = rest.find(']').map_or(rest.len(), |end| end + 1);
                conditions.push_str(&rest[..end]);
                rest = &rest[end..];
            }
            ':' if rest.starts_with("::") => {
                pseudo = Some(rest.to_owned());
                rest = "";
            }
            ':' => {
                let name_end =
                    rest[1..].find(|c: char| !(c.is_alphanumeric() || c == '-')).map_or(rest.len(), |end| end + 1);
                let mut end = name_end;
                if rest[end..].starts_with('(') {
                    let mut depth = 0usize;
                    for (index, character) in rest[end..].char_indices() {
                        match character {
                            '(' => depth += 1,
                            ')' => {
                                depth -= 1;
                                if depth == 0 {
                                    end += index + 1;
                                    break;
                                }
                            }
                            _ => {}
                        }
                    }
                }
                let name = &rest[1..name_end];
                match name {
                    "global" | "local" => {
                        return Err(format!("uses `:{name}()`, which a module of handles has no counterpart for"));
                    }
                    "before" | "after" | "first-line" | "first-letter" => pseudo = Some(format!(":{}", &rest[..end])),
                    _ => conditions.push_str(&rest[..end]),
                }
                rest = &rest[end..];
            }
            _ => return Err("styles an element by its tag or id; Kirana styles what a class is on".to_owned()),
        }
    }
    Ok((classes, conditions, pseudo))
}

/// A lexical form of `path`, without `..` (`components` already leaves out a `.` after the start).
fn normal(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                out.pop();
            }
            other => out.push(other),
        }
    }
    out
}

/// Migrates a script that imports CSS modules: the imports read the modules of handles, and each
/// read of a class reads its handle. `modules` are the run's converted modules; `environment`
/// resolves an import that is not relative (`@/styles/x.module.css`).
pub fn migrate(path: &Path, source: &str, modules: &Modules, environment: &dyn Environment) -> Migration {
    let file = path.display().to_string();
    let parsed = kirana_frontend::with_parsed(path, &file, source, |parsed| {
        let mut walker = Walker {
            source,
            path,
            modules,
            environment,
            edits: Vec::new(),
            notes: Vec::new(),
            locals: BTreeMap::new(),
            claimed: Vec::new(),
            first: None,
            style_props: false,
            joiners: Vec::new(),
        };
        for statement in &parsed.program.body {
            if let oxc_ast::ast::Statement::ImportDeclaration(declaration) = statement {
                walker.import(declaration);
            }
        }
        if walker.locals.is_empty() {
            return (source.to_owned(), walker.notes);
        }
        walker.visit_program(parsed.program);
        walker.finish()
    });
    match parsed {
        Ok((source, mut notes)) => {
            notes.sort_by_key(|note| note.offset);
            Migration { source, notes, rename: None }
        }
        Err(_) => Migration {
            source: source.to_owned(),
            notes: vec![Note { offset: 0, message: "the file does not parse; nothing was rewritten".to_owned() }],
            rename: None,
        },
    }
}

/// How a module is named in a script: the whole module (`styles`) or one class.
#[derive(Clone)]
enum Local {
    Module(PathBuf),
    Class(PathBuf, String),
}

struct Walker<'s, 'm, 'e> {
    source: &'s str,
    path: &'s Path,
    modules: &'m Modules,
    environment: &'e dyn Environment,
    edits: Vec<Edit>,
    notes: Vec<Note>,
    locals: BTreeMap<String, Local>,
    claimed: Vec<Span>,
    /// Where `styleProps`'s import goes: before the first CSS module's.
    first: Option<u32>,
    style_props: bool,
    /// Imports of a class joiner alone, removed when no call of it is left.
    joiners: Vec<(Span, String)>,
}

impl<'s, 'm, 'e> Walker<'s, 'm, 'e> {
    fn text(&self, span: Span) -> &'s str {
        &self.source[span.start as usize..span.end as usize]
    }

    fn note(&mut self, offset: u32, message: impl Into<String>) {
        self.notes.push(Note { offset, message: message.into() });
    }

    fn module(&self, path: &Path) -> &'m Module {
        &self.modules[path]
    }

    /// An import of a CSS module: written as an import of its module of handles.
    fn import(&mut self, declaration: &ImportDeclaration<'_>) {
        let specifier = declaration.source.value.as_str().unwrap_or_default();
        if [".module.scss", ".module.sass", ".module.less"].iter().any(|extension| specifier.ends_with(extension)) {
            return self.note(
                declaration.span.start,
                format!("{specifier} is not CSS: compile it to a `.module.css` first, then run this again"),
            );
        }
        // A joiner imported alone (`import clsx from "clsx"`) goes once nothing calls it any more.
        if let [only] = declaration.specifiers.iter().flatten().collect::<Vec<_>>().as_slice()
            && JOINERS.contains(&only.name().as_str())
        {
            self.joiners.push((declaration.span, only.name().to_string()));
        }
        if !specifier.ends_with(".module.css") {
            return;
        }
        let resolved = if specifier.starts_with('.') {
            Some(normal(&self.path.parent().unwrap_or(Path::new("")).join(specifier)))
        } else {
            self.environment.resolve(specifier).map(|path| normal(&path))
        };
        let Some((module_path, module)) = resolved.and_then(|path| self.modules.get_key_value(&path)) else {
            return self
                .note(declaration.span.start, format!("{specifier} is not among the files migrated: pass it too"));
        };
        let new = format!("{}.styles", specifier.trim_end_matches(".module.css"));
        let mut lines = Vec::new();
        let mut named = Vec::new();
        for specifier in declaration.specifiers.iter().flatten() {
            let local = specifier.name().to_string();
            match specifier {
                ImportDeclarationSpecifier::ImportSpecifier(named_import) => {
                    let class = named_import.imported.name().to_string();
                    let export =
                        module.class(&class).map_or_else(|| export_name(&class), |(_, class)| class.export.clone());
                    named.push(if export == local { local.clone() } else { format!("{export} as {local}") });
                    self.locals.insert(local, Local::Class(module_path.clone(), class));
                }
                _ => {
                    lines.push(format!("import * as {local} from {}", js_string(&new)));
                    self.locals.insert(local, Local::Module(module_path.clone()));
                }
            }
        }
        if !named.is_empty() {
            lines.push(format!("import {{ {} }} from {}", named.join(", "), js_string(&new)));
        }
        self.first.get_or_insert(declaration.span.start);
        self.edits.push(Edit { span: declaration.span, text: lines.join("\n") });
    }

    /// The class an expression reads, with the handle's text: `styles.root`, `styles["is-open"]`, or
    /// a class imported by name.
    fn reference(&mut self, expression: &Expression<'_>) -> Option<(PathBuf, String, String)> {
        let (object, class) = match expression {
            Expression::StaticMemberExpression(member) => (&member.object, member.property.name.to_string()),
            Expression::ComputedMemberExpression(member) => match &member.expression {
                Expression::StringLiteral(name) => (&member.object, name.value.as_str().unwrap_or_default().to_owned()),
                _ => return None,
            },
            Expression::Identifier(identifier) => {
                return match self.locals.get(identifier.name.as_str()) {
                    Some(Local::Class(path, class)) => Some((path.clone(), class.clone(), identifier.name.to_string())),
                    _ => None,
                };
            }
            _ => return None,
        };
        let Expression::Identifier(object) = object else { return None };
        let Some(Local::Module(path)) = self.locals.get(object.name.as_str()).cloned() else { return None };
        let Some((_, found)) = self.module(&path).class(&class) else {
            self.note(expression.span().start, format!("{} has no class `.{class}`", self.module(&path).file()));
            return None;
        };
        Some((path, class, format!("{}.{}", object.name, found.export)))
    }

    /// A class list as an `sx` array: its handles and the plain class names beside them; `None` for
    /// a list this cannot read, whose reads become class strings instead.
    fn list(&mut self, expression: &Expression<'_>, out: &mut List) -> bool {
        match expression {
            Expression::StringLiteral(text) => {
                out.names.extend(text.value.as_str().unwrap_or_default().split_whitespace().map(str::to_owned));
                true
            }
            Expression::TemplateLiteral(template) => {
                for (index, quasi) in template.quasis.iter().enumerate() {
                    out.names.extend(quasi.value.raw.split_whitespace().map(str::to_owned));
                    if let Some(inner) = template.expressions.get(index)
                        && !self.list(inner, out)
                    {
                        return false;
                    }
                }
                true
            }
            Expression::CallExpression(call) => {
                let joiner =
                    matches!(&call.callee, Expression::Identifier(callee) if JOINERS.contains(&callee.name.as_str()));
                let join = match &call.callee {
                    Expression::StaticMemberExpression(member) if member.property.name == "join" => {
                        Some(&member.object)
                    }
                    _ => None,
                };
                if joiner {
                    return call.arguments.iter().all(|argument| match argument.as_expression() {
                        Some(Expression::ObjectExpression(object)) => self.object(object, out),
                        Some(argument) => self.list(argument, out),
                        None => false,
                    });
                }
                match join {
                    Some(Expression::ArrayExpression(array)) => array
                        .elements
                        .iter()
                        .all(|element| element.as_expression().is_some_and(|element| self.list(element, out))),
                    _ => false,
                }
            }
            // A class name from elsewhere (a `className` prop) stays a class name beside the handles.
            other if !self.mentions(other) => {
                out.others.push(self.text(other.span()).to_owned());
                true
            }
            other => self.item(other, out),
        }
    }

    /// Whether `expression` reads any CSS module imported here.
    fn mentions(&self, expression: &Expression<'_>) -> bool {
        let mut mentions = Mentions { locals: &self.locals, found: false };
        mentions.visit_expression(expression);
        mentions.found
    }

    /// `{ [styles.open]: open }`, an object of `clsx`'s.
    fn object(&mut self, object: &oxc_ast::ast::ObjectExpression<'_>, out: &mut List) -> bool {
        object.properties.iter().all(|property| {
            let ObjectPropertyKind::ObjectProperty(property) = property else { return false };
            if !property.computed {
                return false;
            }
            let key = property.key.as_expression().expect("a computed key is an expression");
            let Some((path, class, handle)) = self.reference(key) else { return false };
            out.refs.push((path, class));
            out.items.push(format!("{} && {handle}", self.text(property.value.span())));
            true
        })
    }

    /// One entry of a class list that may hold handles: a class read, or a choice of them.
    fn item(&mut self, expression: &Expression<'_>, out: &mut List) -> bool {
        match self.choice(expression, out) {
            Some(text) => {
                out.items.push(text);
                true
            }
            None => false,
        }
    }

    /// A class read, or `&&`, `||`, `??` or a conditional choosing among them and nothing, as the
    /// `sx` entry it becomes; `None` for anything else (a plain class name chosen by a condition).
    fn choice(&mut self, expression: &Expression<'_>, out: &mut List) -> Option<String> {
        if let Some((path, class, handle)) = self.reference(expression) {
            out.refs.push((path, class));
            return Some(handle);
        }
        match expression {
            Expression::StringLiteral(text) if text.value.as_str() == Some("") => Some("null".to_owned()),
            Expression::NullLiteral(_) | Expression::BooleanLiteral(_) => Some(self.text(expression.span()).to_owned()),
            Expression::Identifier(identifier) if identifier.name == "undefined" => Some("undefined".to_owned()),
            Expression::ParenthesizedExpression(inner) => {
                self.choice(&inner.expression, out).map(|text| format!("({text})"))
            }
            Expression::ConditionalExpression(conditional) => {
                let consequent = self.choice(&conditional.consequent, out)?;
                let alternate = self.choice(&conditional.alternate, out)?;
                Some(format!("{} ? {consequent} : {alternate}", self.text(conditional.test.span())))
            }
            Expression::LogicalExpression(logical) => self.logical(logical, out),
            _ => None,
        }
    }

    fn logical(&mut self, logical: &LogicalExpression<'_>, out: &mut List) -> Option<String> {
        let operator = logical.operator.as_str();
        let left = if logical.operator == oxc_syntax::operator::LogicalOperator::And {
            self.text(logical.left.span()).to_owned()
        } else {
            self.choice(&logical.left, out)?
        };
        let right = self.choice(&logical.right, out)?;
        Some(format!("{left} {operator} {right}"))
    }

    /// `className={…}` holding the module's classes, as `sx` on an element and as compiled props on
    /// a component, which may not read `sx`.
    fn class_name(&mut self, element: &JSXOpeningElement<'_>, attribute: Span, value: &Expression<'_>) {
        let mut out = List::default();
        if !self.list(value, &mut out) || out.items.is_empty() {
            return;
        }
        self.order(&out.refs, value.span().start);
        let component = !matches!(&element.name, JSXElementName::Identifier(_));
        let text = if component {
            self.style_props = true;
            let mut all = Vec::new();
            if !out.names.is_empty() {
                all.push(js_string(&out.names.join(" ")));
            }
            all.extend(out.items);
            all.extend(out.others);
            format!("{{...styleProps({})}}", all.join(", "))
        } else {
            let sx = if out.items.len() == 1 { out.items.remove(0) } else { format!("[{}]", out.items.join(", ")) };
            let mut classes = Vec::new();
            if !out.names.is_empty() {
                classes.push(js_string(&out.names.join(" ")));
            }
            classes.extend(out.others);
            let names = match classes.as_slice() {
                [] => String::new(),
                [one] if out.names.is_empty() => format!("className={{{one}}} "),
                [one] => format!("className={one} "),
                _ => format!("className={{[{}].filter(Boolean).join(\" \")}} ", classes.join(", ")),
            };
            format!("{names}sx={{{sx}}}")
        };
        self.claimed.push(attribute);
        self.edits.push(Edit { span: attribute, text });
    }

    /// Reports two classes of one module on an element in an order that changes which wins: CSS took
    /// the one later in the file, `sx` takes the one later in the list.
    fn order(&mut self, refs: &[(PathBuf, String)], at: u32) {
        for (index, (path, earlier)) in refs.iter().enumerate() {
            for (other, later) in &refs[index + 1..] {
                if other != path {
                    continue;
                }
                let module = self.module(path);
                let (first, a) = module.class(earlier).expect("a class read is in its module");
                let (second, b) = module.class(later).expect("a class read is in its module");
                let shared: Vec<&str> = a.properties.intersection(&b.properties).map(String::as_str).collect();
                if second < first && !shared.is_empty() {
                    let message = format!(
                        "`.{earlier}` comes after `.{later}` in {}, so it won where both set {}; `sx` lists it first, so `.{later}` wins now: swap them if `.{earlier}` should",
                        module.file(),
                        shared.join(", ")
                    );
                    self.note(at, message);
                }
            }
        }
    }

    fn finish(mut self) -> (String, Vec<Note>) {
        if self.style_props
            && let Some(first) = self.first
        {
            self.edits.push(Edit {
                span: Span::new(first, first),
                text: "import { props as styleProps } from \"@kirana-style/core\"\n".to_owned(),
            });
        }
        self.edits.sort_by(|a, b| b.span.start.cmp(&a.span.start).then(b.span.end.cmp(&a.span.end)));
        let mut out = self.source.to_owned();
        for edit in &self.edits {
            out.replace_range(edit.span.start as usize..edit.span.end as usize, &edit.text);
        }
        for (span, name) in &self.joiners {
            let import = format!("{}\n", self.text(*span));
            let call = format!("{name}(");
            let calls = out.match_indices(&call).filter(|(at, _)| {
                !out[..*at]
                    .ends_with(|character: char| character.is_alphanumeric() || character == '_' || character == '.')
            });
            let left = calls.count();
            if left == 0 {
                out = out.replacen(&import, "", 1);
            }
        }
        (out, self.notes)
    }
}

/// A class list read as `sx`: its entries, the plain class names beside them, and the classes it
/// reads, in order.
#[derive(Default)]
struct List {
    items: Vec<String>,
    names: Vec<String>,
    /// Class names from elsewhere (`className`, `props.className`), kept as class names.
    others: Vec<String>,
    refs: Vec<(PathBuf, String)>,
}

/// Whether an expression reads a CSS module, for [`Walker::mentions`].
struct Mentions<'l> {
    locals: &'l BTreeMap<String, Local>,
    found: bool,
}

impl<'a> Visit<'a> for Mentions<'_> {
    fn visit_identifier_reference(&mut self, identifier: &oxc_ast::ast::IdentifierReference<'a>) {
        self.found |= self.locals.contains_key(identifier.name.as_str());
    }
}

impl<'a> Visit<'a> for Walker<'_, '_, '_> {
    fn visit_import_declaration(&mut self, _: &ImportDeclaration<'a>) {}

    fn visit_jsx_opening_element(&mut self, element: &JSXOpeningElement<'a>) {
        for item in &element.attributes {
            if let JSXAttributeItem::Attribute(attribute) = item
                && let JSXAttributeName::Identifier(name) = &attribute.name
                && name.name == "className"
                && let Some(JSXAttributeValue::ExpressionContainer(container)) = &attribute.value
                && let Some(value) = container.expression.as_expression()
            {
                self.class_name(element, attribute.span, value);
            }
        }
        walk::walk_jsx_opening_element(self, element);
    }

    fn visit_expression(&mut self, expression: &Expression<'a>) {
        let span = expression.span();
        if self.claimed.iter().any(|claimed| claimed.start <= span.start && span.end <= claimed.end) {
            return;
        }
        if let Some((_, _, handle)) = self.reference(expression) {
            // Anywhere else a class was a string: the handle's compiled class is the same string.
            self.style_props = true;
            self.edits.push(Edit { span, text: format!("styleProps({handle}).className") });
            return;
        }
        if let Expression::Identifier(identifier) = expression
            && let Some(Local::Module(_)) = self.locals.get(identifier.name.as_str())
        {
            self.note(
                span.start,
                format!(
                    "`{}`, the whole module, is used as a value: its entries are handles now, not class names",
                    identifier.name
                ),
            );
        }
        walk::walk_expression(self, expression);
    }
}
