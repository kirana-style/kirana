//! Values produced by the restricted evaluator (KRN-CMP-003, KRN-DYN-001).

use std::sync::Arc;

use crate::condition::Condition;
use crate::defs::{CounterStyleDef, Dep, KeyframesDef, PositionTryDef};
use crate::style::{Handle, Target};

/// A byte range in the module being compiled.
pub type SourceSpan = (u32, u32);

/// The `@kirana-style/core` exports the compiler recognises.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Api {
    Css,
    Cx,
    Props,
    Recipe,
    Relation,
    Select,
    Keyframes,
    DefineTokens,
    DefineTheme,
    Mode,
    Media,
    Container,
    Supports,
    FirstThatWorks,
    PositionTry,
    ViewTransition,
    CounterStyle,
    Own,
}

impl Api {
    /// Looks an export up by name.
    pub fn from_export(name: &str) -> Option<Api> {
        Some(match name {
            "css" => Api::Css,
            "cx" => Api::Cx,
            "props" => Api::Props,
            "recipe" => Api::Recipe,
            "relation" => Api::Relation,
            "select" => Api::Select,
            "keyframes" => Api::Keyframes,
            "defineTokens" => Api::DefineTokens,
            "defineTheme" => Api::DefineTheme,
            "mode" => Api::Mode,
            "media" => Api::Media,
            "container" => Api::Container,
            "supports" => Api::Supports,
            "firstThatWorks" => Api::FirstThatWorks,
            "positionTry" => Api::PositionTry,
            "viewTransition" => Api::ViewTransition,
            "counterStyle" => Api::CounterStyle,
            "own" => Api::Own,
            _ => return None,
        })
    }

    /// The export name.
    pub fn export(self) -> &'static str {
        match self {
            Api::Css => "css",
            Api::Cx => "cx",
            Api::Props => "props",
            Api::Recipe => "recipe",
            Api::Relation => "relation",
            Api::Select => "select",
            Api::Keyframes => "keyframes",
            Api::DefineTokens => "defineTokens",
            Api::DefineTheme => "defineTheme",
            Api::Mode => "mode",
            Api::Media => "media",
            Api::Container => "container",
            Api::Supports => "supports",
            Api::FirstThatWorks => "firstThatWorks",
            Api::PositionTry => "positionTry",
            Api::ViewTransition => "viewTransition",
            Api::CounterStyle => "counterStyle",
            Api::Own => "own",
        }
    }
}

/// A method obtained by member access on a Kirana value, before it is called.
#[derive(Debug, Clone, PartialEq)]
pub enum Method {
    /// `field.within` / `field.after` / `field.before`.
    RelationRead(Arc<RelationValue>, crate::condition::RelationKind),
    /// `select.descendant` / `select.child`.
    Select { child: bool },
}

/// A declared relation (`relation("field")`).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct RelationValue {
    pub name: String,
    pub marker: String,
}

/// A token reference.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TokenRef {
    /// The CSS text used where the token appears: its literal value or `var(--kv…)`.
    pub css: String,
    /// The custom property when the token is a variable token.
    pub variable: Option<String>,
    /// `namespace.path`.
    pub identity: String,
    pub deps: Vec<Dep>,
}

/// A recipe definition ([06](../../../../spec/06-authoring-api.md#recipe--variants-and-slots)).
/// The handles of one variant option or compound entry, one per slot.
pub type SlotHandles = Vec<Handle>;

/// `(group, option)` selections.
pub type Selections = Vec<(String, String)>;

#[derive(Debug, Clone, PartialEq, Default)]
pub struct Recipe {
    /// Slot names; `None` for a single-element recipe.
    pub slots: Option<Vec<String>>,
    /// One handle per slot (or one).
    pub base: Vec<Handle>,
    /// Groups in declaration order: `(group, [(option, handles)])`.
    pub variants: Vec<(String, Vec<(String, SlotHandles)>)>,
    /// `(required options, handles)`.
    pub compounds: Vec<(Selections, SlotHandles)>,
    pub defaults: Vec<(String, String)>,
}

impl Recipe {
    /// The number of slots (1 without slots).
    pub fn slot_count(&self) -> usize {
        self.slots.as_ref().map_or(1, Vec::len)
    }

    /// Resolves static options (an unknown option name or value is an error string).
    pub fn resolve(&self, options: &[(String, String)]) -> Result<Vec<Handle>, String> {
        for (group, option) in options {
            let Some((_, choices)) = self.variants.iter().find(|(name, _)| name == group) else {
                return Err(format!("the recipe has no variant {group:?}"));
            };
            if !choices.iter().any(|(name, _)| name == option) {
                return Err(format!("variant {group:?} has no option {option:?}"));
            }
        }
        let chosen = |group: &str| {
            options.iter().chain(&self.defaults).find(|(name, _)| name == group).map(|(_, option)| option.as_str())
        };
        let mut result = self.base.clone();
        for (group, choices) in &self.variants {
            if let Some(option) = chosen(group)
                && let Some((_, handles)) = choices.iter().find(|(name, _)| name == option)
            {
                merge_slots(&mut result, handles);
            }
        }
        for (required, handles) in &self.compounds {
            if required.iter().all(|(group, option)| chosen(group) == Some(option.as_str())) {
                merge_slots(&mut result, handles);
            }
        }
        Ok(result)
    }
}

fn merge_slots(into: &mut [Handle], from: &[Handle]) {
    for (target, source) in into.iter_mut().zip(from) {
        target.merge(source);
    }
}

/// An object key after evaluation.
#[derive(Debug, Clone, PartialEq)]
pub enum Key {
    Str(Arc<str>),
    /// A condition value used as a computed key.
    Conditions(Arc<Vec<Condition>>),
    /// A `select.*` target used as a computed key.
    Select(Arc<Target>),
    /// A variable token used as a computed key assigns its custom property (D-035).
    Token(Arc<TokenRef>),
}

impl Key {
    /// The text of a string key.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Key::Str(text) => Some(text),
            _ => None,
        }
    }
}

/// A value only partly known at build time.
#[derive(Debug, Clone, PartialEq)]
pub enum Dynamic {
    /// Only known at runtime; the span is the expression to copy into the output.
    Open(SourceSpan),
    /// `test ? consequent : alternate` (or `test && consequent`) with a runtime test. `span` is the
    /// whole expression.
    Conditional { span: SourceSpan, test: SourceSpan, consequent: Value, alternate: Value },
    /// A style whose parts are merged at runtime (KRN-DYN-002, KRN-DYN-003).
    Style(Vec<StylePart>),
    /// A runtime spread argument (`...variants`) in a handle position.
    Spread(SourceSpan),
}

/// One part of a runtime-merged style, in merge order.
#[derive(Debug, Clone, PartialEq)]
pub enum StylePart {
    /// A handle known at build time.
    Static(Handle),
    /// A class expression: one of two handles chosen by a runtime test.
    Conditional { test: SourceSpan, consequent: Handle, alternate: Handle },
    /// A handle only known at runtime (a prop, a runtime recipe call).
    Runtime(SourceSpan),
    /// Runtime handles spread into the argument list (`...recipe(options)`).
    Spread(SourceSpan),
    /// A bridged atom plus the runtime assignment of its custom property.
    Bridge { handle: Handle, variable: String, value: SourceSpan },
}

/// An owned, lowered expression for pure-function descriptors.
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Value(Value),
    Param(usize),
    Template {
        quasis: Vec<Arc<str>>,
        expressions: Vec<Expr>,
    },
    Member {
        object: Box<Expr>,
        property: Box<Expr>,
    },
    Call {
        callee: Box<Expr>,
        arguments: Vec<Expr>,
    },
    Binary {
        operator: BinaryOp,
        left: Box<Expr>,
        right: Box<Expr>,
    },
    Unary {
        operator: UnaryOp,
        argument: Box<Expr>,
    },
    Logical {
        operator: LogicalOp,
        left: Box<Expr>,
        right: Box<Expr>,
    },
    Conditional {
        test: Box<Expr>,
        consequent: Box<Expr>,
        alternate: Box<Expr>,
    },
    Object(Vec<(ExprKey, Expr)>),
    Array(Vec<Expr>),
    /// `Object.entries(x)` and its kin, over a value known at build time (KF-053).
    Builtin {
        builtin: Builtin,
        argument: Box<Expr>,
    },
    /// `array.map(callback)`: the callback's parameters follow the enclosing function's, so its
    /// body reads both; each is the item, one element of it (`([key, value]) =>`) or the index.
    Map {
        array: Box<Expr>,
        slots: Vec<Slot>,
        body: Box<Expr>,
    },
}

/// A global function the evaluator runs on build-time values (KF-053).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Builtin {
    ObjectEntries,
    ObjectKeys,
    ObjectValues,
    ObjectFromEntries,
}

/// What a `map` callback's parameter receives.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Slot {
    /// `(item) =>`.
    Item,
    /// One element of an array item: `([key, value]) =>` is `ItemAt(0)`, `ItemAt(1)`.
    ItemAt(usize),
    /// `(item, index) =>`.
    Index,
}

/// An object key in a lowered expression.
#[derive(Debug, Clone, PartialEq)]
pub enum ExprKey {
    Static(Arc<str>),
    Computed(Expr),
    Spread,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOp {
    Add,
    Sub,
    Mul,
    Div,
    Rem,
    Eq,
    NotEq,
    StrictEq,
    StrictNotEq,
    /// `key in object`.
    In,
    Lt,
    LtEq,
    Gt,
    GtEq,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOp {
    Not,
    Minus,
    Plus,
    TypeOf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogicalOp {
    And,
    Or,
    Coalesce,
}

/// A small pure function the evaluator may apply at build time.
#[derive(Debug, Clone, PartialEq)]
pub struct Descriptor {
    pub params: usize,
    /// Each parameter written with a default (`later = color`), by index: the default is evaluated
    /// in the function's scope when the argument is absent or `undefined` (KF-040).
    pub defaults: Vec<(usize, Expr)>,
    pub body: Expr,
}

/// The reason prefix of [`Value::unresolved`].
const UNRESOLVED: &str = "unresolved import ";

/// The reason prefix of [`Value::cycle`].
const CYCLE: &str = "import cycle ";

/// An evaluated value.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Undefined,
    Null,
    Bool(bool),
    Number(f64),
    Str(Arc<str>),
    Array(Arc<Vec<Value>>),
    Object(Arc<Vec<(Key, Value)>>),
    Handle(Arc<Handle>),
    Token(Arc<TokenRef>),
    Keyframes(Arc<KeyframesDef>),
    /// A `@position-try` rule: its dashed ident at runtime.
    PositionTry(Arc<PositionTryDef>),
    /// A `@counter-style` rule: its custom ident at runtime.
    CounterStyle(Arc<CounterStyleDef>),
    /// `firstThatWorks(...)`: the preferred value first. Members are static CSS-bearing values.
    Fallbacks(Arc<Vec<Value>>),
    Conditions(Arc<Vec<Condition>>),
    Select(Arc<Target>),
    Relation(Arc<RelationValue>),
    Recipe(Arc<Recipe>),
    Api(Api),
    Method(Arc<Method>),
    Function(Arc<Descriptor>),
    Dynamic(Arc<Dynamic>),
    /// Not evaluable; the reason is shown when a static value was required.
    Unknown(Arc<str>),
}

impl Value {
    /// A string value.
    pub fn str(text: impl AsRef<str>) -> Value {
        Value::Str(Arc::from(text.as_ref()))
    }

    /// An unknown value with a reason.
    pub fn unknown(reason: impl AsRef<str>) -> Value {
        Value::Unknown(Arc::from(reason.as_ref()))
    }

    /// The value of an import whose specifier did not resolve from the file `from`.
    pub fn unresolved(specifier: &str, from: &str) -> Value {
        Value::unknown(format!("{UNRESOLVED}{specifier:?} from {from}"))
    }

    /// The value of an import that closes a cycle (`a.ts → b.ts → a.ts`): the module it names is
    /// still being evaluated, so none of its exports is known yet.
    pub fn cycle(chain: &str) -> Value {
        Value::unknown(format!("{CYCLE}{chain}"))
    }

    /// The first import cycle (`a.ts → b.ts → a.ts`) this value was cut short by.
    pub fn import_cycle(&self) -> Option<&str> {
        match self {
            Value::Unknown(reason) => reason.strip_prefix(CYCLE),
            Value::Array(items) => items.iter().find_map(Value::import_cycle),
            Value::Object(entries) => entries.iter().find_map(|(_, value)| value.import_cycle()),
            _ => None,
        }
    }

    /// The first unresolved import (`"specifier" from file`) this value depends on.
    pub fn unresolved_import(&self) -> Option<&str> {
        match self {
            Value::Unknown(reason) => reason.strip_prefix(UNRESOLVED),
            Value::Array(items) => items.iter().find_map(Value::unresolved_import),
            Value::Object(entries) => entries.iter().find_map(|(_, value)| value.unresolved_import()),
            _ => None,
        }
    }

    /// Whether the value is fully known at build time (no dynamic or unknown parts inside).
    pub fn is_static(&self) -> bool {
        match self {
            Value::Dynamic(_) | Value::Unknown(_) => false,
            Value::Array(items) => items.iter().all(Value::is_static),
            Value::Object(entries) => entries.iter().all(|(_, value)| value.is_static()),
            _ => true,
        }
    }

    /// JavaScript truthiness, when it is known.
    pub fn truthy(&self) -> Option<bool> {
        Some(match self {
            Value::Undefined | Value::Null => false,
            Value::Bool(value) => *value,
            Value::Number(number) => *number != 0.0 && !number.is_nan(),
            Value::Str(text) => !text.is_empty(),
            Value::Dynamic(_) | Value::Unknown(_) => return None,
            _ => true,
        })
    }

    /// Looks a static string key up in an object value.
    pub fn get(&self, name: &str) -> Option<&Value> {
        match self {
            Value::Object(entries) => {
                entries.iter().rev().find_map(|(key, value)| (key.as_str() == Some(name)).then_some(value))
            }
            _ => None,
        }
    }
}

/// JavaScript `Number.prototype.toString` for the values style code uses.
pub fn number_to_string(number: f64) -> String {
    if number.is_nan() {
        "NaN".to_owned()
    } else if number.is_infinite() {
        if number > 0.0 { "Infinity".to_owned() } else { "-Infinity".to_owned() }
    } else if number == 0.0 {
        "0".to_owned()
    } else {
        format!("{number}")
    }
}
