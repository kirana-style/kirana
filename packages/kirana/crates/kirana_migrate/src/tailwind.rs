//! The Tailwind codemod behind `kirana-style migrate tailwind` (KRN-API-013, D-058,
//! `design-notes/migrate-tailwind.md`).
//!
//! Class strings are lowered through `kirana_utility` and rendered as source, so the object compiles
//! to the same atoms as the class string it replaces, but for a composition an element alone can
//! resolve (`Walker::resolve_layers`). Relations, contextual targets and `dark:` are handled here; what needs a person (`!important`, an undeclared custom variant, a dynamic class
//! string) is reported and left in a comment.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Component, Path, PathBuf};

use kirana_config::{Grammar, Rule, Variant};
use kirana_ir::{TokenDef, TokenValue, Value};
use kirana_utility::{Exported, Expr, Scales, Tree};
use oxc_ast::ast::{
    Argument, ArrowFunctionExpression, BindingPattern, BindingProperty, CallExpression, Declaration, Expression,
    FormalParameters, Function, IdentifierReference, ImportDeclaration, ImportDeclarationSpecifier, JSXAttribute,
    JSXAttributeItem, JSXAttributeName, JSXAttributeValue, JSXElementName, JSXExpression, JSXMemberExpressionObject,
    JSXOpeningElement, LogicalOperator, ObjectExpression, ObjectProperty, ObjectPropertyKind, Program, PropertyKey,
    Statement, TSPropertySignature, TSType, TSTypeLiteral, TSTypeName, TSTypeReference, VariableDeclarationKind,
    VariableDeclarator,
};
use oxc_ast_visit::{Visit, walk};
use oxc_span::{GetSpan, Span};
use oxc_syntax::scope::ScopeFlags;

use crate::{Migration, Note};

/// What the codemod reads besides the file: the project's scales and packages.
pub trait Environment {
    /// The value `export` of `module` has, imported from the file being migrated.
    fn export(&self, module: &str, export: &str) -> Value;
    /// Whether `specifier` is an installed package, whose components do not read `sx`.
    fn is_external(&self, specifier: &str) -> bool;
    /// How the file being migrated imports `file`: relative within a package, through the other
    /// package's `exports` across packages.
    fn specifier(&self, file: &Path) -> String;
    /// The file `specifier` resolves to from the file being migrated.
    fn resolve(&self, specifier: &str) -> Option<PathBuf>;
    /// The definition of the token whose custom property is `variable`, from a module an `export`
    /// has evaluated: a composition layer's registration and initial value.
    fn token(&self, variable: &str) -> Option<std::sync::Arc<TokenDef>>;
}

/// What a first pass over every file ([`survey`]) learns about the others: which file anchors each
/// relation and which read it — the anchoring file exports the relation and its readers import it,
/// since a relation is identified by package and name — and which components receive a class.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProjectMap {
    /// Relation identifier → the file that anchors it (the first one found).
    pub anchors: BTreeMap<String, PathBuf>,
    /// Relation identifier → the files that read it and anchor it nowhere themselves.
    pub readers: BTreeMap<String, BTreeSet<PathBuf>>,
    /// Components some file passes a class to, by the file declaring them and their name.
    pub styled: BTreeSet<(PathBuf, String)>,
    /// Recipes (`cva`s), by the file declaring them and their name.
    pub recipes: BTreeSet<(PathBuf, String)>,
    /// `data-slot` values some file reads with `in-data-[slot=…]:`; elements written with one anchor it.
    pub slot_reads: BTreeSet<String>,
    /// `data-slot` value → the properties its elements' own styles set (their class list or recipe),
    /// each with its value when set unconditionally (else empty).
    pub slot_properties: BTreeMap<String, BTreeSet<(String, String)>>,
    /// Contextual rules on a `data-slot` target, to be written on the target itself (D-016), in
    /// source order: the later of two on one property wins, as in the class string.
    pub inversions: Vec<Inversion>,
    /// Recipes, by file and name → the `data-slot` values of the elements that apply them.
    pub recipe_slots: BTreeMap<(PathBuf, String), BTreeSet<String>>,
    /// Components some file renders through a `render` prop (`render={<Button />}`), by the file
    /// declaring them and their name: the part hands them its class.
    pub rendered: BTreeSet<(PathBuf, String)>,
    /// Components that pass their `className` on to another of the project's components: from, to.
    pub class_forwards: BTreeSet<((PathBuf, String), (PathBuf, String))>,
    /// The composition layers a contextual rule sets or reads anywhere (`*:shadow-sm`): an element
    /// they may reach keeps composing those (KF-076).
    pub contextual_layers: BTreeSet<String>,
}

/// A parent's contextual rule on a `data-slot` target (`*:data-[slot=x]:w-full`). A `select` block
/// ranks below the target's own styles (D-016), where Tailwind's parent rule won, so the target
/// carries the rule itself, under a condition on its position:
/// `':is([data-slot="parent"] > [data-slot="x"])': "100%"`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct Inversion {
    pub parent: InversionParent,
    /// `" > "` for a child, `" "` for a descendant.
    pub combinator: String,
    /// The contextual target as written, and the `data-slot` it names.
    pub target: String,
    pub slot: String,
    /// Conditions after the target (`@media`), rendered.
    pub conditions: Vec<String>,
    /// The utility without its variants (`w-full`, `-mt-2`).
    pub utility: String,
}

/// Where a parent's selector comes from.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum InversionParent {
    /// An element written with this `data-slot`.
    Slot(String),
    /// A recipe's base, applied by elements with one `data-slot` (by file and name).
    Recipe(PathBuf, String),
}

impl ProjectMap {
    /// Whether a component keeps merging an incoming `className`: it is rendered through a `render`
    /// prop, or one that does passes its class on to it.
    pub fn keeps_class(&self, file: &Path, name: &str) -> bool {
        let mut keepers = self.rendered.clone();
        loop {
            let more: Vec<(PathBuf, String)> = self
                .class_forwards
                .iter()
                .filter(|(from, to)| keepers.contains(from) && !keepers.contains(to))
                .map(|(_, to)| to.clone())
                .collect();
            if more.is_empty() {
                return keepers.contains(&(file.to_path_buf(), name.to_owned()));
            }
            keepers.extend(more);
        }
    }

    /// The parent's selector, when it has one: a recipe applied by elements of exactly one slot.
    fn parent_selector(&self, parent: &InversionParent) -> Option<String> {
        let slot = match parent {
            InversionParent::Slot(slot) => slot.clone(),
            InversionParent::Recipe(file, name) => {
                let slots = self.recipe_slots.get(&(file.clone(), name.clone()))?;
                (slots.len() == 1).then(|| slots.iter().next().cloned()).flatten()?
            }
        };
        Some(format!("[data-slot=\"{slot}\"]"))
    }

    /// Whether the rule moves to its target: the parent has a selector, and the target's elements
    /// have a class list or recipe to carry it.
    pub fn inverts(&self, inversion: &Inversion) -> bool {
        self.parent_selector(&inversion.parent).is_some() && self.slot_properties.contains_key(&inversion.slot)
    }

    /// The rules the elements with `slot` carry for their parents: condition, further conditions
    /// and utility.
    pub fn inversions_for(&self, slot: &str) -> Vec<(String, Vec<String>, String)> {
        self.inversions
            .iter()
            .filter(|inversion| inversion.slot == slot && self.slot_properties.contains_key(slot))
            .filter_map(|inversion| {
                let parent = self.parent_selector(&inversion.parent)?;
                let condition = format!(":is({parent}{}{})", inversion.combinator, inversion.target);
                Some((js_string(&condition), inversion.conditions.clone(), inversion.utility.clone()))
            })
            .collect()
    }

    /// Adds one file's survey.
    pub fn add(&mut self, file: &Path, survey: &Survey) {
        for identifier in &survey.anchored {
            self.anchors.entry(identifier.clone()).or_insert_with(|| file.to_path_buf());
        }
        for identifier in survey.read.difference(&survey.anchored) {
            self.readers.entry(identifier.clone()).or_default().insert(file.to_path_buf());
        }
        self.styled.extend(survey.styled.iter().cloned());
        self.rendered.extend(survey.rendered.iter().cloned());
        self.class_forwards.extend(survey.class_forwards.iter().cloned());
        self.contextual_layers.extend(survey.contextual_layers.iter().cloned());
        self.recipes.extend(survey.recipes.iter().map(|recipe| (file.to_path_buf(), recipe.clone())));
        for slot in &survey.slots {
            self.anchors.entry(slot_identifier(slot)).or_insert_with(|| file.to_path_buf());
        }
        self.slot_reads.extend(survey.slot_reads.iter().cloned());
        for (slot, properties) in &survey.slot_properties {
            self.slot_properties.entry(slot.clone()).or_default().extend(properties.iter().cloned());
        }
        for inversion in &survey.inversions {
            if !self.inversions.contains(inversion) {
                self.inversions.push(inversion.clone());
            }
        }
        for (recipe, slot) in &survey.recipe_slots {
            self.recipe_slots.entry((file.to_path_buf(), recipe.clone())).or_default().insert(slot.clone());
        }
    }
}

/// The relations one file anchors and reads, the components it passes a class to, and its recipes.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Survey {
    pub anchored: BTreeSet<String>,
    pub read: BTreeSet<String>,
    pub styled: BTreeSet<(PathBuf, String)>,
    pub recipes: BTreeSet<String>,
    /// The `data-slot` values its elements are written with, and those it reads with `in-*`.
    pub slots: BTreeSet<String>,
    pub slot_reads: BTreeSet<String>,
    pub slot_properties: BTreeMap<String, BTreeSet<(String, String)>>,
    pub inversions: Vec<Inversion>,
    /// Recipes applied by an element with a `data-slot`: recipe, slot.
    pub recipe_slots: BTreeSet<(String, String)>,
    pub rendered: BTreeSet<(PathBuf, String)>,
    pub class_forwards: BTreeSet<((PathBuf, String), (PathBuf, String))>,
    pub contextual_layers: BTreeSet<String>,
}

/// The first pass: what a file would anchor and read, without writing anything.
pub fn survey(path: &Path, source: &str, options: &Options<'_>, environment: &dyn Environment) -> Survey {
    let file = path.display().to_string();
    kirana_frontend::with_parsed(path, &file, source, |parsed| {
        let mut walker = Walker::new(path, source, options, environment);
        walker.visit_program(parsed.program);
        Survey {
            anchored: walker.anchored,
            read: walker.read,
            styled: walker.styled,
            recipes: walker.recipes,
            slots: walker.slots,
            slot_reads: walker.slot_reads,
            slot_properties: walker.slot_properties,
            inversions: walker.inversions,
            recipe_slots: walker.recipe_slots,
            rendered: walker.rendered,
            class_forwards: walker.class_forwards,
            contextual_layers: walker.contextual_layers,
        }
    })
    .unwrap_or_default()
}

/// The project-wide inputs of a Tailwind migration.
pub struct Options<'o> {
    /// The configured grammar; its relative modules are already absolute (`kirana_config`).
    pub grammar: &'o Grammar,
    /// Variants and utilities the project's CSS declares (`@custom-variant`, `@utility`): a use of
    /// one the grammar does not also declare is reported, not read with Tailwind's default meaning.
    pub custom_variants: &'o BTreeSet<String>,
    pub custom_utilities: &'o BTreeSet<String>,
    /// Relations anchored in one file and read in another ([`survey`]).
    pub project: &'o ProjectMap,
}

/// Migrates one file's source.
pub fn migrate(path: &Path, source: &str, options: &Options<'_>, environment: &dyn Environment) -> Migration {
    let file = path.display().to_string();
    let parsed = kirana_frontend::with_parsed(path, &file, source, |parsed| {
        let mut walker = Walker::new(path, source, options, environment);
        walker.visit_program(parsed.program);
        walker.finish()
    });
    match parsed {
        Ok((rewritten, notes)) => Migration { source: rewritten, notes, rename: None },
        Err(_) => Migration {
            source: source.to_owned(),
            notes: vec![Note { offset: 0, message: "the file does not parse; nothing was rewritten".to_owned() }],
            rename: None,
        },
    }
}

/// One class string, lowered as `kirana-style migrate tailwind` lowers a `className` (KF-004).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Lowering {
    /// The `css()` call the class string becomes; `None` when nothing in it sets a value.
    pub style: Option<String>,
    /// A module holding it as `styles.style`, with the imports, relations and per-mode tokens it
    /// needs, as the codemod would write them into a file at the given path, and what an element's
    /// `sx` then holds (`const sx = [...]`).
    pub module: String,
    /// Relation identifiers the element anchors (`group/menu` gives `menuGroup`): apply
    /// `<identifier>.anchor` beside the style.
    pub anchors: Vec<String>,
    /// Utilities left out, each with the reason, as the codemod leaves them in a comment.
    pub left: Vec<String>,
    /// What the codemod reports beside the rewrite.
    pub notes: Vec<String>,
}

/// Lowers `classes` as an element's `className` in a file at `path`: token imports are written as
/// that file would import them. The same lowering as [`migrate`], one class string at a time, for a
/// tool that reports what a Tailwind class string becomes without rewriting a file.
pub fn lower(path: &Path, classes: &str, options: &Options<'_>, environment: &dyn Environment) -> Lowering {
    // One line of source, so that what an element's `sx` holds is written after the declarations.
    let mut walker = Walker::new(path, "\n", options, environment);
    let lowered = walker.lower(classes, 0);
    let style = (!lowered.entries.is_empty() || !lowered.left.is_empty())
        .then(|| format!("css({})", Walker::object(&lowered, "  ")));
    let mut items: Vec<String> = lowered.anchors.iter().map(|anchor| format!("{anchor}.anchor")).collect();
    items.extend(lowered.handles.iter().cloned());
    if let Some(style) = &style {
        walker.core.insert("css");
        walker.styles.push(("style".to_owned(), style.clone()));
        items.push(format!("{}.style", walker.styles_name));
    }
    if !items.is_empty() {
        walker.edits.push((Span::new(1, 1), format!("const sx = [{}]\n", items.join(", "))));
    }
    let (module, notes) = walker.finish();
    Lowering {
        style,
        // The blank line the source's own line leaves before `sx`, and that line alone when the
        // string sets nothing.
        module: module.replacen("\n\n\nconst sx", "\n\nconst sx", 1).trim_start().to_owned(),
        anchors: lowered.anchors,
        left: lowered.left,
        notes: notes.into_iter().map(|note| note.message).collect(),
    }
}

/// The relation `in-data-[slot=button-group]:` reads and `data-slot="button-group"` anchors.
fn slot_identifier(slot: &str) -> String {
    let name = camel(slot);
    format!("in{}{}", name[..1].to_ascii_uppercase(), &name[1..])
}

/// `data-[slot=button-group]` → `button-group`.
fn slot_of(variant: &str) -> Option<&str> {
    let slot = variant.strip_prefix("data-[slot=")?.strip_suffix(']')?;
    let slot = slot.trim_matches(|quote| quote == '"' || quote == '\'');
    (!slot.is_empty()).then_some(slot)
}

/// The `data-slot` a contextual block targets: `[select.child('[data-slot="x"]')]` → `x`.
fn block_slot(block: &str) -> Option<&str> {
    let rest = &block[block.find("data-slot=")? + "data-slot=".len()..];
    let rest = rest.trim_start_matches(['"', '\'', '\\']);
    let end = rest.find(['"', '\'', ']', '\\']).unwrap_or(rest.len());
    (end > 0).then(|| &rest[..end])
}

/// The physical longhands a property sets, so `borderWidth` and `borderBottomWidth` overlap and
/// `paddingInlineStart` meets `paddingLeft`.
fn longhands(property: &str) -> BTreeSet<String> {
    fn leaves(kebab: &str, out: &mut BTreeSet<String>) {
        match kirana_css_data::family_longhands(kebab) {
            Some(children) => children.iter().for_each(|child| leaves(child, out)),
            None => {
                out.insert(kirana_css_data::physical_counterpart(kebab).unwrap_or(kebab).to_owned());
            }
        }
    }
    let mut out = BTreeSet::new();
    leaves(&kirana_shared::kebab_case(property), &mut out);
    out
}

/// A render target's incoming class, passed on as `cn()` did: a class string, never a function of
/// state (`cn()` dropped those).
const INCOMING_CLASS: &str = "typeof className === \"string\" && className";

/// Class-joining helpers whose calls become `sx` arrays.
const JOINERS: [&str; 4] = ["cn", "clsx", "twMerge", "classNames"];

/// One piece of a rendered value: CSS text, or a JavaScript expression inside a template.
#[derive(Debug, Clone, PartialEq)]
enum Part {
    Text(String),
    Code(String),
}

/// A value as source: one string literal, one expression, or a template literal of both.
fn render_value(parts: &[Part]) -> String {
    match parts {
        [Part::Text(text)] => js_string(text),
        [Part::Code(code)] => code.clone(),
        _ => {
            let mut out = String::from("`");
            for part in parts {
                match part {
                    Part::Text(text) => {
                        out.push_str(&text.replace('\\', "\\\\").replace('`', "\\`").replace("${", "\\${"))
                    }
                    Part::Code(code) => {
                        out.push_str("${");
                        out.push_str(code);
                        out.push('}');
                    }
                }
            }
            out.push('`');
            out
        }
    }
}

/// A JavaScript string literal, in double quotes unless the text holds them.
fn js_string(text: &str) -> String {
    let escaped = text.replace('\\', "\\\\");
    if !text.contains('"') {
        format!("\"{escaped}\"")
    } else if !text.contains('\'') {
        format!("'{escaped}'")
    } else {
        format!("\"{}\"", escaped.replace('"', "\\\""))
    }
}

/// An object key: bare when it is an identifier.
fn js_key(name: &str) -> String {
    if name.starts_with('[') {
        return name.to_owned();
    }
    let identifier =
        name.chars().next().is_some_and(|first| first.is_ascii_alphabetic() || first == '_' || first == '$')
            && name.chars().all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '$');
    if identifier { name.to_owned() } else { js_string(name) }
}

/// A CSS property as `css()` names it: `content-visibility` → `contentVisibility`,
/// `-webkit-line-clamp` → `WebkitLineClamp`.
fn camel_property(property: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for character in property.chars() {
        if character == '-' {
            upper = true;
        } else if upper {
            out.push(character.to_ascii_uppercase());
            upper = false;
        } else {
            out.push(character);
        }
    }
    out
}

/// `card-header` → `cardHeader`.
fn camel(name: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for character in name.chars() {
        if character.is_ascii_alphanumeric() {
            if upper && !out.is_empty() {
                out.push(character.to_ascii_uppercase());
            } else if out.is_empty() {
                out.push(character.to_ascii_lowercase());
            } else {
                out.push(character);
            }
            upper = false;
        } else {
            upper = true;
        }
    }
    if out.chars().next().is_some_and(|first| first.is_ascii_digit()) {
        out.insert(0, '_');
    }
    out
}

/// Declarations written as source: a property and the parts of its value.
type Declarations = Vec<(String, Vec<Part>)>;

/// A declaration the codemod will write, before grouping.
#[derive(Debug, Clone, Default)]
struct Entry {
    /// The contextual block it belongs to (`[select.descendant("svg")]`), rendered.
    block: Option<String>,
    /// Condition keys, rendered (`":hover"`, `[menuGroup.within(":hover")]`).
    conditions: Vec<String>,
    property: String,
    value: Vec<Part>,
    /// Set by a rule's `pair` (`text-sm`'s line height): yields to the property set directly.
    paired: bool,
    /// The value as the grammar gave it, and the layer the property is (`[compose["ring-width"]]`),
    /// for a composition this element resolves (KF-076).
    expr: Option<Expr>,
    layer: Option<String>,
}

/// A class string, lowered.
#[derive(Debug, Default)]
struct Lowered {
    entries: Vec<Entry>,
    /// Relations this element anchors, by identifier.
    anchors: Vec<String>,
    /// Handles its utilities apply (`utilities.handles`, D-115), as imported, before its own style.
    handles: Vec<String>,
    /// Utilities left in a comment, with the reason.
    left: Vec<String>,
}

struct Walker<'s> {
    path: &'s Path,
    source: &'s str,
    options: &'s Options<'s>,
    environment: &'s dyn Environment,
    edits: Vec<(Span, String)>,
    notes: Vec<Note>,
    claimed: Vec<Span>,
    /// Imports from `@kirana-style/core` the rewritten file needs.
    core: BTreeSet<&'static str>,
    /// Whether a props type declares `sx?: Sx`, which imports the type.
    sx_type: bool,
    /// How deep in object type literals the walk is.
    type_literals: usize,
    /// `data-slot` values written here and read here; the anchor the element being visited owes.
    slots: BTreeSet<String>,
    slot_reads: BTreeSet<String>,
    pending_anchor: Option<String>,
    /// The `data-slot` of the element whose class is being lowered, the recipe being written, and
    /// what each one's own styles set.
    current_slot: Option<String>,
    current_recipe: Option<String>,
    slot_properties: BTreeMap<String, BTreeSet<(String, String)>>,
    recipe_properties: BTreeMap<String, BTreeSet<(String, String)>>,
    /// Contextual rules a target will carry, recipes applied by slotted elements, and whether the
    /// class string being lowered is a recipe's base.
    inversions: Vec<Inversion>,
    recipe_slots: BTreeSet<(String, String)>,
    in_recipe_base: bool,
    /// Components rendered through a `render` prop, and per enclosing function whether it is one
    /// that keeps merging the class a part hands it.
    rendered: BTreeSet<(PathBuf, String)>,
    keeps_class: Vec<bool>,
    class_forwards: BTreeSet<((PathBuf, String), (PathBuf, String))>,
    /// The project component whose class is being rewritten, to record a forwarded `className`.
    forward_target: Option<(PathBuf, String)>,
    /// Token imports: module specifier → export → the local name it is imported as.
    tokens: BTreeMap<String, BTreeMap<String, String>>,
    /// Relation identifier → relation name.
    relations: BTreeMap<String, String>,
    /// Relations read in this file, by identifier, and those anchored here.
    read: BTreeSet<String>,
    anchored: BTreeSet<String>,
    /// The `styles` object's entries, in order.
    styles: Vec<(String, String)>,
    styles_name: String,
    /// Where the declarations go: after the last import.
    insert_at: u32,
    /// Local name → import specifier, to tell installed components from the project's.
    imports: BTreeMap<String, String>,
    /// Local name → the name it is imported as (`Collapsible` from `{ Root as Collapsible }`).
    imported_names: BTreeMap<String, String>,
    /// Components this file passes a class to, by declaring file and name.
    styled: BTreeSet<(PathBuf, String)>,
    /// Variables bound to a `cva()` call, now recipes.
    recipes: BTreeSet<String>,
    /// Relations a recipe's classes anchored (`group/tabs-list` in a `cva`), applied where it is
    /// called, and the recipes whose anchors reached a call.
    recipe_anchors: BTreeMap<String, Vec<String>>,
    anchors_applied: BTreeSet<String>,
    /// References to a joiner, and how many of them were rewritten.
    joiner_references: BTreeMap<String, usize>,
    joiner_rewritten: BTreeMap<String, usize>,
    joiner_imports: Vec<(String, Span, Span, usize)>,
    /// `VariantProps` imported from `class-variance-authority`.
    variant_props: bool,
    /// The enclosing component or function names, innermost last.
    scope: Vec<String>,
    /// Per enclosing function, innermost last: the span of a component's first parameter, type
    /// included, when it binds `className`, which becomes `sx`, and whether `className` there names
    /// that prop.
    class_params: Vec<Option<Span>>,
    class_is_sx: Vec<bool>,
    /// Set by a declarator whose name is capitalised, for the function it holds.
    pending_component: bool,
    /// Per-mode tokens for non-colour `dark:` values: key, light and dark values.
    mode_tokens: Vec<(String, Vec<Part>, Vec<Part>)>,
    /// Condition keys written as an exported variant (`[breakpoint.md]`, D-115) → whether the
    /// condition is an at-rule, which the rendered key no longer shows.
    exported: BTreeMap<String, bool>,
    /// The name of their token group in this file.
    modes_name: String,
    /// The properties of the `cva` being rewritten, from its base, whose pairs an option may drop.
    cva_base: Vec<(Option<String>, Vec<String>, String)>,
    /// Per enclosing function: a component that destructures `{ ...rest }` without `className`, where
    /// `sx` goes (just inside the pattern's brace), its rest name, and whether `sx` was applied.
    wrappers: Vec<Option<(u32, String, bool)>>,
    /// Module constants holding a class string (`const LABEL = "…"`): name → (value span, text).
    constants: BTreeMap<String, (Span, String)>,
    /// The constants used as styles, and every reference to each.
    constants_styled: BTreeMap<String, usize>,
    constant_references: BTreeMap<String, usize>,
    /// Whether the class string being lowered is the only style of a host element, which nothing
    /// else can add a composition layer to, and the layers contextual rules here set or read.
    alone: bool,
    contextual_layers: BTreeSet<String>,
}

impl Scales for Walker<'_> {
    fn export(&self, module: &str, export: &str) -> Value {
        self.environment.export(module, export)
    }
}

impl<'s> Walker<'s> {
    fn new(path: &'s Path, source: &'s str, options: &'s Options<'s>, environment: &'s dyn Environment) -> Self {
        let styles_name = if source.contains("const styles") { "migrated" } else { "styles" }.to_owned();
        Self {
            path,
            source,
            options,
            environment,
            edits: Vec::new(),
            notes: Vec::new(),
            claimed: Vec::new(),
            core: BTreeSet::new(),
            tokens: BTreeMap::new(),
            relations: BTreeMap::new(),
            read: BTreeSet::new(),
            anchored: BTreeSet::new(),
            styles: Vec::new(),
            styles_name,
            insert_at: 0,
            imports: BTreeMap::new(),
            exported: BTreeMap::new(),
            recipes: BTreeSet::new(),
            recipe_anchors: BTreeMap::new(),
            anchors_applied: BTreeSet::new(),
            joiner_references: BTreeMap::new(),
            joiner_rewritten: BTreeMap::new(),
            joiner_imports: Vec::new(),
            variant_props: false,
            scope: Vec::new(),
            class_params: Vec::new(),
            sx_type: false,
            type_literals: 0,
            slots: BTreeSet::new(),
            slot_reads: BTreeSet::new(),
            pending_anchor: None,
            current_slot: None,
            current_recipe: None,
            slot_properties: BTreeMap::new(),
            recipe_properties: BTreeMap::new(),
            inversions: Vec::new(),
            recipe_slots: BTreeSet::new(),
            in_recipe_base: false,
            rendered: BTreeSet::new(),
            keeps_class: Vec::new(),
            class_forwards: BTreeSet::new(),
            forward_target: None,
            class_is_sx: Vec::new(),
            pending_component: false,
            mode_tokens: Vec::new(),
            modes_name: if source.contains("const modes") { "migratedModes" } else { "modes" }.to_owned(),
            cva_base: Vec::new(),
            wrappers: Vec::new(),
            constants: BTreeMap::new(),
            constants_styled: BTreeMap::new(),
            constant_references: BTreeMap::new(),
            imported_names: BTreeMap::new(),
            styled: BTreeSet::new(),
            alone: false,
            contextual_layers: BTreeSet::new(),
        }
    }

    fn text(&self, span: Span) -> &'s str {
        &self.source[span.start as usize..span.end as usize]
    }

    fn replace(&mut self, span: Span, text: impl Into<String>) {
        self.edits.push((span, text.into()));
    }

    fn note(&mut self, offset: u32, message: impl Into<String>) {
        self.notes.push(Note { offset, message: message.into() });
    }

    fn is_claimed(&self, span: Span) -> bool {
        self.claimed.iter().any(|claimed| claimed.start <= span.start && span.end <= claimed.end)
    }

    // ── Lowering a class string ────────────────────────────────────────────────────────────────

    /// A token as source: `color.blue[600]`, importing `color` from its module.
    fn token(&mut self, module: &str, export: &str, path: &[String]) -> String {
        let specifier = self.specifier(module);
        let mut out = self.local_name(&specifier, export);
        for segment in path {
            if segment.bytes().all(|byte| byte.is_ascii_digit()) && !segment.starts_with('0') {
                out.push_str(&format!("[{segment}]"));
            } else if js_key(segment) == *segment {
                out.push('.');
                out.push_str(segment);
            } else {
                out.push_str(&format!("[{}]", js_string(segment)));
            }
        }
        out
    }

    /// The name `export` of `specifier` is imported as: the export's own, unless the file already
    /// has that name — from another module's export, as a preset's `color` and a theme's `color`,
    /// or from its own imports — and then prefixed with the module's last segment (`themeColor`).
    fn local_name(&mut self, specifier: &str, export: &str) -> String {
        if let Some(local) = self.tokens.get(specifier).and_then(|exports| exports.get(export)) {
            return local.clone();
        }
        let taken = |walker: &Self, name: &str| {
            walker.imports.contains_key(name)
                || walker.tokens.values().any(|exports| exports.values().any(|local| local == name))
        };
        let mut local = export.to_owned();
        if taken(self, &local) {
            let segment = specifier.rsplit('/').next().unwrap_or(specifier);
            let base = format!("{}{}{}", camel(segment), export[..1].to_ascii_uppercase(), &export[1..]);
            local = base.clone();
            let mut index = 2;
            while taken(self, &local) {
                local = format!("{base}{index}");
                index += 1;
            }
        }
        self.tokens.entry(specifier.to_owned()).or_default().insert(export.to_owned(), local.clone());
        local
    }

    /// An import specifier for `module` from this file: packages as they are, files relative.
    fn specifier(&self, module: &str) -> String {
        let target = PathBuf::from(module);
        if !target.is_absolute() {
            return module.to_owned();
        }
        let from = self.path.parent().unwrap_or(Path::new(""));
        let relative = relative_path(from, &target);
        let mut text = relative.to_string_lossy().replace('\\', "/");
        for extension in [".tsx", ".ts", ".jsx", ".js", ".mts", ".mjs"] {
            if let Some(stem) = text.strip_suffix(extension) {
                text = stem.to_owned();
                break;
            }
        }
        if !text.starts_with('.') {
            text = format!("./{text}");
        }
        text
    }

    fn parts(&mut self, expr: &Expr) -> Vec<Part> {
        match expr {
            Expr::Text(text) => vec![Part::Text(text.clone())],
            Expr::Token { module, export, path, .. } => vec![Part::Code(self.token(module, export, path))],
            Expr::Negate(inner) => {
                let mut parts = vec![Part::Text("calc(".to_owned())];
                parts.extend(self.parts(inner));
                parts.push(Part::Text(" * -1)".to_owned()));
                merge_text(parts)
            }
            Expr::Alpha(inner, percent) => {
                let mut parts = vec![Part::Text("color-mix(in oklab, ".to_owned())];
                parts.extend(self.parts(inner));
                parts.push(Part::Text(format!(" {percent}%, transparent)")));
                merge_text(parts)
            }
            Expr::Paired(inner) => self.parts(inner),
            Expr::Concat(inner) => {
                let parts = inner.iter().flat_map(|expr| self.parts(expr)).collect();
                merge_text(parts)
            }
        }
    }

    /// The relation identifier for `group`/`peer` with an optional name, declared on first use.
    fn relation(&mut self, kind: &str, name: Option<&str>) -> String {
        let (identifier, relation) = match name {
            Some(name) => {
                (format!("{}{}", camel(name), if kind == "group" { "Group" } else { "Peer" }), name.to_owned())
            }
            None => (kind.to_owned(), kind.to_owned()),
        };
        self.relations.insert(identifier.clone(), relation);
        self.core.insert("relation");
        identifier
    }

    /// A contextual rule its target could carry: the target names a `data-slot`, the parent is known
    /// (an element's `data-slot`, or the recipe base being lowered), and the utility lowers without
    /// variants. Recorded for the survey either way.
    fn inversion(
        &mut self,
        kind: &str,
        target: &str,
        conditions: &[String],
        parsed: &kirana_utility::Parsed<'_>,
        is_dark: bool,
        utility: &str,
    ) -> Option<Inversion> {
        let slot = block_slot(target)?.to_owned();
        let parent = match (&self.current_slot, &self.current_recipe) {
            (Some(slot), _) => InversionParent::Slot(slot.clone()),
            (None, Some(recipe)) if self.in_recipe_base => {
                InversionParent::Recipe(self.path.to_path_buf(), recipe.clone())
            }
            _ => return None,
        };
        let lowers = kirana_utility::declarations(self.options.grammar, self, parsed.name, parsed.negative, utility)
            .is_ok_and(|declarations| declarations.iter().all(|(property, _)| !property.starts_with('{')));
        // A dropped `:not([class*='w-'])` guard let a class the caller passes win in Tailwind; on the
        // target, the rule would beat it.
        // An exported condition is imported by this file, not by the target's.
        let exported = conditions.iter().any(|condition| self.exported.contains_key(condition));
        if is_dark || parsed.important || !lowers || utility.contains("[class") || exported {
            return None;
        }
        let inversion = Inversion {
            parent,
            combinator: if kind == "child" { " > " } else { " " }.to_owned(),
            target: target.to_owned(),
            slot,
            conditions: conditions.to_vec(),
            utility: format!("{}{}", if parsed.negative { "-" } else { "" }, parsed.name),
        };
        if !self.inversions.contains(&inversion) {
            self.inversions.push(inversion.clone());
        }
        Some(inversion)
    }

    /// The style an element carries for its parents' contextual rules (`inversions_for`), after the
    /// items it has, before a caller's `sx`.
    fn with_inversions(&mut self, items: &mut Vec<String>, name: &str) {
        let Some(slot) = self.current_slot.clone() else { return };
        let mut lowered = Lowered::default();
        let mut dark = Vec::new();
        for (condition, conditions, utility) in self.options.project.inversions_for(&slot) {
            let before = lowered.entries.len();
            // It lowered for the survey; the same grammar lowers it here.
            let _ = self.lower_one(&utility, &mut lowered, &mut dark);
            for entry in &mut lowered.entries[before..] {
                let mut all = vec![condition.clone()];
                all.extend(conditions.iter().cloned());
                all.append(&mut entry.conditions);
                entry.conditions = all;
            }
        }
        if lowered.entries.is_empty() {
            return;
        }
        let key = self.style_name(name);
        self.core.insert("css");
        let body = Self::object(&lowered, "  ");
        self.styles.push((key.clone(), format!("css({body})")));
        let at = items.iter().position(|item| item == "sx" || item.ends_with(".sx")).unwrap_or(items.len());
        items.insert(at, format!("{}.{key}", self.styles_name));
    }

    /// Why a contextual rule will not show: the elements with the `data-slot` it targets set the
    /// property themselves, which outranks it (D-016), where Tailwind's parent rule won.
    fn outranked(&self, entries: &[Entry]) -> Option<String> {
        entries.iter().find_map(|entry| {
            let slot = block_slot(entry.block.as_deref()?)?;
            let own = self.options.project.slot_properties.get(slot)?;
            let wanted = longhands(&entry.property);
            let value = if entry.conditions.is_empty() { render_value(&entry.value) } else { String::new() };
            // The same value unconditionally on both sides shows either way.
            let (clash, _) = own.iter().find(|(property, own)| {
                !longhands(property).is_disjoint(&wanted)
                    && !(*property == entry.property && !value.is_empty() && *own == value)
            })?;
            Some(format!(
                "`data-slot=\"{slot}\"` sets `{clash}` itself, which outranks a contextual rule (Tailwind's parent rule won); read the parent from the target instead"
            ))
        })
    }

    /// The relation of a `data-slot` value, declared on first use.
    fn slot_relation(&mut self, slot: &str) -> String {
        let identifier = slot_identifier(slot);
        self.relations.insert(identifier.clone(), format!("in-{slot}"));
        self.core.insert("relation");
        identifier
    }

    /// Puts the anchor the element owes (`data-slot` read with `in-*`) first among its items.
    fn take_anchor(&mut self, items: &mut Vec<String>) {
        if let Some(identifier) = self.pending_anchor.take() {
            items.insert(0, format!("{identifier}.anchor"));
            self.anchored.insert(identifier);
        }
    }

    /// A variant's condition, or why it has none. Relations and `dark` are the caller's.
    fn condition(&mut self, variant: &str, utility: &str) -> Result<String, String> {
        if self.options.custom_variants.contains(variant) && !self.options.grammar.variants.contains_key(variant) {
            return Err(format!(
                "`{variant}:` is a custom variant in your CSS; declare it under `utilities.variants` and run again"
            ));
        }
        kirana_utility::variant(self.options.grammar, self, variant, utility).map_err(|failure| failure.message)
    }

    /// `group-hover/menu` → `[menuGroup.within(":hover")]`.
    fn relation_read(&mut self, variant: &str, utility: &str) -> Option<Result<String, String>> {
        let (kind, rest) = if let Some(rest) = variant.strip_prefix("group") {
            ("group", rest)
        } else {
            ("peer", variant.strip_prefix("peer")?)
        };
        if !(rest.is_empty() || rest.starts_with('-') || rest.starts_with('/')) {
            return None;
        }
        let mut pieces = kirana_utility::split_outside_brackets(rest, '/');
        let name = (pieces.len() > 1).then(|| pieces.pop()).flatten();
        let state = pieces.join("/");
        let state = state.strip_prefix('-').unwrap_or(&state).to_owned();
        let method = if kind == "group" { "within" } else { "after" };
        let argument = if state.is_empty() {
            String::new()
        } else {
            match self.condition(&state, utility) {
                Ok(condition) if condition.starts_with(':') || condition.starts_with('[') => js_string(&condition),
                Ok(condition) => {
                    return Some(Err(format!("`{utility}`: `{condition}` is not a state an anchor can have")));
                }
                Err(reason) => return Some(Err(reason)),
            }
        };
        let identifier = self.relation(kind, name);
        self.read.insert(identifier.clone());
        Some(Ok(format!("[{identifier}.{method}({argument})]")))
    }

    /// `[&_svg]` → (`descendant`, `svg`), `*` → (`child`, `*`); the target is checked once every
    /// variant after it has had the chance to name it (`*:data-[slot=x]:`).
    fn contextual(variant: &str) -> Option<(&'static str, String)> {
        let (kind, target) = match variant {
            "*" => ("child", "*".to_owned()),
            "**" => ("descendant", "*".to_owned()),
            _ => {
                let inner = kirana_utility::arbitrary(variant)?;
                let rest = inner.strip_prefix('&')?;
                if let Some(target) = rest.strip_prefix('>') {
                    ("child", target.trim().to_owned())
                } else if rest.starts_with(' ') {
                    ("descendant", rest.trim().to_owned())
                } else {
                    return None;
                }
            }
        };
        // shadcn's guards (`svg:not([class*='size-'])`) existed so an icon's own size could win;
        // a contextual rule already loses to the element's own styles.
        Some((kind, strip_class_guards(&target)))
    }

    /// Lowers one class string. `offset` places the notes.
    fn lower(&mut self, classes: &str, offset: u32) -> Lowered {
        let mut lowered = Lowered::default();
        let mut dark: Vec<Entry> = Vec::new();
        for utility in kirana_utility::utilities(classes) {
            let before = lowered.entries.len();
            match self.lower_one(utility, &mut lowered, &mut dark) {
                Ok(()) => {
                    if let Some(reason) = self.outranked(&lowered.entries[before..]) {
                        self.note(offset, format!("`{utility}`: {reason}"));
                        lowered.left.push(format!("{utility} — {reason}"));
                    } else if ["[class*='w-']", "[class*='h-']"].iter().any(|guard| utility.contains(guard))
                        && lowered.entries.len() > before
                    {
                        // A child whose own classes only contained the text (`max-w-sm` for
                        // `[class*='w-']`) opted out in Tailwind; here only a value of its own does.
                        // (`size-` guards need nothing: an icon's own size is its own value.)
                        let reason = "applied without its `[class*=…]` guard: a child that opted out through a class such as `max-w-*` needs a value of its own (`width: auto`)";
                        self.note(offset, format!("`{utility}`: {reason}"));
                        lowered.left.push(format!("{utility} — {reason}"));
                    }
                }
                Err(reason) => {
                    self.note(offset, reason.clone());
                    lowered.left.push(format!("{utility} — {reason}"));
                }
            }
        }
        let own: BTreeSet<(String, String)> = lowered
            .entries
            .iter()
            .filter(|entry| entry.block.is_none())
            .map(|entry| {
                let value = if entry.conditions.is_empty() { render_value(&entry.value) } else { String::new() };
                (entry.property.clone(), value)
            })
            .collect();
        if let Some(slot) = self.current_slot.clone() {
            self.slot_properties.entry(slot).or_default().extend(own.iter().cloned());
        }
        if let Some(recipe) = self.current_recipe.clone() {
            self.recipe_properties.entry(recipe).or_default().extend(own);
        }
        // A paired value yields to the same property set directly (`text-sm leading-snug`) wherever
        // that one applies: under a condition alone, the size's own stays at rest (KF-076).
        let direct: Vec<(Option<String>, String, Vec<String>)> = lowered
            .entries
            .iter()
            .filter(|entry| !entry.paired)
            .map(|entry| (entry.block.clone(), entry.property.clone(), entry.conditions.clone()))
            .collect();
        lowered.entries.retain(|entry| {
            !entry.paired
                || !direct.iter().any(|(block, property, conditions)| {
                    *block == entry.block
                        && *property == entry.property
                        && kirana_utility::covers(conditions, &entry.conditions)
                })
        });
        // A `dark:` layer becomes a per-mode token, which the composition then has to read.
        let dark_layers = dark.iter().any(|entry| {
            entry.layer.is_some()
                || entry.expr.as_ref().is_some_and(|expr| !layers_read(self.environment, expr).is_empty())
        });
        let mut mode_places: BTreeMap<(Option<String>, Vec<String>, String), String> = BTreeMap::new();
        // `dark:` becomes the second half of a `light-dark()` pair with the value at rest. Only a
        // colour can be a pair; a background with no value at rest pairs with its initial
        // `transparent`, which is exactly what Tailwind renders in light mode.
        // Colour `dark:` values by place, for the state entries they outrank below.
        let mut dark_colours: Vec<Entry> = Vec::new();
        for entry in dark {
            let colour = entry.property.to_ascii_lowercase().contains("color")
                || matches!(entry.property.as_str(), "fill" | "stroke");
            // The light value is the one at the same conditions, else the one at the nearest
            // enclosing conditions (`dark:data-active:border-input` pairs with `border-transparent`),
            // else a background's initial `transparent`.
            let exact = lowered.entries.iter().rposition(|light| {
                light.block == entry.block && light.conditions == entry.conditions && light.property == entry.property
            });
            let enclosing = || {
                lowered
                    .entries
                    .iter()
                    .filter(|light| {
                        light.block == entry.block
                            && light.property == entry.property
                            && entry.conditions.starts_with(&light.conditions)
                    })
                    .max_by_key(|light| light.conditions.len())
                    .map(|light| light.value.clone())
            };
            if !colour {
                // Not a colour: a `{ light, dark }` token, with the light half from the same or
                // enclosing conditions, else `initial` (an unset `compose` step stays unset). A later
                // `dark:` value for the same place replaces the dark half of the same token.
                let place = (entry.block.clone(), entry.conditions.clone(), entry.property.clone());
                if let Some(key) = mode_places.get(&place) {
                    let token = self.mode_tokens.iter_mut().find(|(existing, _, _)| existing == key);
                    token.expect("recorded with its place").2 = entry.value.clone();
                    continue;
                }
                let light = match exact {
                    Some(index) => lowered.entries[index].value.clone(),
                    None => enclosing().unwrap_or_else(|| vec![Part::Text("initial".to_owned())]),
                };
                let reference = self.mode_token(&entry.property, light, entry.value.clone());
                mode_places.insert(place, reference.rsplit('.').next().unwrap_or_default().to_owned());
                let index = exact.unwrap_or_else(|| {
                    lowered.entries.push(entry.clone());
                    lowered.entries.len() - 1
                });
                lowered.entries[index].value = vec![Part::Code(reference)];
                continue;
            }
            let light = match exact {
                Some(index) => {
                    let value = lowered.entries[index].value.clone();
                    Some((index, value))
                }
                None => {
                    let value = enclosing().or_else(|| {
                        (entry.property == "backgroundColor").then(|| vec![Part::Text("transparent".to_owned())])
                    });
                    value.map(|value| {
                        lowered.entries.push(Entry { value: value.clone(), ..entry.clone() });
                        (lowered.entries.len() - 1, value)
                    })
                }
            };
            match light {
                Some((index, value)) => {
                    dark_colours.push(entry.clone());
                    let mut parts = vec![Part::Text("light-dark(".to_owned())];
                    parts.extend(value);
                    parts.push(Part::Text(", ".to_owned()));
                    parts.extend(entry.value);
                    parts.push(Part::Text(")".to_owned()));
                    lowered.entries[index].value = merge_text(parts);
                }
                None => {
                    let reason = format!(
                        "`dark:` on `{}` has no light value to pair with; write a light-dark() token",
                        entry.property
                    );
                    self.note(offset, reason.clone());
                    lowered.left.push(format!("dark:{} — {reason}", entry.property));
                }
            }
        }
        // Tailwind prints `dark:` after the state variants, so `dark:bg-input/30` outranks
        // `aria-expanded:bg-muted` in dark mode: a state entry with no dark value of its own takes the
        // dark half of the nearest enclosing one. At-rules (`md:`) are left as they are.
        for light in &mut lowered.entries {
            let paired = matches!(light.value.first(), Some(Part::Text(text)) if text.starts_with("light-dark("));
            let states = |conditions: &[String]| {
                conditions.iter().all(|condition| {
                    !condition.starts_with("\"@") && condition != "\"*\"" && self.exported.get(condition) != Some(&true)
                })
            };
            let Some(dark) = dark_colours
                .iter()
                .filter(|dark| {
                    dark.block == light.block
                        && dark.property == light.property
                        && light.conditions.len() > dark.conditions.len()
                        && light.conditions.starts_with(&dark.conditions)
                })
                .max_by_key(|dark| dark.conditions.len())
            else {
                continue;
            };
            if paired || !states(&light.conditions[dark.conditions.len()..]) {
                continue;
            }
            let mut parts = vec![Part::Text("light-dark(".to_owned())];
            parts.extend(light.value.clone());
            parts.push(Part::Text(", ".to_owned()));
            parts.extend(dark.value.clone());
            parts.push(Part::Text(")".to_owned()));
            light.value = merge_text(parts);
        }
        if self.alone && !dark_layers {
            self.resolve_layers(&mut lowered);
        }
        lowered
    }

    /// Tailwind composes `box-shadow`, `translate`, `filter` and `border-style` from layers that any
    /// class of the element may set. Where this style is all the element has (see `alone`), a
    /// property whose layers are all set here, under its own conditions, is written resolved:
    /// `ring-1 ring-border` is `boxShadow: \`0 0 0 1px ${theme.border}\``, `border` is `borderStyle:
    /// "solid"`. A layer under other conditions, or one a contextual rule may set, keeps the
    /// composition (KF-076).
    fn resolve_layers(&mut self, lowered: &mut Lowered) {
        let contextual =
            |key: &String| self.contextual_layers.contains(key) || self.options.project.contextual_layers.contains(key);
        let environment = self.environment;
        let reads = |entry: &Entry| entry.expr.as_ref().map(|expr| layers_read(environment, expr)).unwrap_or_default();
        let (mut consumed, mut needed) = (BTreeSet::new(), BTreeSet::new());
        let mut resolved = Vec::new();
        for (index, reader) in lowered.entries.iter().enumerate() {
            let mut keys = reads(reader);
            if reader.layer.is_some() || keys.is_empty() {
                continue;
            }
            // The layers it reads, and those they read (`ring-shadow` reads `ring-width`).
            let mut next = 0;
            while let Some(key) = keys.get(next).cloned() {
                for setter in lowered.entries.iter().filter(|setter| setter.layer.as_ref() == Some(&key)) {
                    for read in reads(setter) {
                        if !keys.contains(&read) {
                            keys.push(read);
                        }
                    }
                }
                next += 1;
            }
            let setters: Vec<&Entry> = lowered
                .entries
                .iter()
                .filter(|setter| setter.expr.is_some() && setter.layer.as_ref().is_some_and(|key| keys.contains(key)))
                .collect();
            // A layer set under fewer conditions applies here too; one under more is the business of
            // the reader written beside it there. One under other conditions would compose with
            // this one where both apply, and a layer set without its reader composes with this one.
            let encloses = |setter: &&Entry| kirana_utility::covers(&setter.conditions, &reader.conditions);
            let read_there = |setter: &&Entry| {
                kirana_utility::covers(&reader.conditions, &setter.conditions)
                    && lowered.entries.iter().any(|other| {
                        other.layer.is_none()
                            && other.conditions == setter.conditions
                            && other.block == reader.block
                            && reads(other).iter().any(|key| keys.contains(key))
                    })
            };
            let local =
                setters.iter().all(|setter| setter.block == reader.block && (encloses(setter) || read_there(setter)));
            let mut setters: Vec<&Entry> = setters.into_iter().filter(encloses).collect();
            // The innermost value of a layer wins, then the later one.
            setters.sort_by_key(|setter| setter.conditions.len());
            if local && !keys.iter().any(contextual) {
                resolved.extend(reader.expr.as_ref().map(|expr| (index, resolve(environment, expr, &setters))));
                consumed.extend(keys);
            } else {
                needed.extend(keys);
            }
        }
        for (index, value) in resolved {
            lowered.entries[index].value = tidy(self.parts(&value));
            lowered.entries[index].expr = Some(value);
        }
        lowered
            .entries
            .retain(|entry| !entry.layer.as_ref().is_some_and(|key| consumed.contains(key) && !needed.contains(key)));
    }

    /// A per-mode token for a non-colour `dark:` value, declared once per file with the others.
    fn mode_token(&mut self, property: &str, light: Vec<Part>, dark: Vec<Part>) -> String {
        let base: String = camel(property.trim_matches(['[', ']']));
        let taken = |key: &str, tokens: &[(String, Vec<Part>, Vec<Part>)]| {
            tokens.iter().any(|(existing, _, _)| existing == key)
        };
        let mut key = base.clone();
        let mut index = 2;
        while taken(&key, &self.mode_tokens) {
            key = format!("{base}{index}");
            index += 1;
        }
        self.mode_tokens.push((key.clone(), light, dark));
        self.core.insert("defineTokens");
        format!("{}.{key}", self.modes_name)
    }

    fn lower_one(&mut self, utility: &str, lowered: &mut Lowered, dark: &mut Vec<Entry>) -> Result<(), String> {
        let parsed = kirana_utility::parse(utility);
        // `p-4!` beats every other value of the property; `{ "*": null, base: … }` removes them.
        // Under a variant there is no such removal: the ladder decides, and it is reported.
        if parsed.important && !parsed.variants.is_empty() {
            return Err(format!("`{utility}`: Kirana has no `!important`; the precedence ladder decides"));
        }
        // An anchor: `group`, `group/menu`, `peer/field`.
        if parsed.variants.is_empty() && !parsed.negative {
            for kind in ["group", "peer"] {
                let name = if parsed.name == kind {
                    Some(None)
                } else {
                    parsed.name.strip_prefix(kind).and_then(|rest| rest.strip_prefix('/')).map(Some)
                };
                if let Some(name) = name {
                    let identifier = self.relation(kind, name);
                    self.anchored.insert(identifier.clone());
                    lowered.anchors.push(identifier);
                    return Ok(());
                }
            }
        }
        let mut block = None;
        let mut select: Option<(&'static str, String)> = None;
        let mut conditions = Vec::new();
        let mut is_dark = false;
        for variant in &parsed.variants {
            if *variant == "dark" && !self.options.grammar.variants.contains_key("dark") {
                is_dark = true;
                continue;
            }
            // `in-data-[slot=x]:` — inside any element written with `data-slot="x"`, which anchors it.
            if let Some(slot) = variant.strip_prefix("in-").and_then(slot_of) {
                let identifier = self.slot_relation(slot);
                self.read.insert(identifier.clone());
                self.slot_reads.insert(slot.to_owned());
                conditions.push(format!("[{identifier}.within()]"));
                continue;
            }
            if let Some(read) = self.relation_read(variant, utility) {
                conditions.push(read?);
                continue;
            }
            if let Some(target) = Self::contextual(variant) {
                if block.is_some() || select.is_some() || !conditions.is_empty() {
                    return Err(format!(
                        "`{utility}`: a contextual target under a condition of the element itself; write it in css() by hand"
                    ));
                }
                select = Some(target);
                continue;
            }
            // A variant naming an export is written as that export, imported (D-115); its text, where a
            // key can write it, still says what kind of condition it is.
            let mut reference = None;
            if let Some(Variant::Export(source)) = self.options.grammar.variants.get(*variant) {
                let exported = kirana_utility::exported_condition(self, source, variant, utility)
                    .map_err(|failure| failure.message)?;
                let key = format!("[{}]", self.token(&source.module, &source.export, &source.path));
                match exported {
                    Exported::Relation => {
                        self.exported.insert(key.clone(), false);
                        conditions.push(key);
                        continue;
                    }
                    Exported::Key(text) => {
                        self.exported.insert(key.clone(), text.starts_with('@'));
                        reference = Some((key, text));
                    }
                }
            }
            let (key, condition) = match reference {
                Some((key, text)) => (Some(key), text),
                None => (None, self.condition(variant, utility)?),
            };
            if let Some((_, target)) = select.as_mut().filter(|_| !condition.starts_with('@')) {
                // After `*:`, an attribute or an element names the target: `*:data-[slot=x]:`.
                *target = narrow_target(target, &condition).ok_or_else(|| {
                    format!("`{utility}`: `{condition}` is a state of the contextual target, which css() cannot select")
                })?;
            } else if kirana_utility::is_pseudo_element(&condition) {
                if block.is_some() || select.is_some() {
                    return Err(format!(
                        "`{utility}`: a pseudo-element inside another block; write it in css() by hand"
                    ));
                }
                // Written as text: whether a block gets its `content` is read from its key.
                block = Some(js_string(&condition));
            } else {
                conditions.push(key.unwrap_or_else(|| js_string(&condition)));
            }
        }
        if let Some((kind, target)) = select {
            if !kirana_ir::is_contextual_target(&target) {
                return Err(format!(
                    "`{utility}`: `{target}` is not a contextual target: an element name, classes, attribute selectors and pseudo-classes"
                ));
            }
            if let Some(inversion) = self.inversion(kind, &target, &conditions, &parsed, is_dark, utility)
                && self.options.project.inverts(&inversion)
            {
                // The target carries it (`inversions_for`); the parent writes nothing.
                return Ok(());
            }
            self.core.insert("select");
            block = Some(format!("[select.{kind}({})]", js_string(&target)));
        }
        // `space-x-4`, `divide-y`: Tailwind styles every child but the last, at no specificity, so a
        // child's own margin or border wins — a contextual rule does the same.
        if let Some(declarations) = self.child_rule(parsed.name, parsed.negative, utility) {
            if is_dark || block.is_some() || !conditions.is_empty() {
                return Err(format!(
                    "`{utility}`: a child rule under a condition or inside a block; write it in css() by hand"
                ));
            }
            self.core.insert("select");
            let block = Some(format!("[select.child({})]", js_string(":not(:last-child)")));
            for (property, value) in declarations? {
                lowered.entries.push(Entry { block: block.clone(), property, value, ..Entry::default() });
            }
            return Ok(());
        }
        // `[content-visibility:auto]`: an arbitrary property is a declaration as written. Utility
        // strings do not take them; an object has no reason not to.
        if let Some((property, value)) = kirana_utility::arbitrary(parsed.name).and_then(|inner| {
            let (property, value) = inner.split_once(':')?;
            let valid =
                !property.is_empty() && property.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-');
            valid.then(|| (property.to_owned(), value.to_owned()))
        }) {
            let property = if property.starts_with("--") { property } else { camel_property(&property) };
            let value = self.parts(&kirana_utility::written_expr(self.options.grammar, self, value));
            let entry = Entry { block, conditions, property, value, ..Entry::default() };
            if is_dark {
                dark.push(entry)
            } else {
                lowered.entries.push(entry)
            }
            return Ok(());
        }
        // A utility the design system has as a handle applies that handle (D-115).
        let failed = |failure: kirana_utility::Failure| match failure.help {
            Some(help) => format!("{} ({help})", failure.message),
            None => failure.message,
        };
        if let Some(source) = kirana_utility::handle(self.options.grammar, utility).map_err(failed)? {
            if let Some(recipe) = &self.current_recipe {
                return Err(format!(
                    "`{utility}` is a handle, which a recipe cannot hold: apply `{}` where `{recipe}` is called",
                    source.reference()
                ));
            }
            let reference = self.token(&source.module, &source.export, &source.path);
            lowered.handles.push(reference);
            return Ok(());
        }
        let custom = self.options.custom_utilities.iter().any(|custom| {
            custom == parsed.name || custom.strip_suffix('*').is_some_and(|prefix| parsed.name.starts_with(prefix))
        });
        if custom
            && kirana_utility::declarations(self.options.grammar, self, parsed.name, parsed.negative, utility).is_err()
        {
            return Err(format!(
                "`{}` is a custom utility in your CSS; declare its declarations under `utilities.utilities`, or the handle that has them under `utilities.handles`, and run again",
                parsed.name
            ));
        }
        let declarations =
            kirana_utility::declarations(self.options.grammar, self, parsed.name, parsed.negative, utility)
                .map_err(failed)?;
        for (property, value) in declarations {
            // A property written `{scale.key}` is that token, set as a computed key.
            let token = kirana_utility::property_token(self.options.grammar, self, &property);
            let layer = token.as_ref().and_then(|token| layer(self.environment, token)).map(|(key, _)| key);
            let property = match token {
                Some(Expr::Token { module, export, path, .. }) => format!("[{}]", self.token(&module, &export, &path)),
                _ => property,
            };
            if block.as_deref().is_some_and(|block| block.starts_with("[select.")) {
                self.contextual_layers.extend(layer.iter().cloned().chain(layers_read(self.environment, &value)));
            }
            if parsed.important {
                lowered.entries.push(Entry {
                    block: block.clone(),
                    conditions: vec!["\"*\"".to_owned()],
                    property: property.clone(),
                    value: vec![Part::Code("null".to_owned())],
                    layer: layer.clone(),
                    ..Entry::default()
                });
            }
            let paired = matches!(value, Expr::Paired(_));
            let entry = Entry {
                block: block.clone(),
                conditions: conditions.clone(),
                property,
                value: self.parts(&value),
                paired,
                expr: Some(value),
                layer,
            };
            if is_dark { dark.push(entry) } else { lowered.entries.push(entry) }
        }
        Ok(())
    }

    /// The declarations of a child rule (`space-x-4`, `divide-y-2`, `divide-border`), as Tailwind 4 writes
    /// them with the reverse flag off, through the grammar's own `me-*`, `mb-*` and `border-*`.
    fn child_rule(&mut self, name: &str, negative: bool, utility: &str) -> Option<Result<Declarations, String>> {
        let lower = |walker: &mut Self, name: &str, negative: bool| {
            kirana_utility::declarations(walker.options.grammar, walker, name, negative, utility)
                .map(|declarations| {
                    declarations
                        .into_iter()
                        .map(|(property, value)| (property, walker.parts(&value)))
                        .collect::<Vec<_>>()
                })
                .map_err(|failure| failure.message)
        };
        let zero = |property: &str| (property.to_owned(), vec![Part::Text("0px".to_owned())]);
        if let Some((axis, value)) = name.strip_prefix("space-").and_then(|rest| rest.split_once('-')) {
            let (start, end) = match axis {
                "x" => ("marginInlineStart", "me"),
                "y" => ("marginBlockStart", "mb"),
                _ => return None,
            };
            return Some(lower(self, &format!("{end}-{value}"), negative).map(|mut declarations| {
                declarations.insert(0, zero(start));
                declarations
            }));
        }
        let rest = name.strip_prefix("divide")?;
        let axis = |axis: &str| match axis {
            "x" => Some(("borderInlineStartWidth", "borderInlineEndWidth", "borderInlineStyle")),
            "y" => Some(("borderBlockStartWidth", "borderBlockEndWidth", "borderBlockStyle")),
            _ => None,
        };
        let width = |value: &str| match value {
            "" => Some("1px".to_owned()),
            _ => value.bytes().all(|byte| byte.is_ascii_digit()).then(|| format!("{value}px")),
        };
        let parts = rest.strip_prefix('-').unwrap_or(rest);
        let (head, tail) = parts.split_once('-').unwrap_or((parts, ""));
        if let (Some((start, end, style)), Some(width)) = (axis(head), width(tail)) {
            return Some(Ok(vec![
                zero(start),
                (end.to_owned(), vec![Part::Text(width)]),
                (style.to_owned(), vec![Part::Text("solid".to_owned())]),
            ]));
        }
        // `divide-border`, `divide-muted/50`: the children's border colour.
        let colour = lower(self, &format!("border-{parts}"), false).ok()?;
        let colour: Declarations = colour.into_iter().filter(|(property, _)| property == "borderColor").collect();
        (!colour.is_empty()).then_some(Ok(colour))
    }

    // ── Writing objects ────────────────────────────────────────────────────────────────────────

    /// A lowered string as an object literal's body, indented by `indent`.
    fn object(lowered: &Lowered, indent: &str) -> String {
        let inner = format!("{indent}  ");
        let mut out = String::from("{\n");
        for left in &lowered.left {
            out.push_str(&format!("{inner}// tailwind: {left}\n"));
        }
        let mut blocks: Vec<(Option<String>, Vec<&Entry>)> = Vec::new();
        for entry in &lowered.entries {
            match blocks.iter_mut().find(|(block, _)| *block == entry.block) {
                Some((_, entries)) => entries.push(entry),
                None => blocks.push((entry.block.clone(), vec![entry])),
            }
        }
        // Declarations of the element first, then its contextual blocks.
        blocks.sort_by_key(|(block, _)| block.is_some());
        for (block, entries) in blocks {
            let properties = group_entries(&entries);
            match block {
                None => {
                    for (property, tree) in properties {
                        out.push_str(&format!("{inner}{}: {},\n", js_key(&property), render_tree(&tree)));
                    }
                }
                Some(key) => {
                    out.push_str(&format!("{inner}{key}: {{\n"));
                    let pseudo = key.trim_matches(['"', '\'']);
                    let properties = if kirana_utility::needs_content(pseudo)
                        && !properties.iter().any(|(property, _)| property == "content")
                    {
                        // Under the conditions its declarations have (see the engine's utility.rs).
                        let content = kirana_utility::condition_paths(entries.iter().map(|entry| &entry.conditions))
                            .into_iter()
                            .map(|conditions| Entry {
                                block: None,
                                conditions,
                                property: "content".to_owned(),
                                value: vec![Part::Text("\"\"".to_owned())],
                                ..Entry::default()
                            });
                        let all: Vec<Entry> = content.chain(entries.iter().map(|entry| (*entry).clone())).collect();
                        group_entries(&all.iter().collect::<Vec<_>>())
                    } else {
                        properties
                    };
                    for (property, tree) in properties {
                        out.push_str(&format!("{inner}  {}: {},\n", js_key(&property), render_tree(&tree)));
                    }
                    out.push_str(&format!("{inner}}},\n"));
                }
            }
        }
        if out == "{\n" {
            return "{}".to_owned();
        }
        out.push_str(indent);
        out.push('}');
        out
    }

    /// Adds a `styles` entry for a class string and returns what an `sx` array holds for it.
    fn style_items(&mut self, classes: &str, offset: u32, name: &str) -> Vec<String> {
        let lowered = self.lower(classes, offset);
        let mut items: Vec<String> = lowered.anchors.iter().map(|anchor| format!("{anchor}.anchor")).collect();
        items.extend(lowered.handles.iter().cloned());
        if !lowered.entries.is_empty() || !lowered.left.is_empty() {
            let key = self.style_name(name);
            self.core.insert("css");
            let body = Self::object(&lowered, "  ");
            self.styles.push((key.clone(), format!("css({body})")));
            items.push(format!("{}.{key}", self.styles_name));
        }
        items
    }

    fn style_name(&self, name: &str) -> String {
        // Always an identifier: `svg:rect` and `2-col` are names in the markup, not in JavaScript.
        let base = camel(name);
        let base = if base.is_empty() { "root".to_owned() } else { base };
        let taken = |candidate: &str| self.styles.iter().any(|(key, _)| key == candidate);
        if !taken(&base) {
            return base;
        }
        (2..).map(|index| format!("{base}{index}")).find(|candidate| !taken(candidate)).unwrap_or(base)
    }

    // ── Class expressions ──────────────────────────────────────────────────────────────────────

    /// A static class string, when the expression is one.
    fn static_string(expression: &Expression<'_>) -> Option<String> {
        match expression {
            // A lone surrogate, which oxc keeps as written, is in no class: the string stays as it is.
            Expression::StringLiteral(literal) => literal.value.as_str().map(str::to_owned),
            Expression::TemplateLiteral(template) if template.expressions.is_empty() => template
                .quasis
                .first()
                .and_then(|quasi| quasi.value.cooked)
                .and_then(|cooked| cooked.as_str())
                .map(str::to_owned),
            _ => None,
        }
    }

    /// Whether a class expression can become styles: static strings, the `className` prop, and
    /// conditions and joiners of those. Anything else is a runtime class string and stays one.
    fn is_style(&self, expression: &Expression<'_>) -> bool {
        match expression {
            Expression::StringLiteral(_) | Expression::NullLiteral(_) | Expression::BooleanLiteral(_) => true,
            Expression::TemplateLiteral(template) => template.expressions.is_empty(),
            Expression::Identifier(identifier) => {
                identifier.name == "undefined"
                    || (identifier.name == "className" && self.class_is_sx.last() == Some(&true))
                    || self.constants.contains_key(identifier.name.as_str())
            }
            Expression::StaticMemberExpression(member) => member.property.name == "className",
            Expression::LogicalExpression(logical) => {
                logical.operator == LogicalOperator::And && self.is_style(&logical.right)
            }
            Expression::ConditionalExpression(conditional) => {
                self.is_style(&conditional.consequent) && self.is_style(&conditional.alternate)
            }
            Expression::ParenthesizedExpression(inner) => self.is_style(&inner.expression),
            Expression::CallExpression(call) => {
                call.callee.get_identifier_reference().is_some_and(|callee| self.recipes.contains(callee.name.as_str()))
                    || (self.joiner(call).is_some()
                        && call
                            .arguments
                            .iter()
                            .all(|argument| argument.as_expression().is_some_and(|e| self.is_style(e))))
            }
            _ => false,
        }
    }

    /// A class expression split into `sx` items and the class strings that stay: a joiner's
    /// arguments one by one, anything else whole.
    fn split(&mut self, expression: &Expression<'_>, name: &str) -> (Vec<String>, Vec<String>) {
        let (items, classes) = match expression {
            Expression::CallExpression(call) if self.joiner(call).is_some() => self.split_joiner(call, name),
            _ if self.is_style(expression) => (self.items(expression, name), Vec::new()),
            _ => (Vec::new(), vec![self.text(expression.span()).to_owned()]),
        };
        for class in &classes {
            self.note(expression.span().start, format!("`{class}` is not a static class string; it stays a class"));
        }
        (items, classes)
    }

    /// A joiner's arguments one by one: styles, and what stays a class (joined again when several).
    fn split_joiner(&mut self, call: &CallExpression<'_>, name: &str) -> (Vec<String>, Vec<String>) {
        let (mut items, mut classes) = (Vec::new(), Vec::new());
        let mut run: Option<(u32, String)> = None;
        for argument in &call.arguments {
            match argument.as_expression() {
                Some(expression) if Self::static_string(expression).is_some() => {
                    self.extend_run(&mut run, expression);
                }
                Some(expression) if self.is_style(expression) => {
                    items.extend(self.flush_run(&mut run, name));
                    items.extend(self.items(expression, name));
                }
                _ => {
                    items.extend(self.flush_run(&mut run, name));
                    classes.push(self.text(argument.span()).to_owned());
                }
            }
        }
        items.extend(self.flush_run(&mut run, name));
        let joiner = self.joiner(call).unwrap_or_default();
        if classes.is_empty() {
            *self.joiner_rewritten.entry(joiner.clone()).or_default() += 1;
        } else if items.is_empty() {
            classes = vec![self.text(call.span).to_owned()];
        } else {
            // The joiner stays for what is still a class: it flattens arrays and objects too.
            classes = vec![format!("{joiner}({})", classes.join(", "))];
        }
        (items, classes)
    }

    /// Consecutive static strings in one joiner are one class list to tailwind-merge — `cn("a b",
    /// "dark:c")` pairs `c` with `a` — so they are lowered together, as one style.
    fn extend_run(&self, run: &mut Option<(u32, String)>, expression: &Expression<'_>) {
        let text = Self::static_string(expression).unwrap_or_default();
        match run {
            Some((_, classes)) => {
                classes.push(' ');
                classes.push_str(&text);
            }
            None => *run = Some((expression.span().start, text)),
        }
    }

    fn flush_run(&mut self, run: &mut Option<(u32, String)>, name: &str) -> Vec<String> {
        match run.take() {
            Some((offset, classes)) => self.style_items(&classes, offset, name),
            None => Vec::new(),
        }
    }

    /// The `sx` items a style expression (see [`Self::is_style`]) stands for.
    fn items(&mut self, expression: &Expression<'_>, name: &str) -> Vec<String> {
        if let Some(classes) = Self::static_string(expression) {
            return self.style_items(&classes, expression.span().start, name);
        }
        match expression {
            Expression::CallExpression(call) if self.joiner(call).is_some() => {
                let joiner = self.joiner(call).unwrap_or_default();
                *self.joiner_rewritten.entry(joiner).or_default() += 1;
                // `is_style` let this joiner through only if every argument is an expression.
                let arguments: Vec<&Expression<'_>> =
                    call.arguments.iter().filter_map(Argument::as_expression).collect();
                let mut items = Vec::new();
                let mut run: Option<(u32, String)> = None;
                for expression in arguments {
                    if Self::static_string(expression).is_some() {
                        self.extend_run(&mut run, expression);
                    } else {
                        items.extend(self.flush_run(&mut run, name));
                        items.extend(self.items(expression, name));
                    }
                }
                items.extend(self.flush_run(&mut run, name));
                items
            }
            Expression::ParenthesizedExpression(inner) => self.items(&inner.expression, name),
            Expression::Identifier(identifier) if identifier.name == "className" => self.sx_items(),
            Expression::Identifier(identifier) if self.constants.contains_key(identifier.name.as_str()) => {
                self.constant_style(identifier.name.as_str())
            }
            Expression::StaticMemberExpression(member) if member.property.name == "className" => {
                vec![format!("{}.sx", self.text(member.object.span()))]
            }
            Expression::LogicalExpression(logical) if logical.operator == LogicalOperator::And => {
                let left = self.text(logical.left.span()).to_owned();
                let right = self.items(&logical.right, name);
                match right.as_slice() {
                    [] => Vec::new(),
                    [single] => vec![format!("{left} && {single}")],
                    _ => vec![format!("{left} && [{}]", right.join(", "))],
                }
            }
            Expression::ConditionalExpression(conditional) => {
                let test = self.text(conditional.test.span()).to_owned();
                let consequent = self.items(&conditional.consequent, name);
                let alternate = self.items(&conditional.alternate, name);
                vec![format!("{test} ? {} : {}", one(&consequent), one(&alternate))]
            }
            Expression::CallExpression(call)
                if call
                    .callee
                    .get_identifier_reference()
                    .is_some_and(|callee| self.recipes.contains(callee.name.as_str())) =>
            {
                self.recipe_call(call, name)
            }
            _ => Vec::new(),
        }
    }

    /// A recipe call; cva's `className` option (`buttonVariants({ size, className })`) becomes an
    /// item of its own after the recipe's handle, since a recipe takes only its variants.
    fn recipe_call(&mut self, call: &CallExpression<'_>, name: &str) -> Vec<String> {
        let recipe = self.text(call.callee.span()).to_owned();
        if let Some(slot) = &self.current_slot {
            self.recipe_slots.insert((recipe.clone(), slot.clone()));
        }
        if let (Some(slot), Some(properties)) = (self.current_slot.clone(), self.recipe_properties.get(&recipe)) {
            self.slot_properties.entry(slot).or_default().extend(properties.iter().cloned());
        }
        let mut items = self.anchors_of(&recipe);
        items.extend(self.recipe_options(call, name));
        items
    }

    fn recipe_options(&mut self, call: &CallExpression<'_>, name: &str) -> Vec<String> {
        let Some(Expression::ObjectExpression(options)) = call.arguments.first().and_then(Argument::as_expression)
        else {
            return vec![self.text(call.span).to_owned()];
        };
        let is_class = |property: &ObjectPropertyKind<'_>| {
            matches!(property, ObjectPropertyKind::ObjectProperty(property)
                if matches!(&property.key, PropertyKey::StaticIdentifier(key) if key.name == "className" || key.name == "class"))
        };
        let Some(ObjectPropertyKind::ObjectProperty(class)) =
            options.properties.iter().find(|property| is_class(property))
        else {
            return vec![self.text(call.span).to_owned()];
        };
        let kept: Vec<&str> = options
            .properties
            .iter()
            .filter(|property| !is_class(property))
            .map(|property| self.text(property.span()))
            .collect();
        let callee = self.text(call.callee.span());
        let options = if kept.is_empty() { String::new() } else { format!("{{ {} }}", kept.join(", ")) };
        let mut items = vec![format!("{callee}({options})")];
        if class.shorthand {
            items.extend(self.sx_items());
        } else if self.is_style(&class.value) {
            items.extend(self.items(&class.value, name));
        } else {
            let text = self.text(class.value.span()).to_owned();
            self.note(
                class.span.start,
                format!("`{text}` is cva's className option and not a static class string; pass it as className"),
            );
            items.push(text);
        }
        items
    }

    /// A function's scope for `className`: a component (a capitalised function) whose first parameter
    /// destructures `className` renames it to `sx`; any other function binding `className` has its
    /// own, which stays — a render function a library calls with `className` keeps receiving it.
    fn enter_function(&mut self, params: &FormalParameters<'_>, component: bool) {
        let binds = |pattern: &BindingPattern<'_>| match pattern {
            BindingPattern::ObjectPattern(object) => object
                .properties
                .iter()
                .any(|property| matches!(&property.key, PropertyKey::StaticIdentifier(key) if key.name == "className")),
            _ => false,
        };
        let first = params.items.first().map(|parameter| &parameter.pattern);
        let renames = component && first.is_some_and(binds);
        let shadows = params.items.iter().any(|parameter| binds(&parameter.pattern));
        // The whole parameter, so its type annotation's `className?: string` is found too.
        self.class_params.push(if renames { params.items.first().map(GetSpan::span) } else { None });
        let rendered = self.scope.last().is_some_and(|name| self.options.project.keeps_class(self.path, name));
        self.keeps_class.push(renames && rendered);
        let inherited = self.class_is_sx.last().copied().unwrap_or(false);
        self.class_is_sx.push(if shadows { renames } else { inherited });
        // A component passing `{ ...props }` on without reading `className` is a wrapper.
        let wrapper = match first {
            Some(BindingPattern::ObjectPattern(object)) if component && !renames => object
                .rest
                .as_ref()
                .and_then(|rest| rest.argument.get_identifier_name())
                .map(|rest| (object.span.start + 1, rest.to_string(), false)),
            _ => None,
        };
        self.wrappers.push(wrapper);
    }

    /// What a renamed `className` stands for among items: `sx`, and for a render target the class a
    /// part hands it too.
    fn sx_items(&mut self) -> Vec<String> {
        // Passed on to another of the project's components: that one receives it too.
        if let (Some(to), Some(from)) = (self.forward_target.clone(), self.scope.last()) {
            self.class_forwards.insert(((self.path.to_path_buf(), from.clone()), to));
        }
        let mut items = vec!["sx".to_owned()];
        if self.keeps_class.last() == Some(&true) {
            items.push(INCOMING_CLASS.to_owned());
        }
        items
    }

    /// Whether `span` lies in the first parameter of the component being walked, if it renames.
    fn in_class_params(&self, span: Span) -> bool {
        self.class_params
            .last()
            .copied()
            .flatten()
            .is_some_and(|params| params.start <= span.start && span.end <= params.end)
    }

    fn leave_function(&mut self) {
        self.class_params.pop();
        self.keeps_class.pop();
        self.class_is_sx.pop();
        // A wrapper that handed its props to an installed component takes `sx` for it.
        if let Some(Some((at, _, true))) = self.wrappers.pop() {
            self.edits.push((Span::new(at, at), " sx,".to_owned()));
        }
    }

    /// An installed component receiving a wrapper's props gets its `sx` through `props()`, since it
    /// does not read `sx` itself.
    fn wrapper_spread(&mut self, element: &JSXOpeningElement<'_>, external: bool) {
        // Only a component some file passes a class to; a provider or a root that renders nothing
        // has no class to take.
        let component = self.scope.last().cloned().unwrap_or_default();
        if !self.options.project.styled.contains(&(self.path.to_path_buf(), component)) {
            return;
        }
        let Some(Some((_, rest, applied))) = self.wrappers.last_mut() else { return };
        let spread = element.attributes.iter().find_map(|item| match item {
            JSXAttributeItem::SpreadAttribute(spread)
                if spread
                    .argument
                    .get_identifier_reference()
                    .is_some_and(|reference| reference.name == rest.as_str()) =>
            {
                Some(spread.span)
            }
            _ => None,
        });
        let has_class = element.attributes.iter().any(|item| {
            matches!(item, JSXAttributeItem::Attribute(attribute) if attribute_name(attribute) == Some("className"))
        });
        let (Some(spread), false) = (spread, has_class) else { return };
        *applied = true;
        let text = if external {
            self.core.insert("props as styleProps");
            "{...styleProps(sx)} "
        } else {
            "sx={sx} "
        };
        self.edits.push((Span::new(spread.start, spread.start), text.to_owned()));
    }

    /// `cn(…)` where a string is wanted (`classNames={{ day: cn("…") }}`): the class name the styles
    /// compile to, through `props()`.
    fn joiner_elsewhere(&mut self, call: &CallExpression<'_>) {
        let name = self.scope.last().map(|name| camel(name)).unwrap_or_default();
        let (items, classes) = self.split_joiner(call, &name);
        if items.is_empty() {
            return;
        }
        for class in &classes {
            self.note(call.span.start, format!("`{class}` is not a static class string; it stays a class"));
        }
        self.core.insert("props as styleProps");
        let all: Vec<String> = items.into_iter().chain(classes).collect();
        self.replace(call.span, format!("styleProps({}).className", all.join(", ")));
        self.claimed.push(call.span);
    }

    /// A module constant used as a style: its string becomes `css({…})` in place, once, and each use
    /// names the handle.
    fn constant_style(&mut self, name: &str) -> Vec<String> {
        let uses = self.constants_styled.entry(name.to_owned()).or_default();
        *uses += 1;
        if *uses == 1 {
            let (span, classes) = self.constants[name].clone();
            let lowered = self.lower(&classes, span.start);
            let mut arguments: Vec<String> = lowered.anchors.iter().map(|anchor| format!("{anchor}.anchor")).collect();
            arguments.extend(lowered.handles.iter().cloned());
            arguments.push(Self::object(&lowered, ""));
            self.core.insert("css");
            self.edits.push((span, format!("css({})", arguments.join(", "))));
        }
        vec![name.to_owned()]
    }

    fn joiner(&self, call: &CallExpression<'_>) -> Option<String> {
        let callee = call.callee.get_identifier_reference()?;
        JOINERS.contains(&callee.name.as_str()).then(|| callee.name.to_string())
    }

    /// The name a style for this element takes: its `data-slot`, else the component it is in.
    fn element_name(&self, element: &JSXOpeningElement<'_>) -> String {
        let slot = element.attributes.iter().find_map(|item| match item {
            JSXAttributeItem::Attribute(attribute) if attribute_name(attribute) == Some("data-slot") => {
                match &attribute.value {
                    Some(JSXAttributeValue::StringLiteral(literal)) => literal.value.as_str().map(str::to_owned),
                    _ => None,
                }
            }
            _ => None,
        });
        if let Some(slot) = slot {
            return camel(&slot);
        }
        let component = self.scope.last().map(|name| camel(name)).unwrap_or_default();
        match &element.name {
            JSXElementName::Identifier(identifier) if !component.is_empty() => {
                let tag = identifier.name.as_str();
                format!("{component}{}{}", tag[..1].to_ascii_uppercase(), &tag[1..])
            }
            JSXElementName::Identifier(identifier) => identifier.name.to_string(),
            other => {
                let text = self.text(other.span());
                let last = camel(text.rsplit('.').next().unwrap_or(text));
                format!("{component}{}{}", last[..1].to_ascii_uppercase(), &last[1..])
            }
        }
    }

    /// Whether the element is a component from an installed package, which does not read `sx`.
    fn is_external(&self, element: &JSXOpeningElement<'_>) -> bool {
        let local = match &element.name {
            JSXElementName::IdentifierReference(reference) => reference.name.as_str(),
            JSXElementName::MemberExpression(member) => match &member.object {
                JSXMemberExpressionObject::IdentifierReference(reference) => reference.name.as_str(),
                _ => return false,
            },
            _ => return false,
        };
        self.imports.get(local).is_some_and(|specifier| self.environment.is_external(specifier))
    }

    fn sx_text(items: &[String], external: bool) -> String {
        if external { format!("{{...styleProps({})}}", items.join(", ")) } else { format!("sx={{{}}}", one(items)) }
    }

    /// Where a component used here is declared: its file and name, imported or in this file.
    fn declared(&self, local: &str) -> Option<(PathBuf, String)> {
        match self.imports.get(local) {
            Some(specifier) => self.environment.resolve(specifier).zip(self.imported_names.get(local).cloned()),
            None => Some((self.path.to_path_buf(), local.to_owned())),
        }
    }

    fn class_name_attribute(&mut self, element: &JSXOpeningElement<'_>, attribute: &JSXAttribute<'_>) {
        self.alone = self.is_alone(element, attribute);
        self.class_name_rewrite(element, attribute);
        self.forward_target = None;
        self.alone = false;
    }

    /// Whether a host element's `className` is all it is styled with, so no other class can add a
    /// layer to a composition its style resolves: one static class list, no spread props that may
    /// carry a class, and no contextual rule moved onto it (KF-076). A component merges its own
    /// styles with the one it is given, and keeps composing.
    fn is_alone(&self, element: &JSXOpeningElement<'_>, attribute: &JSXAttribute<'_>) -> bool {
        let one_list = match &attribute.value {
            Some(JSXAttributeValue::StringLiteral(_)) => true,
            Some(JSXAttributeValue::ExpressionContainer(container)) => {
                container.expression.as_expression().is_some_and(|expression| match expression {
                    Expression::CallExpression(call) if self.joiner(call).is_some() => call
                        .arguments
                        .iter()
                        .all(|argument| argument.as_expression().and_then(Self::static_string).is_some()),
                    _ => Self::static_string(expression).is_some(),
                })
            }
            _ => false,
        };
        let spread = element.attributes.iter().any(|item| matches!(item, JSXAttributeItem::SpreadAttribute(_)));
        let inverted = element.attributes.iter().any(|item| match item {
            JSXAttributeItem::Attribute(slot) if attribute_name(slot) == Some("data-slot") => match &slot.value {
                Some(JSXAttributeValue::StringLiteral(literal)) => {
                    literal.value.as_str().is_some_and(|slot| !self.options.project.inversions_for(slot).is_empty())
                }
                _ => true,
            },
            _ => false,
        });
        one_list && matches!(element.name, JSXElementName::Identifier(_)) && !spread && !inverted
    }

    fn class_name_rewrite(&mut self, element: &JSXOpeningElement<'_>, attribute: &JSXAttribute<'_>) {
        // A component given a class: its declaration, imported or in this file, will need `sx`.
        if let JSXElementName::IdentifierReference(reference) = &element.name {
            let declared = self.declared(reference.name.as_str());
            self.forward_target = declared.clone().filter(|_| !self.is_external(element));
            self.styled.extend(declared);
        }
        let name = self.element_name(element);
        let external = self.is_external(element);
        let items = match &attribute.value {
            Some(JSXAttributeValue::StringLiteral(literal)) => literal
                .value
                .as_str()
                .map_or_else(Vec::new, |classes| self.style_items(classes, literal.span.start, &name)),
            Some(JSXAttributeValue::ExpressionContainer(container)) => {
                let expression =
                    container.expression.as_expression().expect("the parser rejects an empty attribute expression");
                if matches!(expression, Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)) {
                    self.note(attribute.span.start, "a className function of state: its `cn()` calls compile through `props()`; any other class string it returns is left as it was");
                    return;
                }
                {
                    let (mut items, classes) = self.split(expression, &name);
                    if items.is_empty() {
                        return;
                    }
                    self.take_anchor(&mut items);
                    self.with_inversions(&mut items, &name);
                    if external && classes.is_empty() && self.onto_rendered(element, attribute, &items) {
                        return;
                    }
                    // A render target's host element takes the incoming class last, as `cn(own,
                    // className)` did: beside `sx`, the compiler would merge it first.
                    let host_incoming = matches!(element.name, JSXElementName::Identifier(_))
                        && items.iter().any(|item| item == INCOMING_CLASS);
                    if external || host_incoming {
                        // `props()` takes class strings too, so what stays a class goes with it.
                        self.core.insert("props as styleProps");
                        let all: Vec<String> = items.into_iter().chain(classes).collect();
                        self.replace(attribute.span, Self::sx_text(&all, true));
                    } else {
                        // The compiler merges `sx` into the element's own `className`, and the
                        // incoming class of a render target stays a class beside it.
                        let incoming = items.iter().any(|item| item == INCOMING_CLASS);
                        items.retain(|item| item != INCOMING_CLASS);
                        let mut classes = classes;
                        if incoming && classes.is_empty() {
                            classes.push("className".to_owned());
                        }
                        let mut text = Self::sx_text(&items, false);
                        if let Some(class) = classes.first() {
                            text.push_str(&format!(" className={{{class}}}"));
                            // A migrated component reads `sx`; the class reaches its props, whose
                            // spread replaces the class its own styles compiled to.
                            if matches!(
                                element.name,
                                JSXElementName::IdentifierReference(_) | JSXElementName::MemberExpression(_)
                            ) {
                                self.note(
                                    attribute.span.start,
                                    format!("`{class}` stays a class on a component that takes `sx`: spread with its props, it replaces the component's own styles; make it a style or drop it"),
                                );
                            }
                        }
                        self.replace(attribute.span, text);
                    }
                    self.claimed.push(attribute.span);
                    return;
                }
            }
            _ => return,
        };
        let mut items = items;
        self.take_anchor(&mut items);
        self.with_inversions(&mut items, &name);
        if external && !items.is_empty() && self.onto_rendered(element, attribute, &items) {
            return;
        }
        if external {
            self.core.insert("props as styleProps");
        }
        let text = if items.is_empty() { String::new() } else { Self::sx_text(&items, external) };
        self.replace(attribute.span, text);
        self.claimed.push(attribute.span);
    }

    /// A class string in another class prop (`containerClassName="md:col-span-2"`) stays a class
    /// string, compiled: `{styleProps(styles.x).className}` flows through `cn()` and `props()` as the
    /// Tailwind classes did, whatever the receiving component does with it.
    fn other_class_attribute(&mut self, element: &JSXOpeningElement<'_>, attribute: &JSXAttribute<'_>) {
        let Some(JSXAttributeValue::StringLiteral(literal)) = &attribute.value else { return };
        // A JSX attribute's string has no escapes and comes from UTF-8 source: never a lone surrogate.
        let classes = literal.value.as_str().unwrap_or_default();
        let name = self.element_name(element);
        let items = self.style_items(classes, literal.span.start, &name);
        if items.is_empty() {
            return;
        }
        self.core.insert("props as styleProps");
        self.replace(literal.span, format!("{{styleProps({}).className}}", items.join(", ")));
    }

    /// A map of class strings (`modifiersClassNames={{ booked: "…" }}`, react-day-picker's
    /// `classNames`): each static string is compiled in place, as for another class prop.
    fn class_map_attribute(&mut self, element: &JSXOpeningElement<'_>, attribute: &JSXAttribute<'_>) {
        let Some(JSXAttributeValue::ExpressionContainer(container)) = &attribute.value else { return };
        let Some(Expression::ObjectExpression(object)) = container.expression.as_expression() else { return };
        let element_name = self.element_name(element);
        for property in &object.properties {
            let ObjectPropertyKind::ObjectProperty(property) = property else { continue };
            let Some(classes) = Self::static_string(&property.value) else { continue };
            let key = property
                .key
                .static_name()
                .and_then(|key| key.as_js_str().as_str().map(str::to_owned))
                .unwrap_or_default();
            let items = self.style_items(&classes, property.value.span().start, &format!("{element_name}-{key}"));
            if items.is_empty() {
                continue;
            }
            self.core.insert("props as styleProps");
            // A map's values are strings; `className` is typed optional.
            self.replace(property.value.span(), format!("styleProps({}).className ?? \"\"", items.join(", ")));
        }
    }

    /// An installed part rendering one of the project's components (`<Part render={<Button />}
    /// className="…">`) is that component's element: its styles become the component's `sx`, since a
    /// class the part merged into the component's props would replace the component's own. Only
    /// when the rendered element has no class, `sx` or `data-slot` of its own.
    fn onto_rendered(
        &mut self,
        element: &JSXOpeningElement<'_>,
        attribute: &JSXAttribute<'_>,
        items: &[String],
    ) -> bool {
        let rendered = element.attributes.iter().find_map(|item| match item {
            JSXAttributeItem::Attribute(render) if attribute_name(render) == Some("render") => match &render.value {
                Some(JSXAttributeValue::ExpressionContainer(container)) => match &container.expression {
                    JSXExpression::JSXElement(rendered) => Some(&rendered.opening_element),
                    _ => None,
                },
                _ => None,
            },
            _ => None,
        });
        let Some(rendered) = rendered else { return false };
        let own = rendered.attributes.iter().any(|item| {
            matches!(item, JSXAttributeItem::Attribute(own)
                if matches!(attribute_name(own), Some("className" | "sx" | "data-slot")))
        });
        if own || !matches!(rendered.name, JSXElementName::IdentifierReference(_)) || self.is_external(rendered) {
            return false;
        }
        let end = rendered.name.span().end;
        let items: Vec<String> = items.iter().filter(|item| *item != INCOMING_CLASS).cloned().collect();
        self.edits.push((Span::new(end, end), format!(" sx={{{}}}", one(&items))));
        self.replace(attribute.span, "");
        self.claimed.push(attribute.span);
        true
    }

    /// `className: cn(…)` in an object (props handed to `mergeProps`) becomes `...styleProps(…)`.
    fn class_name_property(&mut self, property: &ObjectProperty<'_>) {
        let name = self.scope.last().map(|name| camel(name)).unwrap_or_default();
        let (items, classes) = if property.shorthand {
            (if self.class_is_sx.last() == Some(&true) { self.sx_items() } else { Vec::new() }, Vec::new())
        } else {
            self.split(&property.value, &name)
        };
        if items.is_empty() {
            return;
        }
        self.core.insert("props as styleProps");
        let all: Vec<String> = items.into_iter().chain(classes).collect();
        self.replace(property.span, format!("...styleProps({})", all.join(", ")));
        self.claimed.push(property.span);
    }

    // ── cva → recipe ───────────────────────────────────────────────────────────────────────────

    fn cva(&mut self, call: &CallExpression<'_>, name: &str) {
        self.current_recipe = Some(name.to_owned());
        self.cva_body(call, name);
        self.current_recipe = None;
    }

    fn cva_body(&mut self, call: &CallExpression<'_>, name: &str) {
        self.recipes.insert(name.to_owned());
        self.core.insert("recipe");
        let indent = line_indent(self.source, call.span.start);
        let inner = format!("{indent}  ");
        let mut out = String::from("recipe({\n");
        if let Some(base) = call.arguments.first().and_then(Argument::as_expression) {
            match Self::static_string(base) {
                Some(classes) => {
                    self.in_recipe_base = true;
                    let lowered = self.lower(&classes, base.span().start);
                    self.in_recipe_base = false;
                    self.recipe_anchors(&lowered, name);
                    self.cva_base = lowered
                        .entries
                        .iter()
                        .map(|entry| (entry.block.clone(), entry.conditions.clone(), entry.property.clone()))
                        .collect();
                    if !lowered.entries.is_empty() || !lowered.left.is_empty() {
                        out.push_str(&format!("{inner}base: {},\n", Self::object(&lowered, &inner)));
                    }
                }
                None => self.note(base.span().start, "a cva base that is not a static string; left out"),
            }
        }
        if let Some(Expression::ObjectExpression(config)) = call.arguments.get(1).and_then(Argument::as_expression) {
            self.cva_config(config, name, &inner, &mut out);
        }
        out.push_str(&format!("{indent}}})"));
        if out == format!("recipe({{\n{indent}}})") {
            out = "recipe({})".to_owned();
        }
        self.replace(call.span, out);
        self.claimed.push(call.span);
    }

    /// tailwind-merge in `cn()` deletes a base utility an option conflicts with, pair included: an option's
    /// `text-[0.8rem]` removes the base's `text-sm`, line height and all. Where an option sets a pair's
    /// first property and not the second, and the base set the second, the option removes it.
    fn drop_pairs(&self, lowered: &mut Lowered) {
        for rules in self.options.grammar.utilities.values() {
            for rule in rules {
                let Rule::Scale(rule) = rule else { continue };
                for (primary, paired) in
                    rule.properties.iter().flat_map(|primary| rule.pair.keys().map(move |paired| (primary, paired)))
                {
                    let sets = |property: &String| {
                        lowered.entries.iter().any(|entry| {
                            entry.block.is_none() && entry.conditions.is_empty() && entry.property == *property
                        })
                    };
                    let base_sets = self.cva_base.iter().any(|(block, conditions, property)| {
                        block.is_none() && conditions.is_empty() && property == paired
                    });
                    if sets(primary) && !sets(paired) && base_sets {
                        lowered.entries.push(Entry {
                            block: None,
                            conditions: Vec::new(),
                            property: paired.clone(),
                            value: vec![Part::Code("null".to_owned())],
                            ..Entry::default()
                        });
                    }
                }
            }
        }
    }

    /// A recipe cannot hold an anchor, which is a handle, so every call of it applies the anchor.
    fn recipe_anchors(&mut self, lowered: &Lowered, name: &str) {
        let anchors = self.recipe_anchors.entry(name.to_owned()).or_default();
        for anchor in &lowered.anchors {
            if !anchors.contains(anchor) {
                anchors.push(anchor.clone());
            }
        }
    }

    /// The anchors a recipe's calls apply, remembered as applied.
    fn anchors_of(&mut self, recipe: &str) -> Vec<String> {
        let anchors = self.recipe_anchors.get(recipe).cloned().unwrap_or_default();
        if !anchors.is_empty() {
            self.anchors_applied.insert(recipe.to_owned());
        }
        anchors.into_iter().map(|anchor| format!("{anchor}.anchor")).collect()
    }

    fn cva_config(&mut self, config: &ObjectExpression<'_>, name: &str, inner: &str, out: &mut String) {
        for property in &config.properties {
            let ObjectPropertyKind::ObjectProperty(property) = property else {
                out.push_str(&format!("{inner}{},\n", self.text(property.span())));
                continue;
            };
            let key = self.text(property.key.span()).to_owned();
            match (key.as_str(), &property.value) {
                ("variants", Expression::ObjectExpression(groups)) => {
                    out.push_str(&format!("{inner}variants: {{\n"));
                    for group in &groups.properties {
                        let ObjectPropertyKind::ObjectProperty(group) = group else {
                            out.push_str(&format!("{inner}  {},\n", self.text(group.span())));
                            continue;
                        };
                        let Expression::ObjectExpression(options) = &group.value else {
                            out.push_str(&format!("{inner}  {},\n", self.text(group.span)));
                            continue;
                        };
                        out.push_str(&format!("{inner}  {}: {{\n", self.text(group.key.span())));
                        for option in &options.properties {
                            let indent = format!("{inner}    ");
                            let ObjectPropertyKind::ObjectProperty(option) = option else {
                                out.push_str(&format!("{indent}{},\n", self.text(option.span())));
                                continue;
                            };
                            let option_key = self.text(option.key.span()).to_owned();
                            match Self::static_string(&option.value) {
                                Some(classes) => {
                                    let mut lowered = self.lower(&classes, option.value.span().start);
                                    self.recipe_anchors(&lowered, name);
                                    self.drop_pairs(&mut lowered);
                                    out.push_str(&format!(
                                        "{indent}{option_key}: {},\n",
                                        Self::object(&lowered, &indent)
                                    ));
                                }
                                None => {
                                    self.note(
                                        option.span.start,
                                        "a variant option that is not a static string; left as it was",
                                    );
                                    out.push_str(&format!("{indent}{},\n", self.text(option.span)));
                                }
                            }
                        }
                        out.push_str(&format!("{inner}  }},\n"));
                    }
                    out.push_str(&format!("{inner}}},\n"));
                }
                ("compoundVariants", Expression::ArrayExpression(compounds)) => {
                    out.push_str(&format!("{inner}compoundVariants: [\n"));
                    for element in &compounds.elements {
                        let Some(Expression::ObjectExpression(compound)) = element.as_expression() else {
                            out.push_str(&format!("{inner}  {},\n", self.text(element.span())));
                            continue;
                        };
                        out.push_str(&format!("{inner}  {{\n"));
                        for entry in &compound.properties {
                            let indent = format!("{inner}    ");
                            let ObjectPropertyKind::ObjectProperty(entry) = entry else {
                                out.push_str(&format!("{indent}{},\n", self.text(entry.span())));
                                continue;
                            };
                            let entry_key = self.text(entry.key.span()).to_owned();
                            match (entry_key.as_str(), Self::static_string(&entry.value)) {
                                ("class" | "className", Some(classes)) => {
                                    let mut lowered = self.lower(&classes, entry.value.span().start);
                                    self.drop_pairs(&mut lowered);
                                    out.push_str(&format!("{indent}css: {},\n", Self::object(&lowered, &indent)));
                                }
                                _ => out.push_str(&format!("{indent}{},\n", self.text(entry.span))),
                            }
                        }
                        out.push_str(&format!("{inner}  }},\n"));
                    }
                    out.push_str(&format!("{inner}],\n"));
                }
                _ => out.push_str(&format!("{inner}{},\n", self.reindented(property.span, inner))),
            }
        }
    }

    /// Source text moved to a new indentation, its continuation lines shifted with it.
    fn reindented(&self, span: Span, indent: &str) -> String {
        let old = line_indent(self.source, span.start);
        self.text(span)
            .lines()
            .enumerate()
            .map(|(index, line)| match (index, line.strip_prefix(old.as_str())) {
                (0, _) | (_, None) => line.to_owned(),
                (_, Some(rest)) => format!("{indent}{rest}"),
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    // ── Finishing ──────────────────────────────────────────────────────────────────────────────

    fn finish(mut self) -> (String, Vec<Note>) {
        // A joiner whose every reference was rewritten is no longer imported.
        for (name, span, declaration, specifiers) in std::mem::take(&mut self.joiner_imports) {
            let references = self.joiner_references.get(&name).copied().unwrap_or(0);
            let rewritten = self.joiner_rewritten.get(&name).copied().unwrap_or(0);
            if references > rewritten {
                self.note(span.start, format!("`{name}` is still used outside className; its import stays"));
                continue;
            }
            if specifiers == 1 {
                self.replace(line_span(self.source, declaration), "");
            } else {
                self.replace(specifier_span(self.source, span), "");
            }
        }
        for (recipe, anchors) in &self.recipe_anchors {
            if !anchors.is_empty() && !self.anchors_applied.contains(recipe) {
                let anchors: Vec<String> = anchors.iter().map(|anchor| format!("`{anchor}.anchor`")).collect();
                self.notes.push(Note {
                    offset: 0,
                    message: format!(
                        "recipe `{recipe}` anchors {}: apply it where the recipe is used",
                        anchors.join(", ")
                    ),
                });
            }
        }
        for (name, styled) in &self.constants_styled {
            if self.constant_references.get(name).copied().unwrap_or(0) > *styled {
                self.notes.push(Note {
                    offset: self.constants[name].0.start,
                    message: format!(
                        "`{name}` is now a style, and it is also used as a string elsewhere; those uses need a class name: `props({name}).className`"
                    ),
                });
            }
        }
        // A relation anchored in another file is imported from it; one anchored nowhere is reported.
        let mut imported = BTreeSet::new();
        let unanchored: Vec<String> = self.read.difference(&self.anchored).cloned().collect();
        for identifier in unanchored {
            match self.options.project.anchors.get(&identifier).filter(|file| file.as_path() != self.path) {
                Some(file) => {
                    let specifier = self.environment.specifier(file);
                    self.tokens.entry(specifier).or_default().insert(identifier.clone(), identifier.clone());
                    imported.insert(identifier);
                }
                None => {
                    let relation = &self.relations[&identifier];
                    self.notes.push(Note {
                        offset: 0,
                        message: format!("`{identifier}` (relation \"{relation}\") is read here and anchored in no migrated file: apply its anchor where the state lives"),
                    });
                }
            }
        }
        // What the rewritten file references decides what it imports and declares: a value a later
        // utility replaced (a paired line height) or a relation anchored inside a recipe leaves
        // nothing behind to name.
        let mut styles = String::new();
        if !self.styles.is_empty() {
            styles.push_str(&format!("const {} = {{\n", self.styles_name));
            for (key, style) in &self.styles {
                styles.push_str(&format!("  {key}: {style},\n"));
            }
            styles.push_str("}\n");
        }
        let mut used = styles.clone();
        for (_, text) in &self.edits {
            used.push_str(text);
            used.push('\n');
        }
        let mut relations = String::new();
        if !self.mode_tokens.is_empty() {
            // Named after the file and its folders: a token group's namespace is project-wide, and many
            // files are called `page.tsx`.
            let mut segments: Vec<String> = self
                .path
                .with_extension("")
                .components()
                .rev()
                .take(3)
                .map(|component| component.as_os_str().to_string_lossy().into_owned())
                .collect();
            segments.reverse();
            let namespace = format!("{}-modes", segments.join("-"));
            relations.push_str(&format!(
                "const {} = defineTokens(\n  {},\n  {{\n",
                self.modes_name,
                js_string(&namespace)
            ));
            for (key, light, dark) in &self.mode_tokens {
                relations.push_str(&format!(
                    "    {}: {{ light: {}, dark: {} }},\n",
                    js_key(key),
                    render_value(light),
                    render_value(dark)
                ));
            }
            relations.push_str("  },\n  { variable: true }\n)\n");
            self.notes.push(Note {
                offset: 0,
                message: format!(
                    "`dark:` on properties that are not colours became per-mode tokens (`{}`): they follow the color scheme and Kirana's `mode` handles — apply `mode.dark` and `mode.light` where the app's theme switch sets `.dark`",
                    self.modes_name
                ),
            });
        }
        for (identifier, relation) in &self.relations {
            // Read in another file, anchored here: this file declares it for both.
            let shared = self.options.project.anchors.get(identifier).is_some_and(|file| file.as_path() == self.path)
                && self.options.project.readers.contains_key(identifier);
            if shared || (mentions(&used, identifier) && !imported.contains(identifier)) {
                let export = if shared { "export " } else { "" };
                relations.push_str(&format!("{export}const {identifier} = relation({})\n", js_string(relation)));
            }
        }
        used.push_str(&relations);
        let mut header = String::new();
        let core: Vec<&str> =
            self.core.iter().copied().filter(|name| mentions(&used, name.rsplit(' ').next().unwrap_or(name))).collect();
        if !core.is_empty() {
            header.push_str(&format!("import {{ {} }} from \"@kirana-style/core\"\n", core.join(", ")));
        }
        if self.sx_type {
            header.push_str("import type { Sx } from \"@kirana-style/core\"\n");
        }
        for (module, exports) in &self.tokens {
            let names: Vec<String> = exports
                .iter()
                .filter(|(_, local)| mentions(&used, local))
                .map(|(export, local)| if export == local { export.clone() } else { format!("{export} as {local}") })
                .collect();
            if !names.is_empty() {
                header.push_str(&format!("import {{ {} }} from {}\n", names.join(", "), js_string(module)));
            }
        }
        let declarations = match (relations.is_empty(), styles.is_empty()) {
            (false, false) => format!("{relations}\n{styles}"),
            _ => format!("{relations}{styles}"),
        };
        // At the start of the line after the last import: the header joins the imports, and the
        // declarations follow after a blank line; the file's own blank line then separates them
        // from its code.
        let at = self.insert_at;
        // Declarations always come with the import of what they call.
        let block = if declarations.is_empty() { header } else { format!("{header}\n{declarations}") };
        if !block.is_empty() {
            let block = if at == 0 { format!("{block}\n") } else { block };
            self.edits.push((Span::new(at, at), block));
        }
        // Spans nest, as the tree does: an edit inside one already rewritten (a binding inside a
        // `className` expression that is now `sx`) is part of that rewrite's original text, and goes.
        self.edits.sort_by(|a, b| a.0.start.cmp(&b.0.start).then(b.0.end.cmp(&a.0.end)));
        let mut until = 0;
        let kept: Vec<&(Span, String)> = self
            .edits
            .iter()
            .filter(|edit| {
                let outside = edit.0.start >= until;
                // An edit inside another extends nothing: its end counts as 0.
                until = until.max(edit.0.end * u32::from(outside));
                outside
            })
            .collect();
        let mut out = self.source.to_owned();
        for (span, text) in kept.into_iter().rev() {
            out.replace_range(span.start as usize..span.end as usize, text);
        }
        self.notes.sort_by_key(|note| note.offset);
        (out, self.notes)
    }
}

/// Whether `text` uses the identifier `name`: not inside a longer one, after a dot (`a.name`), as
/// an object key (`name:`), nor on a `//` line.
fn mentions(text: &str, name: &str) -> bool {
    let word = |byte: u8| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$';
    text.match_indices(name).any(|(at, _)| {
        let byte = |index: usize| text.as_bytes().get(index).copied();
        let before = byte(at.wrapping_sub(1));
        // `a.name` is a property; `...name` is a spread of the identifier.
        let member = before == Some(b'.') && byte(at.wrapping_sub(2)) != Some(b'.');
        // `name: value` is an object key, and a `//` line a comment.
        let key = text[at + name.len()..].trim_start().starts_with(':');
        let line = &text[text[..at].rfind('\n').map_or(0, |start| start + 1)..at];
        !before.is_some_and(word) && !member && !byte(at + name.len()).is_some_and(word) && !key && !line.contains("//")
    })
}

/// Adjacent text parts joined, so `calc(3px * -1)` stays one string.
fn merge_text(parts: Vec<Part>) -> Vec<Part> {
    let mut out: Vec<Part> = Vec::new();
    for part in parts {
        match (out.last_mut(), part) {
            (Some(Part::Text(last)), Part::Text(text)) => last.push_str(&text),
            (_, part) => out.push(part),
        }
    }
    out
}

/// A layer the grammar composes a property through (`compose.ring-width`): a registered token that
/// does not inherit, as Tailwind registers `--tw-*`. Its key, and its initial value unless unset.
fn layer(environment: &dyn Environment, expr: &Expr) -> Option<(String, Option<String>)> {
    let Expr::Token { module, export, path, value: Value::Token(token) } = expr else { return None };
    let definition = environment.token(token.variable.as_deref()?)?;
    definition.registration.as_ref().filter(|registration| !registration.inherits)?;
    let initial = match &definition.value {
        TokenValue::Plain(value) if !value.is_empty() => Some(value.clone()),
        _ => None,
    };
    Some((format!("{module}#{export}.{}", path.join(".")), initial))
}

/// The layers a value reads.
fn layers_read(environment: &dyn Environment, expr: &Expr) -> Vec<String> {
    match expr {
        Expr::Text(_) => Vec::new(),
        Expr::Token { .. } => layer(environment, expr).map(|(key, _)| key).into_iter().collect(),
        Expr::Negate(inner) | Expr::Alpha(inner, _) | Expr::Paired(inner) => layers_read(environment, inner),
        Expr::Concat(parts) => parts.iter().flat_map(|part| layers_read(environment, part)).collect(),
    }
}

/// A value with the layers it reads replaced by what `setters` set them to: `Err` with the layer's
/// initial value for one none of them sets. In a comma-separated list (`box-shadow`'s five layers)
/// an item that only reads unset layers is left out, as a hand port writes one shadow.
fn substitute(environment: &dyn Environment, expr: &Expr, setters: &[&Entry]) -> Result<Expr, Option<String>> {
    let whole = |expr: &Expr| resolve(environment, expr, setters);
    match expr {
        Expr::Token { .. } => match layer(environment, expr) {
            Some((key, initial)) => {
                let setter = setters.iter().rev().find(|setter| setter.layer.as_ref() == Some(&key));
                // Every setter carries its value: the ones without one are left out of `setters`.
                setter.and_then(|setter| setter.expr.as_ref()).map(whole).ok_or(initial)
            }
            None => Ok(expr.clone()),
        },
        Expr::Negate(inner) => Ok(Expr::Negate(Box::new(whole(inner)))),
        Expr::Alpha(inner, percent) => Ok(Expr::Alpha(Box::new(whole(inner)), *percent)),
        // A size's paired line height is never a composition's.
        Expr::Text(_) | Expr::Paired(_) => Ok(expr.clone()),
        Expr::Concat(parts) => {
            let mut items: Vec<Vec<Result<Expr, Option<String>>>> = vec![Vec::new()];
            for part in parts {
                match part {
                    Expr::Text(text) => {
                        for (index, piece) in text.split(',').enumerate() {
                            if index > 0 {
                                items.push(Vec::new());
                            }
                            items.last_mut().expect("starts with one").push(Ok(Expr::Text(piece.to_owned())));
                        }
                    }
                    _ => items.last_mut().expect("starts with one").push(substitute(environment, part, setters)),
                }
            }
            let set = |item: &Vec<Result<Expr, Option<String>>>| {
                item.iter().any(|part| match part {
                    Ok(Expr::Text(text)) => !text.trim().is_empty(),
                    Ok(_) => true,
                    Err(_) => false,
                })
            };
            if items.len() > 1 && items.iter().any(set) {
                items.retain(set);
            }
            let mut out = Vec::new();
            for (index, item) in items.into_iter().enumerate() {
                if index > 0 {
                    out.push(Expr::Text(",".to_owned()));
                }
                out.extend(
                    item.into_iter().map(|part| part.unwrap_or_else(|initial| Expr::Text(initial.unwrap_or_default()))),
                );
            }
            Ok(Expr::Concat(out))
        }
    }
}

/// A value with its layers replaced, an unset one by its initial value.
fn resolve(environment: &dyn Environment, expr: &Expr, setters: &[&Entry]) -> Expr {
    substitute(environment, expr, setters).unwrap_or_else(|initial| Expr::Text(initial.unwrap_or_default()))
}

/// Spaces an unset layer left behind collapsed, and none at either end.
fn tidy(parts: Vec<Part>) -> Vec<Part> {
    let mut out: Vec<Part> = Vec::new();
    let mut space = true;
    for part in parts {
        match part {
            Part::Text(text) => {
                let mut tidied = String::new();
                for character in text.chars() {
                    if character != ' ' || !space {
                        tidied.push(character);
                    }
                    space = character == ' ';
                }
                out.push(Part::Text(tidied));
            }
            code => {
                space = false;
                out.push(code);
            }
        }
    }
    if let Some(Part::Text(text)) = out.last_mut() {
        text.truncate(text.trim_end().len());
    }
    out.retain(|part| !matches!(part, Part::Text(text) if text.is_empty()));
    out
}

fn group_entries(entries: &[&Entry]) -> Vec<(String, Tree<String>)> {
    kirana_utility::group(
        entries.iter().map(|entry| (entry.conditions.clone(), entry.property.clone(), render_value(&entry.value))),
    )
}

fn render_tree(tree: &Tree<String>) -> String {
    if let (Some(base), true) = (&tree.base, tree.conditions.is_empty()) {
        return base.clone();
    }
    let mut entries = Vec::new();
    // `"*": null` first: it removes every value but the ones this style lists.
    let removal = |condition: &String| condition == "\"*\"";
    for (condition, inner) in tree.conditions.iter().filter(|(condition, _)| removal(condition)) {
        entries.push(format!("{condition}: {}", render_tree(inner)));
    }
    if let Some(base) = &tree.base {
        entries.push(format!("base: {base}"));
    }
    for (condition, inner) in tree.conditions.iter().filter(|(condition, _)| !removal(condition)) {
        entries.push(format!("{condition}: {}", render_tree(inner)));
    }
    format!("{{ {} }}", entries.join(", "))
}

fn one(items: &[String]) -> String {
    match items {
        [] => "undefined".to_owned(),
        [single] => single.clone(),
        _ => format!("[{}]", items.join(", ")),
    }
}

/// A contextual target narrowed by the next variant's condition: `*` and `[data-slot="x"]` is
/// `[data-slot="x"]`, `svg` and `[data-icon]` is `svg[data-icon]`, `*` and `:is(svg)` is `svg`.
fn narrow_target(target: &str, condition: &str) -> Option<String> {
    // Every condition here is an attribute or a pseudo-class: at-rules stay conditions.
    let added = match condition.strip_prefix(":is(").and_then(|rest| rest.strip_suffix(')')) {
        Some(element) => strip_class_guards(element),
        None => condition.to_owned(),
    };
    // An attribute or a pseudo-class narrows any target; an element name only replaces `*`.
    match (target, added.starts_with(['[', ':'])) {
        ("*", _) => Some(added),
        (_, true) => Some(format!("{target}{added}")),
        _ => None,
    }
}

/// `svg:not([class*='size-'])` → `svg`.
fn strip_class_guards(target: &str) -> String {
    let mut out = target.to_owned();
    while let Some(start) = out.find(":not([class") {
        let Some(length) = out[start..].find("])") else { break };
        out.replace_range(start..start + length + 2, "");
    }
    out
}

fn attribute_name<'a>(attribute: &'a JSXAttribute<'_>) -> Option<&'a str> {
    match &attribute.name {
        JSXAttributeName::Identifier(identifier) => Some(identifier.name.as_str()),
        JSXAttributeName::NamespacedName(_) => None,
    }
}

/// The whitespace a line starts with.
fn line_indent(source: &str, offset: u32) -> String {
    let start = source[..offset as usize].rfind('\n').map_or(0, |at| at + 1);
    source[start..].chars().take_while(|character| *character == ' ' || *character == '\t').collect()
}

/// A statement's span widened to its whole line, newline included.
fn line_span(source: &str, span: Span) -> Span {
    let end = source[span.end as usize..].find('\n').map_or(source.len(), |at| span.end as usize + at + 1);
    Span::new(span.start, end as u32)
}

/// A specifier's span widened to the separator after it (or before it, when last).
fn specifier_span(source: &str, span: Span) -> Span {
    let bytes = source.as_bytes();
    let mut end = span.end as usize;
    while bytes.get(end).is_some_and(u8::is_ascii_whitespace) {
        end += 1;
    }
    if bytes.get(end) == Some(&b',') {
        end += 1;
        while bytes.get(end) == Some(&b' ') {
            end += 1;
        }
        return Span::new(span.start, end as u32);
    }
    let mut start = span.start as usize;
    while start > 0 && (bytes[start - 1].is_ascii_whitespace() || bytes[start - 1] == b',') {
        start -= 1;
    }
    Span::new(start as u32, span.end)
}

/// `target` relative to the directory `from`.
fn relative_path(from: &Path, target: &Path) -> PathBuf {
    let from: Vec<Component> = from.components().collect();
    let target: Vec<Component> = target.components().collect();
    let shared = from.iter().zip(&target).take_while(|(a, b)| a == b).count();
    let mut out = PathBuf::new();
    for _ in shared..from.len() {
        out.push("..");
    }
    for component in &target[shared..] {
        out.push(component.as_os_str());
    }
    out
}

impl<'a> Visit<'a> for Walker<'a> {
    fn visit_program(&mut self, program: &Program<'a>) {
        self.insert_at = program
            .body
            .iter()
            .filter_map(|statement| match statement {
                Statement::ImportDeclaration(declaration) => Some(line_span(self.source, declaration.span).end),
                _ => None,
            })
            .max()
            .unwrap_or(0);
        // Module constants holding a class string, which a class expression may name.
        for statement in &program.body {
            let declaration = match statement {
                Statement::VariableDeclaration(declaration) => declaration,
                Statement::ExportDeclaration(export) => match &export.declaration {
                    Declaration::VariableDeclaration(declaration) => declaration,
                    _ => continue,
                },
                _ => continue,
            };
            if declaration.kind != VariableDeclarationKind::Const {
                continue;
            }
            for declarator in &declaration.declarations {
                if let (Some(name), Some(init)) = (declarator.id.get_identifier_name(), declarator.init.as_ref())
                    && let Some(text) = Self::static_string(init)
                {
                    self.constants.insert(name.to_string(), (init.span(), text));
                }
            }
        }
        walk::walk_program(self, program);
    }

    fn visit_import_declaration(&mut self, declaration: &ImportDeclaration<'a>) {
        // A specifier with a lone surrogate names no module the migration reads.
        let Some(specifier) = declaration.source.value.as_str() else { return };
        let specifiers = declaration.specifiers.as_ref().map_or(0, |list| list.len());
        if specifier == "class-variance-authority" {
            if declaration.specifiers.iter().flatten().any(|item| item.local().name == "VariantProps") {
                self.variant_props = true;
            }
            self.replace(line_span(self.source, declaration.span), "");
            return;
        }
        for item in declaration.specifiers.iter().flatten() {
            let local = item.local().name.to_string();
            self.imports.insert(local.clone(), specifier.to_owned());
            if let ImportDeclarationSpecifier::ImportSpecifier(named) = item {
                let imported = named.imported.name().to_string();
                // A recipe another migrated file declares: `buttonVariants()` is a style here too.
                if self
                    .environment
                    .resolve(specifier)
                    .is_some_and(|file| self.options.project.recipes.contains(&(file, imported.clone())))
                {
                    self.recipes.insert(local.clone());
                }
                self.imported_names.insert(local.clone(), imported);
            }
            if let ImportDeclarationSpecifier::ImportSpecifier(named) = item
                && JOINERS.contains(&local.as_str())
            {
                self.joiner_imports.push((local, named.span, declaration.span, specifiers));
            }
        }
    }

    fn visit_function(&mut self, function: &Function<'a>, flags: ScopeFlags) {
        let named = function.id.as_ref().map(|id| id.name.to_string());
        let component = std::mem::take(&mut self.pending_component)
            || named.as_ref().is_some_and(|name| name.starts_with(|first: char| first.is_ascii_uppercase()));
        if let Some(name) = &named {
            self.scope.push(name.clone());
        }
        self.enter_function(&function.params, component);
        walk::walk_function(self, function, flags);
        self.leave_function();
        if named.is_some() {
            self.scope.pop();
        }
    }

    fn visit_arrow_function_expression(&mut self, arrow: &ArrowFunctionExpression<'a>) {
        let component = std::mem::take(&mut self.pending_component);
        self.enter_function(&arrow.params, component);
        walk::walk_arrow_function_expression(self, arrow);
        self.leave_function();
    }

    fn visit_variable_declarator(&mut self, declarator: &VariableDeclarator<'a>) {
        let name = declarator.id.get_identifier_name().map(|name| name.to_string());
        if let (Some(name), Some(Expression::CallExpression(call))) = (&name, declarator.init.as_ref())
            && call.callee.get_identifier_reference().is_some_and(|callee| callee.name == "cva")
        {
            self.cva(call, name);
            return;
        }
        let function =
            matches!(declarator.init, Some(Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)));
        if let (true, Some(name)) = (function, &name) {
            self.scope.push(name.clone());
            self.pending_component = name.starts_with(|first: char| first.is_ascii_uppercase());
        }
        walk::walk_variable_declarator(self, declarator);
        if function && name.is_some() {
            self.scope.pop();
        }
    }

    fn visit_jsx_opening_element(&mut self, element: &JSXOpeningElement<'a>) {
        let external = self.is_external(element);
        // A host element (`<form {...props}>`) reads `sx` only as its own attribute.
        let host = matches!(element.name, JSXElementName::Identifier(_));
        if external || host {
            self.wrapper_spread(element, external);
        }
        // `render={<Button />}`: the part hands `Button` its class.
        for item in &element.attributes {
            if let JSXAttributeItem::Attribute(render) = item
                && attribute_name(render) == Some("render")
                && let Some(JSXAttributeValue::ExpressionContainer(container)) = &render.value
                && let JSXExpression::JSXElement(target) = &container.expression
                && let JSXElementName::IdentifierReference(reference) = &target.opening_element.name
            {
                let declared = self.declared(reference.name.as_str());
                self.rendered.extend(declared);
            }
        }
        let slot = element.attributes.iter().find_map(|item| match item {
            JSXAttributeItem::Attribute(attribute) if attribute_name(attribute) == Some("data-slot") => {
                match &attribute.value {
                    Some(JSXAttributeValue::StringLiteral(literal)) => literal.value.as_str().map(str::to_owned),
                    _ => None,
                }
            }
            _ => None,
        });
        if let Some(slot) = &slot {
            if self.options.project.slot_reads.contains(slot) {
                self.pending_anchor = Some(self.slot_relation(slot));
            }
            self.slots.insert(slot.clone());
        }
        self.current_slot = slot;
        let mut class = false;
        for item in &element.attributes {
            if let JSXAttributeItem::Attribute(attribute) = item
                && attribute_name(attribute) == Some("className")
                && !self.is_claimed(attribute.span)
            {
                class = true;
                self.class_name_attribute(element, attribute);
            }
            if let JSXAttributeItem::Attribute(attribute) = item
                && attribute_name(attribute).is_some_and(|name| name.ends_with("ClassName"))
            {
                self.other_class_attribute(element, attribute);
            }
            if let JSXAttributeItem::Attribute(attribute) = item
                && attribute_name(attribute).is_some_and(|name| name == "classNames" || name.ends_with("ClassNames"))
            {
                self.class_map_attribute(element, attribute);
            }
        }
        self.current_slot = None;
        // An anchor no class list took: its own attribute, unless a class the compiler cannot merge
        // with would replace it.
        if let Some(identifier) = self.pending_anchor.take() {
            if external && class {
                self.note(
                    element.span.start,
                    format!("apply `{identifier}.anchor` here by hand: this element's `data-slot` is read with `in-*`, and its class stays a class"),
                );
            } else {
                let end = element.name.span().end;
                let text = if external {
                    self.core.insert("props as styleProps");
                    format!(" {{...styleProps({identifier}.anchor)}}")
                } else {
                    format!(" sx={{{identifier}.anchor}}")
                };
                self.edits.push((Span::new(end, end), text));
                self.anchored.insert(identifier);
            }
        }
        walk::walk_jsx_opening_element(self, element);
    }

    fn visit_object_property(&mut self, property: &ObjectProperty<'a>) {
        if let PropertyKey::StaticIdentifier(key) = &property.key
            && key.name == "className"
            && !self.is_claimed(property.span)
        {
            self.class_name_property(property);
        }
        walk::walk_object_property(self, property);
    }

    fn visit_binding_property(&mut self, property: &BindingProperty<'a>) {
        // A component's own props: `{ className, ...props }` → `{ sx, ...props }`, `{ className: c }`
        // → `{ sx: c }`. A library's render function keeps receiving `className`.
        if let PropertyKey::StaticIdentifier(key) = &property.key
            && key.name == "className"
            && self.in_class_params(property.span)
        {
            // A render target keeps its `className` too: `{ sx, className, ...props }`.
            let keep = property.shorthand && self.keeps_class.last() == Some(&true);
            self.replace(key.span, if keep { "sx, className" } else { "sx" });
        }
        walk::walk_binding_property(self, property);
    }

    fn visit_ts_type_literal(&mut self, literal: &TSTypeLiteral<'a>) {
        self.type_literals += 1;
        walk::walk_ts_type_literal(self, literal);
        self.type_literals -= 1;
    }

    fn visit_ts_property_signature(&mut self, signature: &TSPropertySignature<'a>) {
        // The component's own props type: `{ className?: string }` → `{ sx?: Sx }`; a nested
        // object's `className` is another element's.
        if let PropertyKey::StaticIdentifier(key) = &signature.key
            && key.name == "className"
            && self.type_literals == 1
            && self.in_class_params(signature.span)
        {
            self.replace(key.span, "sx");
            if let Some(annotation) = &signature.type_annotation {
                self.replace(annotation.span, ": Sx");
                self.sx_type = true;
            }
            return;
        }
        walk::walk_ts_property_signature(self, signature);
    }

    fn visit_identifier_reference(&mut self, reference: &IdentifierReference<'a>) {
        let name = reference.name.as_str();
        if JOINERS.contains(&name) {
            *self.joiner_references.entry(name.to_owned()).or_default() += 1;
        }
        if self.constants.contains_key(name) {
            *self.constant_references.entry(name.to_owned()).or_default() += 1;
        }
        if name == "className" && self.class_is_sx.last() == Some(&true) && !self.is_claimed(reference.span) {
            self.replace(reference.span, "sx");
        }
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if self.joiner(call).is_some() && !self.is_claimed(call.span) {
            self.joiner_elsewhere(call);
        }
        walk::walk_call_expression(self, call);
    }

    fn visit_ts_type_reference(&mut self, reference: &TSTypeReference<'a>) {
        if self.variant_props
            && let TSTypeName::IdentifierReference(name) = &reference.type_name
            && name.name == "VariantProps"
            && let Some(arguments) = &reference.type_arguments
            && let Some(TSType::TSTypeQuery(query)) = arguments.params.first()
        {
            // cva's `VariantProps<typeof x>` is the options a recipe takes.
            let target = self.text(query.span).to_owned();
            self.replace(reference.span, format!("NonNullable<Parameters<{target}>[0]>"));
            return;
        }
        walk::walk_ts_type_reference(self, reference);
    }
}
