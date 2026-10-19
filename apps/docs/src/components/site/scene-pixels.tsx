/**
 * A landscape in pixels: the brand's motif. The scene's picture is sampled cell by cell, its tones
 * posterised with the same 8 × 8 Bayer dither as the pixel K, and the cells thin out towards one
 * edge until the picture dissolves into the page. A soft band of sun crosses it every eighteen
 * seconds, warming the cells it passes, and the cells near the pointer brighten.
 *
 * Every page hero, the footer and the closing card draw their scene with it. Until WebGL has
 * drawn a frame, and wherever it cannot, the plain picture shows with a CSS mask fading the same way, so nothing waits on the canvas.
 *
 * Same budget as `PixelField`: one triangle and one short fragment shader, drawn only while on
 * screen and the tab is visible, at most 30 frames a second and a device pixel ratio of 2, one
 * still frame for readers who prefer reduced motion, and everything freed on unmount.
 */
import { useEffect, useRef } from "react"
import { css } from "@kirana-style/core"

import { SUN } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"
import { breakpoint } from "@workspace/ui/tokens/breakpoints"

import { SCENES, sceneImage } from "@/brand/scenes"
import type { SceneId } from "@/brand/scenes"

import { BAYER, PRECISION, VERTEX, compile, rgb } from "./pixel-field"

/**
 * Which edge the picture dissolves towards. `hero` is a page hero's: up into the words above it on
 * a narrow screen, left into the words beside it from `lg` up.
 */
export type Dissolve = "up" | "down" | "left" | "right" | "hero"

const WIDE = "(min-width: 64rem)"

const TOWARD: Record<Exclude<Dissolve, "hero">, [number, number]> = {
  up: [0, 1],
  down: [0, -1],
  left: [-1, 0],
  right: [1, 0],
}

const FRAGMENT = `${PRECISION}
uniform vec2 uResolution;
uniform float uTime;
uniform float uCell;
uniform sampler2D uImage;
uniform vec2 uImageSize;
uniform vec2 uAnchor;
uniform vec2 uToward;
uniform float uFade;
uniform vec3 uSun;
uniform float uDim;
uniform vec2 uPointer;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
${BAYER}
void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec2 centre = (cell + 0.5) * uCell;
  vec2 uv = centre / uResolution;

  // The picture as object-fit: cover, anchored like CSS object-position (y measured from the top).
  float scale = max(uResolution.x / uImageSize.x, uResolution.y / uImageSize.y);
  vec2 shown = uImageSize * scale;
  vec2 offset = (uResolution - shown) * vec2(uAnchor.x, 1.0 - uAnchor.y);
  vec3 colour = texture2D(uImage, (centre - offset) / shown).rgb;

  // A few tones per channel, dithered: the painting read as pixels.
  float tone = bayer8(cell);
  colour = floor(colour * 6.0 + tone) / 6.0;

  // The sun crossing, and the pointer's glow.
  float sweep = fract(uTime / 18.0) * 2.8 - 0.9;
  float ray = exp(-pow((dot(uv, vec2(0.62, 0.78)) - sweep) * 3.2, 2.0));
  float near = uPointer.x < 0.0 ? 0.0
    : smoothstep(uCell * 18.0, 0.0, distance(centre, uPointer));
  colour = mix(colour, uSun, 0.3 * ray + 0.22 * near) * uDim;

  // How much of the picture is left: solid away from the edge, thinning to nothing at it,
  // with a ragged, slowly drifting front.
  float along = dot(uv - 0.5, uToward) + 0.5;
  along += (noise(cell * 0.09 + vec2(uTime * 0.03, 0.0)) - 0.5) * 0.16;
  float cover = 1.0 - smoothstep(1.0 - uFade, 1.0, along);
  cover = clamp(cover + 0.12 * ray + 0.18 * near, 0.0, 1.0);
  float lit = step(bayer8(cell + vec2(3.0, 5.0)) + 0.002, cover);

  // Square cells with a hairline between them, so the pixels read as pixels.
  vec2 inside = fract(gl_FragCoord.xy / uCell);
  float square = step(0.08, inside.x) * step(inside.x, 0.92) *
                 step(0.08, inside.y) * step(inside.y, 0.92);
  float alpha = lit * square;
  gl_FragColor = vec4(colour * alpha, alpha);
}
`

const fades = (toward: string) =>
  `linear-gradient(to ${toward}, black 40%, transparent 100%)`

const styles = {
  root: css({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
  }),
  picture: css({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transitionProperty: "opacity",
    transitionDuration: "400ms",
    opacity: { base: 1, ":is([data-drawn] *)": 0 },
  }),
  up: css({ maskImage: fades("top") }),
  down: css({ maskImage: fades("bottom") }),
  left: css({ maskImage: fades("left") }),
  right: css({ maskImage: fades("right") }),
  hero: css({
    maskImage: { base: fades("top"), [breakpoint.lg]: fades("left") },
  }),
  canvas: css({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    // The shader reads both: the sun's colour, and whether the scheme is dark.
    color: SUN.sun,
    caretColor: "light-dark(rgb(0 0 0), rgb(255 255 255))",
  }),
}

export function ScenePixels({
  scene,
  dissolve = "up",
  fade = 0.6,
  cell = 4,
  priority = false,
  sx,
}: {
  scene: SceneId
  /** The edge the picture dissolves towards. */
  dissolve?: Dissolve
  /** 0–1: how much of the way across the picture is thinning out. */
  fade?: number
  /** Cell size in CSS pixels. */
  cell?: number
  /**
   * The page's largest picture (the homepage hero): fetched first. Every other scene waits until
   * it is about to scroll into view.
   */
  priority?: boolean
  sx?: Sx
}) {
  const root = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLCanvasElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const { position } = SCENES[scene]

  useEffect(() => {
    const canvas = ref.current
    const box = root.current
    const picture = image.current
    const gl = canvas?.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    })
    if (!canvas || !box || !picture || !gl) return

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) return
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    )
    const location = gl.getAttribLocation(program, "position")
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const uniform = (name: string) => gl.getUniformLocation(program, name)
    const uResolution = uniform("uResolution")
    const uTime = uniform("uTime")
    const uCell = uniform("uCell")
    const uImageSize = uniform("uImageSize")
    const uSun = uniform("uSun")
    const uDim = uniform("uDim")
    const uPointer = uniform("uPointer")
    const [x, y] = position
      .split(" ")
      .map((part) => Number.parseFloat(part) / 100)
    gl.uniform2f(uniform("uAnchor"), x ?? 0.5, y ?? 0.5)
    const uToward = uniform("uToward")
    const wide = window.matchMedia(WIDE)
    const aim = () =>
      gl.uniform2fv(
        uToward,
        TOWARD[dissolve === "hero" ? (wide.matches ? "left" : "up") : dissolve]
      )
    aim()
    gl.uniform1f(uniform("uFade"), fade)
    gl.uniform2f(uPointer, -1, -1)

    const texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.uniform1i(uniform("uImage"), 0)

    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const start = performance.now()
    let loaded = false
    let frame = 0
    let last = 0
    let visible = false
    let gone = false

    const resize = () => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uCell, cell * ratio)
    }
    const recolor = () => {
      const style = getComputedStyle(canvas)
      gl.uniform3fv(uSun, rgb(style.color))
      // `caret-color` is black in the light scheme and white in the dark one.
      gl.uniform1f(uDim, rgb(style.caretColor)[0] > 0.5 ? 0.86 : 1)
    }
    const draw = () => {
      if (!loaded) return
      gl.uniform1f(uTime, still ? 7 : (performance.now() - start) / 1000)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      box.dataset.drawn = ""
    }
    const loop = (now: number) => {
      frame = 0
      if (!visible || document.hidden) return
      if (now - last >= 1000 / 30) {
        last = now
        draw()
      }
      frame = requestAnimationFrame(loop)
    }
    const run = () => {
      if (still) return draw()
      if (!frame && visible && !document.hidden)
        frame = requestAnimationFrame(loop)
    }

    // The texture is the picture the <img> already loaded, so the scene is fetched once.
    const ready =
      picture.complete && picture.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve, reject) => {
            picture.addEventListener("load", () => resolve(), { once: true })
            picture.addEventListener("error", reject, { once: true })
          })
    ready
      .then(() => picture.decode())
      .then(() => {
        if (gone) return
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          picture
        )
        gl.uniform2f(uImageSize, picture.naturalWidth, picture.naturalHeight)
        loaded = true
        draw()
        run()
      })
      .catch(() => {
        // The CSS picture stays.
      })

    resize()
    recolor()

    const onScreen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      run()
    })
    onScreen.observe(canvas)
    const sized = new ResizeObserver(() => {
      resize()
      draw()
    })
    sized.observe(canvas)
    const scheme = new MutationObserver(() => {
      recolor()
      draw()
    })
    scheme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    })
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onMedia = () => {
      recolor()
      draw()
    }
    media.addEventListener("change", onMedia)
    const onWide = () => {
      aim()
      draw()
    }
    if (dissolve === "hero") wide.addEventListener("change", onWide)
    document.addEventListener("visibilitychange", run)
    // The canvas lets events through, so listen on the window and place the pointer in the
    // canvas's pixels (origin bottom left).
    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const inside = px >= 0 && py >= 0 && px <= rect.width && py <= rect.height
      gl.uniform2f(
        uPointer,
        inside ? px * ratio : -1,
        inside ? (rect.height - py) * ratio : -1
      )
    }
    if (!still)
      window.addEventListener("pointermove", onPointer, { passive: true })

    return () => {
      gone = true
      delete box.dataset.drawn
      cancelAnimationFrame(frame)
      onScreen.disconnect()
      sized.disconnect()
      scheme.disconnect()
      media.removeEventListener("change", onMedia)
      wide.removeEventListener("change", onWide)
      document.removeEventListener("visibilitychange", run)
      window.removeEventListener("pointermove", onPointer)
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    }
  }, [scene, dissolve, fade, cell, position])

  return (
    <div ref={root} aria-hidden="true" sx={[styles.root, sx]}>
      <img
        ref={image}
        // The smaller picture only: once the canvas has drawn, this picture is hidden, and the
        // canvas's cells show less detail than 800 pixels hold at any width. It is what shows
        // until then, or instead where WebGL is not available.
        src={sceneImage(scene, 800)}
        alt=""
        {...(priority
          ? { fetchPriority: "high" as const }
          : { loading: "lazy" as const, decoding: "async" as const })}
        style={{ objectPosition: position }}
        sx={[styles.picture, styles[dissolve]]}
      />
      <canvas ref={ref} sx={styles.canvas} />
    </div>
  )
}
