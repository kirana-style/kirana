//! The shared lowering, rule by rule, against a small grammar and hand-built scales.

use std::collections::BTreeMap;
use std::sync::Arc;

use kirana_config::Grammar;
use kirana_diagnostics::Code;
use kirana_ir::{Key, Value};
use kirana_utility::{Declaration, Expr, Scales};

fn object(entries: &[(&str, Value)]) -> Value {
    Value::Object(Arc::new(entries.iter().map(|(key, value)| (Key::Str(Arc::from(*key)), value.clone())).collect()))
}

/// Scales by module and export.
struct Fake(BTreeMap<(String, String), Value>);

impl Scales for Fake {
    fn export(&self, module: &str, export: &str) -> Value {
        self.0.get(&(module.to_owned(), export.to_owned())).cloned().unwrap_or(Value::Undefined)
    }
}

fn scales() -> Fake {
    let mut map = BTreeMap::new();
    map.insert(
        ("./s".to_owned(), "space".to_owned()),
        object(&[("1", Value::str("0.25rem")), ("4", Value::str("1rem"))]),
    );
    map.insert(
        ("./s".to_owned(), "color".to_owned()),
        object(&[
            ("blue", object(&[("600", Value::str("blue600")), ("DEFAULT", Value::str("blue"))])),
            ("red", object(&[("600", Value::str("red600"))])),
            ("primaryForeground", Value::str("pf")),
            ("white", Value::str("#fff")),
        ]),
    );
    map.insert(("./s".to_owned(), "size".to_owned()), object(&[("sm", Value::str("0.875rem"))]));
    map.insert(("./s".to_owned(), "leading".to_owned()), object(&[("sm", Value::str("1.25"))]));
    map.insert(("./s".to_owned(), "compose".to_owned()), object(&[("x", Value::str("var(--x)"))]));
    Fake(map)
}

fn grammar() -> Grammar {
    let json = serde_json::json!({
        "scales": {
            "space": [{"module": "./missing", "export": "space"}, {"module": "./s", "export": "space"}],
            "color": [{"module": "./s", "export": "color"}],
            "size": [{"module": "./s", "export": "size"}],
            "leading": [{"module": "./s", "export": "leading"}],
            "compose": [{"module": "./s", "export": "compose"}]
        },
        "utilities": {
            "flex": [{"static": {"display": "flex"}}, {"properties": ["flexDirection"], "values": {"col": "column"}}],
            "p": [{"properties": ["padding"], "scale": "space", "number": {"step": 0.25, "unit": "rem"}}],
            "m": [{"properties": ["margin"], "scale": "space", "negative": true},
                  {"properties": ["margin"], "values": {"auto": "auto"}}],
            "w": [{"properties": ["width"], "scale": "space", "fractions": true}],
            "text": [{"properties": ["fontSize"], "scale": "size", "pair": {"lineHeight": "leading"}},
                     {"properties": ["color"], "scale": "color", "alpha": true},
                     {"properties": ["textAlign"], "values": {"center": "center"}}],
            "ease": [{"properties": ["ease"], "scale": "space", "aliases": {"one": "1"}}],
            "leading": [{"properties": ["lineHeight"], "scale": "leading"}, {"properties": ["lineHeight"], "values": {"none": "1"}}],
            "z": [{"properties": ["zIndex"], "number": {}}],
            "bg": [{"properties": ["backgroundColor"], "scale": "color", "alpha": true},
                   {"properties": ["backgroundColor"], "values": {"current": "currentColor"}},
                   {"properties": ["backgroundImage"], "values": {"none": "none"}}],
            "bright": [{"properties": ["filter"], "number": {"unit": "%"}, "format": "brightness({value})"}],
            "ring": [{"properties": ["{compose.x}"], "number": {"unit": "px"},
                      "also": {"boxShadow": "0 0 {compose.x}"}},
                     {"properties": ["ringColor"], "values": {"on": "{compose.x}"}, "also": {"a": "b"}}],
            "broken": [{"static": {"a": "{nope.x}"}}],
            "broken-also": [{"properties": ["a"], "values": {"x": "y"}, "also": {"b": "{compose"}}],
            "broken-format": [{"properties": ["a"], "number": {}, "format": "{other}"}],
            "broken-scale-also": [{"properties": ["a"], "number": {}, "also": {"b": "{value}"}}],
            "broken-token": [{"static": {"a": "{compose.missing}"}}],
            "unreachable": [{"properties": ["{compose.missing}"], "number": {}}],
            "broken-keyword": [{"properties": ["a"], "values": {"x": "{nope.y}"}}],
            "@container": [{"static": {"containerType": "inline-size"}}]
        },
        "variants": {
            "hover": ":hover",
            "md": "@media (width >= 48rem)",
            "@md": "@container (width >= 28rem)",
            "@print": "@media print",
            "after": "::after",
            "before": "::before",
            "disabled": ":disabled"
        }
    });
    serde_json::from_value(json).expect("a grammar")
}

fn lower(utility: &str) -> Result<Vec<Declaration>, kirana_utility::Failure> {
    kirana_utility::lower(&grammar(), &scales(), utility)
}

/// The declarations of a utility as `property: value` text, tokens by path.
fn text(utility: &str) -> Vec<String> {
    fn render(expr: &Expr) -> String {
        match expr {
            Expr::Text(text) => text.clone(),
            Expr::Token { export, path, .. } => format!("{export}.{}", path.join(".")),
            Expr::Negate(inner) => format!("-({})", render(inner)),
            Expr::Alpha(inner, percent) => format!("{}/{percent}", render(inner)),
            Expr::Concat(parts) => parts.iter().map(render).collect(),
            Expr::Paired(inner) => format!("~{}", render(inner)),
        }
    }
    lower(utility)
        .unwrap_or_else(|failure| panic!("{utility}: {}", failure.message))
        .iter()
        .map(|declaration| {
            let mut out = String::new();
            if let Some(block) = &declaration.block {
                out.push_str(&format!("{block} "));
            }
            for condition in &declaration.conditions {
                out.push_str(&format!("{condition} "));
            }
            out.push_str(&format!("{}: {}", declaration.property, render(&declaration.value)));
            out
        })
        .collect()
}

fn failure(utility: &str) -> (Code, String) {
    let failure = lower(utility).expect_err(utility);
    (failure.code, format!("{}{}", failure.message, failure.help.map(|help| format!(" | {help}")).unwrap_or_default()))
}

#[test]
fn a_utility_is_taken_apart() {
    let parsed = kirana_utility::parse("md:hover:-mt-2");
    assert_eq!(parsed.variants, ["md", "hover"]);
    assert!(parsed.negative && !parsed.important);
    assert_eq!(parsed.name, "mt-2");
    assert!(kirana_utility::parse("!p-4").important);
    assert!(kirana_utility::parse("p-4!").important);
    assert_eq!(kirana_utility::parse("data-[a=b:c]:p-4").variants, ["data-[a=b:c]"]);
}

#[test]
fn utilities_are_split_on_whitespace_outside_brackets() {
    let found: Vec<&str> = kirana_utility::utilities("  p-4 bg-[rgb(1, 2, 3)]\n]x ").collect();
    assert_eq!(found, ["p-4", "bg-[rgb(1, 2, 3)]", "]x"]);
    assert_eq!(kirana_utility::split_outside_brackets("a/[b/c]/d", '/'), ["a", "[b/c]", "d"]);
    assert_eq!(kirana_utility::split_outside_brackets("]a/b", '/'), ["]a", "b"]);
    assert_eq!(kirana_utility::arbitrary("[a_b]").as_deref(), Some("a b"));
    assert_eq!(kirana_utility::arbitrary("[]"), None);
    assert_eq!(kirana_utility::arbitrary("a"), None);
}

#[test]
fn rules_lower_to_their_declarations() {
    assert_eq!(text("flex"), ["display: flex"]);
    assert_eq!(text("flex-col"), ["flexDirection: column"]);
    assert_eq!(text("p-4"), ["padding: space.4"]);
    assert_eq!(text("p-50"), ["padding: 12.5rem"]);
    assert_eq!(text("p-1.5"), ["padding: 0.375rem"]);
    assert_eq!(text("p-[3px]"), ["padding: 3px"]);
    assert_eq!(text("p-(--gap)"), ["padding: var(--gap)"]);
    assert_eq!(text("-m-4"), ["margin: -(space.4)"]);
    assert_eq!(text("m-auto"), ["margin: auto"]);
    assert_eq!(text("w-1/2"), ["width: calc(1/2 * 100%)"]);
    assert_eq!(text("text-sm"), ["fontSize: size.sm", "lineHeight: ~leading.sm"]);
    assert_eq!(text("text-[13px]"), ["fontSize: 13px"]);
    assert_eq!(text("text-blue-600/50"), ["color: color.blue.600/50"]);
    assert_eq!(text("text-blue"), ["color: color.blue.DEFAULT"]);
    assert_eq!(text("text-primary-foreground"), ["color: color.primaryForeground"]);
    assert_eq!(text("text-[#0af]"), ["color: #0af"]);
    assert_eq!(text("text-[#0af]/50"), ["color: #0af/50"]);
    assert_eq!(text("text-center"), ["textAlign: center"]);
    assert_eq!(text("ease-one"), ["ease: space.1"]);
    assert_eq!(text("z-3"), ["zIndex: 3"]);
    assert_eq!(text("z-[x]"), ["zIndex: x"]);
    assert_eq!(text("bright-50"), ["filter: brightness(50%)"]);
    assert_eq!(text("ring-2"), ["{compose.x}: 2px", "boxShadow: 0 0 compose.x"]);
    assert_eq!(text("ring-on"), ["ringColor: compose.x", "a: b"]);
    assert_eq!(text("@container"), ["containerType: inline-size"]);
    assert_eq!(text("@container/card"), ["containerType: inline-size", "containerName: card"]);
}

#[test]
fn values_a_rule_does_not_take_fall_through() {
    for (utility, message) in [
        ("p-x", "`p-x`: no such value"),
        ("p-1.x", "`p-1.x`: no such value"),
        ("p-.5", "`p-.5`: no such value"),
        ("-p-4", "`-p-4`: no such value"),
        ("-flex", "`-flex`: no such value"),
        ("-m-auto", "`-m-auto`: no such value"),
        ("text-blue-600/200", "`text-blue-600/200`: no such value"),
        ("text-blue-600/x", "`text-blue-600/x`: no such value"),
        ("text-[13px]/50", "`text-[13px]/50`: no such value"),
        ("text-[#0af]x", "`text-[#0af]x`: no such value"),
        ("broken", "`broken`: no such value"),
        ("broken-also-x", "`broken-also-x`: no such value"),
        ("broken-format-1", "`broken-format-1`: no such value"),
        ("broken-scale-also-1", "`broken-scale-also-1`: no such value"),
        ("broken-token", "`broken-token`: no such value"),
        (
            "unreachable-1",
            "`unreachable-1`: the token {compose.missing} cannot be reached from here | the module declaring it must be a dependency of this package",
        ),
        ("broken-keyword-x", "`broken-keyword-x`: no such value"),
        ("p-(--gap", "`p-(--gap`: no such value"),
        ("text-blue-700", "`text-blue-700`: no such value"),
        ("@container/", "`@container/` is not a utility | did you mean `@container`?"),
        ("qqq", "`qqq` is not a utility"),
        ("fle", "`fle` is not a utility | did you mean `flex`?"),
    ] {
        let (code, text) = failure(utility);
        assert_eq!(code, Code::UnknownUtility, "{utility}");
        assert_eq!(text, message, "{utility}");
    }
    // A mixed root: an arbitrary colour is never a font size, nor a length a colour.
    assert_eq!(text("text-[var(--c)]"), ["color: var(--c)"]);
    assert_eq!(text("text-(--c)"), ["color: var(--c)"]);
}

#[test]
fn variants_are_conditions_and_pseudo_elements_are_blocks() {
    assert_eq!(text("md:hover:p-4"), ["@media (width >= 48rem) :hover padding: space.4"]);
    assert_eq!(text("hover:after:p-4"), ["::after :hover padding: space.4"]);
    assert!(kirana_utility::needs_content("::before") && kirana_utility::needs_content("::after"));
    assert!(!kirana_utility::needs_content("::placeholder"));
    assert_eq!(failure("after:before:p-4").1, "`after:before:p-4`: two pseudo-elements");
    let (code, message) = failure("!p-4");
    assert_eq!(code, Code::UtilityUnsupported);
    assert!(message.contains("`!important` has no place"));
    assert_eq!(failure("hovr:p-4").0, Code::UnknownUtilityVariant);
}

#[test]
fn tailwind_builtin_variants() {
    let condition =
        |variant: &str| kirana_utility::variant(&grammar(), variant, "u").map_err(|failure| failure.message);
    for (variant, expected) in [
        ("@md/card", "@container card (width >= 28rem)"),
        ("@[250px]", "@container (width >= 250px)"),
        ("@[250px]/card", "@container card (width >= 250px)"),
        ("nth-3", ":nth-child(3)"),
        ("nth-[2n+1]", ":nth-child(2n+1)"),
        ("nth-last-2", ":nth-last-child(2)"),
        ("nth-of-type-2", ":nth-of-type(2)"),
        ("nth-last-of-type-2", ":nth-last-of-type(2)"),
        ("supports-[display:grid]", "@supports (display:grid)"),
        ("supports-[selector(:has(a))]", "@supports (selector(:has(a)))"),
        ("supports-backdrop-filter", "@supports (backdrop-filter: var(--tw))"),
        ("data-[state=open]", "[data-state=\"open\"]"),
        ("data-[state='open']", "[data-state=\"open\"]"),
        ("data-[open]", "[data-open]"),
        ("data-side=left", "[data-side=\"left\"]"),
        ("data-open", "[data-open]"),
        ("aria-[sort=ascending]", "[aria-sort=\"ascending\"]"),
        ("aria-invalid", "[aria-invalid=\"true\"]"),
        ("has-[svg]", ":has(svg)"),
        ("has-disabled", ":has(:disabled)"),
        ("has-md", ":has(@media (width >= 48rem))"),
        ("not-disabled", ":not(:disabled)"),
        ("not-[.x]", ":not(.x)"),
        ("[&:nth-child(2)]", ":nth-child(2)"),
        ("[&[data-x]]", "[data-x]"),
        ("[@media_print]", "@media print"),
        ("[a]", ":is(a)"),
    ] {
        assert_eq!(condition(variant).as_deref(), Ok(expected), "{variant}");
    }
    for (variant, message) in [
        ("@print/x", "`u`: no variant `@print/x`"),
        ("@a/b/c", "`u`: no variant `@a/b/c`"),
        ("@lg/card", "`u`: no variant `@lg/card`"),
        ("nth-x", "`u`: no variant `nth-x`"),
        ("nth-", "`u`: no variant `nth-`"),
        ("data-a_b", "`u`: no variant `data-a_b`"),
        ("data-", "`u`: no variant `data-`"),
        ("not-md", "`u`: no variant `not-md`"),
        ("has-bogus", "`u`: no variant `bogus`"),
        ("group-hover", "`u`: `group-hover:` reads another element's state"),
        ("peer-checked", "`u`: `peer-checked:` reads another element's state"),
        ("[&_svg]", "`u`: arbitrary selector variants are not utilities"),
        ("[&[data-open]>button]", "`u`: arbitrary selector variants are not utilities"),
        ("[&(a,b)]", "`u`: arbitrary selector variants are not utilities"),
        ("[&[a]+b]", "`u`: arbitrary selector variants are not utilities"),
        ("[&[a]~b]", "`u`: arbitrary selector variants are not utilities"),
        ("[&[a],[b]]", "`u`: arbitrary selector variants are not utilities"),
        ("[&:hover_b]", "`u`: arbitrary selector variants are not utilities"),
        ("[&:hover>b]", "`u`: arbitrary selector variants are not utilities"),
    ] {
        let failure = kirana_utility::variant(&grammar(), variant, "u").expect_err(variant);
        let text = format!("{}{}", failure.message, failure.help.map(|help| format!(" | {help}")).unwrap_or_default());
        assert!(text.starts_with(message), "{variant}: {text}");
    }
}

#[test]
fn token_named_properties() {
    let grammar = grammar();
    let token = |property: &str| kirana_utility::property_token(&grammar, &scales(), property);
    assert!(matches!(token("{compose.x}"), Some(Expr::Token { .. })));
    assert_eq!(token("color"), None);
    assert_eq!(token("{compose}"), None);
    assert_eq!(token("{nope.x}"), None);
    assert_eq!(token("{compose.missing}"), None);
    assert_eq!(token("{compose.x"), None);
}

#[test]
fn declarations_group_by_property_and_condition() {
    let grouped = kirana_utility::group(vec![
        (vec![], "a".to_owned(), 1),
        (vec![":hover".to_owned()], "a".to_owned(), 2),
        (vec![":hover".to_owned(), "@x".to_owned()], "a".to_owned(), 3),
        (vec![":hover".to_owned()], "a".to_owned(), 4),
        (vec![], "b".to_owned(), 5),
    ]);
    assert_eq!(grouped.len(), 2);
    let (name, tree) = &grouped[0];
    assert_eq!(name, "a");
    assert_eq!(tree.base, Some(1));
    assert_eq!(tree.conditions.len(), 1);
    assert_eq!(tree.conditions[0].1.base, Some(4));
    assert_eq!(tree.conditions[0].1.conditions[0].1.base, Some(3));
    assert!(format!("{:?}", grouped[1].1).contains("base: Some(5)"));
}

#[test]
fn a_named_container_needs_the_container_utility() {
    let mut grammar = grammar();
    grammar.utilities.remove("@container");
    let failure = kirana_utility::lower(&grammar, &scales(), "@container/card").expect_err("no @container");
    assert_eq!(failure.message, "`@container/card` is not a utility");
    assert!(kirana_utility::variant(&grammar, "[&:is(a,b)]", "u").is_ok());
}

#[test]
fn content_takes_the_conditions_of_its_block() {
    let hover = vec![":hover".to_owned()];
    let focus = vec![":focus".to_owned()];
    let paths = [hover.clone(), focus.clone(), hover.clone()];
    assert_eq!(kirana_utility::condition_paths(paths.iter()), [hover.clone(), focus.clone()]);
    let paths = [hover, Vec::new(), focus];
    assert_eq!(kirana_utility::condition_paths(paths.iter()), [Vec::<String>::new()]);
}

#[test]
fn math_in_a_bracketed_value_is_spaced_as_tailwind_decodes_it() {
    for (value, expected) in [
        ("[calc(100%-1px)]", "calc(100% - 1px)"),
        ("[calc(var(--x)+2rem)]", "calc(var(--x) + 2rem)"),
        ("[calc(1.5rem-var(--gap))]", "calc(1.5rem - var(--gap))"),
        ("[calc(-1px*2)]", "calc(-1px*2)"),
        ("[min(12%,calc(10*-1px))]", "min(12%,calc(10*-1px))"),
        ("[max(var(--a-b),1px)]", "max(var(--a-b),1px)"),
        ("[translate-x(1px-2px)]", "translate-x(1px-2px)"),
        ("[calc(a-b)]", "calc(a-b)"),
    ] {
        assert_eq!(kirana_utility::arbitrary(value).as_deref(), Some(expected), "{value}");
    }
}

#[test]
fn a_paired_value_yields_to_the_property_set_directly() {
    // `text-sm/sm`: the modifier names the pair's value through `leading-sm`, set directly.
    assert_eq!(text("text-sm/sm"), ["fontSize: size.sm", "lineHeight: leading.sm"]);
    assert_eq!(text("text-sm/none"), ["fontSize: size.sm", "lineHeight: 1"]);
    assert!(lower("text-sm/unknown").is_err());
    let settle = |utilities: &[&str]| -> Vec<String> {
        let declarations: Vec<Declaration> = utilities.iter().flat_map(|utility| lower(utility).unwrap()).collect();
        kirana_utility::settle_pairs(declarations)
            .iter()
            .map(|declaration| {
                let paired = if matches!(declaration.value, Expr::Paired(_)) { " ~" } else { "" };
                format!("{:?} {:?} {}{paired}", declaration.block, declaration.conditions, declaration.property)
            })
            .collect()
    };
    // The element's paired line height goes where `leading-none` applies, and stays at rest, where
    // Tailwind's `var(--tw-leading, …)` falls back to it (KF-076); the `::after` block has no direct one.
    assert_eq!(
        settle(&["text-sm", "hover:leading-none", "after:text-sm"]),
        [
            "None [] fontSize",
            "None [] lineHeight ~",
            "None [\":hover\"] lineHeight",
            "Some(\"::after\") [] fontSize",
            "Some(\"::after\") [] lineHeight ~"
        ]
    );
    // A line height set at rest, or under fewer conditions, applies wherever the size's does.
    assert_eq!(settle(&["md:hover:text-sm", "hover:leading-none"]).len(), 2);
    assert_eq!(
        settle(&["md:text-sm", "leading-none"]),
        ["None [\"@media (width >= 48rem)\"] fontSize", "None [] lineHeight"]
    );
}

#[test]
fn a_bracketed_image_is_a_background_image() {
    // As Tailwind 4 infers the `image` type (KF-076): every layer an image, `var()`s aside.
    for (utility, expected) in [
        ("bg-[url(/a.png)]", "backgroundImage: url(/a.png)"),
        (
            "bg-[repeating-linear-gradient(45deg,var(--b)_0_1px,transparent_1px_8px)]",
            "backgroundImage: repeating-linear-gradient(45deg,var(--b) 0 1px,transparent 1px 8px)",
        ),
        ("bg-[radial-gradient(red,blue),var(--x)]", "backgroundImage: radial-gradient(red,blue),var(--x)"),
        ("bg-[conic-gradient(red,blue)]", "backgroundImage: conic-gradient(red,blue)"),
        ("bg-[image-set(url(a)_1x)]", "backgroundImage: image-set(url(a) 1x)"),
        ("bg-[cross-fade(url(a),url(b))]", "backgroundImage: cross-fade(url(a),url(b))"),
        ("bg-none", "backgroundImage: none"),
        // Not an image: a colour, a lone variable, a word, a list with something else in it.
        ("bg-[#fff]", "backgroundColor: #fff"),
        ("bg-[var(--x)]", "backgroundColor: var(--x)"),
        ("bg-[var(--x),var(--y)]", "backgroundColor: var(--x),var(--y)"),
        ("bg-[linear-gradient(red,blue),red]", "backgroundColor: linear-gradient(red,blue),red"),
        ("bg-[canvas]", "backgroundColor: canvas"),
        ("bg-[foo]", "backgroundColor: foo"),
        ("bg-(--x)", "backgroundColor: var(--x)"),
        ("bg-blue-600", "backgroundColor: color.blue.600"),
    ] {
        assert_eq!(text(utility), [expected], "{utility}");
    }
}

#[test]
fn tailwinds_spacing_function_is_steps_of_space_1() {
    assert_eq!(text("p-[--spacing(var(--gap))]"), ["padding: calc(space.1 * var(--gap))"]);
    assert_eq!(text("p-[calc(--spacing(2)+1px)]"), ["padding: calc(calc(space.1 * 2) + 1px)"]);
    assert_eq!(text("flex-[--spacing(2]"), ["flexDirection: --spacing(2"]);
    // Without a `space` scale, or without its `1`, the text stays as written.
    let bare: Grammar = serde_json::from_value(serde_json::json!({
        "scales": { "space": [{ "module": "./s", "export": "radius" }] },
        "utilities": { "w": [{ "properties": ["width"], "values": { "full": "100%" } }] }
    }))
    .expect("a grammar");
    let none: Grammar = serde_json::from_value(serde_json::json!({
        "scales": {},
        "utilities": { "w": [{ "properties": ["width"], "values": { "full": "100%" } }] }
    }))
    .expect("a grammar");
    for grammar in [bare, none] {
        let declarations = kirana_utility::lower(&grammar, &scales(), "w-[--spacing(2)]").expect("lowers");
        assert_eq!(declarations[0].value, Expr::Text("--spacing(2)".to_owned()));
    }
}

#[test]
fn a_bracketed_colour_keyword_is_a_colour() {
    assert_eq!(text("text-[CanvasText]"), ["color: CanvasText"]);
    assert_eq!(text("text-[2rem]"), ["fontSize: 2rem"]);
}

#[test]
fn grouping_parentheses_keep_their_math() {
    assert_eq!(
        kirana_utility::arbitrary("[calc((var(--a)-var(--b))*1rem)]").as_deref(),
        Some("calc((var(--a) - var(--b))*1rem)")
    );
    // A function's own parenthesis is not math: `var(--a-b)` stays one name.
    assert_eq!(kirana_utility::arbitrary("[calc(var(--a-b)+1px)]").as_deref(), Some("calc(var(--a-b) + 1px)"));
    assert_eq!(kirana_utility::arbitrary("[(1px-2px)]").as_deref(), Some("(1px-2px)"));
}
