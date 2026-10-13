/**
 * The small scenes in the mega-menu's featured cards, built from the
 * illustration kit so they share its tiles, pills and glow.
 */
import {
  Cancel01Icon,
  CpuIcon,
  FileCodeIcon,
  FileScriptIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import type { Featured } from "./nav"
import { At, Card, Caret, Pill, Row, Scene, T, Tag, Tile } from "./visuals"

function Compile() {
  return (
    <Scene width={210} height={96} live={["M 50 44 H 84", "M 126 44 H 160"]}>
      <At x={14} y={46}>
        <Tile icon={FileCodeIcon} size={40} caption="card.tsx" />
      </At>
      <At x={50} y={46}>
        <Tile icon={CpuIcon} size={44} variant="accent" caption="kirana" />
      </At>
      <At x={86} y={46}>
        <Tile icon={FileScriptIcon} size={40} caption="app.css" />
      </At>
    </Scene>
  )
}

function Migrate() {
  return (
    <Scene width={210} height={96} live={["M 105 34 V 62"]}>
      <At x={50} y={22}>
        <Pill mono>
          <Tag tone="muted">tw</Tag>
          px-4 py-2
        </Pill>
      </At>
      <At x={50} y={78}>
        <Pill mono active>
          <Tag tone="accent">kirana</Tag>
          paddingInline
        </Pill>
      </At>
    </Scene>
  )
}

function Start() {
  return (
    <Card title="~/app" width={200} glow>
      <Row flat typed={0}>
        <T tone="prompt">$</T>
        <T tone="strong">bun add @kirana-style/core</T>
      </Row>
      <Row flat typed={1}>
        <T tone="prompt">$</T>
        <T tone="strong">bun add -d @kirana-style/vite</T>
      </Row>
      <Row flat typed={2}>
        <T tone="prompt">$</T>
        <Caret />
      </Row>
    </Card>
  )
}

function Why() {
  return (
    <Scene width={210} height={96}>
      <At x={50} y={24}>
        <Pill mono>
          <Tag tone="danger" icon={Cancel01Icon} />
          built while rendering
        </Pill>
      </At>
      <At x={50} y={74}>
        <Pill mono active>
          <Tag tone="success" icon={Tick02Icon} />
          one .css at build time
        </Pill>
      </At>
    </Scene>
  )
}

const ART = { compile: Compile, migrate: Migrate, start: Start, why: Why }

export function MenuArt({ kind }: { kind: Featured["art"] }) {
  const Art = ART[kind]
  return <Art />
}
