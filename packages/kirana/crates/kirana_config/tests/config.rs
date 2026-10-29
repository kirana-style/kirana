use kirana_config::*;
use kirana_diagnostics::{Code, Level};

fn messages(json: &str) -> Vec<String> {
    Config::from_json(json)
        .unwrap_err()
        .into_iter()
        .map(|diagnostic| {
            assert_eq!(diagnostic.code, Code::InvalidConfig);
            diagnostic.message
        })
        .collect()
}

#[test]
fn defaults() {
    let config = Config::from_json("{}").unwrap();
    assert_eq!(config.names.prefix, "k");
    assert_eq!(config.dynamic.branch_budget, 16);
    assert_eq!(config.jsx, Jsx::React);
    assert!(config.targets_at_floor());
    assert_eq!(config.level(Code::RelationUnused), None);
    assert_eq!(Config::default().dynamic, Dynamic::default());
    assert_eq!(Config::default().names, Names::default());
}

#[test]
fn full_configuration() {
    let config = Config::from_json(
        r#"{"root":"/app","targets":{"chrome":123,"safari":"17.5","firefox":"120"},
            "layers":{"before":["reset","base"],"after":["over-rides_2"],"tiers":true},
            "dynamic":{"branchBudget":8},"names":{"prefix":"ds"},"jsx":"react",
            "diagnostics":{"relation-unused":"off"}}"#,
    )
    .unwrap();
    assert_eq!(config.root, "/app");
    assert_eq!(config.layers.before, ["reset", "base"]);
    assert_eq!(config.layers.after, ["over-rides_2"]);
    assert!(config.layers.tiers);
    assert!(!Config::default().layers.tiers);
    assert!(config.targets_at_floor());
    assert_eq!(config.level(Code::RelationUnused), Some(Level::Off));
    let lower = Config::from_json(r#"{"targets":{"safari":"16.4"}}"#).unwrap();
    assert!(!lower.targets_at_floor());
    let chrome_only = Config::from_json(r#"{"targets":{"chrome":100}}"#).unwrap();
    assert!(!chrome_only.targets_at_floor());
    let firefox_only = Config::from_json(r#"{"targets":{"firefox":100}}"#).unwrap();
    assert!(!firefox_only.targets_at_floor());
}

#[test]
fn versions() {
    assert_eq!(encode_version(&Version::Major(123)), Some(123 << 16));
    assert_eq!(encode_version(&Version::Text("17.5".into())), Some((17 << 16) | (5 << 8)));
    assert_eq!(encode_version(&Version::Text("17".into())), Some(17 << 16));
    assert_eq!(encode_version(&Version::Text("x".into())), None);
    assert_eq!(encode_version(&Version::Text("17.x".into())), None);
    assert_eq!(encode_version(&Version::Text("17.5.1".into())), None);
    assert_eq!(encode_version(&Version::Text("17.300".into())), None);
}

#[test]
fn invalid_configuration() {
    assert!(messages(r#"{"bogus":1}"#)[0].contains("unknown field"));
    let problems = messages(
        r#"{"names":{"prefix":"K1"},"dynamic":{"branchBudget":0},"targets":{"chrome":"new"},
            "layers":{"before":["kirana","9x"]},
            "diagnostics":{"nope":"off","parse-error":"warning"}}"#,
    );
    assert_eq!(problems.len(), 7, "{problems:#?}");
    assert!(messages(r#"{"names":{"prefix":""}}"#)[0].contains("names.prefix"));
    assert!(messages(r#"{"names":{"prefix":"abcde"}}"#)[0].contains("names.prefix"));
}

#[test]
fn exclusive_conditions() {
    let config =
        Config::from_json(r#"{"conditions":{"exclusive":[["[data-open]", "[ data-closed ]", ":hover"]]}}"#).unwrap();
    assert_eq!(config.conditions.exclusive, [["[data-open]", "[data-closed]", ":hover"]]);
    assert_eq!(Config::default().conditions, Conditions::default());
    assert_eq!(
        messages(r#"{"conditions":{"exclusive":[["[data-open]"], ["[a]:hover", "@media (x)", "nope"]]}}"#),
        [
            "conditions.exclusive[0] needs at least two conditions",
            "conditions.exclusive[1]: \"[a]:hover\" is not one attribute or pseudo-class condition",
            "conditions.exclusive[1]: \"@media (x)\" is not one attribute or pseudo-class condition",
            "conditions.exclusive[1]: \"nope\" is not one attribute or pseudo-class condition",
        ]
    );
    // One vocabulary per library (KF-015), normalized the same way.
    let config =
        Config::from_json(r#"{"conditions":{"exclusiveAcross":[["[ data-starting-style ]"], ["[data-entering]"]]}}"#)
            .unwrap();
    assert_eq!(config.conditions.exclusive_across, [["[data-starting-style]"], ["[data-entering]"]]);
    assert_eq!(
        messages(r#"{"conditions":{"exclusiveAcross":[["[data-open]", "a b"]]}}"#),
        [
            "conditions.exclusiveAcross needs at least two vocabularies",
            "conditions.exclusiveAcross[0]: \"a b\" is not one attribute or pseudo-class condition",
        ]
    );
    // Attributes a project's own components write (KF-042), by name.
    let config = Config::from_json(r#"{"conditions":{"ownAttributes":["data-side","aria-x2"]}}"#).unwrap();
    assert_eq!(config.conditions.own_attributes, ["data-side", "aria-x2"]);
    assert_eq!(
        messages(r#"{"conditions":{"ownAttributes":["[data-side]","","Data-side","data_side"]}}"#),
        [
            "conditions.ownAttributes[0] must be an attribute name such as \"data-side\", got \"[data-side]\"",
            "conditions.ownAttributes[1] must be an attribute name such as \"data-side\", got \"\"",
            "conditions.ownAttributes[2] must be an attribute name such as \"data-side\", got \"Data-side\"",
            "conditions.ownAttributes[3] must be an attribute name such as \"data-side\", got \"data_side\"",
        ]
    );
}

#[test]
fn libraries() {
    let config = Config::from_json(r#"{"libraries":["acme-ui","@acme/design-system","a.b_c~d"]}"#).unwrap();
    assert_eq!(config.libraries, ["acme-ui", "@acme/design-system", "a.b_c~d"]);
    assert!(Config::default().libraries.is_empty());
    assert_eq!(
        messages(r#"{"libraries":["Acme","@acme","@acme/","@/x","","_x",".x","@acme/Ui"]}"#),
        [
            "libraries: \"Acme\" is not a package name",
            "libraries: \"@acme\" is not a package name",
            "libraries: \"@acme/\" is not a package name",
            "libraries: \"@/x\" is not a package name",
            "libraries: \"\" is not a package name",
            "libraries: \"_x\" is not a package name",
            "libraries: \".x\" is not a package name",
            "libraries: \"@acme/Ui\" is not a package name",
        ]
    );
}

#[test]
fn utility_grammar() {
    let config = Config::from_json(
        r#"{"utilities":{
            "scales":{"space":[{"module":"@kirana-style/preset-scales","export":"space"}]},
            "utilities":{
                "flex":[{"static":{"display":"flex"}}],
                "p":[{"properties":["padding"],"scale":"space","negative":true,"alias":null}],
                "items":[{"properties":["alignItems"],"values":{"center":"center"}}]
            },
            "variants":{"hover":":hover"}
        }}"#
        .replace(r#","alias":null"#, "")
        .as_str(),
    )
    .unwrap();
    let grammar = config.utilities.unwrap();
    assert_eq!(grammar.variants["hover"], ":hover");
    assert!(matches!(&grammar.utilities["flex"][0], Rule::Static(rule) if rule.declarations["display"] == "flex"));
    assert!(
        matches!(&grammar.utilities["p"][0], Rule::Scale(rule) if rule.negative && rule.scale.as_deref() == Some("space"))
    );
    assert!(matches!(&grammar.utilities["items"][0], Rule::Keyword(rule) if rule.values["center"] == "center"));
    assert_eq!(Grammar::default().utilities.len(), 0);
    assert_eq!(
        messages(
            r#"{"utilities":{"scales":{},"utilities":{
                "a":[{"static":{}}],
                "b":[{"properties":[],"scale":"missing","pair":{"lineHeight":"gone"}}],
                "c":[{"properties":[],"values":{}}]
            }}}"#
        ),
        [
            "utilities.utilities.a: a static rule sets nothing",
            "utilities.utilities.b: no scale named \"missing\"",
            "utilities.utilities.b: no scale named \"gone\"",
            "utilities.utilities.b: a rule needs at least one property",
            "utilities.utilities.c: a rule needs at least one property",
        ]
    );
    assert_eq!(
        messages(
            r#"{"utilities":{"utilities":{
                "d":[{"properties":["a"]}],
                "e":[{"properties":["a"],"number":{"step":0}}]
            }}}"#
        ),
        [
            "utilities.utilities.d: a rule needs a scale or a number",
            "utilities.utilities.e: a number's step must be positive"
        ]
    );
    // A relative module is relative to the project root, wherever the importing file is.
    let config = Config::from_json(
        r#"{"root":"/app/web","utilities":{"scales":{
            "a":[{"module":"./src/./theme.ts","export":"a"}],
            "b":[{"module":"../ui/tokens.ts","export":"b"}],
            "c":[{"module":"@acme/tokens","export":"c"}]
        }}}"#,
    )
    .unwrap();
    let scales = config.utilities.unwrap().scales;
    let module = |name: &str| scales[name][0].module.replace('\\', "/");
    assert!(module("a").ends_with("/app/web/src/theme.ts"), "{}", module("a"));
    assert!(module("b").ends_with("/app/ui/tokens.ts"), "{}", module("b"));
    assert_eq!(module("c"), "@acme/tokens");
    // Without a root there is nothing to be relative to, and the module stays as written.
    let config = Config::from_json(r#"{"utilities":{"scales":{"a":[{"module":"./theme.ts","export":"a"}]}}}"#).unwrap();
    assert_eq!(config.utilities.unwrap().scales["a"][0].module, "./theme.ts");
}
