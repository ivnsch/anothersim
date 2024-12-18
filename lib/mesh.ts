export class Mesh {
  buffer: GPUBuffer;
  bufferLayout: GPUVertexBufferLayout;

  private vertices: Float32Array;

  constructor(label: string, device: GPUDevice, vertices: Float32Array) {
    this.vertices = vertices;

    this.buffer = createDefaultBuffer(label, device, this.vertices);
    setDefaultVerticesInBuffer(this.buffer, this.vertices);

    this.bufferLayout = createDefaultBufferLayout();
  }
}

export const createDefaultBuffer = (
  label: string,
  device: GPUDevice,
  vertices: Float32Array
): GPUBuffer => {
  return device.createBuffer({
    label: label,
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
};

export const setDefaultVerticesInBuffer = (
  buffer: GPUBuffer,
  vertices: Float32Array
) => {
  new Float32Array(buffer.getMappedRange()).set(vertices);
  buffer.unmap();
};

export const createDefaultBufferLayout = (): GPUVertexBufferLayout => {
  return {
    arrayStride: 12, // 3 floats per vertex * 4 bytes per float
    attributes: [
      {
        // 3 floats, with 0 offset
        shaderLocation: 0,
        format: "float32x3",
        offset: 0,
      },
    ],
  };
};
