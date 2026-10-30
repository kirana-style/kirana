/**
 * The compiler page's scene, in its own module so it can be imported outside the route (a route
 * file exports only its route).
 */
import {
  CpuIcon,
  FilterHorizontalIcon,
  Files01Icon,
  FileScriptIcon,
} from "@hugeicons/core-free-icons"

import { At, Pill, Scene, Stage, Tag, Tile } from "@/components/site/visuals"

/** Modules in, most set aside unread, the rest compiled into one stylesheet. */
export function PipelineArt() {
  return (
    <Stage>
      <Scene
        width={620}
        height={170}
        wires={["M 92 85 H 170"]}
        live={["M 250 85 H 350", "M 430 85 H 520"]}
      >
        <At x={10} y={50}>
          <Tile icon={Files01Icon} size={52} caption="your modules" />
        </At>
        <At x={34} y={50}>
          <Tile icon={FilterHorizontalIcon} size={52} caption="prefilter" />
        </At>
        <At x={34} y={14}>
          <Pill mono>
            <Tag tone="muted">7,747</Tag>
            99.3 % never parsed
          </Pill>
        </At>
        <At x={62} y={50}>
          <Tile
            icon={CpuIcon}
            size={60}
            variant="accent"
            caption="evaluate · atomise · order"
          />
        </At>
        <At x={90} y={50}>
          <Tile icon={FileScriptIcon} size={52} caption="one stylesheet" />
        </At>
      </Scene>
    </Stage>
  )
}
