//! Vue, Svelte and Astro components, and Angular templates (D-068), for the language server
//! (`design-notes/editor-components.md`): where script blocks and `sx` bindings are, found by
//! scanning the text. It reports the same blocks, bindings and module ids (`Card.vue.setup.ts`) as
//! the build's parsers (`npm/compiler/src/sfc.ts`), which the Rust server cannot load;
//! `npm/compiler/test/sfc-scan.test.ts` holds it to that. It never parses JavaScript: it skips
//! strings, comments and balanced braces to find where an expression ends.

use std::path::Path;

/// The component formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Framework {
    Vue,
    Svelte,
    Astro,
    /// An Angular template (inline or `.html`): markup only, no script blocks.
    Angular,
}

/// The extensions of component files.
pub const COMPONENT_EXTENSIONS: &[&str] = &["vue", "svelte", "astro"];

/// The framework of a component path; `None` for any other file.
pub fn framework_of(path: &Path) -> Option<Framework> {
    match path.extension().and_then(|extension| extension.to_str())? {
        "vue" => Some(Framework::Vue),
        "svelte" => Some(Framework::Svelte),
        "astro" => Some(Framework::Astro),
        _ => None,
    }
}

/// Whether `path` is a component's script block as the build names it (`Card.vue.setup.ts`), whose
/// template, which reads its bindings, is not part of the module.
pub fn is_block_id(path: &Path) -> bool {
    path.file_stem().map(Path::new).and_then(Path::file_stem).map(Path::new).is_some_and(|component| {
        component
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| COMPONENT_EXTENSIONS.contains(&extension))
    })
}

/// One script block: its content's byte range in the component.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Block {
    /// `script`, `setup`, `instance`, `module` or `frontmatter`, as the build names it.
    pub label: &'static str,
    pub start: usize,
    pub end: usize,
    /// The `lang` attribute; `js` without one, `ts` for a frontmatter.
    pub lang: String,
}

impl Block {
    /// The block's module id, as the build gives it: `Card.vue` + `.setup.ts`.
    pub fn id(&self, component: &Path) -> std::path::PathBuf {
        let mut id = component.as_os_str().to_owned();
        id.push(format!(".{}.{}", self.label, self.lang));
        id.into()
    }
}

/// One `sx` binding in the template.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Binding {
    /// The whole attribute (`:sx="…"`, `sx={…}`, `{sx}`).
    pub start: usize,
    pub end: usize,
    /// The expression's text in the component.
    pub expression_start: usize,
    pub expression_end: usize,
    /// The expression as the framework compiles it: Vue decodes character references
    /// (`&quot;` → `"`); otherwise the text itself.
    pub expression: String,
    /// Where `expression` and the component's text stop lining up: `(offset in expression, offset
    /// in the component)` after each decoded reference.
    pub shifts: Vec<(usize, usize)>,
}

impl Binding {
    /// The binding moved by `base`: a template's bindings, placed in the file that holds it.
    #[must_use]
    pub fn shifted(mut self, base: usize) -> Self {
        self.start += base;
        self.end += base;
        self.expression_start += base;
        self.expression_end += base;
        for shift in &mut self.shifts {
            shift.1 += base;
        }
        self
    }

    /// The component offset of an offset in [`Binding::expression`].
    pub fn source_offset(&self, offset: usize) -> usize {
        let (from, to) =
            self.shifts.iter().rev().find(|(at, _)| *at <= offset).copied().unwrap_or((0, self.expression_start));
        to + (offset - from)
    }
}

/// What a component holds.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Component {
    /// In the order the build compiles them: Vue `script`, `setup`; Svelte `module`, `instance`.
    pub blocks: Vec<Block>,
    pub bindings: Vec<Binding>,
    /// The index in `blocks` of the block the template sees.
    pub target: Option<usize>,
}

impl Component {
    /// The block whose content holds `offset`.
    pub fn block_at(&self, offset: usize) -> Option<&Block> {
        self.blocks.iter().find(|block| block.start <= offset && offset <= block.end)
    }
}

/// Elements that never have content.
const VOID: &[&str] =
    &["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"];

/// Scans one component.
pub fn scan(framework: Framework, source: &str) -> Component {
    let mut scanner =
        Scanner { source, bytes: source.as_bytes(), framework, stack: Vec::new(), v_pre: 0, out: Vec::new() };
    let mut blocks = Vec::new();
    let mut from = 0;
    if framework == Framework::Astro
        && let Some(frontmatter) = frontmatter(source)
    {
        from = frontmatter.end + 3;
        blocks.push(frontmatter);
    }
    scanner.markup(from, None, &mut blocks);
    let bindings = std::mem::take(&mut scanner.out);
    let order = |label: &str| match label {
        "script" | "module" | "frontmatter" => 0,
        _ => 1,
    };
    blocks.sort_by_key(|block: &Block| order(block.label));
    let target_label = match framework {
        Framework::Vue => "setup",
        Framework::Svelte => "instance",
        Framework::Astro => "frontmatter",
        Framework::Angular => "",
    };
    let target = blocks.iter().position(|block| block.label == target_label);
    Component { blocks, bindings, target }
}

/// Astro's `---` fence at the start of the file (after whitespace): the content between the fences.
fn frontmatter(source: &str) -> Option<Block> {
    let open = source.len() - source.trim_start().len();
    if !source[open..].starts_with("---") {
        return None;
    }
    let start = open + 3;
    let end = start + source[start..].find("---")?;
    Some(Block { label: "frontmatter", start, end, lang: "ts".to_owned() })
}

struct Scanner<'s> {
    source: &'s str,
    bytes: &'s [u8],
    framework: Framework,
    /// Open elements, outermost first.
    stack: Vec<String>,
    /// How many open elements carry Vue's `v-pre`, under which directives are plain attributes.
    v_pre: usize,
    out: Vec<Binding>,
}

/// One attribute of a tag.
struct Attribute {
    start: usize,
    end: usize,
    name: (usize, usize),
    value: Value,
}

enum Value {
    None,
    /// The text between the quotes.
    Quoted(usize, usize),
    /// The text between the braces: `name={…}`, or a whole `{…}` attribute (shorthand or spread).
    Expression(usize, usize),
}

impl<'s> Scanner<'s> {
    fn at(&self, index: usize) -> u8 {
        self.bytes.get(index).copied().unwrap_or(0)
    }

    fn starts(&self, index: usize, text: &str) -> bool {
        self.bytes.get(index..index + text.len()).is_some_and(|found| found.eq_ignore_ascii_case(text.as_bytes()))
    }

    /// Content until EOF or the close tag of `closing`; returns the offset after it. A close tag of
    /// an outer element ends the content too, unconsumed, as HTML's implied end tags do.
    fn markup(&mut self, mut index: usize, closing: Option<&str>, blocks: &mut Vec<Block>) -> usize {
        while index < self.bytes.len() {
            if self.starts(index, "<!--") {
                index = self.source[index + 4..].find("-->").map_or(self.bytes.len(), |end| index + 4 + end + 3);
            } else if self.at(index) == b'<' && self.at(index + 1) == b'/' {
                let name_end = self.name_end(index + 2);
                let name = &self.source[index + 2..name_end];
                let after = self.source[name_end..].find('>').map_or(self.bytes.len(), |end| name_end + end + 1);
                if closing.is_some_and(|closing| closing.eq_ignore_ascii_case(name)) {
                    return after;
                }
                if closing.is_some() && self.stack.iter().any(|open| open.eq_ignore_ascii_case(name)) {
                    return index;
                }
                index = after;
            } else if self.at(index) == b'<' && (self.at(index + 1).is_ascii_alphabetic() || self.at(index + 1) == b'>')
            {
                index = self.element(index, blocks);
            } else if self.at(index) == b'{' && !matches!(self.framework, Framework::Vue | Framework::Angular) {
                index = self.expression(index + 1);
            } else {
                index += 1;
            }
        }
        index
    }

    /// Where a tag name starting at `index` ends.
    fn name_end(&self, mut index: usize) -> usize {
        while index < self.bytes.len()
            && (self.bytes[index].is_ascii_alphanumeric() || matches!(self.bytes[index], b'-' | b':' | b'.' | b'_'))
        {
            index += 1;
        }
        index
    }

    /// One element from its `<`; returns the offset after it.
    fn element(&mut self, start: usize, blocks: &mut Vec<Block>) -> usize {
        let name_end = self.name_end(start + 1);
        let name = self.source[start + 1..name_end].to_owned();
        let (attributes, mut index, closed) = self.tag(name_end);
        let top = self.stack.is_empty();
        let lower = name.to_ascii_lowercase();
        let in_template = match self.framework {
            Framework::Vue => self.stack.first().is_some_and(|first| first == "template") && self.v_pre == 0,
            _ => true,
        };
        let v_pre =
            self.framework == Framework::Vue && attributes.iter().any(|attribute| self.name(attribute) == "v-pre");
        if in_template && !v_pre {
            self.bindings(&attributes);
        }
        if closed || VOID.contains(&lower.as_str()) {
            return index;
        }
        if lower == "script" || lower == "style" {
            let close = format!("</{lower}");
            let end = (index..self.bytes.len()).find(|&at| self.starts(at, &close)).unwrap_or(self.bytes.len());
            if lower == "script" && top && !matches!(self.framework, Framework::Astro | Framework::Angular) {
                blocks.push(self.block(&attributes, index, end));
            }
            index = self.source[end..].find('>').map_or(self.bytes.len(), |gt| end + gt + 1);
            return index;
        }
        if v_pre {
            self.v_pre += 1;
        }
        self.stack.push(lower);
        let name = self.stack.last().cloned().unwrap_or_default();
        index = self.markup(index, Some(&name), blocks);
        self.stack.pop();
        if v_pre {
            self.v_pre -= 1;
        }
        index
    }

    fn name(&self, attribute: &Attribute) -> &'s str {
        &self.source[attribute.name.0..attribute.name.1]
    }

    /// A tag's attributes from after its name; returns them, the offset after `>` and whether it
    /// closed itself.
    fn tag(&mut self, mut index: usize) -> (Vec<Attribute>, usize, bool) {
        let mut attributes = Vec::new();
        loop {
            while self.at(index).is_ascii_whitespace() {
                index += 1;
            }
            match self.at(index) {
                0 => return (attributes, self.bytes.len(), true),
                b'>' => return (attributes, index + 1, false),
                b'/' if self.at(index + 1) == b'>' => return (attributes, index + 2, true),
                b'/' => index += 1,
                b'{' => {
                    let end = self.expression(index + 1);
                    attributes.push(Attribute {
                        start: index,
                        end,
                        name: (index, index),
                        value: Value::Expression(index + 1, end - 1),
                    });
                    index = end;
                }
                _ => {
                    let start = index;
                    while index < self.bytes.len()
                        && !self.bytes[index].is_ascii_whitespace()
                        && !matches!(self.bytes[index], b'=' | b'>' | b'{')
                        && !(self.bytes[index] == b'/' && self.at(index + 1) == b'>')
                    {
                        index += 1;
                    }
                    let name = (start, index);
                    let mut after = index;
                    while self.at(after).is_ascii_whitespace() {
                        after += 1;
                    }
                    let mut value = Value::None;
                    if self.at(after) == b'=' {
                        after += 1;
                        while self.at(after).is_ascii_whitespace() {
                            after += 1;
                        }
                        match self.at(after) {
                            quote @ (b'"' | b'\'' | b'`') => {
                                let end = self.source[after + 1..]
                                    .find(quote as char)
                                    .map_or(self.bytes.len(), |end| after + 1 + end);
                                value = Value::Quoted(after + 1, end);
                                index = (end + 1).min(self.bytes.len());
                            }
                            b'{' => {
                                let end = self.expression(after + 1);
                                value = Value::Expression(after + 1, end.saturating_sub(1).max(after + 1));
                                index = end;
                            }
                            _ => {
                                index = after;
                                while index < self.bytes.len()
                                    && !self.bytes[index].is_ascii_whitespace()
                                    && self.bytes[index] != b'>'
                                {
                                    index += 1;
                                }
                            }
                        }
                    }
                    attributes.push(Attribute { start, end: index, name, value });
                }
            }
        }
    }

    /// Records the tag's `sx` binding, if it has one.
    fn bindings(&mut self, attributes: &[Attribute]) {
        for attribute in attributes {
            let name = self.name(attribute);
            let expression = match (&attribute.value, self.framework) {
                (Value::Quoted(start, end), Framework::Vue) if name == ":sx" || name == "v-bind:sx" => {
                    Some((*start, *end))
                }
                (Value::Quoted(start, end), Framework::Angular) if name == "[sx]" || name == "bind-sx" => {
                    Some((*start, *end))
                }
                (Value::Expression(start, end), Framework::Svelte | Framework::Astro) if name == "sx" => {
                    Some((*start, *end))
                }
                // Svelte: `sx="{expr}"`, one expression and nothing else in the quotes.
                (Value::Quoted(start, end), Framework::Svelte) if name == "sx" => {
                    let inner = &self.source[*start..*end];
                    (inner.starts_with('{') && self.expression(start + 1) == *end).then_some((start + 1, end - 1))
                }
                // The shorthand `{sx}`.
                (Value::Expression(start, end), Framework::Svelte | Framework::Astro)
                    if name.is_empty() && self.source[*start..*end].trim() == "sx" =>
                {
                    let at = start + self.source[*start..*end].find("sx").unwrap_or(0);
                    Some((at, at + 2))
                }
                _ => None,
            };
            let Some((start, end)) = expression else { continue };
            let decoded = matches!(self.framework, Framework::Vue | Framework::Angular);
            if !decoded && blank(&self.source[start..end]) {
                continue;
            }
            let (expression, shifts) = if decoded {
                decode(&self.source[start..end], start)
            } else {
                (self.source[start..end].to_owned(), Vec::new())
            };
            self.out.push(Binding {
                start: attribute.start,
                end: attribute.end,
                expression_start: start,
                expression_end: end,
                expression,
                shifts,
            });
        }
    }

    fn block(&self, attributes: &[Attribute], start: usize, end: usize) -> Block {
        let value = |wanted: &str| {
            attributes.iter().find(|attribute| self.name(attribute) == wanted).map(|attribute| match attribute.value {
                Value::Quoted(start, end) => &self.source[start..end],
                _ => "",
            })
        };
        let label = match self.framework {
            Framework::Vue if value("setup").is_some() => "setup",
            Framework::Vue => "script",
            _ if value("module").is_some() || value("context") == Some("module") => "module",
            _ => "instance",
        };
        let lang = value("lang").filter(|lang| !lang.is_empty()).unwrap_or("js").to_owned();
        Block { label, start, end, lang }
    }

    /// An expression from after its `{`; returns the offset after its `}`. Strings, template
    /// literals and comments are skipped; in Astro, markup inside it is scanned for bindings.
    fn expression(&mut self, mut index: usize) -> usize {
        let mut depth = 0usize;
        let mut ignored = Vec::new();
        while index < self.bytes.len() {
            match self.bytes[index] {
                b'{' => depth += 1,
                b'}' if depth == 0 => return index + 1,
                b'}' => depth -= 1,
                quote @ (b'"' | b'\'') => {
                    index += 1;
                    while index < self.bytes.len() && self.bytes[index] != quote && self.bytes[index] != b'\n' {
                        index += if self.bytes[index] == b'\\' { 2 } else { 1 };
                    }
                }
                b'`' => index = self.template_literal(index + 1) - 1,
                b'/' if self.at(index + 1) == b'/' => {
                    index = self.source[index..].find('\n').map_or(self.bytes.len(), |end| index + end);
                }
                b'/' if self.at(index + 1) == b'*' => {
                    index = self.source[index + 2..].find("*/").map_or(self.bytes.len(), |end| index + 2 + end + 1);
                }
                b'<' if self.framework == Framework::Astro
                    && (self.at(index + 1).is_ascii_alphabetic() || self.at(index + 1) == b'>') =>
                {
                    index = self.element(index, &mut ignored);
                    continue;
                }
                _ => {}
            }
            index += 1;
        }
        self.bytes.len()
    }

    /// A template literal from after its backtick; returns the offset after the closing one.
    fn template_literal(&mut self, mut index: usize) -> usize {
        while index < self.bytes.len() {
            match self.bytes[index] {
                b'\\' => index += 2,
                b'`' => return index + 1,
                b'$' if self.at(index + 1) == b'{' => index = self.expression(index + 2),
                _ => index += 1,
            }
        }
        self.bytes.len()
    }
}

/// The text range of an Angular component's inline template: the string after `template:` in the
/// file's `@Component({ … })` (a template literal, or a quoted string).
pub fn angular_template(source: &str) -> Option<(usize, usize)> {
    let decorator = source.find("@Component(")?;
    let mut search = decorator;
    loop {
        let at = search + source[search..].find("template")?;
        search = at + "template".len();
        let rest = source[search..].trim_start();
        let Some(value) = rest.strip_prefix(':') else { continue };
        let value = value.trim_start();
        let quote = value.chars().next().filter(|quote| matches!(quote, '`' | '"' | '\''))?;
        let start = source.len() - value.len() + 1;
        let bytes = source.as_bytes();
        let mut end = start;
        while end < bytes.len() && bytes[end] != quote as u8 {
            end += if bytes[end] == b'\\' { 2 } else { 1 };
        }
        return Some((start, end.min(bytes.len())));
    }
}

/// The `templateUrl` an Angular component names, as written.
pub fn angular_template_url(source: &str) -> Option<&str> {
    let decorator = source.find("@Component(")?;
    let at = decorator + source[decorator..].find("templateUrl")?;
    let rest = source[at + "templateUrl".len()..].trim_start().strip_prefix(':')?.trim_start();
    let quote = rest.chars().next().filter(|quote| matches!(quote, '`' | '"' | '\''))?;
    let value = &rest[1..];
    value.find(quote).map(|end| &value[..end])
}

/// The `[sx]` bindings of an Angular template, placed at `base` in the file that holds it.
pub fn angular_bindings(template: &str, base: usize) -> Vec<Binding> {
    scan(Framework::Angular, template).bindings.into_iter().map(|binding| binding.shifted(base)).collect()
}

/// Whether an expression is empty or only comments (JSX's empty expression).
fn blank(expression: &str) -> bool {
    let mut rest = expression.trim();
    loop {
        if let Some(after) = rest.strip_prefix("/*") {
            rest = after.find("*/").map_or("", |end| &after[end + 2..]).trim_start();
        } else if let Some(after) = rest.strip_prefix("//") {
            rest = after.find('\n').map_or("", |end| &after[end..]).trim_start();
        } else {
            return rest.is_empty();
        }
    }
}

/// An attribute value with HTML character references decoded, as Vue's parser decodes a directive's
/// expression, and where each one shifted the text (see [`Binding::shifts`]). Numeric references and
/// the named ones an expression can need are decoded; any other `&name;` is left as written.
fn decode(text: &str, base: usize) -> (String, Vec<(usize, usize)>) {
    let mut out = String::with_capacity(text.len());
    let mut shifts = Vec::new();
    let mut rest = text;
    let mut at = 0;
    while let Some(amp) = rest.find('&') {
        out.push_str(&rest[..amp]);
        at += amp;
        rest = &rest[amp..];
        let decoded = rest.find(';').filter(|end| *end <= 10).and_then(|end| {
            let name = &rest[1..end];
            let character = match name {
                "quot" => Some('"'),
                "amp" => Some('&'),
                "lt" => Some('<'),
                "gt" => Some('>'),
                "apos" => Some('\''),
                "nbsp" => Some('\u{a0}'),
                _ => match name.strip_prefix("#x").or_else(|| name.strip_prefix("#X")) {
                    Some(hex) => u32::from_str_radix(hex, 16).ok().and_then(char::from_u32),
                    None => name.strip_prefix('#').and_then(|decimal| decimal.parse().ok()).and_then(char::from_u32),
                },
            };
            character.map(|character| (character, end + 1))
        });
        match decoded {
            Some((character, length)) => {
                out.push(character);
                at += length;
                rest = &rest[length..];
                shifts.push((out.len(), base + at));
            }
            None => {
                out.push('&');
                at += 1;
                rest = &rest[1..];
            }
        }
    }
    out.push_str(rest);
    (out, shifts)
}
