/**
 * A dithered field of square pixels moving slowly: a field (noise, waves,
 * ripples, rain — see `PIXEL_PATTERNS`) thresholded by an 8 × 8 Bayer matrix
 * into cells, drawn in the subtree's accent colour.
 *
 * Written for a small GPU budget: one triangle, one short fragment shader, no
 * library. It draws only while on screen and while the tab is visible, caps at
 * 30 frames a second and a device pixel ratio of 2, draws one still frame when
 * the reader prefers reduced motion, and frees its program and buffer on unmount.
 * Mask it from the outside (`sx` with `maskImage`) to keep text clear.
 */
import { useEffect, useRef } from "react"
import { css } from "@kirana-style/core"

import { accent } from "@workspace/docs-ui/accent.ts"
import type { Sx } from "@workspace/ui/lib/sx"

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAGMENT = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCell;
uniform float uDensity;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPattern;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// The ordered-dither matrix, built from the 2 x 2 one without a lookup table.
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

// How lit a cell is, 0-1, before dithering. Each pattern is a different
// field over the same cells; the corner is the top right, where heroes show it.
float field(vec2 cell, vec2 uv, float t) {
  vec2 corner = vec2(uResolution.x / uResolution.y, 1.0);
  if (uPattern < 0.5) {
    // clouds: drifting value noise, clumped into patches
    return smoothstep(0.38, 0.72, fbm(uv * 2.2 + vec2(t * 0.04, t * 0.025)));
  } else if (uPattern < 1.5) {
    // waves: diagonal bands rolling across, broken up by noise
    float w = sin((uv.x * 1.2 + uv.y * 0.8) * 9.0 - t * 0.6) * 0.5 + 0.5;
    return smoothstep(0.35, 0.85, w * (0.55 + 0.6 * fbm(uv * 2.0 + t * 0.03)));
  } else if (uPattern < 2.5) {
    // rings: ripples spreading from the corner, fading with distance
    float d = length(uv - corner);
    float w = sin(d * 16.0 - t * 0.8) * 0.5 + 0.5;
    return smoothstep(0.45, 0.9, w) * smoothstep(1.7, 0.1, d);
  } else if (uPattern < 3.5) {
    // rain: columns of streaks falling at their own speeds
    float lane = hash(vec2(cell.x, 3.0));
    float speed = 0.35 + hash(vec2(cell.x, 1.0)) * 0.6;
    float y = fract(uv.y * 0.9 + t * speed * 0.12 + hash(vec2(cell.x, 7.0)));
    return pow(y, 4.0) * step(0.45, lane);
  } else if (uPattern < 4.5) {
    // blocks: coarse tiles switching slowly, like a map of lit windows
    vec2 tile = floor(cell / 5.0);
    float n = noise(tile * 0.45 + vec2(t * 0.05, 0.0));
    return smoothstep(0.5, 0.7, n) * (0.55 + 0.45 * hash(tile));
  } else if (uPattern < 5.5) {
    // scan: horizontal bands sweeping downwards
    float w = sin(uv.y * 7.0 + t * 0.5) * 0.5 + 0.5;
    return smoothstep(0.5, 0.95, w) * (0.5 + 0.7 * fbm(uv * 3.0));
  }
  // spiral: arms turning around the corner
  vec2 d = uv - corner;
  float r = length(d);
  float w = sin(atan(d.y, d.x) * 4.0 + r * 10.0 - t * 0.6) * 0.5 + 0.5;
  return smoothstep(0.45, 0.9, w) * smoothstep(1.8, 0.2, r);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec2 uv = cell * uCell / uResolution.y;
  float shaped = field(cell, uv, uTime);
  float lit = step(bayer8(cell) + 0.02, shaped * uDensity * 1.8);
  vec2 inside = fract(gl_FragCoord.xy / uCell);
  float square = step(0.18, inside.x) * step(inside.x, 0.82) *
                 step(0.18, inside.y) * step(inside.y, 0.82);
  float alpha = lit * square * uOpacity;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`

const styles = {
  canvas: css({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    // The shader reads this to learn its colour.
    color: accent.base,
  }),
}

/** A colour as the canvas resolves it (`oklch()` and `light-dark()` included), in 0–1 RGB. */
function rgb(color: string): [number, number, number] {
  const probe = document.createElement("canvas").getContext("2d")
  if (!probe) return [0, 0, 0]
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [(r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255]
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

/** The shapes the field can take; the dithering and the cost are the same for all. */
export const PIXEL_PATTERNS = [
  "clouds",
  "waves",
  "rings",
  "rain",
  "blocks",
  "scan",
  "spiral",
] as const
export type PixelPattern = (typeof PIXEL_PATTERNS)[number]

export function PixelField({
  cell = 5,
  density = 0.55,
  opacity = 0.55,
  pattern = "clouds",
  sx,
}: {
  pattern?: PixelPattern
  /** Cell size in CSS pixels. */
  cell?: number
  /** 0–1: how much of the field is lit. */
  density?: number
  opacity?: number
  sx?: Sx
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas?.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    })
    if (!canvas || !gl) return

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) return
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    // One triangle larger than the viewport covers every pixel.
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    )
    const position = gl.getAttribLocation(program, "position")
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const uniform = (name: string) => gl.getUniformLocation(program, name)
    const uResolution = uniform("uResolution")
    const uTime = uniform("uTime")
    const uCell = uniform("uCell")
    const uColor = uniform("uColor")
    gl.uniform1f(uniform("uDensity"), density)
    gl.uniform1f(uniform("uOpacity"), opacity)
    gl.uniform1f(uniform("uPattern"), PIXEL_PATTERNS.indexOf(pattern))

    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uCell, cell * ratio)
    }
    const recolor = () =>
      gl.uniform3fv(uColor, rgb(getComputedStyle(canvas).color))

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const start = performance.now()
    let frame = 0
    let last = 0
    let visible = false
    const draw = () => {
      gl.uniform1f(uTime, still ? 0 : (performance.now() - start) / 1000)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
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

    resize()
    recolor()
    draw()

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
    // The accent is a light-dark() pair: follow the colour scheme.
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
    document.addEventListener("visibilitychange", run)

    return () => {
      cancelAnimationFrame(frame)
      onScreen.disconnect()
      sized.disconnect()
      scheme.disconnect()
      media.removeEventListener("change", onMedia)
      document.removeEventListener("visibilitychange", run)
      // Free what this mount created. The context itself stays with the canvas:
      // React may mount the same canvas again (Strict Mode does), and a lost
      // context cannot be recovered on it.
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    }
  }, [cell, density, opacity, pattern])

  return <canvas ref={ref} aria-hidden="true" sx={[styles.canvas, sx]} />
}
