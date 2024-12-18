import { mat4, vec3 } from "gl-matrix";
import { Entity } from "./entity";
import { vertices } from "./cube_entity";

// for now inheritance, may change
// these functions should be generic for all drawables anyway
export class CubeInstances extends Entity {
  private lastTime: number = 0;
  private velocity: vec3 = vec3.fromValues(0, 0, 0);

  instancesBuffer: GPUBuffer;
  numInstances = 100; // remember to set this in *_axes_transforms in the shader too
  matrixFloatCount = 16; // 4x4 matrix
  matrixSize = 4 * this.matrixFloatCount;
  private matrices: mat4[] = [];
  instancesMatrices = new Float32Array(
    this.matrixFloatCount * this.numInstances
  );

  constructor(device: GPUDevice) {
    // x y z
    // prettier-ignore
    super(device, vertices(-4))

    this.initInstancesMatrices();
    this.instancesBuffer = this.createInstancesBuffer(device, "cube instances");
  }

  private initInstancesMatrices = () => {
    for (let i = 0; i < this.numInstances; i++) {
      const m = mat4.create();
      mat4.identity(m);
      const randomX = Math.random() * 6 - 3;
      const randomZ = Math.random() * 6 - 3;
      const v = vec3.fromValues(randomX, 0, randomZ);
      mat4.translate(m, m, v);
      const scale = 0.1;
      const scaleV = vec3.fromValues(scale, scale, scale);
      mat4.scale(m, m, scaleV);
      this.matrices.push(m);
    }
    this.updateInstanceMatrices();
  };

  // updates instance matrices to match matrices
  private updateInstanceMatrices = () => {
    this.matrices.forEach((matrix, index) => {
      this.instancesMatrices.set(matrix, this.matrixFloatCount * index);
    });
  };

  private createInstancesBuffer = (
    device: GPUDevice,
    label: string
  ): GPUBuffer => {
    const xAxesInstancesBufferSize = this.numInstances * this.matrixSize;
    return device.createBuffer({
      label: label,
      size: xAxesInstancesBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  };

  render = (device: GPUDevice, pass: GPURenderPassEncoder, time: number) => {
    const seconds = time / 1000;
    const timeDelta = seconds - this.lastTime;

    // in the first iteration timeDelta is too large
    // the cube would start with a noticeable offset
    // so we just store the time and exit
    if (!this.lastTime) {
      this.lastTime = seconds;
      return;
    }

    const velocityDelta = vec3.create();
    vec3.scale(velocityDelta, vec3.fromValues(0, 1, 0), -9.8 * timeDelta);
    vec3.add(this.velocity, this.velocity, velocityDelta);
    vec3.scale(this.velocity, this.velocity, 0.01); // slow down for better visualization

    const positionDelta = vec3.create();
    vec3.scale(positionDelta, this.velocity, timeDelta);

    this.matrices.forEach((matrix) => {
      mat4.translate(matrix, matrix, positionDelta);
    });
    this.updateInstanceMatrices();
    // mat4.translate(this.transformMatrix, this.transformMatrix, positionDelta);

    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.buffer);
    pass.draw(36, this.numInstances);

    device.queue.writeBuffer(
      this.instancesBuffer,
      0,
      this.instancesMatrices.buffer,
      this.instancesMatrices.byteOffset,
      this.instancesMatrices.byteLength
    );
  };
}
