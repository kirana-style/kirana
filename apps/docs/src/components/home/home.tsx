/**
 * The homepage, top to bottom. Every section is its own module under
 * `components/home/`; this file is only the order.
 */
import { Blueprint, Faq, Sponsors } from "./closing"
import { Connect } from "./connect"
import { Ecosystem, Features } from "./ecosystem"
import { Editor } from "./editor"
import { Flexible } from "./flexible"
import { Hero } from "./hero"
import { InstallExplorer } from "./install-explorer"
import { Showcase } from "./showcase"
import { System } from "./system"

export function Home() {
  return (
    <main>
      <Hero />
      <Showcase />
      <InstallExplorer />
      <System />
      <Flexible />
      <Features />
      <Editor />
      <Connect />
      <Ecosystem />
      <Sponsors />
      <Faq />
      <Blueprint />
    </main>
  )
}
