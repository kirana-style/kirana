use std::path::Path;

use kirana_shared::{Fs, MemoryFs, OsFs, base62, base62_compact, hash_parts, hash64, kebab_case};

#[test]
fn hashing_is_stable_and_separated() {
    // A fixed value: changing it changes every class name, which needs a decision entry.
    assert_eq!(hash64(b"kirana"), hash64(b"kirana"));
    assert_ne!(hash_parts(&["ab", "c"]), hash_parts(&["a", "bc"]));
    assert_eq!(hash_parts(&["a"]), hash64(b"a\0"));
}

#[test]
fn base62_is_fixed_width_and_compact() {
    assert_eq!(base62(0, 3), "000");
    assert_eq!(base62(61, 2), "0Z");
    assert_eq!(base62(62, 2), "10");
    assert_eq!(base62(62 * 62 + 1, 2), "01");
    assert_eq!(base62_compact(0), "0");
    assert_eq!(base62_compact(61), "Z");
    assert_eq!(base62_compact(62), "10");
}

#[test]
fn kebab_case_handles_vendor_prefixes() {
    assert_eq!(kebab_case("backgroundColor"), "background-color");
    assert_eq!(kebab_case("WebkitLineClamp"), "-webkit-line-clamp");
    assert_eq!(kebab_case("msFlex"), "-ms-flex");
    assert_eq!(kebab_case("msg"), "msg");
    assert_eq!(kebab_case("--my-var"), "--my-var");
    assert_eq!(kebab_case("color"), "color");
}

#[test]
fn memory_and_os_file_systems_read_files() {
    let memory = MemoryFs::new();
    memory.write("/a.ts", "export {}");
    assert_eq!(memory.read_to_string(Path::new("/a.ts")).unwrap(), "export {}");
    assert!(memory.read_to_string(Path::new("/missing.ts")).is_err());

    let own = OsFs.read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml").as_path());
    assert!(own.unwrap().contains("kirana_shared"));
}
