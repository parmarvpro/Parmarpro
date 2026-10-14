/**
 * The scan band: a restrained cyan-white core with a faint blue halo. Deliberately thin, no lens
 * flare, no neon outline — most of the "scan" feeling comes from the particles it touches.
 */
export const scanVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const scanFragment = /* glsl */ `
uniform float uGate;
uniform float uTime;
uniform float uHeight;   // world height of the quad
uniform float uHdr;

varying vec2 vUv;

void main() {
  float dy = (vUv.y - 0.5) * uHeight;
  float core = exp(-(dy * dy) / (0.016 * 0.016));
  float halo = exp(-(dy * dy) / (0.16 * 0.16));
  float ends = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  // fine hologram texture travelling along the line
  float tex = 0.72 + 0.28 * sin(vUv.x * 140.0 - uTime * 5.0) * sin(vUv.x * 37.0 + uTime * 1.3);
  float k = uGate * ends;
  vec3 col = vec3(0.78, 0.97, 1.0) * core * 1.2 * tex + vec3(0.2, 0.5, 1.0) * halo * 0.26;
  col *= k;
  if (uHdr < 0.5) col = min(col, vec3(1.0));
  gl_FragColor = vec4(col, 1.0); // AdditiveBlending weights by alpha, so keep it at 1
}
`;
