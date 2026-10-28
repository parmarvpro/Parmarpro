import { FIELD_COLORS, FLOW_DIRECTIONS, hexToRgb01 } from "./counter-flow";

/**
 * Counter-flow dot field: one WebGL canvas, one draw call, three blocks.
 * A flowing wave field is turned into round halftone dots whose size follows
 * the field, with a 4×4 ordered (Bayer) dither choosing the tone. The outer
 * blocks flow up in blue, the middle flows down in paper, at the same speed.
 *
 * Written for ParmarPro; the idea (ordered dither plus adaptive resolution)
 * is common technique, none of this is copied from another site.
 */

const VERTEX_SOURCE = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

export const FRAGMENT_SOURCE = `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uPxScale;
uniform float uCell;
uniform float uGutter;
uniform float uRadius;
uniform float uOffset;
uniform float uSpeed;
uniform vec3 uDir;
uniform float uScrollPhase;
uniform vec3 uPointer;
uniform vec3 uBlueBase;
uniform vec3 uBlueLow;
uniform vec3 uBlueMid;
uniform vec3 uBlueHigh;
uniform vec3 uPaperBase;
uniform vec3 uPaperLow;
uniform vec3 uPaperMid;
uniform vec3 uPaperHigh;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec2 css = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uPxScale;
  float width = uResolution.x / uPxScale;
  float height = uResolution.y / uPxScale;

  // Which block are we in? Three equal panels with a gutter between them.
  float panelW = (width - 2.0 * uGutter) / 3.0;
  float pitch = panelW + uGutter;
  float panel = clamp(floor(css.x / pitch), 0.0, 2.0);
  float lx = css.x - panel * pitch;
  if (lx > panelW) { gl_FragColor = vec4(0.0); return; }

  float mid = step(0.5, panel) - step(1.5, panel);
  float panelH = height - uOffset;
  float top = mid * uOffset;

  // Rounded-rectangle silhouette for the block.
  vec2 halfSize = vec2(panelW, panelH) * 0.5;
  vec2 p = vec2(lx, css.y - top) - halfSize;
  vec2 q = abs(p) - (halfSize - vec2(uRadius));
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float shape = 1.0 - smoothstep(-0.75, 0.75, dist);
  if (shape <= 0.0) { gl_FragColor = vec4(0.0); return; }

  // The field is sampled once per halftone cell so each dot is a clean circle.
  vec2 cellId = floor(css / uCell);
  vec2 within = fract(css / uCell) - 0.5;
  vec2 centre = (cellId + 0.5) * uCell;
  float nx = (centre.x - panel * pitch) / panelW;
  float ny = (centre.y - top) / panelH;

  // +1 flows up, -1 flows down. Scroll adds phase with the same sign, so the
  // middle block always answers the outer two in the opposite direction.
  float dir = panel < 0.5 ? uDir.x : (panel < 1.5 ? uDir.y : uDir.z);
  float flow = (uTime * uSpeed + uScrollPhase) * dir;

  vec2 pd = centre - uPointer.xy;
  float falloff = exp(-dot(pd, pd) / 12800.0) * uPointer.z;
  float ripple = falloff * sin(length(pd) * 0.07 - uTime * 4.0) * 0.05;

  float sway = 0.04 * sin(uTime * 0.35 + ny * 3.1 + panel * 1.7);
  float w1 = sin(6.2831853 * (ny * 1.05 + flow + sway + nx * 0.30 + ripple));
  float w2 = sin(6.2831853 * (ny * 2.10 + flow * 1.35 + nx * 0.85 - sway));
  float band = smoothstep(0.1, 0.9, 0.5 + 0.5 * (0.7 * w1 + 0.3 * w2));
  float amount = clamp(band * 0.78 + (1.0 - ny) * 0.46 - 0.12, 0.0, 1.0);

  // Round halftone dot, size follows the field.
  float radius = sqrt(amount) * 0.64;
  float aa = 0.9 / (uCell * uPxScale);
  float dotMask = (1.0 - smoothstep(radius - aa, radius + aa, length(within))) * smoothstep(0.02, 0.09, radius);

  // Ordered dither picks one of three tones.
  float level = amount + (bayer4(cellId) - 0.5) * 0.12;
  vec3 base = mix(uBlueBase, uPaperBase, mid);
  vec3 low = mix(uBlueLow, uPaperLow, mid);
  vec3 tone = mix(uBlueMid, uPaperMid, mid);
  vec3 high = mix(uBlueHigh, uPaperHigh, mid);
  vec3 dotColour = level > 0.6 ? high : (level > 0.32 ? tone : low);
  base = mix(base, base * 0.94, ny);

  vec3 colour = mix(base, dotColour, dotMask);
  gl_FragColor = vec4(colour * shape, shape);
}`;

export type DitherOptions = {
  /** Halftone cell size in CSS px. */
  cellPx: number;
  /** Gap between the three blocks in CSS px. */
  gutterPx: number;
  /** Corner radius of each block in CSS px. */
  radiusPx: number;
  /** How far lower the middle block sits, in CSS px. */
  offsetPx: number;
  /** Wave periods per second. 0.083 is about one cycle every 12 seconds. */
  speed: number;
  /** Upper bound for device pixel ratio. */
  maxDpr: number;
  /** Draw one still frame instead of animating. */
  reducedMotion: boolean;
  /** Called if the GPU context is lost, so the caller can show its fallback. */
  onContextLost?: () => void;
  /** Read each frame; positive = scrolling down. Drives the scroll-coupled phase. */
  readScrollVelocity?: () => number;
};

export type DitherLayout = Pick<DitherOptions, "cellPx" | "gutterPx" | "radiusPx" | "offsetPx">;

export type DitherStats = { scale: number; frameMs: number; frames: number };

export type DitherController = {
  start(): void;
  stop(): void;
  setPaused(paused: boolean): void;
  setPointer(x: number, y: number): void;
  /** Update sizes that change with breakpoints (read from CSS by the caller). */
  configure(layout: DitherLayout): void;
  resize(): void;
  drawStill(time: number): void;
  dispose(): void;
  stats(): DitherStats;
};

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Returns null when WebGL (with highp floats) is unavailable, so callers can use a CSS fallback. */
export function createDitherRenderer(canvas: HTMLCanvasElement, options: DitherOptions): DitherController | null {
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: true,
    premultipliedAlpha: true,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  if (!precision || precision.precision === 0) return null;

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.clearColor(0, 0, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    time: uniform("uTime"),
    resolution: uniform("uResolution"),
    pxScale: uniform("uPxScale"),
    scrollPhase: uniform("uScrollPhase"),
    pointer: uniform("uPointer"),
  };

  const colour = (name: string, hex: string) => gl.uniform3fv(uniform(name), hexToRgb01(hex));
  colour("uBlueBase", FIELD_COLORS.blue.base);
  colour("uBlueLow", FIELD_COLORS.blue.low);
  colour("uBlueMid", FIELD_COLORS.blue.mid);
  colour("uBlueHigh", FIELD_COLORS.blue.high);
  colour("uPaperBase", FIELD_COLORS.paper.base);
  colour("uPaperLow", FIELD_COLORS.paper.low);
  colour("uPaperMid", FIELD_COLORS.paper.mid);
  colour("uPaperHigh", FIELD_COLORS.paper.high);
  const uCell = uniform("uCell");
  const uGutter = uniform("uGutter");
  const uRadius = uniform("uRadius");
  const uOffset = uniform("uOffset");
  const applyLayout = (layout: DitherLayout) => {
    gl.uniform1f(uCell, layout.cellPx);
    gl.uniform1f(uGutter, layout.gutterPx);
    gl.uniform1f(uRadius, layout.radiusPx);
    gl.uniform1f(uOffset, layout.offsetPx);
  };
  applyLayout(options);
  gl.uniform1f(uniform("uSpeed"), options.speed);
  gl.uniform3f(uniform("uDir"), FLOW_DIRECTIONS[0], FLOW_DIRECTIONS[1], FLOW_DIRECTIONS[2]);

  const maxScale = Math.min(window.devicePixelRatio || 1, options.maxDpr);
  let scale = maxScale;
  let time = 0;
  let scrollPhase = 0;
  let pointerX = -9999;
  let pointerY = -9999;
  let pointerStrength = 0;
  let raf = 0;
  let last = 0;
  let started = false;
  let paused = false;
  let disposed = false;
  let sampleFrames = 0;
  let sampleMs = 0;
  let averageMs = 0;
  let totalFrames = 0;

  const onLost = (event: Event) => {
    event.preventDefault();
    stop();
    options.onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const resize = () => {
    const cssW = Math.max(2, canvas.clientWidth);
    const cssH = Math.max(2, canvas.clientHeight);
    const w = Math.max(2, Math.round(cssW * scale));
    const h = Math.max(2, Math.round(cssH * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.resolution, w, h);
    gl.uniform1f(u.pxScale, w / cssW);
  };

  const draw = (t: number) => {
    gl.uniform1f(u.time, t);
    gl.uniform1f(u.scrollPhase, scrollPhase);
    gl.uniform3f(u.pointer, pointerX, pointerY, pointerStrength);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now: number) => {
    if (disposed || paused || !started) return;
    const dt = last ? Math.min(now - last, 100) : 16.7;
    last = now;
    time += dt / 1000;
    const velocity = options.readScrollVelocity ? options.readScrollVelocity() : 0;
    scrollPhase += Math.max(-3, Math.min(3, velocity)) * dt * 0.00035;
    pointerStrength *= Math.pow(0.985, dt / 16.7);
    draw(time);
    totalFrames += 1;

    // Adaptive resolution: back off when frames are slow, recover when fast.
    sampleFrames += 1;
    sampleMs += dt;
    if (sampleFrames === 30) {
      averageMs = sampleMs / sampleFrames;
      if (averageMs > 22 && scale > 0.5) {
        scale = Math.max(0.5, scale * 0.8);
        resize();
      } else if (averageMs < 15.5 && scale < maxScale) {
        scale = Math.min(maxScale, scale * 1.06);
        resize();
      }
      sampleFrames = 0;
      sampleMs = 0;
    }
    raf = requestAnimationFrame(frame);
  };

  const begin = () => {
    cancelAnimationFrame(raf);
    last = 0;
    raf = requestAnimationFrame(frame);
  };

  function stop() {
    started = false;
    cancelAnimationFrame(raf);
  }

  resize();

  return {
    start() {
      if (disposed) return;
      resize();
      if (options.reducedMotion) {
        draw(3);
        return;
      }
      started = true;
      if (!paused) begin();
    },
    stop,
    setPaused(next) {
      paused = next;
      if (next) cancelAnimationFrame(raf);
      else if (started && !disposed) begin();
    },
    setPointer(x, y) {
      pointerX = x;
      pointerY = y;
      pointerStrength = 1;
    },
    configure(layout) {
      applyLayout(layout);
      if (options.reducedMotion || !started) draw(options.reducedMotion ? 3 : time);
    },
    resize() {
      resize();
      if (options.reducedMotion || !started) draw(options.reducedMotion ? 3 : time);
    },
    drawStill(t) {
      resize();
      draw(t);
    },
    dispose() {
      disposed = true;
      stop();
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
    stats() {
      return { scale, frameMs: averageMs, frames: totalFrames };
    },
  };
}
