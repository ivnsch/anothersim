import { vec3 } from "gl-matrix";
import { Axis } from "./axis";
import { AxisLines } from "./axis_lines";
import { Camera } from "./camera";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import { CubeDensityInstances } from "./cube_density_instances";
import { CubeInstances } from "./cube_instances";
import { Entity } from "./entity";
import { ObjFileEntity } from "./obj_file_entity";
import { ParsedObjFile } from "./obj_parser";
import { Projection } from "./projection";
import my_compute_shader from "./shaders/compute.wgsl";
import my_screen_shader from "./shaders/vertex_frag.wgsl";

export class Sim2d {
  adapter: GPUAdapter | null = null;
  device: GPUDevice | null = null;
  context: GPUCanvasContext;

  presentationFormat: GPUTextureFormat;
  renderPipeline: GPURenderPipeline | null = null;
  computePipeline: GPUComputePipeline | null = null;

  renderPassDescriptor: GPURenderPassDescriptor | null = null;

  projection: Projection | null = null;
  camera: Camera | null = null;

  entities: Entity[] = [];

  objFile: ParsedObjFile;

  colorBuffer: ColorBuffer | null = null;
  sampler: GPUSampler | null = null;

  computeBindGroup: GPUBindGroup | null = null;
  renderBindGroup: GPUBindGroup | null = null;

  constructor(canvas: HTMLCanvasElement, objFile: ParsedObjFile) {
    this.presentationFormat = "bgra8unorm";
    this.context = <GPUCanvasContext>canvas.getContext("webgpu");
    this.objFile = objFile;
  }

  init = async (navigator: Navigator, cameraPos: vec3) => {
    const adapter = <GPUAdapter>await navigator.gpu?.requestAdapter();
    if (adapter) {
      const device = <GPUDevice>await adapter.requestDevice();
      this.initInternal(adapter, device, cameraPos);
    } else {
      console.log("error: no adapter");
    }
  };

  private initInternal = async (
    adapter: GPUAdapter,
    device: GPUDevice,
    cameraPos: vec3
  ) => {
    this.adapter = adapter;
    this.device = device;

    const projection = new Projection(device);
    this.projection = projection;
    const camera = new Camera(device, cameraPos);
    this.camera = camera;

    const colorBuffer = initColorBuffer(device);
    this.colorBuffer = colorBuffer;
    const sampler = createSampler(device);
    this.sampler = sampler;

    this.entities = [];

    this.context.configure({
      device: device,
      format: this.presentationFormat,
    });

    this.camera.buffer = createMatrixUniformBuffer(device);

    const renderBindGroupLayout = createRenderBindGroupLayout(this.device);
    this.renderBindGroup = createRenderBindGroup(
      renderBindGroupLayout,
      device,
      sampler,
      colorBuffer
    );
    this.renderPipeline = createRenderPipeline(
      my_screen_shader,
      device,
      this.presentationFormat,
      renderBindGroupLayout
    );

    const computeBindGroupLayout = createComputeBindGroupLayout(device);
    this.computeBindGroup = createComputeBindGroup(
      computeBindGroupLayout,
      device,
      this.colorBuffer,
      camera,
      projection
    );
    this.computePipeline = createComputePipeline(
      my_compute_shader,
      device,
      computeBindGroupLayout
    );
  };

  render = (time: number) => {
    if (
      !(
        this.device &&
        this.context &&
        this.computePipeline &&
        this.computeBindGroup &&
        this.renderPipeline &&
        this.renderBindGroup &&
        this.projection &&
        this.camera
      )
    ) {
      console.log("missing deps, can't render");
      return;
    }

    render(
      time,
      this.device,
      this.context,
      this.computePipeline,
      this.computeBindGroup,
      this.renderPipeline,
      this.renderBindGroup,
      this.entities,
      this.projection,
      this.camera
    );
  };

  setCameraEulers = (pitch: number, yaw: number, roll: number) => {
    if (!this.camera) return;

    this.camera.pitch = pitch;
    this.camera.yaw = yaw;
    this.camera.roll = roll;
  };

  setCameraTranslation = (translation: vec3) => {
    if (!this.camera) return;

    this.camera.position = translation;
  };
}

const render = (
  time: number,
  device: GPUDevice,
  context: GPUCanvasContext,
  computePipeline: GPUComputePipeline,
  computeBindGroup: GPUBindGroup,
  renderPipeline: GPURenderPipeline,
  renderBindGroup: GPUBindGroup,
  entities: Entity[],
  projection: Projection,
  camera: Camera
) => {
  camera.update();

  const commandEncoder: GPUCommandEncoder = device.createCommandEncoder();

  computePass(commandEncoder, computePipeline, computeBindGroup);
  renderPass(
    time,
    device,
    commandEncoder,
    renderPipeline,
    renderBindGroup,
    context,
    entities
  );

  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);

  device.queue.writeBuffer(
    projection.buffer,
    0,
    projection.matrix as Float32Array
  );
  device.queue.writeBuffer(camera.buffer, 0, camera.matrix() as Float32Array);
};

const computePass = (
  commandEncoder: GPUCommandEncoder,
  computePipeline: GPUComputePipeline,
  computeBindGroup: GPUBindGroup
) => {
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, computeBindGroup);
  computePass.dispatchWorkgroups(
    Math.floor((CANVAS_WIDTH + 7) / 8),
    Math.floor((CANVAS_HEIGHT + 7) / 8),
    1
  );
  computePass.end();
};

const renderPass = (
  time: number,
  device: GPUDevice,
  commandEncoder: GPUCommandEncoder,
  renderPipeline: GPURenderPipeline,
  renderBindGroup: GPUBindGroup,
  context: GPUCanvasContext,
  entities: Entity[]
) => {
  const textureView: GPUTextureView = context.getCurrentTexture().createView();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  renderPass.setPipeline(renderPipeline);
  renderPass.setBindGroup(0, renderBindGroup);
  renderPass.draw(6, 1, 0, 0);
  entities.forEach((entity) => {
    entity.render(device, renderPass, time);
  });
  renderPass.end();
};

const createRenderBindGroupLayout = (device: GPUDevice): GPUBindGroupLayout => {
  return device.createBindGroupLayout({
    label: "my render bind group layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
    ],
  });
};

const createComputeBindGroupLayout = (
  device: GPUDevice
): GPUBindGroupLayout => {
  return device.createBindGroupLayout({
    label: "my compute bind group layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: "write-only",
          format: "rgba8unorm",
          viewDimension: "2d",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {},
      },
    ],
  });
};

export type BindGroupDeps = {
  device: GPUDevice;
  bindGroupLayout: GPUBindGroupLayout;
  yAxis: Axis;
  xAxisLines: AxisLines;
  zAxisLines: AxisLines;
  cubeInstances: CubeInstances;
  cubeDensityInstances: CubeDensityInstances;
  cameraBuffer: GPUBuffer;
  projection: Projection;
  objFile: ObjFileEntity;
};

const createComputePipeline = (
  shader: string,
  device: GPUDevice,
  bindGroupLayout: GPUBindGroupLayout
): GPUComputePipeline => {
  const layout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  return device.createComputePipeline({
    layout: layout,

    compute: {
      module: device.createShaderModule({
        code: shader,
      }),
      entryPoint: "main",
    },
  });
};

const createRenderPipeline = (
  shader: string,
  device: GPUDevice,
  presentationFormat: GPUTextureFormat,
  bindGroupLayout: GPUBindGroupLayout
): GPURenderPipeline => {
  const layout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  return device.createRenderPipeline({
    label: "my screen shader pipeline",
    layout: layout,
    vertex: {
      module: device.createShaderModule({ code: shader }),
      entryPoint: "vert_main",
    },
    fragment: {
      module: device.createShaderModule({ code: shader }),
      entryPoint: "frag_main",
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none", // No face culling
    },
  });
};

export const createMatrixUniformBuffer = (device: GPUDevice): GPUBuffer => {
  return device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
};

class ColorBuffer {
  buffer: GPUTexture;
  view: GPUTextureView;

  constructor(buffer: GPUTexture, view: GPUTextureView) {
    this.buffer = buffer;
    this.view = view;
  }
}

const initColorBuffer = (device: GPUDevice): ColorBuffer => {
  const buffer = device.createTexture({
    size: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING,
  });

  return new ColorBuffer(buffer, buffer.createView());
};

const createSampler = (device: GPUDevice): GPUSampler => {
  const samplerDescriptor: GPUSamplerDescriptor = {
    addressModeU: "repeat",
    addressModeV: "repeat",
    magFilter: "linear",
    minFilter: "nearest",
    mipmapFilter: "nearest",
    maxAnisotropy: 1,
  };
  return device.createSampler(samplerDescriptor);
};

const createComputeBindGroup = (
  layout: GPUBindGroupLayout,
  device: GPUDevice,
  colorBuffer: ColorBuffer,
  camera: Camera,
  projection: Projection
): GPUBindGroup => {
  return device.createBindGroup({
    layout: layout,
    entries: [
      {
        binding: 0,
        resource: colorBuffer.view,
      },
      {
        binding: 1,
        resource: {
          buffer: projection.buffer,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: camera.buffer,
        },
      },
    ],
  });
};

const createRenderBindGroup = (
  layout: GPUBindGroupLayout,
  device: GPUDevice,
  sampler: GPUSampler,
  colorBuffer: ColorBuffer
): GPUBindGroup => {
  return device.createBindGroup({
    layout: layout,
    entries: [
      {
        binding: 0,
        resource: sampler,
      },
      {
        binding: 1,
        resource: colorBuffer.view,
      },
    ],
  });
};
