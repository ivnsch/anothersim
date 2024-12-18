import { mat4, vec3 } from "gl-matrix";

export class Matrix3x3 {
  private values: number[];

  constructor(values: number[]) {
    if (values.length !== 9) {
      throw new Error("Matrix must have 9 elements.");
    }
    this.values = values;
  }

  toGlMatrix = (): mat4 => {
    let gl = mat4.create();
    gl[0] = this.values[0];
    gl[1] = this.values[1];
    gl[2] = this.values[2];
    gl[3] = 0;

    gl[4] = this.values[3];
    gl[5] = this.values[4];
    gl[6] = this.values[5];
    gl[7] = 0;

    gl[8] = this.values[6];
    gl[9] = this.values[7];
    gl[10] = this.values[8];
    gl[11] = 0;

    gl[12] = 0;
    gl[13] = 0;
    gl[14] = 0;
    gl[15] = 1;

    return gl;
  };
}

export const setObjPitch = (angle: number): mat4 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // prettier-ignore
  return mat4.fromValues(
          1, 0, 0, 0,
          0, cos, -sin, 0,
          0, sin, cos, 0,
          0, 0, 0, 1
      );
};

export const setObjYaw = (angle: number): mat4 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // prettier-ignore
  return mat4.fromValues(
          cos, 0, sin, 0,
          0, 1, 0, 0,
          -sin, 0, cos, 0,
          0, 0, 0, 1
      );
};

export const setObjRoll = (angle: number): mat4 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // prettier-ignore
  return mat4.fromValues(
              cos, -sin, 0, 0,
              sin, cos, 0, 0,
              0, 0, 1, 0,
              0, 0, 0, 1
          );
};

export const trans = (vec: vec3): mat4 => {
  // prettier-ignore
  return mat4.fromValues(
          1, 0, 0, vec[0],
          0, 1, 0, vec[1],
          0, 0, 1, vec[2],
          0, 0 ,0 ,1 
      );
};

export const prettyPrintMat4 = (m: mat4) => {
  // prettier-ignore
  console.log(`
  [ ${m[0].toFixed(2)}, ${m[1].toFixed(2)}, ${m[2].toFixed(2)}, ${m[3].toFixed(2)} ]
  [ ${m[4].toFixed(2)}, ${m[5].toFixed(2)}, ${m[6].toFixed(2)}, ${m[7].toFixed(2)} ]
  [ ${m[8].toFixed(2)}, ${m[9].toFixed(2)}, ${m[10].toFixed(2)}, ${m[11].toFixed(2)} ]
  [ ${m[12].toFixed(2)}, ${m[13].toFixed(2)}, ${m[14].toFixed(2)}, ${m[15].toFixed(2)} ]
    `);
};
