//! The Kirana Style IR (tier 1): the one representation that crosses from source frontends to
//! CSS emission, rewriting and tooling (KRN-CMP-005).

pub mod condition;
pub mod defs;
pub mod dense;
pub mod style;
pub mod value;

pub use condition::*;
pub use defs::*;
pub use style::*;
pub use value::*;
