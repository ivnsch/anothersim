import { mat4, vec3 } from "gl-matrix";
import {
  createDefaultBuffer,
  createDefaultBufferLayout,
  setDefaultVerticesInBuffer,
} from "./mesh";
import {
  createIdentityMatrix,
  createMatrixUniformBuffer,
  createMeshTypeUniformBuffer,
} from "./sim";
import { setObjPitch, setObjRoll, setObjYaw, trans } from "./matrix_3x3";

export class Entity {
  vertices: Float32Array;

  buffer: GPUBuffer;
  bufferLayout: GPUVertexBufferLayout;

  bindGroup: GPUBindGroup | null = null;

  transformBuffer: GPUBuffer;
  transformMatrix: mat4 = createIdentityMatrix();

  meshTypeBuffer: GPUBuffer | null = null;

  constructor(device: GPUDevice, vertices: number[]) {
    this.vertices = new Float32Array(vertices);

    this.buffer = createDefaultBuffer("triangle mesh", device, this.vertices);
    setDefaultVerticesInBuffer(this.buffer, this.vertices);
    this.bufferLayout = createDefaultBufferLayout();

    this.transformBuffer = createMatrixUniformBuffer(device);
  }

  initialize = () => {};

  initMeshType = (device: GPUDevice, id: number) => {
    this.meshTypeBuffer = createMeshTypeUniformBuffer(device);
    new Uint32Array(this.meshTypeBuffer.getMappedRange()).set([id]);
    this.meshTypeBuffer.unmap();
  };

  render = (device: GPUDevice, pass: GPURenderPassEncoder, time: number) => {
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.buffer);
    pass.draw(3, 1);

    device.queue.writeBuffer(
      this.transformBuffer,
      0,
      <ArrayBuffer>this.transformMatrix
    );
  };

  center = (): vec3 => {
    return vec3.create();
  };

  translationToOrigin = (): vec3 => {
    return vec3.create();
  };

  setEulers = (pitch: number, yaw: number, roll: number) => {
    // translate to origin
    const transVec = this.translationToOrigin();
    // const transVec = this.cubeMesh.translationToOrigin();
    const transMatrix = trans(transVec);

    // rotate
    const pitchMatrix = setObjPitch(pitch);
    const yawMatrix = setObjYaw(yaw);
    const rollMatrix = setObjRoll(roll);

    // translate back to original position
    const negatedTransVec = vec3.create();
    vec3.negate(negatedTransVec, transVec);
    const transBackMatrix = trans(negatedTransVec);

    const rotations = mat4.create();

    // note inverse order
    mat4.multiply(rotations, yawMatrix, transBackMatrix);
    mat4.multiply(rotations, pitchMatrix, rotations);
    mat4.multiply(rotations, rollMatrix, rotations);
    mat4.multiply(rotations, transMatrix, rotations);

    // // debug - apply the transform to some point (and compare with manual calculation)
    // const testPoint = vec4.fromValues(0, 0, -2, 1);
    // const transformed = vec4.create();
    // vec4.transformMat4(transformed, testPoint, rotations);

    const transposed = mat4.create();
    mat4.transpose(transposed, rotations);

    // not sure why it's needed to transpose,
    // gl-matrix and webgpu are both supposed to use column-major?
    // added it because noticed transposing fixes rotation (not rotating around center)
    // this.rotMatrix = rotations;
    this.transformMatrix = transposed;
    // this.cubeEulersMatrix = transposed;
  };

  setPosition = (pos: vec3) => {
    mat4.translate(this.transformMatrix, this.transformMatrix, pos);
  };
}
