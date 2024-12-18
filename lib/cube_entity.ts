import { mat4, vec2, vec3 } from "gl-matrix";
import { Entity } from "./entity";
import { prettyPrintMat4 } from "./matrix_3x3";

// for now inheritance, may change
// these functions should be generic for all drawables anyway
export class CubeEntity extends Entity {
  private lastTime: number = 0;
  private velocity: vec3 = vec3.fromValues(0, 0, 0);

  constructor(device: GPUDevice) {
    // x y z
    // prettier-ignore
    super(device, vertices(-4))
  }

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

    mat4.translate(this.transformMatrix, this.transformMatrix, positionDelta);

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

export const vertices = (z: number) => {
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
