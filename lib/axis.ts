import { Entity } from "./entity";

// for now inheritance, may change
// these functions should be generic for all drawables anyway
export class Axis extends Entity {
  private static z = -2;

  constructor(device: GPUDevice, vertices: number[]) {
    // x y z
    // prettier-ignore
    super(device, vertices)
  }

  render = (device: GPUDevice, pass: GPURenderPassEncoder) => {
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.buffer);
    pass.draw(6, 1);

    device.queue.writeBuffer(
      this.transformBuffer,
      0,
      <ArrayBuffer>this.transformMatrix
    );
  };
}
