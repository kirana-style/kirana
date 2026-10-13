//! Small building blocks shared by every Kirana crate (tier 0).
//!
//! - [`hash64`] and [`base62`]: the deterministic hashing that names atoms, variables and markers
//!   ([10-compiler-architecture](../../../../spec/10-compiler-architecture.md#hashing-and-names)).
//! - [`FxHashMap`] / [`FxHashSet`]: non-cryptographic maps (engineering rule 3 in doc 13).
//! - [`Fs`]: the file system seen by the engine, with an OS and an in-memory implementation.

use std::collections::BTreeMap;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

pub use rustc_hash::{FxHashMap, FxHashSet};

const ALPHABET: &[u8; 62] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// XXH3-64 of `bytes` (D-037: the hash that closes Q-01).
pub fn hash64(bytes: &[u8]) -> u64 {
    xxhash_rust::xxh3::xxh3_64(bytes)
}

/// Hashes several parts with an unambiguous separator, so `("ab", "c")` and `("a", "bc")` differ.
pub fn hash_parts(parts: &[&str]) -> u64 {
    let mut buffer = Vec::with_capacity(parts.iter().map(|part| part.len() + 1).sum());
    for part in parts {
        buffer.extend_from_slice(part.as_bytes());
        buffer.push(0);
    }
    hash64(&buffer)
}

/// The `width` lowest base-62 digits of `value`, most significant first.
pub fn base62(mut value: u64, width: usize) -> String {
    let mut digits = vec![b'0'; width];
    for slot in digits.iter_mut().rev() {
        *slot = ALPHABET[(value % 62) as usize];
        value /= 62;
    }
    String::from_utf8(digits).expect("the alphabet is ASCII")
}

/// Base-62 text of `value` with no padding (`0` is `"0"`).
pub fn base62_compact(mut value: u64) -> String {
    let mut digits = Vec::new();
    loop {
        digits.push(ALPHABET[(value % 62) as usize]);
        value /= 62;
        if value == 0 {
            break;
        }
    }
    digits.reverse();
    String::from_utf8(digits).expect("the alphabet is ASCII")
}

/// `camelCase` or `WebkitLineClamp` → `kebab-case` / `-webkit-line-clamp`. Custom properties
/// (`--name`) are returned unchanged.
pub fn kebab_case(name: &str) -> String {
    if name.starts_with("--") {
        return name.to_owned();
    }
    let mut out = String::with_capacity(name.len() + 4);
    for (index, character) in name.chars().enumerate() {
        if character.is_ascii_uppercase() {
            // `ms` is the one vendor prefix that is written lowercase in camelCase (`msFlex`).
            out.push('-');
            out.push(character.to_ascii_lowercase());
        } else if index == 0 && name.starts_with("ms") && name[2..].starts_with(char::is_uppercase) {
            out.push('-');
            out.push(character);
        } else {
            out.push(character);
        }
    }
    out
}

/// The file system the engine reads modules and `package.json` files from.
pub trait Fs: Send + Sync {
    /// Reads a whole UTF-8 file.
    fn read_to_string(&self, path: &Path) -> io::Result<String>;
}

/// The operating system's file system.
#[derive(Debug, Default, Clone, Copy)]
pub struct OsFs;

impl Fs for OsFs {
    fn read_to_string(&self, path: &Path) -> io::Result<String> {
        std::fs::read_to_string(path)
    }
}

/// An in-memory file system for tests and the WASM build.
#[derive(Debug, Default)]
pub struct MemoryFs {
    files: RwLock<BTreeMap<PathBuf, String>>,
}

impl MemoryFs {
    /// Creates an empty file system.
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds or replaces a file.
    pub fn write(&self, path: impl Into<PathBuf>, contents: impl Into<String>) {
        self.files.write().expect("not poisoned").insert(path.into(), contents.into());
    }
}

impl Fs for MemoryFs {
    fn read_to_string(&self, path: &Path) -> io::Result<String> {
        self.files
            .read()
            .expect("not poisoned")
            .get(path)
            .cloned()
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, path.display().to_string()))
    }
}
