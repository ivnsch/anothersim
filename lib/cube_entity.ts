import { Entity } from "./entity";

// for now inheritance, may change
// these functions should be generic for all drawables anyway
export class CubeEntity extends Entity {
  private static z = -2;

  constructor(device: GPUDevice) {
    // x y z
    // prettier-ignore
    super(device, vertices(-4))
  }

  render = (device: GPUDevice, pass: GPURenderPassEncoder, time: number) => {
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.buffer);
    pass.draw(36, 1);

    device.queue.writeBuffer(
      this.transformBuffer,
      0,
      <ArrayBuffer>this.transformMatrix
    );
  };
}

const vertices = (z: number) => {
  const cubeSide = 2;
  // x y z
  // prettier-ignore
  return [
        // front
        -cubeSide / 2, -cubeSide / 2, z ,
        -cubeSide / 2, cubeSide / 2, z ,
        cubeSide / 2, -cubeSide / 2, z ,
        -cubeSide / 2, cubeSide / 2, z ,
        cubeSide / 2, cubeSide / 2, z ,
        cubeSide / 2, -cubeSide / 2, z ,
        // back
        -cubeSide / 2, -cubeSide / 2, -cubeSide + z ,
        -cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, -cubeSide / 2, -cubeSide + z ,
        -cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, -cubeSide / 2, -cubeSide + z ,
        // top
        -cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        -cubeSide / 2, cubeSide / 2, z ,
        cubeSide / 2, cubeSide / 2, z ,
        -cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, cubeSide / 2, z ,
        // right
        cubeSide / 2, cubeSide / 2, z ,
        cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, -cubeSide / 2, z ,
        cubeSide / 2, -cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, -cubeSide / 2, z ,
        // bottom
        -cubeSide / 2, -cubeSide / 2, -cubeSide + z ,
        -cubeSide / 2, -cubeSide / 2, z ,
        cubeSide / 2, -cubeSide / 2, z ,
        -cubeSide / 2, -cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, -cubeSide / 2, -cubeSide + z ,
        cubeSide / 2, -cubeSide / 2, z ,
        // left
        -cubeSide / 2, cubeSide / 2, z ,
        -cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        -cubeSide / 2, -cubeSide / 2, z ,
        -cubeSide / 2, -cubeSide / 2, -cubeSide + z ,
        -cubeSide / 2, cubeSide / 2, -cubeSide + z ,
        -cubeSide / 2, -cubeSide / 2, z ,
        // 0.0, 0.5, z, 
        // -0.5, -0.5, z, 
        // 0.5, -0.5, z,
    ]
};
