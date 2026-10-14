import { NOISE_GLSL } from './noise';

/**
 * Full-screen backdrop. Dark charcoal for the character; as `uMix` rises it becomes diffused warm
 * light (cream, yellow, coral, cyan) built from a few drifting soft blobs rather than shapes.
 */
export const backgroundVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

export const backgroundFragment = /* glsl */ `
${NOISE_GLSL}

uniform float uTime;
uniform float uMix;
uniform float uAspect;
uniform vec2 uParallax;
uniform vec3 uCream;
uniform vec3 uYellow;
uniform vec3 uCoral;
uniform vec3 uCyan;
uniform float uScan;

varying vec2 vUv;

float blob(vec2 p, vec2 c, float r) {
  vec2 d = (p - c) * vec2(uAspect, 1.0);
  return exp(-dot(d, d) / (r * r));
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv + uParallax * 0.02;
  float t = uTime;

  // ---- character state: charcoal with a faint cool pool of light behind the sprite
  vec2 q = (uv - vec2(0.5, 0.5)) * vec2(uAspect, 1.0);
  float r = length(q);
  vec3 dark = mix(vec3(0.118, 0.122, 0.142), vec3(0.062, 0.064, 0.078), smoothstep(0.0, 0.95, r));
  dark += vec3(0.012, 0.022, 0.04) * exp(-r * r * 5.0);
  dark += vec3(0.02, 0.05, 0.08) * uScan * exp(-r * r * 3.0);   // faint ambient cyan while scanning

  // ---- crowd state: diffused coloured light (yy runs 0 at the top of the frame to 1 at the bottom)
  vec2 pa = p + 0.02 * vec2(sin(t * 0.05), cos(t * 0.04));
  float yy = 1.0 - pa.y;
  float low = noised(vec3(pa * 1.6, t * 0.02)).x - 0.5;           // very low-frequency modulation
  // warm yellow body, pale cream where the light is brightest
  vec3 light = mix(uYellow, uCream, 0.35 + 0.25 * (1.0 - yy));
  float sun = blob(pa, vec2(0.5 + 0.04 * sin(t * 0.07), 0.26), 0.62);
  light = mix(light, uCream, clamp(sun * 0.9 + low * 0.2, 0.0, 1.0));
  // soft coral pooling toward the lower left and upper left corners
  float coral = blob(pa, vec2(0.02, 0.9), 0.5) * 0.55 + blob(pa, vec2(0.0, 0.08), 0.32) * 0.3;
  light = mix(light, uCoral, clamp(coral, 0.0, 0.7));
  // cyan wash on the right
  float cyan = blob(pa, vec2(1.0, 0.18 + 0.03 * sin(t * 0.06)), 0.4) * 0.65 + blob(pa, vec2(0.92, 0.95), 0.36) * 0.6;
  light = mix(light, uCyan, clamp(cyan, 0.0, 0.8));
  light += (noised(vec3(pa * 6.0, t * 0.03)).x - 0.5) * 0.02;

  // charcoal → dusky periwinkle → luminous: passing through a cool dusk avoids a muddy brown mid-tone
  vec3 dusk = vec3(0.30, 0.33, 0.52);
  float m = smoothstep(0.0, 1.0, uMix);
  vec3 col = mix(dark, dusk, smoothstep(0.0, 0.5, m));
  col = mix(col, light, smoothstep(0.38, 1.0, m));

  // triangular-ish dither keeps the soft gradients free of banding
  float n = hash31(vec3(gl_FragCoord.xy, floor(t * 24.0))) + hash31(vec3(gl_FragCoord.yx, 7.0));
  col += (n - 1.0) * (1.5 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`;
