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
# own builds. The JavaScript suite loads it through `KIRANA_NATIVE_PATH`, and so does every process
# a test starts, which inherits the variable. It stays in `target/`: copied over the workspace's
# addon, it reached every other process that loaded the engine meanwhile (an editor's language
# server, `budgets` running beside this task), which wrote its profile where it ran, outside
# `target/`, and ran a debug build.
cargo build -p kirana_napi
case "$(uname -s)" in
  Darwin) library=target/debug/libkirana_napi.dylib ;;
  MINGW*|MSYS*|CYGWIN*) library=target/debug/kirana_napi.dll ;;
  *) library=target/debug/libkirana_napi.so ;;
esac
# Node loads an addon by its `.node` extension.
cp "$library" target/debug/kirana-coverage.node
export KIRANA_NATIVE_PATH="$PWD/target/debug/kirana-coverage.node"
# Worker threads, not forks: forked workers exit before the profile runtime writes its data.
vp test run --coverage --pool=threads
cargo llvm-cov report --summary-only --fail-under-lines 100 --fail-under-functions 100 --fail-under-regions 100
