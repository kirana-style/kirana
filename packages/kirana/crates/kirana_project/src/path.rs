//! The session's paths as the keys of its maps: hashed and compared byte by byte.

use std::borrow::{Borrow, Cow};
use std::ffi::OsStr;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

/// A module's or a directory's path as the session's maps key it. `Path` hashes and compares
/// component by component, a walk over every byte of a path with a check at each, and a transform
/// looks a path up in one map or another a hundred times and more; this hashes and compares the
/// bytes at once, ten times faster for a path of a hundred bytes. The session's paths are a host's
/// module ids and the resolver's answers, absolute and normalized, so the bytes are the path's
/// identity. On Windows every separator is made `/` first (`key`), since a host may spell a path
/// either way and `Path` holds the two spellings equal.
#[derive(Clone, Debug)]
pub(crate) struct ModulePath(PathBuf);

impl ModulePath {
    pub fn new(path: &Path) -> Self {
        Self(PathBuf::from(key(path).into_owned()))
    }

    pub fn as_path(&self) -> &Path {
        &self.0
    }
}

impl PartialEq for ModulePath {
    fn eq(&self, other: &Self) -> bool {
        self.0.as_os_str() == other.0.as_os_str()
    }
}

impl Eq for ModulePath {}

/// Ordered as `Path` orders, component by component, so what is written in path order is written
/// as before. (Two spellings `Path` holds equal compare equal here while being distinct keys; the
/// session's paths, normalized, have one spelling each.)
impl PartialOrd for ModulePath {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ModulePath {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.0.cmp(&other.0)
    }
}

impl std::ops::Deref for ModulePath {
    type Target = Path;

    fn deref(&self) -> &Path {
        &self.0
    }
}

impl Hash for ModulePath {
    fn hash<H: Hasher>(&self, state: &mut H) {
        // The same hash as the `OsStr` a lookup borrows (`Borrow`).
        self.0.as_os_str().hash(state);
    }
}

impl Borrow<OsStr> for ModulePath {
    fn borrow(&self) -> &OsStr {
        self.0.as_os_str()
    }
}

/// `path` as the session's maps are looked up by: its own bytes, borrowed; on Windows with `/`
/// for every `\`, copied when it has one.
pub(crate) fn key(path: &Path) -> Cow<'_, OsStr> {
    #[cfg(windows)]
    if path.as_os_str().as_encoded_bytes().contains(&b'\\') {
        return Cow::Owned(std::ffi::OsString::from(path.to_string_lossy().replace('\\', "/")));
    }
    Cow::Borrowed(path.as_os_str())
}
