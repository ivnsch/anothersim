import { vec3 } from "gl-matrix";
import { Entity } from "./entity";
import { ParsedObjFile } from "./obj_parser";

export class ObjFileEntity extends Entity {
  parsedObj: ParsedObjFile;

  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;

  indices: Uint16Array;

  constructor(device: GPUDevice, parsedObj: ParsedObjFile, id: number) {
    const vertices = parsedObj.vertices;

    super(device, vertices, id);
    this.parsedObj = parsedObj;
    this.vertexBuffer = device.createBuffer({
      size: vertices.length * 4, // vertices * 4 bytes per float
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const indices = this.parsedObj.indices;
    this.indices = new Uint16Array(indices);
    this.indexBuffer = device.createBuffer({
      size: indices.length * 4, // indices * 4 bytes per float
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    this.setScale(vec3.fromValues(1.5, 1, 1));
  }

  render = (device: GPUDevice, pass: GPURenderPassEncoder, time: number) => {
    pass.setBindGroup(0, this.bindGroup);

    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, "uint16");
    pass.drawIndexed(this.indices.length, 1);

    device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);
    device.queue.writeBuffer(this.indexBuffer, 0, this.indices);

    device.queue.writeBuffer(
      this.transformBuffer,
      0,
      this.transformMatrix as Float32Array
    );
  };
}
