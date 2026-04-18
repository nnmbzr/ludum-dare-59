/* eslint-disable @typescript-eslint/no-explicit-any */
import { Filter, GlProgram } from 'pixi.js';

const vertex = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`;

const fragment = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uStrength;
  uniform float uSpotSize;
  uniform vec2 uCenter;

  void main(void) {
    vec2 uv = vTextureCoord;

    // Normalize to [-1, 1] around center
    vec2 centered = (uv - uCenter) * 2.0;
    float r = length(centered);

    // Smoothly ramp distortion from 0 inside spot to full outside
    float t = smoothstep(uSpotSize, uSpotSize + max(uSpotSize * 0.5, 0.05), r);
    float distorted = 1.0 + t * uStrength * r * r;

    vec2 distortedUV = uCenter + (centered / distorted) * 0.5;
    distortedUV = clamp(distortedUV, 0.0, 1.0);

    finalColor = texture(uTexture, distortedUV);
  }
`;

/** Fisheye (barrel distortion) filter for a first-person room perspective */
export class FisheyeFilter extends Filter {
  /** mouseRange: scale factor for mouse input (0 = fixed center, 1 = full 1:1 mapping) */
  public mouseRange = 0.3;

  constructor(strength = 0.25, spotSize = 0.3) {
    const glProgram = GlProgram.from({ vertex, fragment });

    super({
      glProgram,
      resources: {
        fisheyeUniforms: {
          uStrength: { value: strength, type: 'f32' },
          uSpotSize: { value: spotSize, type: 'f32' },
          uCenter: { value: [0.5, 0.5], type: 'vec2<f32>' },
        },
      },
    });
  }

  get strength(): number {
    return (this.resources.fisheyeUniforms as any).uniforms.uStrength;
  }

  set strength(value: number) {
    (this.resources.fisheyeUniforms as any).uniforms.uStrength = value;
  }

  /** Radius in [-1..1] space where distortion fades to zero (0 = no clear spot) */
  get spotSize(): number {
    return (this.resources.fisheyeUniforms as any).uniforms.uSpotSize;
  }

  set spotSize(value: number) {
    (this.resources.fisheyeUniforms as any).uniforms.uSpotSize = value;
  }

  /** Set distortion center from mouse UV; mouseRange scales how far center can move from 0.5 */
  setCenter(u: number, v: number): void {
    (this.resources.fisheyeUniforms as any).uniforms.uCenter[0] = 0.5 + (u - 0.5) * this.mouseRange;
    (this.resources.fisheyeUniforms as any).uniforms.uCenter[1] = 0.5 + (v - 0.5) * this.mouseRange;
  }
}
