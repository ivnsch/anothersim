import { vec3, mat4 } from "gl-matrix";
import { createMatrixUniformBuffer } from "./sim";

export class Camera {
  position: vec3;

  forwards: vec3;
  right: vec3;
  up: vec3;

  view: mat4 | null = null;

  pitch: number = 0;
  yaw: number = 0;
  roll: number = 0;

  buffer: GPUBuffer;

  constructor(device: GPUDevice, position: vec3) {
    this.position = position;

    this.forwards = vec3.create();
    this.right = vec3.create();
    this.up = vec3.create();

    this.buffer = createMatrixUniformBuffer(device);
  }

  update = () => {
    // euler -> cartesian, https://stackoverflow.com/a/1568687
    this.forwards = [
      -Math.sin(degToRad(this.yaw)) * Math.cos(degToRad(this.pitch)),
      Math.sin(degToRad(this.pitch)),
      -Math.cos(degToRad(this.yaw)) * Math.cos(degToRad(this.pitch)),
    ];

    // not sure I understand this, first cross with [0, 1, 0] and then calculate up based on this? but it works..
    vec3.cross(this.right, this.forwards, [0, 1, 0]);

    // up orthogonal to right and forwards
    vec3.cross(this.up, this.right, this.forwards);

    // the point where the camera looks at
    var target: vec3 = vec3.create();
    vec3.add(target, this.position, this.forwards);

    // translation
    // vec3.add(this.position, this.translation, this.position);

    this.view = mat4.create();
    mat4.lookAt(this.view, this.position, target, this.up);
  };

  matrix = (): mat4 => {
    return createMatrix(this.position, this.forwards, this.up);
  };
}

const createMatrix = (position: vec3, target: vec3, up: vec3) => {
  const m = mat4.create();
  mat4.lookAt(m, position, target, up);
  return m;
};

export function degToRad(angle: number): number {
  return (angle * Math.PI) / 180;
}
