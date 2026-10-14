/**
 * Final composite: soft highlight roll-off for HDR values, vignette, film grain and a gentle
 * colour grade. Everything upstream is display-referred sRGB, so nothing is gamma-converted here.
 */
export const gradeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const gradeFragment = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uMix;       // 0 character state, 1 crowd state
uniform float uAspect;
uniform float uGrain;
uniform float uAberration;
uniform vec2 uResolution;

varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 softClip(vec3 c) {
  // Linear below the knee, smooth shoulder above it: HDR glow compresses instead of clipping.
  vec3 knee = vec3(0.82);
  vec3 over = max(c - knee, 0.0);
  return min(c, knee) + (1.0 - knee) * (1.0 - exp(-over / (1.0 - knee)));
}

void main() {
  vec2 d = vUv - 0.5;
  float ca = uAberration * dot(d, d);
  vec3 col;
  col.r = texture2D(tDiffuse, vUv + d * ca).r;
  col.g = texture2D(tDiffuse, vUv).g;
  col.b = texture2D(tDiffuse, vUv - d * ca).b;

  col = softClip(col);

  // vignette: deepens the charcoal stage; in the bright stage it becomes a warm shade, not grey
  float v = smoothstep(0.38, 1.1, length(d * vec2(uAspect * 0.62, 1.0)));
  vec3 shade = mix(vec3(0.0), vec3(0.86, 0.68, 0.62), uMix);
  col = mix(col, col * shade, v * mix(0.8, 0.28, uMix));

  // very light split toning: cool shadows for the character, warm highlights for the crowd
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col += mix(vec3(-0.004, 0.0, 0.01), vec3(0.01, 0.004, -0.006), uMix) * (1.0 - l);

  float g = hash12(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5;
  col += g * uGrain * (0.6 + 0.8 * (1.0 - l));

  gl_FragColor = vec4(col, 1.0);
}
`;
