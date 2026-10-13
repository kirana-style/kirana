export default {
  testEnvironment: "node",
  // Kirana compiles the styles, then babel-jest compiles TypeScript and JSX as usual.
  transform: {
    "\\.[jt]sx?$": ["@kirana-style/jest", { transformer: "babel-jest" }],
  },
}
