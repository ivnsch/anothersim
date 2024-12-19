import { mat4 } from "gl-matrix";
import { Entity } from "./entity";
import { Mesh } from "./mesh";

export class AxisLines extends Entity {
  mesh: Mesh | null = null;

  instancesBuffer: GPUBuffer;
  numInstances = 20; // remember to set this in *_axes_transforms in the shader too
  matrixFloatCount = 16; // 4x4 matrix
  matrixSize = 4 * this.matrixFloatCount;
  instancesMatrices = new Float32Array(
    this.matrixFloatCount * this.numInstances
  );

  constructor(
    device: GPUDevice,
    instancesBufferLabel: string,
    vertices: number[],
    meshTypeId: number,
    matrixCreator: (coord: number) => mat4
  ) {
    super(device, vertices, meshTypeId);

    this.initInstancesMatrices(matrixCreator);
    this.instancesBuffer = this.createInstancesBuffer(
      device,
      instancesBufferLabel
    );
  }

  private initInstancesMatrices = (matrixCreator: (coord: number) => mat4) => {
    const gridSpacing = 0.2;
    for (let i = 0; i < this.numInstances; i++) {
      const coord = (i - this.numInstances / 2) * gridSpacing;
      this.instancesMatrices.set(
        matrixCreator(coord),
        this.matrixFloatCount * i
      );
    }
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
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.buffer);
    pass.draw(6, this.numInstances);

    device.queue.writeBuffer(
      this.instancesBuffer,
      0,
      this.instancesMatrices.buffer,
      this.instancesMatrices.byteOffset,
      this.instancesMatrices.byteLength
    );
  };
}
