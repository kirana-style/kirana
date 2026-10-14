/**
 * The petal K in pixels: its three petals drawn in the brand colours into a texture, sampled
 * cell by cell and thresholded by an 8 × 8 Bayer matrix, each cell taking its petal's colour,
 * with a ray of light sweeping through and the pointer lighting the cells near it. The landscapes
 * use the same matrix in `ScenePixels`, which shares this file's shader helpers.
 *
 * Written for a small GPU budget: one triangle, one short fragment shader, no
 * library. It draws only while on screen and while the tab is visible, caps at
 * 30 frames a second and a device pixel ratio of 2, draws one still frame when
 * the reader prefers reduced motion, and frees its program and buffer on unmount.
 * Mask it from the outside (`sx` with `maskImage`) to keep text clear.
 */
import { useEffect, useRef } from "react"
import { css } from "@kirana-style/core"

import type { Sx } from "@workspace/ui/lib/sx"

import { GRADIENTS, MARK, PAINT_ORDER, PARTS } from "@/brand/kirana-mark"

/** The vertex shader every pixel canvas shares: one triangle covering the viewport. */
export const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

/** The 8 × 8 ordered-dither matrix in GLSL, built from the 2 × 2 one without a lookup table. */
export const BAYER = `
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
`

const FRAGMENT = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCell;
uniform float uDensity;
uniform float uOpacity;
uniform sampler2D uMark;
uniform vec2 uPointer;

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

${BAYER}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec2 uv = cell * uCell / uResolution.y;
  // The K's coverage and colour at the cell's centre, a slow shimmer, a diagonal ray of light
  // sweeping through, and a glow around the pointer.
  vec4 texel = texture2D(uMark, (cell + 0.5) * uCell / uResolution);
  float drift = 0.5 + 0.35 * fbm(uv * 3.0 + vec2(uTime * 0.05, -uTime * 0.03));
  float sweep = fract(uTime * 0.06) * 3.2 - 0.9;
  float ray = exp(-pow((dot(uv, vec2(0.83, 0.55)) - sweep) * 5.0, 2.0));
  float near = uPointer.x < 0.0 ? 0.0
    : smoothstep(uCell * 16.0, 0.0, distance(gl_FragCoord.xy, uPointer));
  float shaped = texel.a * (drift + 0.7 * ray + 0.8 * near);
  vec3 color = mix(texel.rgb, vec3(1.0), 0.35 * ray);
  float lit = step(bayer8(cell) + 0.02, shaped * uDensity * 1.8);
  vec2 inside = fract(gl_FragCoord.xy / uCell);
  float square = step(0.18, inside.x) * step(inside.x, 0.82) *
                 step(0.18, inside.y) * step(inside.y, 0.82);
  float alpha = lit * square * uOpacity;
  gl_FragColor = vec4(color * alpha, alpha);
}
`

const styles = {
  canvas: css({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  }),
}

/** A colour as the canvas resolves it (`oklch()` and `light-dark()` included), in 0–1 RGB. */
export function rgb(color: string): [number, number, number] {
  const probe = document.createElement("canvas").getContext("2d")
  if (!probe) return [0, 0, 0]
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [(r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255]
}

export function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

/**
 * The petal K in the brand colours on a transparent canvas of `width` × `height`, centred and
 * 84 % of the height: what the shader samples. Drawn from the same paths
 * and gradients as every logo file.
 */
function markCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas
  const scale = Math.min(
    (height * 0.84) / MARK.height,
    (width * 0.84) / MARK.width
  )
  ctx.translate(
    (width - MARK.width * scale) / 2,
    (height - MARK.height * scale) / 2
  )
  ctx.scale(scale, scale)
  for (const part of PAINT_ORDER) {
    const g = GRADIENTS[part]
    const paint = ctx.createLinearGradient(g.x1, g.y1, g.x2, g.y2)
    for (const [offset, colour] of g.stops) paint.addColorStop(offset, colour)
    ctx.fillStyle = paint
    ctx.fill(new Path2D(PARTS[part]))
  }
  return canvas
}

export function PixelField({
  cell = 5,
  density = 0.55,
  opacity = 0.55,
  sx,
}: {
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
    gl.uniform1f(uniform("uDensity"), density)
    gl.uniform1f(uniform("uOpacity"), opacity)
    const uPointer = uniform("uPointer")
    gl.uniform2f(uPointer, -1, -1)

    // The mark's texture, redrawn at the canvas's size.
    const texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.uniform1i(uniform("uMark"), 0)
    const retexture = () =>
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        markCanvas(
          Math.max(1, canvas.clientWidth),
          Math.max(1, canvas.clientHeight)
        )
      )

    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uResolution, canvas.width, canvas.height)
      gl.uniform1f(uCell, cell * ratio)
      retexture()
    }

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
    document.addEventListener("visibilitychange", run)
    // The mark answers the pointer: the canvas lets events through, so listen on
    // the window and place the pointer in the canvas's pixels (origin bottom left).
    const onPointer = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect()
      const x = event.clientX - box.left
      const y = event.clientY - box.top
      const inside = x >= 0 && y >= 0 && x <= box.width && y <= box.height
      gl.uniform2f(
        uPointer,
        inside ? x * ratio : -1,
        inside ? (box.height - y) * ratio : -1
      )
      if (still) draw()
    }
    window.addEventListener("pointermove", onPointer, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      onScreen.disconnect()
      sized.disconnect()
      document.removeEventListener("visibilitychange", run)
      window.removeEventListener("pointermove", onPointer)
      // Free what this mount created. The context itself stays with the canvas:
      // React may mount the same canvas again (Strict Mode does), and a lost
      // context cannot be recovered on it.
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    }
  }, [cell, density, opacity])

  return <canvas ref={ref} aria-hidden="true" sx={[styles.canvas, sx]} />
}
