import {
  HalfFloatType,
  PerspectiveCamera,
  Scene,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  ShaderMaterial,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { cameraPose, characterCameraDistance, crowdMix, parallaxAmount, scanGate, scanY } from './camera';
import { SEED, STAGES, TIERS, TIMELINE, WORLD, type QualityTier } from './config';
import { TransitionController, type Heading, type Mode } from './controller';
import { buildParticleData, chooseSubdivision, countVisibleCells, type ParticleData } from './particleData';
import { ParticleSystem, TRAIL_LENGTH, type FrameState } from './ParticleSystem';
import { detectTier, particleOverride } from './quality';
import { clamp } from './rng';
import { gradeFragment, gradeVertex } from './shaders/grade';
import { loadCharacter } from './sprite/spriteLoader';
import type { PixelGrid } from './sprite/pixelGrid';

export interface ExperienceStatus {
  mode: Mode;
  heading: Heading;
  progress: number;
  stage: string;
  scrollMode: boolean;
  reducedMotion: boolean;
}

export interface ExperienceInfo {
  particles: number;
  tier: QualityTier;
  source: 'image' | 'procedural';
  figures: number;
  hdr: boolean;
  dpr: number;
}

export interface ExperienceOptions {
  container: HTMLElement;
  /** URL of the supplied pixel-art PNG; omit / null to use the built-in sprite. */
  characterSrc?: string | null;
  reducedMotion?: boolean;
  signal?: AbortSignal;
  onStatus?: (s: ExperienceStatus) => void;
}

export class WebGLUnavailableError extends Error {
  constructor(message = 'WebGL 2 is not available in this browser.') {
    super(message);
    this.name = 'WebGLUnavailableError';
  }
}

export class ShaderCompileError extends Error {
  constructor(message = 'The graphics driver could not compile the particle shaders.') {
    super(message);
    this.name = 'ShaderCompileError';
  }
}

const TAN_HALF_FOV = Math.tan((WORLD.fov * Math.PI) / 360);
const REDUCED = { forward: 3.4, reverse: 2.6, motion: 0.22 };

/** Human-readable name for where we are on the progress axis. */
export function stageName(progress: number, heading: Heading): string {
  if (progress <= 0.0005) return 'Character';
  if (progress >= 0.9995) return 'Crowd';
  if (heading === 'toCrowd') {
    for (const s of STAGES) if (s.to > 0 && progress <= s.to) return s.label;
    return 'Reconstruction';
  }
  if (progress > 0.8) return 'Destabilising';
  if (progress > 0.4) return 'Convergence';
  if (progress > 0.16) return 'Pixel rebuild';
  return 'Lock-in';
}

/**
 * Orchestrates the whole experience: renderer, camera rig, post-processing, input and the loop.
 * Framework-agnostic; the React layer only mounts it and relays commands.
 */
export class Experience {
  readonly info: ExperienceInfo;

  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly system: ParticleSystem;
  private readonly controller: TransitionController;
  private composer: EffectComposer | null = null;
  private gradePass: ShaderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private resizeObserver: ResizeObserver;

  private time = 0;
  private timePinned = false;
  private lastNow = 0;
  private disposed = false;
  private paused = false;

  private motion: number;
  private motionTarget: number;
  private reducedMotion: boolean;
  private scrollMode = false;
  private scrubTarget = 0;

  private width = 1;
  private height = 1;
  private dpr = 1;
  private dprCap: number;
  private pxScale = 800;
  private aperture = 10;
  private charDist = 18;
  private builtAspect: number;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly pointer = {
    nx: 0,
    ny: 0,
    sx: 0,
    sy: 0,
    inside: false,
    lastTrailX: 0,
    lastTrailY: 0,
    lastTrailT: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
  };
  private readonly trail: { x: number; y: number; z: number; born: number; strength: number }[] = [];
  private readonly trailOut = Array.from({ length: TRAIL_LENGTH }, () => ({ x: 0, y: 0, z: 0, w: 0 }));
  private readonly frame: FrameState = {
    time: 0,
    progress: 0,
    dir: 0,
    motion: 1,
    scanY: 0,
    scanGate: 0,
    pxScale: 1,
    focus: 1,
    aperture: 1,
    camPos: new Vector3(),
    parallax: [0, 0],
    aspect: 1,
  };
  private shaderFailed = false;
  private down: { x: number; y: number; t: number; touchY: number } | null = null;

  private statusAt = 0;
  private lastStatusKey = '';
  private govAcc = 0;
  private govFrames = 0;
  private govElapsed = 0;
  private govReductions = 0;

  private readonly listeners: Array<() => void> = [];
  private readonly tmp = new Vector3();

  private constructor(
    private readonly opts: ExperienceOptions,
    canvas: HTMLCanvasElement,
    renderer: WebGLRenderer,
    private readonly grid: PixelGrid,
    private readonly subdivision: number,
    data: ParticleData,
    aspect: number,
    tier: QualityTier,
    source: 'image' | 'procedural',
    hdr: boolean,
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.reducedMotion = !!opts.reducedMotion;
    this.motion = this.motionTarget = this.reducedMotion ? REDUCED.motion : 1;
    this.controller = new TransitionController(
      this.reducedMotion
        ? { forwardSeconds: REDUCED.forward, reverseSeconds: REDUCED.reverse, auto: false }
        : {},
    );

    const settings = TIERS[tier];
    this.dprCap = settings.maxDpr;

    this.camera = new PerspectiveCamera(WORLD.fov, 16 / 9, 0.1, 400);
    this.system = new ParticleSystem(data, {
      hdr,
      maxPointSize: this.readMaxPointSize(),
    });
    this.scene.add(...this.system.objects);
    this.builtAspect = aspect;
    this.info = { particles: data.count, tier, source, figures: data.meta.figures, hdr, dpr: 1 };

    if (settings.post) this.buildComposer(hdr, settings.bloom);

    this.resizeObserver = new ResizeObserver(() => this.applyResize());
    this.resizeObserver.observe(opts.container);
    this.bindInput();
    this.applyResize();

    // three reports program link/compile failures here; create() turns it into a clear error.
    renderer.debug.onShaderError = () => {
      this.shaderFailed = true;
    };
  }

  private start(): void {
    this.renderer.setAnimationLoop(this.tick);
  }

  /** Loads the character, then builds everything synchronously (so aborting never leaves a half-made renderer). */
  static async create(opts: ExperienceOptions): Promise<Experience> {
    const tier = detectTier();
    const loaded = await loadCharacter(opts.characterSrc);
    if (opts.signal?.aborted) throw new DOMException('Experience creation aborted', 'AbortError');

    const canvas = document.createElement('canvas');
    canvas.className = 'dissolve-canvas';
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      'A pixel-art character dissolves into thousands of particles that reform as a crowd of colourful silhouettes, and back again.',
    );
    opts.container.appendChild(canvas);

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
    } catch {
      canvas.remove();
      throw new WebGLUnavailableError();
    }
    if (!renderer.capabilities.isWebGL2) {
      renderer.dispose();
      canvas.remove();
      throw new WebGLUnavailableError();
    }
    renderer.setClearColor(0x15161a, 1);

    const hdr =
      renderer.extensions.has('EXT_color_buffer_float') ||
      renderer.extensions.has('EXT_color_buffer_half_float');
    const cells = countVisibleCells(loaded.grid);
    const target = particleOverride() ?? TIERS[tier].particles;
    const k = chooseSubdivision(cells, target);
    const aspect = Math.max(0.3, opts.container.clientWidth / Math.max(1, opts.container.clientHeight));
    const data = buildParticleData({ grid: loaded.grid, subdivision: k, aspect, seed: SEED });

    const exp = new Experience(
      opts,
      canvas,
      renderer,
      loaded.grid,
      k,
      data,
      aspect,
      tier,
      loaded.source,
      hdr && TIERS[tier].post,
    );

    // Compile every program while the loading splash is still up (in parallel where the driver
    // supports it), so the first visible frames are not a multi-hundred-millisecond stall.
    try {
      if (renderer.extensions.has('KHR_parallel_shader_compile')) {
        await Promise.race([
          renderer.compileAsync(exp.scene, exp.camera),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
      } else {
        renderer.compile(exp.scene, exp.camera);
      }
    } catch {
      exp.shaderFailed = true;
    }
    if (opts.signal?.aborted) {
      exp.dispose();
      throw new DOMException('Experience creation aborted', 'AbortError');
    }
    if (exp.shaderFailed) {
      exp.dispose();
      throw new ShaderCompileError();
    }
    exp.start();
    return exp;
  }

  // ------------------------------------------------------------------------------------ commands

  toggle(): void {
    // A click means "drive it by click": hand control back from the wheel.
    this.scrollMode = false;
    this.controller.toggle();
    this.scrubTarget = this.controller.progress;
    this.emitStatus(true);
  }

  setAuto(on: boolean): void {
    // An explicit "Auto" still honours Calm: the loop runs, just with the gentler displacement.
    if (on) this.scrollMode = false;
    this.controller.setMode(on ? 'auto' : 'manual');
    this.emitStatus(true);
  }

  setScrollMode(on: boolean): void {
    this.scrollMode = on;
    if (on) this.scrubTarget = this.controller.progress;
    this.emitStatus(true);
  }

  /** Scrubber input: jump to / drag through a progress value. */
  seek(p: number): void {
    this.scrubTarget = clamp(p, 0, 1);
    this.controller.scrubTo(this.scrubTarget);
    this.emitStatus(true);
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    this.motionTarget = on ? REDUCED.motion : 1;
    this.controller.setDurations(
      on ? REDUCED.forward : TIMELINE.forwardDuration,
      on ? REDUCED.reverse : TIMELINE.reverseDuration,
    );
    if (on && this.controller.mode === 'auto') this.controller.setMode('manual');
    this.emitStatus(true);
  }

  get status(): ExperienceStatus {
    const c = this.controller;
    return {
      mode: c.mode,
      heading: c.heading,
      progress: c.progress,
      stage: stageName(c.progress, c.heading),
      scrollMode: this.scrollMode,
      reducedMotion: this.reducedMotion,
    };
  }

  /** Deterministic capture: pin progress, heading and scene time, then render one frame. */
  freeze(progress: number, dir: number, time?: number): void {
    this.controller.freeze(progress, dir);
    this.scrubTarget = progress;
    if (time !== undefined) {
      this.time = time;
      this.timePinned = true;
    }
    this.renderFrame();
    this.emitStatus(true);
  }

  release(): void {
    this.timePinned = false;
    this.controller.setMode('manual');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    for (const off of this.listeners) off();
    this.system.dispose();
    this.composer?.dispose();
    this.bloomPass?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  // ------------------------------------------------------------------------------------- setup

  private readMaxPointSize(): number {
    const gl = this.renderer.getContext();
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    return range ? Math.max(16, Math.min(range[1], 256)) : 64;
  }

  private buildComposer(hdr: boolean, bloom: boolean): void {
    const target = new WebGLRenderTarget(4, 4, {
      type: hdr ? HalfFloatType : UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (bloom && hdr) {
      // Restrained: only HDR emissives (scan core, sparks, flashes) exceed the threshold.
      this.bloomPass = new UnrealBloomPass(new Vector2(256, 256), 0.38, 0.5, 1.0);
      composer.addPass(this.bloomPass);
    }
    const grade = new ShaderMaterial({
      vertexShader: gradeVertex,
      fragmentShader: gradeFragment,
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uMix: { value: 0 },
        uAspect: { value: 1.78 },
        uGrain: { value: 0.028 },
        uAberration: { value: 0 },
        uResolution: { value: new Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.gradePass = new ShaderPass(grade);
    this.gradePass.renderToScreen = true;
    composer.addPass(this.gradePass);
    this.composer = composer;
  }

  private on<K extends keyof HTMLElementEventMap>(
    el: HTMLElement | Window | Document,
    type: string,
    fn: (e: HTMLElementEventMap[K] & Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    el.addEventListener(type, fn as EventListener, options);
    this.listeners.push(() => el.removeEventListener(type, fn as EventListener, options));
  }

  private bindInput(): void {
    const c = this.canvas;
    this.on(c, 'webglcontextlost', (e) => {
      e.preventDefault();
      this.paused = true;
    });
    this.on(c, 'webglcontextrestored', () => {
      this.paused = false;
    });

    this.on(c, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.on(c, 'pointerleave', () => {
      this.pointer.inside = false;
    });
    this.on(c, 'pointerdown', (e) => {
      const ev = e as PointerEvent;
      this.down = { x: ev.clientX, y: ev.clientY, t: performance.now(), touchY: ev.clientY };
      this.onPointerMove(ev);
    });
    this.on(c, 'pointerup', (e) => {
      const ev = e as PointerEvent;
      const d = this.down;
      this.down = null;
      if (!d) return;
      const moved = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
      if (moved < 10 && performance.now() - d.t < 650) this.toggle();
    });
    this.on(c, 'pointercancel', () => {
      this.down = null;
    });
    this.on(
      c,
      'wheel',
      (e) => {
        if (!this.scrollMode) return;
        e.preventDefault();
        const ev = e as WheelEvent;
        const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? this.height : 1;
        this.scrubTarget = clamp(this.scrubTarget + (ev.deltaY * unit) / 900, 0, 1);
      },
      { passive: false },
    );
    this.on(window, 'keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.code !== 'Space' || ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target as HTMLElement | null;
      if (
        t &&
        (t.closest('button, a, input, select, textarea, [role="button"], [contenteditable="true"]') ||
          t.isContentEditable)
      )
        return;
      ev.preventDefault();
      this.toggle();
    });
  }

  private onPointerMove(ev: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    const p = this.pointer;
    const now = performance.now();

    // touch scrubbing: vertical drag moves progress while scroll mode is on
    if (this.scrollMode && this.down && ev.pointerType === 'touch') {
      this.scrubTarget = clamp(
        this.scrubTarget + (this.down.touchY - ev.clientY) / (rect.height * 0.9),
        0,
        1,
      );
      this.down.touchY = ev.clientY;
    }

    const dtp = Math.max(1, now - p.lastT);
    const speed = Math.hypot(nx - p.lastX, ny - p.lastY) / (dtp / 1000); // NDC per second
    p.lastX = nx;
    p.lastY = ny;
    p.lastT = now;
    p.nx = nx;
    p.ny = ny;
    p.inside = true;

    const movedPx = Math.hypot(ev.clientX - p.lastTrailX, ev.clientY - p.lastTrailY);
    if (movedPx > 6 && now - p.lastTrailT > 24) {
      p.lastTrailX = ev.clientX;
      p.lastTrailY = ev.clientY;
      p.lastTrailT = now;
      this.camera.updateMatrixWorld();
      const hit = this.worldHit(nx, ny);
      this.trail.push({ ...hit, born: this.time, strength: clamp(0.3 + speed * 0.45, 0.3, 1) });
      if (this.trail.length > 24) this.trail.shift();
    }
  }

  /** Intersection of the pointer ray with the z = 0 plane. */
  private worldHit(nx: number, ny: number): { x: number; y: number; z: number } {
    const cam = this.camera;
    this.tmp.set(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
    const t = this.tmp.z === 0 ? 0 : -cam.position.z / this.tmp.z;
    return { x: cam.position.x + this.tmp.x * t, y: cam.position.y + this.tmp.y * t, z: 0 };
  }

  private applyResize(): void {
    const el = this.opts.container;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    this.width = w;
    this.height = h;
    const nativeDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.dpr = Math.max(1, Math.min(nativeDpr, this.dprCap));
    this.info.dpr = this.dpr;

    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.dpr);
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pxScale = (h * this.dpr) / (2 * TAN_HALF_FOV);
    this.aperture = 0.03 * h * this.dpr;
    this.charDist = characterCameraDistance(w / h, this.system.stats.width);

    const aspect = w / h;
    if (Math.abs(aspect / this.builtAspect - 1) > 0.22) {
      if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
      this.rebuildTimer = setTimeout(() => this.rebuildCrowd(), 350);
    }
  }

  /** Re-lays-out the crowd for the current aspect (rotation / big resize). Same particle count. */
  private rebuildCrowd(): void {
    if (this.disposed) return;
    const aspect = Math.max(0.3, this.width / this.height);
    if (Math.abs(aspect / this.builtAspect - 1) <= 0.22) return;
    const data = buildParticleData({ grid: this.grid, subdivision: this.subdivision, aspect, seed: SEED });
    this.system.replaceData(data);
    this.builtAspect = aspect;
  }

  // ------------------------------------------------------------------------------------- frame

  private tick = (now: number): void => {
    if (this.disposed || this.paused) return;
    const rawDt = this.lastNow ? (now - this.lastNow) / 1000 : 0;
    this.lastNow = now;
    const dt = clamp(rawDt, 0, 0.1);

    if (!this.timePinned) this.time += dt;
    this.motion += (this.motionTarget - this.motion) * (1 - Math.exp(-dt / 0.25));

    if (this.scrollMode) {
      // damped follow so wheel notches glide instead of stepping
      const p = this.controller.progress;
      const next = p + (this.scrubTarget - p) * (1 - Math.exp(-dt / 0.14));
      this.controller.scrubTo(Math.abs(next - this.scrubTarget) < 5e-4 ? this.scrubTarget : next);
    }
    this.controller.update(dt);

    // pointer parallax eases toward the pointer (and back to centre when it leaves)
    const p = this.pointer;
    const tx = p.inside ? p.nx : 0;
    const ty = p.inside ? p.ny : 0;
    const k = 1 - Math.exp(-dt / 0.35);
    p.sx += (tx - p.sx) * k;
    p.sy += (ty - p.sy) * k;

    this.renderFrame();
    this.governor(rawDt);
    this.emitStatus(false);
  };

  private renderFrame(): void {
    const c = this.controller;
    const progress = c.progress;
    const meta = this.system.stats;
    const pose = cameraPose(progress, this.charDist);
    const par = parallaxAmount(progress) * this.motion;

    const cam = this.camera;
    cam.position.set(
      pose.x * this.motion + this.pointer.sx * 0.5 * par,
      pose.y + this.pointer.sy * 0.3 * par,
      pose.z,
    );
    cam.lookAt(pose.lookX * this.motion, pose.lookY, 0);
    cam.updateMatrixWorld();

    // pointer wake: newest first, strength fades with age (pooled objects, no per-frame allocation)
    let trailCount = 0;
    for (let i = this.trail.length - 1; i >= 0 && trailCount < TRAIL_LENGTH; i--) {
      const e = this.trail[i];
      const w = e.strength * Math.exp(-(this.time - e.born) * 2.4);
      if (w <= 0.02) continue;
      const out = this.trailOut[trailCount++];
      out.x = e.x;
      out.y = e.y;
      out.z = e.z;
      out.w = w;
    }
    while (this.trail.length && this.time - this.trail[0].born > 3) this.trail.shift();
    this.system.setTrail(this.trailOut, trailCount);

    const frame = this.frame;
    frame.time = this.time;
    frame.progress = progress;
    frame.dir = c.dir;
    frame.motion = this.motion;
    frame.scanY = scanY(progress, meta.top, meta.bottom);
    frame.scanGate = scanGate(progress, c.dir);
    frame.pxScale = this.pxScale;
    frame.focus = pose.focus;
    frame.aperture = this.aperture;
    frame.camPos = cam.position;
    frame.parallax[0] = this.pointer.sx;
    frame.parallax[1] = this.pointer.sy;
    frame.aspect = cam.aspect;
    this.system.update(frame);

    if (this.composer && this.gradePass) {
      const u = (this.gradePass.material as ShaderMaterial).uniforms;
      u.uTime.value = this.time;
      u.uMix.value = crowdMix(progress);
      u.uAspect.value = cam.aspect;
      u.uAberration.value = 0.012 * Math.sin(Math.PI * clamp(progress, 0, 1)) * this.motion;
      this.composer.render();
    } else {
      this.renderer.render(this.scene, cam);
    }
  }

  /** Drops the pixel ratio if the device cannot keep up (never the particle count: pixels must tile). */
  private governor(rawDt: number): void {
    if (rawDt <= 0 || rawDt > 0.5 || this.timePinned) return;
    this.govElapsed += rawDt;
    if (this.govElapsed < 2) return; // ignore shader-compile warm-up
    this.govAcc += rawDt;
    this.govFrames++;
    if (this.govAcc < 1.5) return;
    const avgMs = (this.govAcc / this.govFrames) * 1000;
    this.govAcc = 0;
    this.govFrames = 0;
    if (avgMs > 30 && this.dpr > 1 && this.govReductions < 4) {
      this.govReductions++;
      this.dprCap = Math.max(1, this.dpr - 0.25);
      this.applyResize();
    }
  }

  private emitStatus(force: boolean): void {
    const cb = this.opts.onStatus;
    if (!cb) return;
    const now = performance.now();
    if (!force && now - this.statusAt < 90) return;
    this.statusAt = now;
    const s = this.status;
    const key = `${s.mode}|${s.heading}|${s.stage}|${s.scrollMode}|${s.reducedMotion}|${Math.round(s.progress * 200)}`;
    if (!force && key === this.lastStatusKey) return;
    this.lastStatusKey = key;
    cb(s);
  }
}
