import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
  Vector4,
  type Object3D,
} from 'three';
import { crowdMix } from './camera';
import { GLOW, SCAN } from './config';
import { hexToRgb01 } from './color';
import type { ParticleData } from './particleData';
import { backgroundFragment, backgroundVertex } from './shaders/background';
import { particleFragment, particleVertex } from './shaders/particle';
import { scanFragment, scanVertex } from './shaders/scan';

export const TRAIL_LENGTH = 8;

/** Everything the shaders need each frame. Plain numbers; the engine fills it from the controller. */
export interface FrameState {
  time: number;
  progress: number;
  dir: number;
  motion: number;
  scanY: number;
  scanGate: number;
  pxScale: number;
  focus: number;
  aperture: number;
  camPos: Vector3;
  parallax: [number, number];
  aspect: number;
}

/**
 * Owns the GPU resources of the experience: ONE `Points` draw call for every particle, one quad for
 * the backdrop and one for the scan band. Typed arrays go straight into BufferAttributes; the CPU
 * never touches individual particles after construction.
 */
export class ParticleSystem {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  readonly background: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly scanBand: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly objects: Object3D[];
  readonly count: number;

  private readonly particleMat: ShaderMaterial;
  private readonly trail: Vector4[];

  constructor(
    private readonly data: ParticleData,
    opts: { hdr: boolean; maxPointSize: number },
  ) {
    this.count = data.count;
    const geo = new BufferGeometry();
    // `position` doubles as the character-space target (required by three for the draw count).
    geo.setAttribute('position', new BufferAttribute(data.charPos, 3));
    geo.setAttribute('aCrowd', new BufferAttribute(data.crowdPos, 3));
    geo.setAttribute('aAnchor', new BufferAttribute(data.anchor, 4));
    geo.setAttribute('aRig', new BufferAttribute(data.rig, 4));
    geo.setAttribute('aColorChar', new BufferAttribute(data.colorChar, 4, true));
    geo.setAttribute('aColorCrowd', new BufferAttribute(data.colorCrowd, 4, true));
    geo.setAttribute('aRand', new BufferAttribute(data.rand, 4));
    geo.setAttribute('aDrift', new BufferAttribute(data.drift, 3));
    geo.setAttribute('aMisc', new BufferAttribute(data.misc, 4));
    geo.setAttribute('aTrans', new BufferAttribute(data.trans, 4));

    this.trail = Array.from({ length: TRAIL_LENGTH }, () => new Vector4(0, 0, 0, 0));

    this.particleMat = new ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uDir: { value: 0 },
        uMotion: { value: 1 },
        uScanY: { value: data.meta.top + SCAN.margin },
        uScanGate: { value: 0 },
        uCharTop: { value: data.meta.top },
        uCharBottom: { value: data.meta.bottom },
        uCharLeft: { value: -data.meta.width / 2 },
        uCell: { value: data.meta.cellSize },
        uSubK: { value: data.meta.subdivision },
        uSubSize: { value: data.meta.subSize },
        uPxScale: { value: 800 },
        uMaxPoint: { value: opts.maxPointSize },
        uFocus: { value: 18 },
        uAperture: { value: 10 },
        uCamPos: { value: new Vector3(0, 0, 18) },
        uPointerRadius: { value: 0.06 },
        uPointer: { value: this.trail },
        uHdr: { value: opts.hdr ? 1 : 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Premultiplied alpha: cores occlude (so the dark pixel art stays dark), halos only add light.
      blending: NormalBlending,
      premultipliedAlpha: true,
    });

    this.points = new Points(geo, this.particleMat);
    this.points.frustumCulled = false; // rest positions span the whole crowd, not the sprite's bounds
    this.points.renderOrder = 0;

    const bg = new ShaderMaterial({
      vertexShader: backgroundVertex,
      fragmentShader: backgroundFragment,
      uniforms: {
        uTime: { value: 0 },
        uMix: { value: 0 },
        uAspect: { value: 1.78 },
        uParallax: { value: [0, 0] },
        uScan: { value: 0 },
        uCream: { value: hexToRgb01(GLOW.cream) },
        uYellow: { value: hexToRgb01(GLOW.yellow) },
        uCoral: { value: hexToRgb01(GLOW.coral) },
        uCyan: { value: hexToRgb01(GLOW.cyan) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.background = new Mesh(new PlaneGeometry(2, 2), bg);
    this.background.frustumCulled = false;
    this.background.renderOrder = -10;

    const scan = new ShaderMaterial({
      vertexShader: scanVertex,
      fragmentShader: scanFragment,
      uniforms: {
        uGate: { value: 0 },
        uTime: { value: 0 },
        uHeight: { value: 1.2 },
        uHdr: { value: opts.hdr ? 1 : 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const scanWidth = Math.max(data.meta.width * 2.1, 2.8);
    this.scanBand = new Mesh(new PlaneGeometry(scanWidth, 1.2), scan);
    this.scanBand.position.z = 0.35;
    this.scanBand.frustumCulled = false;
    this.scanBand.renderOrder = 5;
    this.scanBand.visible = false;

    this.objects = [this.background, this.points, this.scanBand];
  }

  /** Writes the per-frame state into uniforms (no allocations). */
  update(s: FrameState): void {
    const u = this.particleMat.uniforms;
    u.uTime.value = s.time;
    u.uProgress.value = s.progress;
    u.uDir.value = s.dir;
    u.uMotion.value = s.motion;
    u.uScanY.value = s.scanY;
    u.uScanGate.value = s.scanGate;
    u.uPxScale.value = s.pxScale;
    u.uFocus.value = s.focus;
    u.uAperture.value = s.aperture;
    (u.uCamPos.value as Vector3).copy(s.camPos);

    const b = this.background.material.uniforms;
    b.uTime.value = s.time;
    b.uMix.value = crowdMix(s.progress);
    b.uAspect.value = s.aspect;
    b.uParallax.value = s.parallax;
    b.uScan.value = s.scanGate;

    const sb = this.scanBand;
    sb.visible = s.scanGate > 0.003;
    sb.position.y = s.scanY;
    sb.material.uniforms.uGate.value = s.scanGate;
    sb.material.uniforms.uTime.value = s.time;
  }

  /** Re-uploads every attribute from fresh data of the same size (e.g. crowd re-layout after a rotate). */
  replaceData(next: ParticleData): void {
    if (next.count !== this.count) throw new Error('replaceData: particle count must not change');
    const geo = this.points.geometry;
    const copy = (name: string, src: ArrayLike<number>) => {
      const attr = geo.getAttribute(name) as BufferAttribute;
      (attr.array as Float32Array | Uint8Array).set(src as ArrayLike<number>);
      attr.needsUpdate = true;
    };
    copy('position', next.charPos);
    copy('aCrowd', next.crowdPos);
    copy('aAnchor', next.anchor);
    copy('aRig', next.rig);
    copy('aColorChar', next.colorChar);
    copy('aColorCrowd', next.colorCrowd);
    copy('aRand', next.rand);
    copy('aDrift', next.drift);
    copy('aMisc', next.misc);
    copy('aTrans', next.trans);
  }

  /** Pointer wake: the first `count` pooled entries, most recent first. Strength fades with age. */
  setTrail(entries: ReadonlyArray<{ x: number; y: number; z: number; w: number }>, count: number): void {
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      if (i < count) this.trail[i].set(entries[i].x, entries[i].y, entries[i].z, entries[i].w);
      else this.trail[i].set(0, 0, 0, 0);
    }
  }

  get stats() {
    return this.data.meta;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.particleMat.dispose();
    this.background.geometry.dispose();
    this.background.material.dispose();
    this.scanBand.geometry.dispose();
    this.scanBand.material.dispose();
  }
}
