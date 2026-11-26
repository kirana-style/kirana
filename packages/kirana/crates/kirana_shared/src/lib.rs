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

/// [`base62`] as bytes, for a name counted without being written.
pub fn base62_bytes<const WIDTH: usize>(value: u64) -> [u8; WIDTH] {
    let mut out = [0; WIDTH];
    for (place, byte) in out.iter_mut().rev().enumerate() {
        let digit = 62u64.checked_pow(place as u32).map_or(0, |power| value / power % 62);
        *byte = ALPHABET[digit as usize];
    }
    out
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

/// The value `text` spells in base 62, or `None` for an empty text, a character outside the alphabet
/// or a value a `u64` cannot hold: what [`base62_compact`] and [`base62`] wrote, read back.
pub fn parse_base62(text: &str) -> Option<u64> {
    if text.is_empty() {
        return None;
    }
    text.bytes().try_fold(0u64, |value, byte| {
        let digit = ALPHABET.iter().position(|&letter| letter == byte)?;
        value.checked_mul(62)?.checked_add(digit as u64)
    })
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
            out.push('-');
            out.push(character.to_ascii_lowercase());
        } else if index == 0 && name.starts_with("ms") && name[2..].starts_with(char::is_uppercase) {
            // `ms` is the one vendor prefix that is written lowercase in camelCase (`msFlex`).
            out.push('-');
            out.push(character);
        } else {
            out.push(character);
        }
    }
    out
}

/// `kebab-case` → `camelCase`, as a style object writes a property: `justify-content` →
/// `justifyContent`, `-webkit-line-clamp` → `webkitLineClamp`.
pub fn camel_case(kebab: &str) -> String {
    let mut out = String::with_capacity(kebab.len());
    let mut upper = false;
    for character in kebab.chars() {
        if character == '-' {
            upper = !out.is_empty();
        } else if upper {
            out.extend(character.to_uppercase());
            upper = false;
        } else {
            out.push(character);
        }
    }
    out
}

/// The candidate nearest to a misspelt `name`, when one is near enough to be what was meant: at most
/// one edit away for a name of three to five characters, two from six on, and none for a shorter
/// name, where one edit reaches too much. An edit is a character inserted, removed or replaced, or two
/// neighbours swapped (`centre` is one edit from `center`). Of equally near candidates the first in
/// alphabetical order wins, so the answer never depends on the candidates' order. The compiler's
/// `help` lines and the language server's quick fixes both ask this, so they always agree.
pub fn nearest<'a>(name: &str, candidates: impl IntoIterator<Item = &'a str>) -> Option<&'a str> {
    let most = match name.chars().count() {
        0..=2 => return None,
        3..=5 => 1,
        _ => 2,
    };
    candidates
        .into_iter()
        .filter(|candidate| *candidate != name)
        .filter_map(|candidate| Some((edit_distance(name, candidate, most)?, candidate)))
        .min()
        .map(|(_, candidate)| candidate)
}

/// The help line for a misspelt name, worded as every diagnostic words it: did you mean `name`?
pub fn did_you_mean(name: &str) -> String {
    format!("did you mean `{name}`?")
}

/// The optimal string alignment distance between `a` and `b`, when it is at most `most`.
fn edit_distance(a: &str, b: &str, most: usize) -> Option<usize> {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    if a.len().abs_diff(b.len()) > most {
        return None;
    }
    // Three rows: the one before the previous is what a swap of two neighbours reads.
    let mut before: Vec<usize> = Vec::new();
    let mut previous: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut row = vec![i; b.len() + 1];
        for j in 1..=b.len() {
            let cost = usize::from(a[i - 1] != b[j - 1]);
            row[j] = (previous[j - 1] + cost).min(previous[j] + 1).min(row[j - 1] + 1);
            if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                row[j] = row[j].min(before[j - 2] + 1);
            }
        }
        before = std::mem::replace(&mut previous, row);
    }
    let distance = previous[b.len()];
    (distance <= most).then_some(distance)
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
