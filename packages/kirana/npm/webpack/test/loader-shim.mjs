// Forwards to the loader instance the test file registered (webpack.test.ts).
export default function loader(...args) {
  return globalThis[Symbol.for("kirana.webpack.test-loader")].apply(this, args)
}
