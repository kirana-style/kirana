//! JavaScript operator semantics over fully static values.

use std::sync::Arc;

use kirana_ir::{BinaryOp, LogicalOp, UnaryOp, Value, number_to_string};

/// `ToString` for static primitives and CSS-bearing Kirana values; `None` for anything else.
pub fn to_string(value: &Value) -> Option<String> {
    Some(match value {
        Value::Undefined => "undefined".to_owned(),
        Value::Null => "null".to_owned(),
        Value::Bool(value) => value.to_string(),
        Value::Number(number) => number_to_string(*number),
        Value::Str(text) => text.to_string(),
        Value::Token(token) => token.css.clone(),
        Value::Keyframes(frames) => frames.name.clone(),
        Value::PositionTry(fallback) => fallback.name.clone(),
        Value::CounterStyle(style) => style.name.clone(),
        _ => return None,
    })
}

/// `ToNumber` for a primitive: `undefined` and every non-primitive give `NaN`, and callers rule the
/// non-primitives out first.
fn to_number(value: &Value) -> f64 {
    match value {
        Value::Null => 0.0,
        Value::Bool(value) => f64::from(u8::from(*value)),
        Value::Number(number) => *number,
        Value::Str(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() { 0.0 } else { trimmed.parse().unwrap_or(f64::NAN) }
        }
        _ => f64::NAN,
    }
}

fn is_primitive(value: &Value) -> bool {
    matches!(value, Value::Undefined | Value::Null | Value::Bool(_) | Value::Number(_) | Value::Str(_))
}

fn strict_equals(left: &Value, right: &Value) -> Option<bool> {
    if !is_primitive(left) || !is_primitive(right) {
        return None;
    }
    Some(match (left, right) {
        (Value::Number(a), Value::Number(b)) => a == b,
        _ => left == right,
    })
}

fn loose_equals(left: &Value, right: &Value) -> Option<bool> {
    if !is_primitive(left) || !is_primitive(right) {
        return None;
    }
    let nullish = |value: &Value| matches!(value, Value::Undefined | Value::Null);
    if nullish(left) || nullish(right) {
        return Some(nullish(left) && nullish(right));
    }
    if std::mem::discriminant(left) == std::mem::discriminant(right) {
        return strict_equals(left, right);
    }
    Some(to_number(left) == to_number(right))
}

/// A binary operator on static values; `None` when the result is not statically defined here.
pub fn binary(operator: BinaryOp, left: &Value, right: &Value) -> Option<Value> {
    Some(match operator {
        BinaryOp::Add => {
            let string_like = |value: &Value| {
                matches!(
                    value,
                    Value::Str(_)
                        | Value::Token(_)
                        | Value::Keyframes(_)
                        | Value::PositionTry(_)
                        | Value::CounterStyle(_)
                )
            };
            if string_like(left) || string_like(right) {
                Value::Str(Arc::from(format!("{}{}", to_string(left)?, to_string(right)?)))
            } else if is_primitive(left) && is_primitive(right) {
                Value::Number(to_number(left) + to_number(right))
            } else {
                return None;
            }
        }
        BinaryOp::Sub | BinaryOp::Mul | BinaryOp::Div | BinaryOp::Rem => {
            if !is_primitive(left) || !is_primitive(right) {
                return None;
            }
            let (a, b) = (to_number(left), to_number(right));
            Value::Number(match operator {
                BinaryOp::Sub => a - b,
                BinaryOp::Mul => a * b,
                BinaryOp::Div => a / b,
                _ => a % b,
            })
        }
        BinaryOp::StrictEq => Value::Bool(strict_equals(left, right)?),
        BinaryOp::StrictNotEq => Value::Bool(!strict_equals(left, right)?),
        BinaryOp::Eq => Value::Bool(loose_equals(left, right)?),
        BinaryOp::NotEq => Value::Bool(!loose_equals(left, right)?),
        BinaryOp::Lt | BinaryOp::LtEq | BinaryOp::Gt | BinaryOp::GtEq => {
            if !is_primitive(left) || !is_primitive(right) {
                return None;
            }
            if let (Value::Str(a), Value::Str(b)) = (left, right) {
                return Some(Value::Bool(match operator {
                    BinaryOp::Lt => a < b,
                    BinaryOp::LtEq => a <= b,
                    BinaryOp::Gt => a > b,
                    _ => a >= b,
                }));
            }
            let (a, b) = (to_number(left), to_number(right));
            Value::Bool(match operator {
                BinaryOp::Lt => a < b,
                BinaryOp::LtEq => a <= b,
                BinaryOp::Gt => a > b,
                _ => a >= b,
            })
        }
    })
}

/// A unary operator on a static value.
pub fn unary(operator: UnaryOp, argument: &Value) -> Option<Value> {
    Some(match operator {
        UnaryOp::Not => Value::Bool(!argument.truthy()?),
        UnaryOp::Minus => Value::Number(-is_primitive(argument).then(|| to_number(argument))?),
        UnaryOp::Plus => Value::Number(is_primitive(argument).then(|| to_number(argument))?),
        UnaryOp::TypeOf => Value::str(match argument {
            Value::Undefined => "undefined",
            Value::Null | Value::Array(_) | Value::Object(_) => "object",
            Value::Bool(_) => "boolean",
            Value::Number(_) => "number",
            Value::Str(_) => "string",
            Value::Function(_) => "function",
            _ => return None,
        }),
    })
}

/// A logical operator whose left side is static: which side's value results.
pub fn logical_pick_left(operator: LogicalOp, left: &Value) -> Option<bool> {
    Some(match operator {
        LogicalOp::And => !left.truthy()?,
        LogicalOp::Or => left.truthy()?,
        LogicalOp::Coalesce => !matches!(left, Value::Undefined | Value::Null),
    })
}
