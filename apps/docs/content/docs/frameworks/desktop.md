---
title: Desktop and mobile apps
description: Style a desktop or mobile app whose pages run in a webview, on Electron, Tauri, Electrobun or Capacitor, with the same Kirana you use on the web.
section: desktop
order: 1
keywords:
  [
    desktop,
    mobile,
    webview,
    electron,
    tauri,
    electrobun,
    capacitor,
    ios,
    android,
    targets,
  ]
---

# Desktop and mobile apps

{{fact:desktop-shells}} show your pages in a browser engine, so Kirana works in
them as it does on the web. The bundler that builds the app's frontend runs Kirana,
and the stylesheet ships inside the app. Each guide below is tested by an example
whose frontend is built and checked in Chromium on every change.

<!-- ::guides group="desktop" -->

## Which engine renders your pages

| Shell      | Engine                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Electron   | Its own Chromium, the same version on every platform                                            |
| Tauri      | WebView2 (Chromium) on Windows, WKWebView on macOS and iOS, WebKitGTK on Linux, Android WebView |
| Electrobun | The system's webview (WebView2, WKWebView, WebKitGTK), or a bundled Chromium (CEF)              |
| Capacitor  | WKWebView on iOS, Android WebView                                                               |

## Set `targets` to the oldest engine you support

Kirana compiles for **{{fact:browser-floor}}** unless told otherwise. Electron
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
