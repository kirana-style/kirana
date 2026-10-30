/**
 * The homepage, top to bottom: what Kirana is, the compiler's own output, the editor, three ways to
 * start, the numbers, the frameworks, where to go next, and the sponsors. Every chapter is its own
 * module under `components/home/`; this file is only the order.
 */
import { Suspense, lazy } from "react"
import type { ComponentType } from "react"

import { Hero } from "./hero"

/**
 * A chapter below the hero, loaded on its own. The browser leaves its code out of the first
 * download and hydrates it when its chunk arrives, or first when the reader reaches into it.
 *
 * The server must still write it in place, or the page streams it at the end for a script to move
 * up, which a reader without JavaScript never sees. So the server loads every chapter as this
 * module loads and renders the loaded one directly; the browser renders the lazy one in the same
 * boundary, and keeps the server's markup until its chunk has arrived.
 */
function later<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K
) {
  let loaded: ComponentType | undefined
  if (import.meta.env.SSR)
    void load().then((module) => {
      loaded = module[name]
    })
  const Chapter = lazy<ComponentType>(() =>
    load().then((module) => ({ default: module[name] }))
  )
  return function Later() {
    const Loaded = loaded
    return (
      <Suspense fallback={null}>{Loaded ? <Loaded /> : <Chapter />}</Suspense>
    )
  }
}

const Showcase = later(() => import("./showcase"), "Showcase")
const Editor = later(() => import("./editor"), "Editor")
const Flexible = later(() => import("./flexible"), "Flexible")
const Proof = later(() => import("./proof"), "Proof")
const Stack = later(() => import("./stack"), "Stack")
const WhereNext = later(() => import("./where-next"), "WhereNext")
const Sponsors = later(() => import("./closing"), "Sponsors")
const Blueprint = later(() => import("./closing"), "Blueprint")

export function Home() {
  return (
    <>
      <Hero />
      <Showcase />
      <Editor />
      <Flexible />
      <Proof />
      <Stack />
      <WhereNext />
      <Sponsors />
      <Blueprint />
    </>
  )
}
