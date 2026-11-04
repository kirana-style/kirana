import { join } from "node:path"

import { app, BrowserWindow } from "electron"

function createWindow() {
  const window = new BrowserWindow({ width: 900, height: 670 })
  // electron-vite's dev server in development, the built renderer otherwise.
  const url = process.env.ELECTRON_RENDERER_URL
  if (url) window.loadURL(url)
  else window.loadFile(join(import.meta.dirname, "../renderer/index.html"))
}

app.whenReady().then(() => {
  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
