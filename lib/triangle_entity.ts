import { mat4, vec3 } from "gl-matrix";
import { Entity } from "./entity";
import { THROWAWAY_ID } from "./constants";

// for now inheritance, may change
// these functions should be generic for all drawables anyway
export class TriangleEntity extends Entity {
  private static z = -2;

  constructor(device: GPUDevice) {
    // x y z
    // prettier-ignore
    super(device, [
          0.0, 0.5, TriangleEntity.z, 
          -0.5, -0.5, TriangleEntity.z, 
          0.5, -0.5, TriangleEntity.z,
      ], THROWAWAY_ID)
  }

  center = (): vec3 => {
    return vec3.fromValues(
      (this.vertices[0] + this.vertices[3] + this.vertices[6]) / 3,
      (this.vertices[1] + this.vertices[4] + this.vertices[7]) / 3,
      TriangleEntity.z
    );
  };

  translationToOrigin = (): vec3 => {
    const c = this.center();
    const v = vec3.create();
    // invert
    vec3.scale(v, c, -1);
    return v;
  };
}
