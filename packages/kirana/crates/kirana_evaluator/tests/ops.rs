use std::sync::Arc;

use kirana_evaluator::ops::{binary, logical_pick_left, to_string, unary};
use kirana_ir::{BinaryOp, Descriptor, Expr, LogicalOp, UnaryOp, Value};

fn num(value: f64) -> Value {
    Value::Number(value)
}

#[test]
fn strings_and_numbers() {
    assert_eq!(to_string(&Value::Handle(Arc::default())), None);
    assert_eq!(binary(BinaryOp::Add, &Value::str("a"), &Value::Array(Arc::default())), None);
    assert_eq!(binary(BinaryOp::Add, &Value::Array(Arc::default()), &Value::str("a")), None);
    assert_eq!(binary(BinaryOp::Add, &num(1.0), &Value::Bool(true)), Some(num(2.0)));
    assert_eq!(binary(BinaryOp::Add, &Value::Null, &Value::Undefined).map(|v| v.truthy()), Some(Some(false)));
    assert_eq!(binary(BinaryOp::Add, &num(1.0), &Value::Array(Arc::default())), None);
    assert_eq!(binary(BinaryOp::Sub, &Value::str(" 3 "), &Value::str("")), Some(num(3.0)));
    assert!(matches!(binary(BinaryOp::Mul, &Value::str("x"), &num(1.0)), Some(Value::Number(n)) if n.is_nan()));
    assert_eq!(binary(BinaryOp::Div, &num(1.0), &Value::Array(Arc::default())), None);
}

#[test]
fn equality_and_comparison() {
    let object = Value::Object(Arc::default());
    assert_eq!(binary(BinaryOp::StrictEq, &object, &object), None);
    assert_eq!(binary(BinaryOp::Eq, &object, &num(1.0)), None);
    assert_eq!(binary(BinaryOp::StrictNotEq, &object, &num(1.0)), None);
    assert_eq!(binary(BinaryOp::NotEq, &object, &num(1.0)), None);
    assert_eq!(binary(BinaryOp::Eq, &Value::Null, &Value::Undefined), Some(Value::Bool(true)));
    assert_eq!(binary(BinaryOp::Eq, &Value::Null, &num(0.0)), Some(Value::Bool(false)));
    assert_eq!(binary(BinaryOp::Eq, &Value::str("1"), &num(1.0)), Some(Value::Bool(true)));
    assert_eq!(binary(BinaryOp::NotEq, &Value::Bool(true), &Value::Bool(true)), Some(Value::Bool(false)));
    assert_eq!(binary(BinaryOp::Lt, &object, &num(1.0)), None);
    assert_eq!(binary(BinaryOp::LtEq, &Value::str("a"), &Value::str("b")), Some(Value::Bool(true)));
    assert_eq!(binary(BinaryOp::GtEq, &Value::Bool(true), &num(1.0)), Some(Value::Bool(true)));
    assert_eq!(binary(BinaryOp::Gt, &Value::Undefined, &num(1.0)), Some(Value::Bool(false)));
}

#[test]
fn unary_operators() {
    assert_eq!(unary(UnaryOp::Plus, &Value::str("2")), Some(num(2.0)));
    assert_eq!(unary(UnaryOp::Minus, &Value::Array(Arc::default())), None);
    assert_eq!(unary(UnaryOp::Minus, &Value::Undefined).map(|v| v.truthy()), Some(Some(false)));
    assert_eq!(unary(UnaryOp::Plus, &Value::Object(Arc::default())), None);
    assert_eq!(unary(UnaryOp::Not, &Value::unknown("x")), None);
    for (value, name) in [
        (Value::Undefined, "undefined"),
        (Value::Null, "object"),
        (Value::Array(Arc::default()), "object"),
        (Value::Object(Arc::default()), "object"),
        (Value::Bool(true), "boolean"),
        (num(1.0), "number"),
        (Value::str(""), "string"),
        (Value::Function(Arc::new(Descriptor { params: 0, body: Expr::Value(Value::Null) })), "function"),
    ] {
        assert_eq!(unary(UnaryOp::TypeOf, &value), Some(Value::str(name)));
    }
    assert_eq!(unary(UnaryOp::TypeOf, &Value::Handle(Arc::default())), None);
}

#[test]
fn logical_operators() {
    assert_eq!(logical_pick_left(LogicalOp::And, &num(0.0)), Some(true));
    assert_eq!(logical_pick_left(LogicalOp::Or, &num(0.0)), Some(false));
    assert_eq!(logical_pick_left(LogicalOp::Coalesce, &Value::Null), Some(false));
    assert_eq!(logical_pick_left(LogicalOp::Coalesce, &num(0.0)), Some(true));
    assert_eq!(logical_pick_left(LogicalOp::And, &Value::unknown("x")), None);
    assert_eq!(logical_pick_left(LogicalOp::Or, &Value::unknown("x")), None);
}
