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
    // Every class name hashes a few short parts: they are laid out on the stack, and only a long
    // value needs the heap. The bytes hashed are the same either way.
    let length: usize = parts.iter().map(|part| part.len() + 1).sum();
    let mut stack = [0u8; 256];
    let mut heap = Vec::new();
    let buffer: &mut [u8] = if length <= stack.len() {
        &mut stack[..length]
    } else {
        heap.resize(length, 0);
        &mut heap
    };
    let mut at = 0;
    for part in parts {
        buffer[at..at + part.len()].copy_from_slice(part.as_bytes());
        at += part.len() + 1;
    }
    hash64(buffer)
}

/// The `width` lowest base-62 digits of `value`, most significant first.
pub fn base62(value: u64, width: usize) -> String {
    let mut out = String::with_capacity(width);
    push_base62(&mut out, value, width);
    out
}

/// [`base62`] written onto `out`, for a name built in one string.
pub fn push_base62(out: &mut String, value: u64, width: usize) {
    for place in (0..width).rev() {
        // A place past the largest power of 62 a `u64` holds is a leading zero.
        let digit = 62u64.checked_pow(place as u32).map_or(0, |power| value / power % 62);
        out.push(char::from(ALPHABET[digit as usize]));
    }
}

/// Base-62 text of `value` with no padding (`0` is `"0"`).
pub fn base62_compact(value: u64) -> String {
    let mut out = String::new();
    push_base62_compact(&mut out, value);
    out
}

/// [`base62_compact`] written onto `out`.
pub fn push_base62_compact(out: &mut String, value: u64) {
    let mut width = 1;
    while 62u64.checked_pow(width as u32).is_some_and(|power| power <= value) {
        width += 1;
    }
    push_base62(out, value, width);
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
