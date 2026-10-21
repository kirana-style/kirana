//! Value grammars (KRN-CAS-010): whether a value fits a property's syntax as MDN writes it.
//!
//! The check is built never to reject valid CSS, including CSS newer than the data (P11):
//!
//! - A value with a word or function no grammar names, a dimension with a unit outside the data,
//!   a substitution (`var()`, `env()`, `attr()`) or a bracketed block is [`Verdict::Unchecked`]:
//!   it may be newer CSS, a name of the author's own, or anything after substitution.
//! - A function is matched by its name alone. Its arguments are never judged, so a grammar's
//!   hardest part (`calc()`, colour functions, gradients) cannot reject anything.
//! - A type the data does not define matches any one component.
//!
//! What is left is the value's top level, made only of words and functions the data knows, and
//! that is where the common mistakes are: `padding: red`, `display: center`, `width: -4px`.

use std::cell::RefCell;
use std::collections::HashMap;

use crate::generated::{KNOWN_FUNCTIONS, KNOWN_WORDS, PROPERTY_SYNTAX, SYNTAXES};

/// The outcome of checking a value against a property's grammar.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Verdict {
    /// The value fits.
    Accepted,
    /// The value cannot be judged from the data, and is accepted.
    Unchecked,
    /// The value does not fit; the property's syntax, as MDN writes it.
    Rejected { expected: &'static str },
}

/// Checks `value` against the grammar of `property` (kebab case).
pub fn check(property: &str, value: &str) -> Verdict {
    let Some(syntax) = lookup(PROPERTY_SYNTAX, property) else { return Verdict::Unchecked };
    let Some(tokens) = tokenize(value) else { return Verdict::Unchecked };
    if let [Token::Ident(word)] = tokens.as_slice()
        && ["inherit", "initial", "unset", "revert", "revert-layer"].iter().any(|wide| word.eq_ignore_ascii_case(wide))
    {
        return Verdict::Accepted;
    }
    if !tokens.iter().all(judgeable) {
        return Verdict::Unchecked;
    }
    let matcher = Matcher { depth: 0, range: None };
    if matcher.ends(&parsed(syntax), &tokens, 0).contains(&tokens.len()) {
        Verdict::Accepted
    } else {
        Verdict::Rejected { expected: syntax }
    }
}

fn lookup(table: &'static [(&'static str, &'static str)], name: &str) -> Option<&'static str> {
    table.binary_search_by(|(key, _)| (*key).cmp(name)).ok().map(|found| table[found].1)
}

/// One component of a value, at its top level.
#[derive(Debug, Clone, PartialEq)]
enum Token<'a> {
    Ident(&'a str),
    Number {
        value: f64,
        integer: bool,
    },
    Percentage(f64),
    Dimension {
        value: f64,
        unit: &'a str,
    },
    Hash,
    String,
    /// A function, by name; its arguments are not kept.
    Function(&'a str),
    Comma,
    Slash,
    /// A bracketed or parenthesised block, or a character no grammar here matches.
    Other,
}

const SUBSTITUTIONS: &[&str] = &["var", "env", "attr"];

/// Whether the data knows enough about a component for a rejection to be right.
fn judgeable(token: &Token<'_>) -> bool {
    match token {
        Token::Ident(word) => word.starts_with("--") || known(KNOWN_WORDS, word),
        Token::Function(name) => {
            !SUBSTITUTIONS.iter().any(|s| name.eq_ignore_ascii_case(s)) && known(KNOWN_FUNCTIONS, name)
        }
        Token::Dimension { unit, .. } => unit_type(unit).is_some(),
        Token::Other => false,
        _ => true,
    }
}

fn known(table: &[&str], word: &str) -> bool {
    table.binary_search(&word.to_ascii_lowercase().as_str()).is_ok()
}

/// Splits a value into its top-level components; `None` when it cannot be read.
fn tokenize(text: &str) -> Option<Vec<Token<'_>>> {
    let bytes = text.as_bytes();
    let mut tokens = Vec::new();
    let mut at = 0;
    while at < bytes.len() {
        let byte = bytes[at];
        if byte.is_ascii_whitespace() {
            at += 1;
            continue;
        }
        match byte {
            b',' => {
                tokens.push(Token::Comma);
                at += 1;
            }
            b'/' => {
                tokens.push(Token::Slash);
                at += 1;
            }
            b'"' | b'\'' => {
                at = string_end(bytes, at)?;
                tokens.push(Token::String);
            }
            b'#' => {
                at = name_end(bytes, at + 1);
                tokens.push(Token::Hash);
            }
            b'(' | b'[' | b'{' => {
                at = block_end(bytes, at)?;
                tokens.push(Token::Other);
            }
            _ if starts_number(bytes, at) => {
                let end = number_end(bytes, at);
                let value: f64 = text[at..end].parse().expect("number_end reads a float");
                let integer = !text[at..end].contains(['.', 'e', 'E']);
                at = end;
                if bytes.get(at) == Some(&b'%') {
                    at += 1;
                    tokens.push(Token::Percentage(value));
                } else if bytes.get(at).is_some_and(|b| b.is_ascii_alphabetic()) {
                    let unit_end = name_end(bytes, at);
                    tokens.push(Token::Dimension { value, unit: &text[at..unit_end] });
                    at = unit_end;
                } else {
                    tokens.push(Token::Number { value, integer });
                }
            }
            _ if starts_name(bytes, at) => {
                let end = name_end(bytes, at);
                if bytes.get(end) == Some(&b'(') {
                    tokens.push(Token::Function(&text[at..end]));
                    at = block_end(bytes, end)?;
                } else {
                    tokens.push(Token::Ident(&text[at..end]));
                    at = end;
                }
            }
            _ => {
                tokens.push(Token::Other);
                at += 1;
            }
        }
    }
    Some(tokens)
}

fn is_name_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_' || byte >= 0x80
}

fn starts_name(bytes: &[u8], at: usize) -> bool {
    let first = |i: usize| bytes.get(i).is_some_and(|&b| b.is_ascii_alphabetic() || b == b'_' || b >= 0x80);
    first(at) || bytes[at] == b'-' && (first(at + 1) || bytes.get(at + 1) == Some(&b'-'))
}

fn name_end(bytes: &[u8], mut at: usize) -> usize {
    while bytes.get(at).is_some_and(|&b| is_name_byte(b)) {
        at += 1;
    }
    at
}

fn starts_number(bytes: &[u8], at: usize) -> bool {
    let digit = |i: usize| bytes.get(i).is_some_and(u8::is_ascii_digit);
    let unsigned = |i: usize| digit(i) || bytes.get(i) == Some(&b'.') && digit(i + 1);
    unsigned(at) || matches!(bytes[at], b'+' | b'-') && unsigned(at + 1)
}

fn number_end(bytes: &[u8], mut at: usize) -> usize {
    let digits = |mut i: usize| {
        while bytes.get(i).is_some_and(u8::is_ascii_digit) {
            i += 1;
        }
        i
    };
    if matches!(bytes[at], b'+' | b'-') {
        at += 1;
    }
    at = digits(at);
    if bytes.get(at) == Some(&b'.') && bytes.get(at + 1).is_some_and(u8::is_ascii_digit) {
        at = digits(at + 1);
    }
    let exponent = match bytes.get(at + 1) {
        Some(b'+' | b'-') => at + 2,
        _ => at + 1,
    };
    if matches!(bytes.get(at), Some(b'e' | b'E')) && bytes.get(exponent).is_some_and(u8::is_ascii_digit) {
        at = digits(exponent);
    }
    at
}

fn string_end(bytes: &[u8], at: usize) -> Option<usize> {
    let quote = bytes[at];
    let mut i = at + 1;
    while i < bytes.len() {
        match bytes[i] {
            b'\\' => i += 2,
            byte if byte == quote => return Some(i + 1),
            _ => i += 1,
        }
    }
    None
}

/// The position after the block opening at `at`, past nested blocks and strings.
fn block_end(bytes: &[u8], at: usize) -> Option<usize> {
    let mut depth = 0usize;
    let mut i = at;
    while i < bytes.len() {
        match bytes[i] {
            b'"' | b'\'' => {
                i = string_end(bytes, i)?;
                continue;
            }
            b'(' | b'[' | b'{' => depth += 1,
            b')' | b']' | b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i + 1);
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

/// The type a unit belongs to.
fn unit_type(unit: &str) -> Option<&'static str> {
    const LENGTHS: &[&str] = &[
        "cap", "ch", "cm", "cqb", "cqh", "cqi", "cqmax", "cqmin", "cqw", "dvb", "dvh", "dvi", "dvmax", "dvmin", "dvw",
        "em", "ex", "ic", "in", "lh", "lvb", "lvh", "lvi", "lvmax", "lvmin", "lvw", "mm", "pc", "pt", "px", "q",
        "rcap", "rch", "rem", "rex", "ric", "rlh", "svb", "svh", "svi", "svmax", "svmin", "svw", "vb", "vh", "vi",
        "vmax", "vmin", "vw",
    ];
    let unit = unit.to_ascii_lowercase();
    Some(match unit.as_str() {
        _ if LENGTHS.binary_search(&unit.as_str()).is_ok() => "length",
        "deg" | "grad" | "rad" | "turn" => "angle",
        "s" | "ms" => "time",
        "hz" | "khz" => "frequency",
        "dpi" | "dpcm" | "dppx" | "x" => "resolution",
        "fr" => "flex",
        _ => return None,
    })
}

/// A parsed grammar.
#[derive(Debug, Clone, PartialEq)]
enum Node {
    Keyword(String),
    /// A literal character: `,`, `/` or another delimiter.
    Literal(char),
    /// `<name>` or `<name [min,max]>`.
    Type {
        name: String,
        range: Option<(f64, f64)>,
    },
    /// `<'property'>`.
    Property(String),
    /// `name( … )`, matched by name.
    Function(String),
    Seq(Vec<Node>),
    /// `a && b`: each once, in any order.
    All(Vec<Node>),
    /// `a || b`: one or more, each at most once, in any order.
    Any(Vec<Node>),
    /// `a | b`.
    One(Vec<Node>),
    Repeat {
        node: Box<Node>,
        min: usize,
        max: usize,
        comma: bool,
    },
}

thread_local! {
    static PARSED: RefCell<HashMap<&'static str, std::rc::Rc<Node>>> = RefCell::new(HashMap::new());
}

/// A syntax's grammar, parsed once per thread.
fn parsed(syntax: &'static str) -> std::rc::Rc<Node> {
    PARSED.with(|cache| {
        cache.borrow_mut().entry(syntax).or_insert_with(|| std::rc::Rc::new(Parser::new(syntax).one())).clone()
    })
}

/// The grammar's own tokens.
#[derive(Debug, Clone, PartialEq)]
enum Syn {
    Word(String),
    Function(String),
    Type(String),
    Open,
    Close,
    Bar,
    Bars,
    Ands,
    Multiplier(usize, usize, bool),
    Literal(char),
}

struct Parser {
    tokens: Vec<Syn>,
    at: usize,
}

impl Parser {
    fn new(syntax: &str) -> Self {
        Self { tokens: lex(syntax), at: 0 }
    }

    fn peek(&self) -> Option<&Syn> {
        self.tokens.get(self.at)
    }

    /// `a | b | …`, the loosest.
    fn one(&mut self) -> Node {
        let mut options = vec![self.any()];
        while self.peek() == Some(&Syn::Bar) {
            self.at += 1;
            options.push(self.any());
        }
        single(options, Node::One)
    }

    fn any(&mut self) -> Node {
        let mut options = vec![self.all()];
        while self.peek() == Some(&Syn::Bars) {
            self.at += 1;
            options.push(self.all());
        }
        single(options, Node::Any)
    }

    fn all(&mut self) -> Node {
        let mut options = vec![self.seq()];
        while self.peek() == Some(&Syn::Ands) {
            self.at += 1;
            options.push(self.seq());
        }
        single(options, Node::All)
    }

    fn seq(&mut self) -> Node {
        let mut items = Vec::new();
        while let Some(item) = self.term() {
            items.push(item);
        }
        single(items, Node::Seq)
    }

    fn term(&mut self) -> Option<Node> {
        let mut node = match self.peek()?.clone() {
            Syn::Open => {
                self.at += 1;
                let inner = self.one();
                if self.peek() == Some(&Syn::Close) {
                    self.at += 1;
                }
                inner
            }
            Syn::Word(word) => {
                self.at += 1;
                Node::Keyword(word)
            }
            Syn::Function(name) => {
                self.at += 1;
                Node::Function(name)
            }
            Syn::Type(inner) => {
                self.at += 1;
                type_node(&inner)
            }
            Syn::Literal(character) => {
                self.at += 1;
                Node::Literal(character)
            }
            Syn::Close | Syn::Bar | Syn::Bars | Syn::Ands | Syn::Multiplier(..) => return None,
        };
        while let Some(Syn::Multiplier(min, max, comma)) = self.peek().cloned() {
            self.at += 1;
            node = Node::Repeat { node: Box::new(node), min, max, comma };
        }
        Some(node)
    }
}

fn single(mut items: Vec<Node>, wrap: fn(Vec<Node>) -> Node) -> Node {
    if items.len() == 1 { items.remove(0) } else { wrap(items) }
}

/// `<name>`, `<name [0,∞]>` or `<'property'>`, from the text between the angle brackets.
fn type_node(inner: &str) -> Node {
    let inner = inner.trim();
    if let Some(property) = inner.strip_prefix('\'').and_then(|rest| rest.strip_suffix('\'')) {
        return Node::Property(property.to_owned());
    }
    let (name, range) = match inner.split_once('[') {
        Some((name, range)) => {
            (name.trim(), range.trim_end_matches(']').split_once(',').map(|(min, max)| (bound(min), bound(max))))
        }
        None => (inner, None),
    };
    Node::Type { name: name.to_owned(), range }
}

/// A range bound: a number, `∞` or `-∞`, with any unit ignored.
fn bound(text: &str) -> f64 {
    let text = text.trim();
    match text {
        "∞" | "+∞" => f64::INFINITY,
        "-∞" => f64::NEG_INFINITY,
        _ => {
            let end =
                text.find(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-' || c == '+')).unwrap_or(text.len());
            text[..end].parse().unwrap_or(f64::NEG_INFINITY)
        }
    }
}

/// The grammar's tokens. A function's arguments are skipped: only its name is kept.
fn lex(syntax: &str) -> Vec<Syn> {
    let chars: Vec<char> = syntax.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        match c {
            _ if c.is_whitespace() => i += 1,
            '[' => {
                out.push(Syn::Open);
                i += 1;
            }
            ']' => {
                out.push(Syn::Close);
                i += 1;
            }
            '|' if chars.get(i + 1) == Some(&'|') => {
                out.push(Syn::Bars);
                i += 2;
            }
            '|' => {
                out.push(Syn::Bar);
                i += 1;
            }
            '&' if chars.get(i + 1) == Some(&'&') => {
                out.push(Syn::Ands);
                i += 2;
            }
            // A type's text never holds another `>`: `<length [0,∞]>`, `<'width'>`, `<rgb()>`.
            '<' => {
                let end = chars[i + 1..].iter().position(|&c| c == '>').map_or(chars.len(), |p| i + 1 + p);
                out.push(Syn::Type(chars[i + 1..end].iter().collect()));
                i = end + 1;
            }
            '\'' => {
                let end = chars[i + 1..].iter().position(|&q| q == '\'').map_or(chars.len(), |p| i + 1 + p);
                let literal: String = chars[i + 1..end].iter().collect();
                out.push(match literal.chars().next() {
                    Some(first) if literal.chars().count() == 1 => Syn::Literal(first),
                    _ => Syn::Word(literal),
                });
                i = end + 1;
            }
            '?' => {
                out.push(Syn::Multiplier(0, 1, false));
                i += 1;
            }
            '*' => {
                out.push(Syn::Multiplier(0, usize::MAX, false));
                i += 1;
            }
            '+' => {
                out.push(Syn::Multiplier(1, usize::MAX, false));
                i += 1;
            }
            '!' => i += 1,
            '#' => {
                i += 1;
                let (min, max) = if chars.get(i) == Some(&'{') {
                    let (range, next) = braces(&chars, i);
                    i = next;
                    range
                } else {
                    (1, usize::MAX)
                };
                out.push(Syn::Multiplier(min, max, true));
            }
            '{' => {
                let ((min, max), next) = braces(&chars, i);
                i = next;
                out.push(Syn::Multiplier(min, max, false));
            }
            _ if c.is_alphabetic() || c == '-' && chars.get(i + 1).is_some_and(|n| n.is_alphabetic() || *n == '-') => {
                let start = i;
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '-' || chars[i] == '_') {
                    i += 1;
                }
                let word: String = chars[start..i].iter().collect();
                if chars.get(i) == Some(&'(') {
                    let mut depth = 0;
                    while i < chars.len() {
                        match chars[i] {
                            '(' => depth += 1,
                            ')' => {
                                depth -= 1;
                                if depth == 0 {
                                    i += 1;
                                    break;
                                }
                            }
                            _ => {}
                        }
                        i += 1;
                    }
                    out.push(Syn::Function(word));
                } else {
                    out.push(Syn::Word(word));
                }
            }
            _ => {
                out.push(Syn::Literal(c));
                i += 1;
            }
        }
    }
    out
}

/// `{a}`, `{a,}` or `{a,b}` starting at `i`: the bounds and the position after the brace.
fn braces(chars: &[char], i: usize) -> ((usize, usize), usize) {
    let end = chars[i..].iter().position(|&c| c == '}').map_or(chars.len(), |p| i + p);
    let inner: String = chars[i + 1..end].iter().collect();
    let number = |text: &str| text.trim().parse().unwrap_or(0);
    let range = match inner.split_once(',') {
        Some((min, max)) if max.trim().is_empty() => (number(min), usize::MAX),
        Some((min, max)) => (number(min), number(max)),
        None => (number(&inner), number(&inner)),
    };
    (range, end + 1)
}

const MATH: &[&str] = &[
    "abs", "acos", "asin", "atan", "atan2", "calc", "clamp", "cos", "exp", "hypot", "log", "max", "min", "mod", "pow",
    "rem", "round", "sign", "sin", "sqrt", "tan",
];
const NUMERIC: &[&str] =
    &["length", "percentage", "number", "integer", "angle", "time", "frequency", "resolution", "flex", "dimension"];

/// Grammars nest; past this depth a type matches any one component.
const MAX_DEPTH: usize = 24;

struct Matcher {
    depth: usize,
    /// The range of the reference being expanded (`<length-percentage [0,∞]>`), for the base types
    /// inside it that state none of their own.
    range: Option<(f64, f64)>,
}

impl Matcher {
    /// Every position the node can end at, starting at `at`.
    fn ends(&self, node: &Node, tokens: &[Token<'_>], at: usize) -> Vec<usize> {
        let mut out = match node {
            Node::Keyword(word) => {
                one_if(matches!(tokens.get(at), Some(Token::Ident(found)) if found.eq_ignore_ascii_case(word)), at)
            }
            Node::Literal(character) => {
                one_if(matches!((character, tokens.get(at)), (',', Some(Token::Comma)) | ('/', Some(Token::Slash))), at)
            }
            Node::Function(name) => {
                one_if(matches!(tokens.get(at), Some(Token::Function(found)) if found.eq_ignore_ascii_case(name)), at)
            }
            Node::Type { name, range } => self.typed(name, *range, tokens, at),
            Node::Property(name) => match lookup(PROPERTY_SYNTAX, name) {
                Some(syntax) => self.deeper(&parsed(syntax), None, tokens, at),
                None => one_if(at < tokens.len(), at),
            },
            Node::Seq(items) => items.iter().fold(vec![at], |starts, item| {
                starts.iter().flat_map(|&start| self.ends(item, tokens, start)).collect::<Vec<_>>()
            }),
            Node::One(options) => options.iter().flat_map(|option| self.ends(option, tokens, at)).collect(),
            Node::All(items) => self.unordered(items, tokens, at, true),
            Node::Any(items) => self.unordered(items, tokens, at, false),
            Node::Repeat { node, min, max, comma } => self.repeat(node, *min, *max, *comma, tokens, at),
        };
        out.sort_unstable();
        out.dedup();
        out
    }

    fn deeper(&self, node: &Node, range: Option<(f64, f64)>, tokens: &[Token<'_>], at: usize) -> Vec<usize> {
        if self.depth >= MAX_DEPTH {
            return one_if(at < tokens.len(), at);
        }
        Matcher { depth: self.depth + 1, range }.ends(node, tokens, at)
    }

    fn typed(&self, name: &str, range: Option<(f64, f64)>, tokens: &[Token<'_>], at: usize) -> Vec<usize> {
        let Some(token) = tokens.get(at) else { return Vec::new() };
        let range = range.or(self.range);
        let in_range = |value: f64| range.is_none_or(|(min, max)| value >= min && value <= max);
        if let Token::Function(function) = token
            && NUMERIC.contains(&name)
            && MATH.iter().any(|math| function.eq_ignore_ascii_case(math))
        {
            return vec![at + 1];
        }
        let base = match (name, token) {
            ("length", Token::Number { value, .. }) => Some(*value == 0.0),
            ("length" | "angle" | "time" | "frequency" | "resolution" | "flex", Token::Dimension { value, unit }) => {
                Some(unit_type(unit) == Some(name) && in_range(*value))
            }
            ("dimension", Token::Dimension { value, .. }) | ("percentage", Token::Percentage(value)) => {
                Some(in_range(*value))
            }
            ("number", Token::Number { value, .. }) => Some(in_range(*value)),
            ("integer", Token::Number { value, integer }) => Some(*integer && in_range(*value)),
            ("string", Token::String) | ("hex-color", Token::Hash) => Some(true),
            ("url", Token::Function(function)) => Some(function.eq_ignore_ascii_case("url")),
            // A `<dashed-ident>` is a `<custom-ident>` too (CSS Values 4).
            ("ident" | "custom-ident", Token::Ident(_)) => Some(true),
            ("dashed-ident" | "custom-property-name", Token::Ident(word)) => Some(word.starts_with("--")),
            (
                "length"
                | "angle"
                | "time"
                | "frequency"
                | "resolution"
                | "flex"
                | "dimension"
                | "percentage"
                | "number"
                | "integer"
                | "string"
                | "hex-color"
                | "url"
                | "ident"
                | "custom-ident"
                | "dashed-ident"
                | "custom-property-name",
                _,
            ) => Some(false),
            _ => None,
        };
        match base {
            Some(matched) => one_if(matched, at),
            None => match lookup(SYNTAXES, name) {
                Some(syntax) => self.deeper(&parsed(syntax), range, tokens, at),
                None => vec![at + 1],
            },
        }
    }

    /// `&&` (every item, once each) and `||` (at least one, at most once each), in any order.
    fn unordered(&self, items: &[Node], tokens: &[Token<'_>], at: usize, every: bool) -> Vec<usize> {
        let mut out = Vec::new();
        let mut seen = std::collections::HashSet::new();
        let mut frontier = vec![(at, vec![false; items.len()])];
        while let Some((position, used)) = frontier.pop() {
            if !seen.insert((position, used.clone())) {
                continue;
            }
            let count = used.iter().filter(|u| **u).count();
            if count > 0 && (!every || count == items.len()) {
                out.push(position);
            }
            for (index, item) in items.iter().enumerate() {
                if used[index] {
                    continue;
                }
                // An optional item that matches nothing still counts as used.
                for end in self.ends(item, tokens, position) {
                    let mut next = used.clone();
                    next[index] = true;
                    frontier.push((end, next));
                }
            }
        }
        out
    }

    fn repeat(&self, node: &Node, min: usize, max: usize, comma: bool, tokens: &[Token<'_>], at: usize) -> Vec<usize> {
        let mut out = Vec::new();
        let mut current = vec![at];
        let mut count = 0;
        if min == 0 {
            out.push(at);
        }
        while !current.is_empty() && count < max && count <= tokens.len() {
            let mut next = Vec::new();
            for &start in &current {
                let from = if comma && count > 0 {
                    match tokens.get(start) {
                        Some(Token::Comma) => start + 1,
                        _ => continue,
                    }
                } else {
                    start
                };
                next.extend(self.ends(node, tokens, from).into_iter().filter(|&end| end > start));
            }
            next.sort_unstable();
            next.dedup();
            count += 1;
            if count >= min {
                out.extend(&next);
            }
            current = next;
        }
        out
    }
}

fn one_if(matched: bool, at: usize) -> Vec<usize> {
    if matched { vec![at + 1] } else { Vec::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn verdict(property: &str, value: &str) -> Verdict {
        check(property, value)
    }

    #[test]
    fn accepts_what_the_grammars_allow() {
        for (property, value) in [
            ("padding", "1rem"),
            ("padding", "1px 2px 3px 4px"),
            ("padding", "0"),
            ("padding", "calc(1rem + 2px)"),
            ("margin", "-4px auto"),
            ("display", "inline flex"),
            ("display", "flex"),
            ("display", "grid"),
            ("color", "red"),
            ("color", "#06c"),
            ("color", "currentColor"),
            ("color", "light-dark(black, white)"),
            ("color", "oklch(54.6% 0.245 262.881)"),
            ("background-color", "transparent"),
            ("align-self", "anchor-center"),
            ("align-self", "safe center"),
            ("width", "calc-size(auto, size)"),
            ("width", "anchor-size(width)"),
            ("width", "fit-content"),
            ("opacity", "0.5"),
            ("opacity", "50%"),
            ("z-index", "10"),
            ("font-weight", "600"),
            ("line-height", "1.5"),
            ("transition-duration", "150ms"),
            ("transition-property", "translate, background-color"),
            ("border", "1px solid gainsboro"),
            ("border-radius", "8px / 4px"),
            ("translate", "0 1px"),
            ("rotate", "45deg"),
            ("font-family", "serif"),
            ("grid-template-columns", "1fr 2fr"),
            ("aspect-ratio", "16 / 9"),
            ("content", "''"),
            ("background-image", "url(a.png)"),
            ("transform", "translateX(1px) rotate(2deg)"),
            ("box-shadow", "0 0 0 2px red, inset 0 1px 0 black"),
            ("position-anchor", "--anchor"),
            ("transition-timing-function", "cubic-bezier(0.4, 0, 0.2, 1)"),
            ("padding", "inherit"),
            ("display", "revert-layer"),
        ] {
            assert_eq!(verdict(property, value), Verdict::Accepted, "{property}: {value}");
        }
    }

    #[test]
    fn rejects_known_words_in_the_wrong_place() {
        for (property, value) in [
            ("padding", "red"),
            ("padding", "-4px"),
            ("padding", "1px 2px 3px 4px 5px"),
            ("display", "center"),
            ("color", "12px"),
            ("width", "-4px"),
            ("opacity", "solid"),
            ("z-index", "1.5"),
            ("transition-duration", "150px"),
            ("font-weight", "12px"),
            ("align-self", "space-between"),
            ("border-style", "1px"),
            ("padding", "1rem,"),
            ("width", "\"text\""),
        ] {
            // A rejection names the property's own syntax.
            let expected = lookup(PROPERTY_SYNTAX, property).unwrap();
            assert_eq!(verdict(property, value), Verdict::Rejected { expected }, "{property}: {value}");
        }
        assert_eq!(
            verdict("padding", "red"),
            Verdict::Rejected { expected: lookup(PROPERTY_SYNTAX, "padding").unwrap() }
        );
    }

    #[test]
    fn leaves_what_it_cannot_judge() {
        for (property, value) in [
            // A word or a function no grammar names: newer CSS, or the author's own.
            ("animation-name", "spin"),
            ("font-family", "Inter, system-ui"),
            ("width", "brand-new-function(1px)"),
            ("display", "brand-new-keyword"),
            // Substitutions and units outside the data.
            ("padding", "var(--gap)"),
            ("padding", "env(safe-area-inset-top)"),
            ("width", "4zz"),
            // A bracketed block, a character no grammar here reads, and an unreadable value.
            ("grid-template-columns", "[full] 1fr [end]"),
            ("padding", "1px !important"),
            ("padding", "'unterminated"),
            ("padding", "fn(1px"),
            ("padding", "(1px"),
            // A property without a grammar.
            ("not-a-property", "red"),
        ] {
            assert_eq!(verdict(property, value), Verdict::Unchecked, "{property}: {value}");
        }
    }

    #[test]
    fn reads_numbers_strings_and_hashes() {
        assert_eq!(
            tokenize("+1.5e3 -.5% 2E-2px 'a\\'b' #fff a/b"),
            Some(vec![
                Token::Number { value: 1500.0, integer: false },
                Token::Percentage(-0.5),
                Token::Dimension { value: 0.02, unit: "px" },
                Token::String,
                Token::Hash,
                Token::Ident("a"),
                Token::Slash,
                Token::Ident("b"),
            ])
        );
        assert_eq!(tokenize("1e"), Some(vec![Token::Dimension { value: 1.0, unit: "e" }]));
        assert_eq!(tokenize("1."), Some(vec![Token::Number { value: 1.0, integer: true }, Token::Other]));
        assert_eq!(tokenize("--x -a -"), Some(vec![Token::Ident("--x"), Token::Ident("-a"), Token::Other]));
        assert_eq!(tokenize("f(\"(\") é"), Some(vec![Token::Function("f"), Token::Ident("é")]));
        assert_eq!(tokenize("f(\"unterminated)"), None);
        // Nested blocks close at their own depth.
        assert_eq!(tokenize("f(g(1)) [a [b]]"), Some(vec![Token::Function("f"), Token::Other]));
    }

    #[test]
    fn parses_value_definition_syntax() {
        let word = |w: &str| Node::Keyword(w.to_owned());
        assert_eq!(Parser::new("a | b c").one(), Node::One(vec![word("a"), Node::Seq(vec![word("b"), word("c")])]));
        assert_eq!(Parser::new("a || b && c").one(), Node::Any(vec![word("a"), Node::All(vec![word("b"), word("c")])]));
        assert_eq!(
            Parser::new("[ a ]#{1,2} b{2} c{1,} d? e* f+").one(),
            Node::Seq(vec![
                Node::Repeat { node: Box::new(word("a")), min: 1, max: 2, comma: true },
                Node::Repeat { node: Box::new(word("b")), min: 2, max: 2, comma: false },
                Node::Repeat { node: Box::new(word("c")), min: 1, max: usize::MAX, comma: false },
                Node::Repeat { node: Box::new(word("d")), min: 0, max: 1, comma: false },
                Node::Repeat { node: Box::new(word("e")), min: 0, max: usize::MAX, comma: false },
                Node::Repeat { node: Box::new(word("f")), min: 1, max: usize::MAX, comma: false },
            ])
        );
        assert_eq!(
            Parser::new("<length [0,∞]> <'width'> <x [-∞,+∞]> <y [1px,abc]> f( a ( b ) ) 'x' 'yz' a#  [ b ]!").one(),
            Node::Seq(vec![
                Node::Type { name: "length".into(), range: Some((0.0, f64::INFINITY)) },
                Node::Property("width".into()),
                Node::Type { name: "x".into(), range: Some((f64::NEG_INFINITY, f64::INFINITY)) },
                Node::Type { name: "y".into(), range: Some((1.0, f64::NEG_INFINITY)) },
                Node::Function("f".into()),
                Node::Literal('x'),
                word("yz"),
                Node::Repeat { node: Box::new(word("a")), min: 1, max: usize::MAX, comma: true },
                word("b"),
            ])
        );
        // A stray closing bracket or combinator ends the sequence where it stands.
        assert_eq!(Parser::new("] a").one(), Node::Seq(Vec::new()));
        assert_eq!(Parser::new("[ a").one(), word("a"));
        assert_eq!(Parser::new("{2").one(), Node::Seq(Vec::new()));
        assert_eq!(Parser::new("a 'unterminated").one(), Node::Seq(vec![word("a"), word("unterminated")]));
        assert_eq!(Parser::new("-moz-x | --y").one(), Node::One(vec![word("-moz-x"), word("--y")]));
    }

    #[test]
    fn matches_combinators() {
        let tokens = tokenize("a b").unwrap();
        let matcher = Matcher { depth: 0, range: None };
        let ends = |syntax: &str| matcher.ends(&Parser::new(syntax).one(), &tokens, 0);
        assert_eq!(ends("a && b"), vec![2]);
        assert_eq!(ends("b && a"), vec![2]);
        assert_eq!(ends("[a]? && [b]?"), vec![0, 1, 2]);
        assert_eq!(ends("a || b"), vec![1, 2]);
        assert_eq!(ends("c || d"), Vec::<usize>::new());
        assert_eq!(ends("[a | b]{2}"), vec![2]);
        assert_eq!(ends("[a | b]{3}"), Vec::<usize>::new());
        assert_eq!(ends("a#"), vec![1]);
        let listed = tokenize("a, a").unwrap();
        assert_eq!(matcher.ends(&Parser::new("a#").one(), &listed, 0), vec![1, 3]);
        assert_eq!(matcher.ends(&Parser::new("a ','").one(), &listed, 0), vec![2]);
        assert_eq!(matcher.ends(&Parser::new("a '~'").one(), &listed, 0), Vec::<usize>::new());
        // An undefined type matches any one component; at the end of the value, none.
        assert_eq!(matcher.ends(&Parser::new("<undefined-type>").one(), &tokens, 0), vec![1]);
        assert_eq!(matcher.ends(&Parser::new("<length>").one(), &tokens, 2), Vec::<usize>::new());
        assert_eq!(matcher.ends(&Parser::new("<'not-a-property'>").one(), &tokens, 0), vec![1]);
        // Past the depth limit a reference matches any one component.
        let deep = Matcher { depth: MAX_DEPTH, range: None };
        assert_eq!(deep.ends(&Parser::new("<'padding'>").one(), &tokens, 0), vec![1]);
    }

    #[test]
    fn matches_base_types() {
        let matcher = Matcher { depth: 0, range: None };
        let fits = |syntax: &str, value: &str| {
            let tokens = tokenize(value).unwrap();
            matcher.ends(&Parser::new(syntax).one(), &tokens, 0).contains(&tokens.len())
        };
        assert!(fits("<angle>", "1turn") && fits("<time>", "1s") && fits("<frequency>", "1khz"));
        assert!(fits("<resolution>", "2x") && fits("<flex>", "1fr") && fits("<dimension>", "3zz"));
        assert!(fits("<integer [1,∞]>", "2") && !fits("<integer [1,∞]>", "0") && !fits("<integer>", "1.5"));
        assert!(fits("<string>", "'a'") && fits("<url>", "url(a)") && !fits("<url>", "src(a)"));
        assert!(fits("<custom-ident>", "a") && fits("<custom-ident>", "--a"));
        assert!(fits("<dashed-ident>", "--a") && !fits("<dashed-ident>", "a"));
        assert!(fits("<hex-color>", "#fff") && !fits("<hex-color>", "a"));
        assert!(fits("<length>", "max(1px, 2px)") && !fits("<string>", "calc(1px)"));
        assert!(!fits("<length>", "1deg") && !fits("<number>", "a"));
    }
}
