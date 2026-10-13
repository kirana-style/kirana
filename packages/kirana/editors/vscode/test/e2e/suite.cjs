// Runs inside VS Code's extension host (CommonJS, as the host loads test suites).
const path = require("node:path")

const vscode = require("vscode")

/**
 * Asks until the answer holds. A provider can be asked before the server has compiled the file, and
 * VS Code cancels a request in flight when a client restarts, so a wrong or failed answer is retried;
 * the last one is reported if time runs out.
 */
async function eventually(label, ask, holds, timeout = 60_000) {
  const deadline = Date.now() + timeout
  let last
  for (;;) {
    try {
      last = await ask()
      if (holds(last)) return last
    } catch (error) {
      last = error
    }
    if (Date.now() > deadline)
      throw new Error(
        `timed out waiting for ${label}; last answer: ${String(last)}`
      )
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

const command = (name, ...args) => vscode.commands.executeCommand(name, ...args)

exports.run = async function run() {
  const folder = vscode.workspace.workspaceFolders[0].uri.fsPath
  const uri = vscode.Uri.file(path.join(folder, "src/card.tsx"))
  const document = await vscode.workspace.openTextDocument(uri)
  await vscode.window.showTextDocument(document)
  await vscode.extensions.getExtension("kirana-style.kirana").activate()
  const text = document.getText()
  const at = (needle, delta = 1) =>
    document.positionAt(text.indexOf(needle) + delta)

  await eventually(
    "the unitless-length diagnostic",
    async () => vscode.languages.getDiagnostics(uri),
    (diagnostics) =>
      diagnostics.some(
        (diagnostic) =>
          diagnostic.source === "kirana" &&
          diagnostic.code === "unitless-length"
      )
  )

  await eventually(
    "a hover with the compiled rule",
    () => command("vscode.executeHoverProvider", uri, at('display: "grid"')),
    (hovers) =>
      hovers
        .flatMap((hover) =>
          hover.contents.map((content) => content.value ?? String(content))
        )
        .some(
          (value) =>
            value.includes("**Kirana**") && value.includes("display: grid")
        )
  )

  await eventually(
    "a swatch for #ff0000",
    () => command("vscode.executeDocumentColorProvider", uri),
    (colours) =>
      colours.some(
        (colour) => colour.color.red === 1 && colour.color.green === 0
      )
  )

  // The summary is drawn coloured by the extension, so VS Code's own hints no longer carry it;
  // a hover at the end of the element's line answers with the card.
  await eventually(
    "the summary, coloured instead of a native hint",
    () =>
      command(
        "vscode.executeInlayHintProvider",
        uri,
        new vscode.Range(0, 0, document.lineCount, 0)
      ),
    (hints) => Array.isArray(hints) && hints.length === 0
  )
  const element = text.indexOf("<div sx={box} />")
  const lineEnd = document.lineAt(document.positionAt(element).line).range.end
  await eventually(
    "the card on the coloured summary",
    () => command("vscode.executeHoverProvider", uri, lineEnd),
    (hovers) =>
      hovers
        .flatMap((hover) =>
          hover.contents.map((content) => content.value ?? String(content))
        )
        .some(
          (value) =>
            value.includes("**Kirana** · `box`") &&
            value.includes("**Compiled CSS**")
        )
  )

  // Hovering the element shows its card: the handle, the box model beside the coloured
  // properties, and the CSS.
  await eventually(
    "the card on an element",
    () => command("vscode.executeHoverProvider", uri, at("sx={box}")),
    (hovers) =>
      hovers
        .flatMap((hover) =>
          hover.contents.map((content) => content.value ?? String(content))
        )
        .some(
          (value) =>
            value.includes("**Kirana** · `box`") &&
            value.includes("| Box model | Resolved |") &&
            value.includes(
              '<span style="color:var(--vscode-charts-blue);">display</span> `grid`'
            ) &&
            value.includes("data:image/svg+xml") &&
            value.includes("**Compiled CSS**")
        )
  )

  await eventually(
    "a code lens on css()",
    () => command("vscode.executeCodeLensProvider", uri),
    (lenses) =>
      lenses.some(
        (lens) =>
          lens.command &&
          lens.command.title.startsWith("css() · 3 declarations")
      )
  )

  const width = text.indexOf("width: 5")
  await eventually(
    "the unitless-length quick fix",
    () =>
      command(
        "vscode.executeCodeActionProvider",
        uri,
        new vscode.Range(
          document.positionAt(width),
          document.positionAt(width + 8)
        )
      ),
    (actions) => actions.some((action) => action.title === 'Write "5px"')
  )

  await eventually(
    "alignItems keyword completion",
    () => command("vscode.executeCompletionItemProvider", uri, at('"cen"', 4)),
    (completion) =>
      completion.items.some(
        (item) => (item.label.label ?? item.label) === "center"
      )
  )

  console.log(
    "kirana e2e: diagnostics, hover, colours, summary, lens, quick fix and completion pass"
  )
}
