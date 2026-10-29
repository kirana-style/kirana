use std::sync::Arc;

use kirana_ir::*;

fn handle_with(property: &str, css: &str) -> Handle {
    let mut handle = Handle::default();
    handle.apply(Op::Set(
        EntryKey::new(Target::Element, Property::longhand(property), ConditionSet::default()),
        AtomValue { css: css.into(), deps: vec![], longhands: 1 },
    ));
    handle
}

#[test]
fn api_names_round_trip() {
    for api in [
        Api::Css,
        Api::Cx,
        Api::Props,
        Api::Recipe,
        Api::Relation,
        Api::Select,
        Api::Keyframes,
        Api::DefineTokens,
        Api::DefineTheme,
        Api::Mode,
        Api::Media,
        Api::Container,
        Api::Supports,
    ] {
        assert_eq!(Api::from_export(api.export()), Some(api));
    }
    assert_eq!(Api::from_export("styled"), None);
}

#[test]
fn value_helpers() {
    assert!(Value::str("a").is_static());
    assert!(!Value::unknown("x").is_static());
    let dynamic = Value::Dynamic(Arc::new(Dynamic::Open((0, 1))));
    assert!(!dynamic.is_static());
    assert!(!Value::Array(Arc::new(vec![Value::Null, dynamic.clone()])).is_static());
    assert!(Value::Array(Arc::new(vec![Value::Null])).is_static());
    let object = Value::Object(Arc::new(vec![
        (Key::Str("a".into()), Value::Number(1.0)),
        (Key::Str("a".into()), Value::Number(2.0)),
        (Key::Conditions(Arc::new(vec![])), Value::Null),
    ]));
    assert!(object.is_static());
    assert!(!Value::Object(Arc::new(vec![(Key::Str("a".into()), dynamic.clone())])).is_static());
    assert_eq!(object.get("a"), Some(&Value::Number(2.0)));
    let style = Dynamic::Style(vec![
        StylePart::Static(Arc::new(Handle::default())),
        StylePart::Conditional { test: (0, 1), consequent: Handle::default(), alternate: Handle::default() },
        StylePart::Runtime((2, 3)),
        StylePart::Spread((6, 7)),
        StylePart::Bridge { handle: Handle::default(), variable: "--k1".into(), value: (4, 5) },
    ]);
    assert_eq!(style.clone(), style);
    let conditional =
        Dynamic::Conditional { span: (0, 9), test: (0, 1), consequent: Value::Null, alternate: Value::Null };
    assert_ne!(conditional, style);
    assert_ne!(Dynamic::Spread((0, 1)), Dynamic::Open((0, 1)));
    assert_eq!(object.get("b"), None);
    assert_eq!(Value::Null.get("a"), None);

    assert_eq!(Value::Undefined.truthy(), Some(false));
    assert_eq!(Value::Null.truthy(), Some(false));
    assert_eq!(Value::Bool(true).truthy(), Some(true));
    assert_eq!(Value::Number(0.0).truthy(), Some(false));
    assert_eq!(Value::Number(f64::NAN).truthy(), Some(false));
    assert_eq!(Value::Number(2.0).truthy(), Some(true));
    assert_eq!(Value::str("").truthy(), Some(false));
    assert_eq!(Value::Api(Api::Css).truthy(), Some(true));
    assert_eq!(dynamic.truthy(), None);
    assert_eq!(Value::unknown("x").truthy(), None);
}

#[test]
fn numbers_print_like_javascript() {
    assert_eq!(number_to_string(f64::NAN), "NaN");
    assert_eq!(number_to_string(f64::INFINITY), "Infinity");
    assert_eq!(number_to_string(f64::NEG_INFINITY), "-Infinity");
    assert_eq!(number_to_string(-0.0), "0");
    assert_eq!(number_to_string(1.0), "1");
    assert_eq!(number_to_string(0.25), "0.25");
    assert_eq!(number_to_string(-3.5), "-3.5");
}

#[test]
fn recipes_resolve_in_merge_order() {
    let recipe = Recipe {
        slots: None,
        base: vec![handle_with("color", "black")],
        variants: vec![
            (
                "tone".into(),
                vec![
                    ("red".into(), vec![handle_with("color", "red")]),
                    ("blue".into(), vec![handle_with("color", "blue")]),
                ],
            ),
            (
                "size".into(),
                vec![
                    ("sm".into(), vec![handle_with("height", "1rem")]),
                    ("md".into(), vec![handle_with("height", "2rem")]),
                ],
            ),
            ("flag".into(), vec![("true".into(), vec![handle_with("opacity", "0.5")])]),
        ],
        compounds: vec![(
            vec![("tone".into(), "red".into()), ("size".into(), "sm".into())],
            vec![handle_with("color", "pink")],
        )],
        defaults: vec![("tone".into(), "blue".into()), ("size".into(), "md".into())],
    };
    assert_eq!(recipe.slot_count(), 1);
    let css = |options: &[(&str, &str)]| {
        let options: Vec<(String, String)> = options.iter().map(|(a, b)| ((*a).into(), (*b).into())).collect();
        recipe.resolve(&options).map(|handles| {
            handles[0].entries().map(|(key, value)| format!("{}:{}", key.property.name, value.css)).collect::<Vec<_>>()
        })
    };
    assert_eq!(css(&[]).unwrap(), ["color:blue", "height:2rem"]);
    assert_eq!(css(&[("tone", "red"), ("size", "sm")]).unwrap(), ["height:1rem", "color:pink"]);
    assert_eq!(css(&[("flag", "true")]).unwrap(), ["color:blue", "height:2rem", "opacity:0.5"]);
    assert_eq!(css(&[("shape", "x")]).unwrap_err(), "the recipe has no variant \"shape\"");
    assert_eq!(css(&[("tone", "green")]).unwrap_err(), "variant \"tone\" has no option \"green\"");
    let slotted = Recipe { slots: Some(vec!["root".into(), "label".into()]), ..Recipe::default() };
    assert_eq!(slotted.slot_count(), 2);
}

#[test]
fn methods_keys_and_expressions_compare() {
    let relation = Arc::new(RelationValue { name: "field".into(), marker: "krA".into() });
    assert_eq!(
        Method::RelationRead(relation.clone(), RelationKind::Within),
        Method::RelationRead(relation, RelationKind::Within)
    );
    assert_ne!(Method::Select { child: true }, Method::Select { child: false });
    let descriptor = Descriptor {
        params: 1,
        defaults: vec![(0, Expr::Value(Value::str("1")))],
        body: Expr::Template { quasis: vec!["".into(), "px".into()], expressions: vec![Expr::Param(0)] },
    };
    assert_eq!(descriptor.clone(), descriptor);
    let token = Key::Token(Arc::new(TokenRef {
        css: "var(--kvA)".into(),
        variable: Some("--kvA".into()),
        identity: "ctx.gap".into(),
        deps: vec![],
    }));
    assert_eq!(token.clone(), token);
    assert_ne!(Key::Select(Arc::new(Target::Element)), Key::Str("a".into()));
    let expr = Expr::Object(vec![
        (ExprKey::Static("a".into()), Expr::Value(Value::Null)),
        (ExprKey::Computed(Expr::Param(0)), Expr::Array(vec![])),
        (ExprKey::Spread, Expr::Member { object: Box::new(Expr::Param(0)), property: Box::new(Expr::Param(1)) }),
    ]);
    assert_eq!(expr.clone(), expr);
}

#[test]
fn unresolved_imports_are_found_inside_values() {
    let missing = Value::unresolved("pkg", "src/a.ts");
    assert_eq!(missing.unresolved_import(), Some("\"pkg\" from src/a.ts"));
    let nested =
        Value::Object(Arc::new(vec![(Key::Str("list".into()), Value::Array(Arc::new(vec![Value::Null, missing])))]));
    assert_eq!(nested.unresolved_import(), Some("\"pkg\" from src/a.ts"));
    assert_eq!(Value::unknown("global").unresolved_import(), None);
    assert_eq!(Value::str("x").unresolved_import(), None);
}
