/**
 * GLSL noise toolkit shared by the particle and background shaders.
 *
 * - PCG integer hash: bit-exact on every GPU (sin()-based hashes drift between vendors), which
 *   keeps the whole animation deterministic.
 * - Value noise with analytic derivatives (Quilez), so a curl needs three evaluations instead of
 *   the eighteen a finite-difference curl would.
 */
export const NOISE_GLSL = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718

uint hashU(uint x) {
  uint state = x * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

float hash11(float p) {
  return float(hashU(uint(int(floor(p))))) * (1.0 / 4294967295.0);
}

float hash31(vec3 p) {
  ivec3 i = ivec3(floor(p));
  uint h = hashU(uint(i.x) ^ hashU(uint(i.y) ^ hashU(uint(i.z))));
  return float(h) * (1.0 / 4294967295.0);
}

// Value noise in [0,1] with its gradient: returns (value, d/dx, d/dy, d/dz).
vec4 noised(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec3 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);

  float a = hash31(i + vec3(0.0, 0.0, 0.0));
  float b = hash31(i + vec3(1.0, 0.0, 0.0));
  float c = hash31(i + vec3(0.0, 1.0, 0.0));
  float d = hash31(i + vec3(1.0, 1.0, 0.0));
  float e = hash31(i + vec3(0.0, 0.0, 1.0));
  float g = hash31(i + vec3(1.0, 0.0, 1.0));
  float h = hash31(i + vec3(0.0, 1.0, 1.0));
  float k = hash31(i + vec3(1.0, 1.0, 1.0));

  float k1 = b - a;
  float k2 = c - a;
  float k3 = e - a;
  float k4 = a - b - c + d;
  float k5 = a - c - e + h;
  float k6 = a - b - e + g;
  float k7 = -a + b + c - d + e - g - h + k;

  return vec4(
    a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
    du * vec3(
      k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
      k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x,
      k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y
    )
  );
}

// Divergence-free flow: curl of a vector potential made of three decorrelated noise fields.
// Particles advected by it swirl and stream without clumping or draining.
vec3 curlNoise(vec3 p) {
  vec3 g1 = noised(p).yzw;
  vec3 g2 = noised(p + vec3(31.416, 17.2, 7.7)).yzw;
  vec3 g3 = noised(p + vec3(-19.1, 43.7, 11.3)).yzw;
  return vec3(g3.y - g2.z, g1.z - g3.x, g2.x - g1.y);
}

float smoother(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

vec2 rotAbout(vec2 p, vec2 c, float a) {
  float s = sin(a);
  float co = cos(a);
  vec2 d = p - c;
  return c + vec2(co * d.x - s * d.y, s * d.x + co * d.y);
}
`;
