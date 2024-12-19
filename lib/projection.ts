import { mat4 } from "gl-matrix";
import { createMatrixUniformBuffer } from "./sim";

export class Projection {
  buffer: GPUBuffer;
  matrix: mat4;

  constructor(device: GPUDevice) {
    this.buffer = createMatrixUniformBuffer(device);
    this.matrix = createProjectionMatrix();
  }
}

const createProjectionMatrix = () => {
  const m = mat4.create();
  mat4.perspective(m, Math.PI / 4, 800 / 600, 0.1, 10);
  return m;
};
