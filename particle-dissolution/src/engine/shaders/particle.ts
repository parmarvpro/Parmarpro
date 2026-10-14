import { NOISE_GLSL } from './noise';

/**
 * Particle shaders. One draw call renders every particle; all motion is a pure function of
 * (global progress, time, per-particle attributes), so the animation is deterministic, scrubbable
 * and reversible with no CPU per-particle work.
 *
 * Per-particle local progress  tau = clamp((progress - rel) / dur, 0, 1)
 * where (rel, dur) is the particle's own schedule (head leaves first on the way out, locks first on
 * the way back). Everything below is built from tau, so stages overlap organically instead of
 * firing on a global clock.
 */
export const particleVertex = /* glsl */ `
${NOISE_GLSL}

attribute vec3 aCrowd;      // crowd-space rest position
attribute vec4 aAnchor;     // figure anchor: x, y(feet), z, height
attribute vec4 aRig;        // figure seed, part id, pivot x, pivot y
attribute vec4 aColorChar;  // character colour + opacity
attribute vec4 aColorCrowd; // crowd colour + opacity
attribute vec4 aRand;       // phase, cluster hash, random a, random b
attribute vec3 aDrift;      // drift direction
attribute vec4 aMisc;       // id, depth (0 near .. 1 far), crowd size, edge
attribute vec4 aTrans;      // relFwd, durFwd, relRev, durRev

uniform float uTime;
uniform float uProgress;
uniform float uDir;         // 0 = heading to the crowd, 1 = heading back (smoothed)
uniform float uMotion;      // 1 = full motion, lower for reduced-motion
uniform float uScanY;
uniform float uScanGate;
uniform float uCharTop;
uniform float uCharBottom;
uniform float uCharLeft;
uniform float uCell;
uniform float uSubK;       // sub-lattice factor k (k*k particles per sprite cell)
uniform float uSubSize;
uniform float uPxScale;     // device px per world unit at unit view depth
uniform float uMaxPoint;
uniform float uFocus;
uniform float uAperture;
uniform vec3 uCamPos;
uniform float uPointerRadius;
uniform vec4 uPointer[8];   // world hit point on z = 0 + strength

varying vec3 vColor;
varying float vAlpha;
varying float vShape;
varying float vCore;
varying float vRim;
varying float vGlow;

// ---- crowd rig -------------------------------------------------------------------------------
// Returns the limb offset; figOff receives the whole-figure drift/bob. Everything is derived from
// the figure seed, so no two figures share phase, tempo or amplitude (no marching formation).
vec3 crowdOffset(vec3 rest, float kind, vec2 pivot, float seed, float depth01, float H, float t, out vec3 figOff) {
  float h1 = hash11(seed * 5.0 + 1.0);
  float h2 = hash11(seed * 5.0 + 2.0);
  float h3 = hash11(seed * 5.0 + 3.0);
  float h4 = hash11(seed * 5.0 + 4.0);
  float calm = mix(1.0, 0.45, depth01); // background figures move more slowly and less

  // slow wander across the frame
  float driftAmp = (0.3 + 0.7 * h1) * H * 0.38 * calm;
  float driftW = TAU / mix(24.0, 56.0, h2);
  figOff = vec3(
    sin(t * driftW + h3 * TAU) * driftAmp,
    0.0,
    sin(t * driftW * 0.7 + h4 * TAU) * H * 0.04
  );

  // relaxed step cycle + vertical bob (twice per cycle)
  float stepW = mix(1.7, 2.7, h2) * calm;
  float ph = h3 * TAU;
  float swing = sin(t * stepW + ph);
  figOff.y += (0.5 + 0.5 * sin(t * stepW * 2.0 + ph)) * 0.014 * H * calm;

  float torsoAngle = sin(t * stepW * 0.5 + ph * 1.3) * 0.028 * calm;
  float angle = torsoAngle;
  if (kind > 3.5 && kind < 5.5) {
    float side = kind < 4.5 ? -1.0 : 1.0;
    angle = swing * side * 0.2 * calm; // legs scissor about the hips
  } else if (kind > 1.5 && kind < 3.5) {
    float side = kind < 2.5 ? -1.0 : 1.0;
    // arms counter-swing; now and then one lifts away from the body
    // one arm per figure, and only a small lift: reads as a casual gesture, never a scarecrow pose
    float gestureSide = h1 < 0.5 ? -1.0 : 1.0;
    float gesture = smoothstep(0.9, 1.0, sin(t * 0.19 + h4 * 40.0)) * (side == gestureSide ? 1.0 : 0.0);
    angle = -swing * side * 0.13 * calm + gesture * side * 0.42;
  }
  vec2 rotated = rotAbout(rest.xy, pivot, angle);
  return vec3(rotated - rest.xy, 0.0);
}

void main() {
  float id = aMisc.x;
  float depth01 = aMisc.y;
  float crowdSize = aMisc.z;
  float phase = aRand.x;
  float rA = aRand.z;
  float rB = aRand.w;
  float kind = aRig.y;
  float seed = aRig.x;
  float t = uTime;

  // ---- per-particle local progress ---------------------------------------------------------
  float rel = mix(aTrans.x, aTrans.z, uDir);
  float dur = mix(aTrans.y, aTrans.w, uDir);
  float tau = clamp((uProgress - rel) / dur, 0.0, 1.0);
  float bell = sin(PI * tau);
  float e = smoother(tau);

  // ---- stage A: character at rest (breathing, shoulders, head) -------------------------------
  // At rest the k*k particles of a sprite cell sit stacked on the cell centre, drawn at exactly cell
  // size: mathematically crisp pixel edges with no seams. Scanning unfolds them to their sub-lattice.
  vec2 ci = vec2(floor((position.x - uCharLeft) / uCell), floor((uCharTop - position.y) / uCell));
  vec2 cellC = vec2(uCharLeft + (ci.x + 0.5) * uCell, uCharTop - (ci.y + 0.5) * uCell);
  vec2 subOff = position.xy - cellC;

  float h01 = clamp((cellC.y - uCharBottom) / (uCharTop - uCharBottom), 0.0, 1.0);
  float idle = uMotion * (1.0 - smoothstep(0.0, 0.5, tau));
  float chest = smoothstep(0.3, 0.62, h01);
  float shoulders = smoothstep(0.48, 0.7, h01) * (1.0 - smoothstep(0.72, 0.86, h01));
  vec2 breathe = vec2(
    sin(t * 0.9 + 0.6) * 0.12 * uCell * shoulders,
    (0.5 + 0.5 * sin(t * 1.55)) * 0.22 * uCell * chest + sin(t * 1.55 + 0.35) * 0.07 * uCell * smoothstep(0.78, 0.9, h01)
  ) * idle;

  // ---- stage B: scan band (head -> feet) -----------------------------------------------------
  float passed = smoothstep(0.0, 0.4, position.y - uScanY);       // 1 once the band is above us
  float activated = passed * (1.0 - uDir);                          // scanned, digitised, not yet released
  float dBand = (cellC.y - uScanY) / 0.075;
  float flash = exp(-dBand * dBand) * uScanGate;                    // whole cell brightens together

  vec3 pChar = vec3(cellC + subOff * activated + breathe, position.z);
  vec3 jitter = vec3(
    sin(t * 3.1 + phase),
    cos(t * 2.7 + phase * 1.7),
    sin(t * 2.3 + phase * 0.7)
  ) * 0.1 * uCell;
  vec3 p0 = pChar + (jitter + aDrift * 0.1 * uCell) * activated * (1.0 - tau) * uMotion;

  // ---- crowd target ---------------------------------------------------------------------------
  float alive = mix(smoothstep(0.7, 1.0, uProgress), 1.0, uDir) * uMotion;
  vec3 figOff;
  vec3 limb = crowdOffset(aCrowd, kind, aRig.zw, seed, depth01, aAnchor.w, t, figOff);
  vec3 fine = aCrowd + (figOff + limb) * alive;

  // Going out, the crowd condenses from loose vertical columns: heads gather first, then torsos,
  // then limbs and halos. Coming back the crowd is already fully formed.
  float s0 = kind < 0.5 ? 0.56 : (kind < 1.5 ? 0.5 : (kind < 5.5 ? 0.64 : 0.7));
  float refine = mix(smoothstep(s0, s0 + 0.3, uProgress), 1.0, uDir);
  float colY = aAnchor.y + (0.05 + 0.9 * rA) * aAnchor.w;
  vec3 coarse = vec3(
    aAnchor.x + (hash11(id + 5000.0) - 0.5) * 0.11 * aAnchor.w,
    mix(colY, aCrowd.y, 0.3),
    aAnchor.z + (aCrowd.z - aAnchor.z) * 0.4
  ) + figOff * alive;
  vec3 p1 = mix(coarse, fine, refine);

  // ---- stages C-E: breakup, stream, settle ----------------------------------------------------
  // Sideways first, vertical later: the stream sweeps across the frame before matter climbs to its
  // final height, so the flow reads as "primarily sideways, slightly upward" rather than a diagonal.
  float eY = mix(smoother((tau - 0.14) / 0.86), e, uDir);
  vec3 base = vec3(mix(p0.x, p1.x, e), mix(p0.y, p1.y, eY), mix(p0.z, p1.z, e));
  // Return trip: funnel through a common region near the centre before the sprite crystallises.
  base = mix(base, vec3(0.0, 0.2, 0.8), uDir * 0.55 * bell * bell);

  float amp = bell * uMotion;
  vec3 pos = base;
  if (amp > 0.0005) {
    vec3 outward = vec3(p0.x, p0.y, 0.0);
    outward /= length(outward) + 0.25;                      // weak radial push from the sprite centre
    vec3 wind = normalize(vec3(1.0, 0.14, 0.0));            // broad sideways + slightly upward stream
    vec3 cp = vec3(base.xy * 0.085, tau * 0.9 + t * 0.06) + aDrift * 0.35;
    vec3 curl = curlNoise(cp);                              // coherent low-frequency flow field
    float turb = mix(1.0, tau * 1.5, uDir);                 // calmer, more directional on approach
    vec3 flow = outward * (0.6 + 0.9 * rB)
      + vec3(0.0, 1.0, 0.0) * (0.35 + 0.5 * rA)             // gentle upward drift
      + wind * 4.2 * (0.55 + 0.9 * rA) * (1.0 - uDir)       // lateral flow
      + curl * 2.6 * turb
      + vec3(0.0, 0.0, 1.0) * (0.4 + 1.6 * rB);             // mild depth displacement toward camera
    vec3 swirl = vec3(-(base.y - 0.2), base.x, 0.0);
    flow += swirl / (length(swirl) + 1.5) * 3.0 * uDir;      // spiral into the centre on the way back
    pos += flow * amp;
  }

  // ---- pointer wake: perspective-correct push away from each recent pointer ray ------------------
  vec3 push = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 tr = uPointer[i];
    if (tr.w > 0.001) {
      vec3 rd = normalize(tr.xyz - uCamPos);
      vec3 v = pos - uCamPos;
      float along = dot(v, rd);
      if (along > 0.1) {
        vec3 perp = v - rd * along;
        float radius = uPointerRadius * along;   // constant screen-space radius at any depth
        float d = length(perp);
        float f = exp(-(d * d) / (radius * radius));
        vec3 away = perp / (d + 1e-4);
        push += (away * 0.9 + cross(rd, away) * 0.45) * f * tr.w * radius * 0.5;
      }
    }
  }
  pos += push * uMotion;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float depthV = max(-mv.z, 0.1);

  // ---- appearance: size, shape, colour ---------------------------------------------------------
  float mixC = smoothstep(0.2, 0.9, tau);
  float restLock = (1.0 - activated) * (1.0 - smoothstep(0.0, 0.12, tau));   // 1 = sitting in its pixel
  // One "leader" per cell (the lattice's top-left slot) draws the whole pixel at rest; the other k*k-1
  // particles stay at zero size until the cell is scanned. Same look, ~k*k times less overdraw.
  float hk = (uSubK - 1.0) * 0.5 / uSubK * uCell;
  float leader = step(abs(subOff.x + hk), 0.001 * uCell) * step(abs(subOff.y - hk), 0.001 * uCell);
  float sChar = mix(uSubSize * 0.82, uCell * leader, restLock);          // pixel at rest, loosened mosaic once scanned
  float sFlight = max(uSubSize * 1.7, 0.034) * (0.8 + 0.7 * rA);           // small round dust in transit
  float sz = mix(sChar, sFlight, smoothstep(0.0, 0.2, tau));
  sz = mix(sz, crowdSize, smoothstep(0.5, 1.0, tau));
  sz *= 1.0 + flash * 0.3 * (1.0 - restLock);

  float shape = 1.0 - smoothstep(0.0, 0.16, tau);                          // crisp squares only at rest
  float coc = uAperture * abs(1.0 - uFocus / depthV);                     // depth-of-field blur, in px
  float corePx = sz * uPxScale / depthV;
  corePx = mix(max(corePx, 1.2), corePx, shape);

  // colour: dark clothing -> hologram lift in transit -> crowd palette
  vec3 col = mix(aColorChar.rgb, aColorCrowd.rgb, mixC);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float flicker = 0.5 + 0.5 * sin(t * 6.0 + phase * 3.0);
  float lift = bell * (0.32 + 0.2 * flicker) * (1.0 - 0.7 * mixC);
  col = mix(col, vec3(0.45, 0.82, 1.0) * (0.55 + 0.9 * lum) + col * 0.25, lift);
  col += vec3(0.5, 0.88, 1.0) * flash * 0.45;                              // scan boundary brightens briefly

  float rest = 1.0 - smoothstep(0.0, 0.25, tau);
  col *= 1.0 + (0.035 * sin(t * 2.1 + phase) + 0.05 * smoothstep(0.965, 1.0, sin(h01 * 16.0 - t * 1.2))) * rest * uMotion;

  float fl = 0.5 + 0.5 * sin(t * 0.37 + seed * 2.1);                       // slow independent colour drift
  col = mix(col, col.gbr, mixC * 0.05 * fl);
  col *= 1.0 + mixC * 0.06 * sin(t * 0.5 + seed * 4.3 + phase * 0.2);

  // sparse blue-white sparks while matter is in motion
  float spark = step(hash11(id + 200000.0), 0.004) * step(0.2, bell) * step(0.7, sin(t * 9.0 + phase * 5.0));  // ~1 in 1000 at any instant
  col = mix(col, vec3(0.8, 0.95, 1.0), spark);
  corePx = mix(corePx, min(corePx, 2.4), spark);                           // sparks are pin-pricks, whatever particle they ride on

  // reverse lock-in: a brief warm-up glow right after a particle reaches its pixel, then it fades
  float resting = 1.0 - step(0.0001, tau);
  float lock = uDir * resting * exp(-max(rel - uProgress, 0.0) * 10.0) * step(0.0001, rel);

  float glow = flash * 0.55 + bell * 0.06 + spark * 0.6 + lock * 0.25;
  col *= 1.0 + flash * 0.7 + spark * 0.9 + lock * 0.35;                    // emissive (HDR) boost for bloom

  float alpha = mix(aColorChar.a, aColorCrowd.a, smoothstep(0.4, 1.0, tau));
  alpha *= 1.0 - 0.2 * bell;

  // Soft focus comes from the sprite itself: every crowd particle gets a Gaussian shoulder (stronger
  // for halos and distant, hazier figures) on top of the depth-of-field blur.
  float crowdSoft = smoothstep(0.45, 1.0, tau) * (kind > 5.5 ? 1.5 : 0.95 + 0.35 * depth01);
  float blurPx = coc + corePx * crowdSoft;
  alpha /= 1.0 + blurPx * blurPx * 0.004;

  float aaPx = 1.0 - shape;
  float glowExt = 1.6 * clamp(glow, 0.0, 1.0);
  float visible = corePx + blurPx + aaPx;
  float total = min(visible * (1.0 + glowExt), uMaxPoint);
  gl_PointSize = total;
  if (total < 0.05) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);                 // resting non-leaders: clipped, never rasterised

  vCore = corePx / max(total, 1e-3);
  vRim = visible / max(total, 1e-3);
  vShape = shape;
  vGlow = clamp(glow, 0.0, 1.2);
  vAlpha = alpha;
  vColor = col;
}
`;

export const particleFragment = /* glsl */ `
uniform float uHdr;

varying vec3 vColor;
varying float vAlpha;
varying float vShape;
varying float vCore;
varying float vRim;
varying float vGlow;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float dRound = length(c);
  float dSquare = max(abs(c.x), abs(c.y));
  float d = mix(dRound, dSquare, vShape);

  // Core: a hard edge when there is no blur (pixel tiles must tile without seams), otherwise a
  // soft rim whose width is the depth-of-field blur.
  float a;
  if (vRim - vCore < 1e-4) {
    a = d <= vCore ? 1.0 : 0.0;
  } else {
    float x = clamp((d - vCore) / (vRim - vCore), 0.0, 1.0);
    a = exp(-x * x * 2.6) * (1.0 - smoothstep(0.65, 1.0, x)); // Gaussian shoulder, windowed to 0 at the rim
    a = d <= vCore ? 1.0 : a;
  }

  // Glow halo: additive, faded to nothing before the sprite edge so no square ever shows.
  float h = 0.0;
  if (vGlow > 0.001) {
    float r = d / max(vRim, 0.05);
    h = exp(-r * r * 2.2) * (1.0 - smoothstep(0.7, 1.0, d)) * vGlow * 0.8;
  }

  float coreA = a * vAlpha;
  if (coreA + h < 0.003) discard;

  vec3 rgb = vColor;
  if (uHdr < 0.5) rgb = min(rgb, vec3(1.0));
  // Premultiplied: the core occludes (alpha), the halo only adds light.
  gl_FragColor = vec4(rgb * (coreA + h), coreA);
}
`;
