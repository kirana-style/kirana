#!/usr/bin/env bash
# Line, function and region coverage for every Kirana package (S1-TEST-05, S1-TEST-06).
#
# Rust: the workspace tests, plus the Vitest suite running against a native addon built with
# coverage instrumentation, so the Node-API binding's lines are measured too. Both fail below 100 %.
set -euo pipefail
cd "$(dirname "$0")/.."

# `clean` refuses a target directory without cargo's cache tag, which a fresh clone lacks when the
# napi build created `target/` first; without the clean, uninstrumented test binaries are reused.
mkdir -p target
[ -f target/CACHEDIR.TAG ] || printf 'Signature: 8a477f597d28d172789f06886806bc55\n' > target/CACHEDIR.TAG
# shellcheck disable=SC1090
source <(cargo llvm-cov show-env --sh)
cargo llvm-cov clean --workspace
cargo nextest run --workspace
# The instrumented addon comes from cargo directly: the coverage wrapper only applies to cargo's
# own builds. It replaces the development addon for the duration of the JavaScript suite.
cargo build -p kirana_napi
native="npm/compiler/kirana.$(node -p 'const r = process.report.getReport(); `${process.platform}-${process.arch}${process.platform === "linux" ? (r.header.glibcVersionRuntime ? "-gnu" : "-musl") : process.platform === "win32" ? "-msvc" : ""}`').node"
case "$(uname -s)" in
  Darwin) library=target/debug/libkirana_napi.dylib ;;
  MINGW*|MSYS*|CYGWIN*) library=target/debug/kirana_napi.dll ;;
  *) library=target/debug/libkirana_napi.so ;;
esac
if [ -f "$native" ]; then
  cp "$native" "$native.bak"
  trap 'mv "$native.bak" "$native"' EXIT
else
  trap 'rm -f "$native"' EXIT
fi
cp "$library" "$native"
# Worker threads, not forks: forked workers exit before the profile runtime writes its data.
vp test run --coverage --pool=threads
cargo llvm-cov report --summary-only --fail-under-lines 100 --fail-under-functions 100 --fail-under-regions 100
