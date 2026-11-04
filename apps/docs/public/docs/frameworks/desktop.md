# Desktop and mobile apps
Source: https://site.kirana-style.workers.dev/docs/frameworks/desktop

# Desktop and mobile apps

Electron, Tauri, Electrobun and Capacitor show your pages in a browser engine, so Kirana works in
them as it does on the web. The bundler that builds the app's frontend runs Kirana,
and the stylesheet ships inside the app. Each guide below is tested by an example
whose frontend is built and checked in Chromium on every change.

- [Electron](/docs/frameworks/electron): Desktop apps on Chromium and Node.js, the renderer built by electron-vite.
- [Tauri](/docs/frameworks/tauri): Small desktop and mobile apps: a Rust core and the system's webview.
- [Electrobun](/docs/frameworks/electrobun): Desktop apps on Bun, with views its templates build by Vite.
- [Capacitor](/docs/frameworks/capacitor): One web app, run as a native iOS and Android app.

## Which engine renders your pages

| Shell      | Engine                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Electron   | Its own Chromium, the same version on every platform                                            |
| Tauri      | WebView2 (Chromium) on Windows, WKWebView on macOS and iOS, WebKitGTK on Linux, Android WebView |
| Electrobun | The system's webview (WebView2, WKWebView, WebKitGTK), or a bundled Chromium (CEF)              |
| Capacitor  | WKWebView on iOS, Android WebView                                                               |

## Set `targets` to the oldest engine you support

Kirana compiles for **Chrome 123, Safari 17.5, Firefox 120** unless told otherwise. Electron
ships its own Chromium, far above that floor, so it needs nothing.

The system webviews update with the operating system: an app that supports older
macOS, iOS or Linux releases runs on an older WebKit. Set
[`targets`](/docs/reference/config#targets) to the oldest one, and Kirana lowers
what that engine lacks:

```ts file="kirana.config.ts"
import { defineConfig } from "@kirana-style/core/config"

export default defineConfig({
  // macOS 13 and iOS 16 ship Safari 16.
  targets: { safari: 16 },
})
```

The build then reports `target-lowering`, so you see what was lowered.

## What stays the same

- **One stylesheet**, imported once in the frontend's entry. There is no server, so
  nothing is rendered twice.
- **Development** runs the shell against the bundler's dev server: styles update as
  you save, as in the browser.
- **The editor, the linter and `kirana-style check`** work on the frontend's files
  as on any web project.
