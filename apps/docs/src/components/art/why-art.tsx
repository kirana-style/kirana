/**
 * The /why page's two scenes, the runtime model and the build, in their own module so the brand
 * kit can draw them too (a route file exports only its route).
 */
import {
  CpuIcon,
  FileCodeIcon,
  FileScriptIcon,
  GlobalIcon,
} from "@hugeicons/core-free-icons"

import {
  At,
  Card as SceneCard,
  Row,
  Scene,
  Stage,
  T,
  Tag,
  Tile,
} from "@/components/site/visuals"

/** Components rendering, each appending its own rule: the old model. */
export function RuntimeArt() {
  return (
    <Stage danger>
      <SceneCard title="browser" icon={GlobalIcon} width={260}>
        <Row>
          <T tone="muted">render</T>
          <T tone="strong">{"<Button />"}</T>
        </Row>
        <Row danger>
          <Tag tone="danger">+</Tag>
          <T tone="danger">{"<style>"}</T>
          <T tone="muted">.css-1q2w {"{…}"}</T>
        </Row>
        <Row>
          <T tone="muted">render</T>
          <T tone="strong">{"<Card />"}</T>
        </Row>
        <Row danger>
          <Tag tone="danger">+</Tag>
          <T tone="danger">{"<style>"}</T>
          <T tone="muted">.css-3e4r {"{…}"}</T>
        </Row>
      </SceneCard>
    </Stage>
  )
}

/** Modules in, one stylesheet out: what Kirana does. */
export function BuildArt() {
  const wires = [
    "M 62 50 C 100 50, 110 90, 138 90",
    "M 62 130 C 100 130, 110 90, 138 90",
  ]
  return (
    <Stage>
      <Scene width={300} height={180} wires={wires} live={["M 182 90 H 236"]}>
        <At x={14} y={28}>
          <Tile icon={FileCodeIcon} size={40} caption="button.tsx" />
        </At>
        <At x={14} y={72}>
          <Tile icon={FileCodeIcon} size={40} caption="card.tsx" />
        </At>
        <At x={53} y={50}>
          <Tile icon={CpuIcon} size={48} variant="accent" caption="kirana" />
        </At>
        <At x={87} y={50}>
          <Tile icon={FileScriptIcon} size={44} caption="app.css" />
        </At>
      </Scene>
    </Stage>
  )
}
