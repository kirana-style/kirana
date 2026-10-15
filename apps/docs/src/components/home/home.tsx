/**
 * The homepage, top to bottom: what Kirana is, the compiler's own output, the editor, three ways to
 * start, the numbers, the frameworks, and where to go next. Every chapter is its own module under
 * `components/home/`; this file is only the order. Detail lives on the product pages and in the
 * docs; the homepage introduces each idea once and links there.
 */
import { Blueprint, Sponsors } from "./closing"
import { Editor } from "./editor"
import { Flexible } from "./flexible"
import { Hero } from "./hero"
import { Proof } from "./proof"
import { Showcase } from "./showcase"
import { Stack } from "./stack"
import { WhereNext } from "./where-next"

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
