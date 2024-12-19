import { mat4, vec3 } from "gl-matrix";
import { AxisLines } from "./axis_lines";
import { xAxisVerticesNew, yAxisVertices, zAxisVerticesNew } from "./axis_mesh";
import { Camera } from "./camera";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import my_shader from "./shaders/screen_shader.wgsl";
import { Axis } from "./axis";
import { Entity } from "./entity";
import { CubeInstances } from "./cube_instances";
import { CubeDensityInstances } from "./cube_density_instances";
import { Projection } from "./projection";

export class Sim {
  adapter: GPUAdapter | null = null;
  device: GPUDevice | null = null;
  context: GPUCanvasContext;

  presentationFormat: GPUTextureFormat;
  pipeline: GPURenderPipeline | null = null;

  renderPassDescriptor: GPURenderPassDescriptor | null = null;

  projection: Projection | null = null;
  camera: Camera | null = null;

  entities: Entity[] = [];

  depthStencilResources: DepthBufferResources | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.presentationFormat = "bgra8unorm";
    this.context = <GPUCanvasContext>canvas.getContext("webgpu");
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

    const xAxisLines = new AxisLines(
      device,
      "x axes instances buffer (new)",
      xAxisVerticesNew(),
      0,
      createY0PlaneHorizontalLinesTranslationMatrix
    );
    const yAxis = new Axis(device, yAxisVertices(), 1);
    const zAxisLines = new AxisLines(
      device,
      "z axes instances buffer (new)",
      zAxisVerticesNew(),
      2,
      createY0PlaneVerticalLinesTranslationMatrix
    );
    const cubePositions = generateInitCubePositions(CubeInstances.numInstances);
    const cubeInstances = new CubeInstances(this.device, cubePositions, 3);
    const cubeDensityInstances = new CubeDensityInstances(
      this.device,
      cubePositions,
      4
    );

    this.entities = [
      yAxis,
      xAxisLines,
      zAxisLines,
      cubeInstances,
      cubeDensityInstances,
    ];

    this.context.configure({
      device: device,
      format: this.presentationFormat,
    });

    this.camera.buffer = createMatrixUniformBuffer(device);

    const bindGroupLayout = createBindGroupLayout(this.device);

    const bindGroupDeps = {
      device: this.device,
      bindGroupLayout: bindGroupLayout,
      cubeInstances: cubeInstances,
      cubeDensityInstances: cubeDensityInstances,
      projection: projection,
      cameraBuffer: this.camera.buffer!,
      xAxisLines: xAxisLines,
      zAxisLines: zAxisLines,
      yAxis: yAxis,
    };

    cubeInstances.initBindGroup(bindGroupDeps, "cube instances bind group");
    xAxisLines.initBindGroup(bindGroupDeps, "x axis bind group (new)");
    yAxis.initBindGroup(bindGroupDeps, "y axis bind group");
    zAxisLines.initBindGroup(bindGroupDeps, "z axis bind group (new)");
    cubeDensityInstances.initBindGroup(
      bindGroupDeps,
      "cube density instances bind group"
    );

    this.depthStencilResources = makeDepthBufferResources(device);

    this.pipeline = createPipeline(
      my_shader,
      device,
      this.presentationFormat,
      cubeInstances.bufferLayout,
      bindGroupLayout,
      this.depthStencilResources.depthStencilState
    );
  };

  private createCurrentTextureView = (): GPUTextureView => {
    return this.context.getCurrentTexture().createView();
  };

  private initRenderPassDescriptor = (
    depthStencilAttachment: GPURenderPassDepthStencilAttachment
  ) => {
    const descriptor = createRenderPassDescriptor(
      this.createCurrentTextureView(),
      depthStencilAttachment
    );
    this.renderPassDescriptor = descriptor;
  };

  render = (time: number) => {
    if (!this.depthStencilResources) {
      return;
    }
    // TODO does this really have to be inialized in render?
    this.initRenderPassDescriptor(
      this.depthStencilResources.depthStencilAttachment
    );

    if (
      !(
        this.device &&
        this.renderPassDescriptor &&
        this.pipeline &&
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
      this.renderPassDescriptor,
      this.pipeline,
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
  renderPassDescriptor: GPURenderPassDescriptor,
  pipeline: GPURenderPipeline,
  entities: Entity[],
  projection: Projection,
  camera: Camera
) => {
  camera.update();

  const encoder = device.createCommandEncoder({ label: "our encoder" });

  const pass = encoder.beginRenderPass(renderPassDescriptor);
  pass.setPipeline(pipeline);

  entities.forEach((entity) => {
    entity.render(device, pass, time);
  });

  pass.end();

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);

  device.queue.writeBuffer(
    projection.buffer,
    0,
    <ArrayBuffer>projection.matrix
  );
  device.queue.writeBuffer(camera.buffer, 0, <ArrayBuffer>camera.matrix());
};

const createRenderPassDescriptor = (
  view: GPUTextureView,
  depthStencilAttachment: GPURenderPassDepthStencilAttachment
): GPURenderPassDescriptor => {
  return {
    label: "our basic canvas renderPass",
    colorAttachments: [
      {
        view: view,
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: "clear",
        storeOp: "store",
      },
    ],
    depthStencilAttachment: depthStencilAttachment,
  };
};

const createBindGroupLayout = (device: GPUDevice): GPUBindGroupLayout => {
  return device.createBindGroupLayout({
    label: "my bind group layout",
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 5, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 6, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 7, visibility: GPUShaderStage.VERTEX, buffer: {} },
      { binding: 8, visibility: GPUShaderStage.VERTEX, buffer: {} },
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
};

export const createBindGroup = (
  label: string,
  device: GPUDevice,
  bindGroupLayout: GPUBindGroupLayout,
  cubeInstances: CubeInstances,
  cubeDensityInstances: CubeDensityInstances,
  projection: Projection,
  cameraBuffer: GPUBuffer,
  meshTypeBuffer: GPUBuffer,
  xAxisLines: AxisLines,
  zAxisLines: AxisLines
): GPUBindGroup => {
  return device.createBindGroup({
    label: label,
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: projection.buffer } },
      { binding: 1, resource: { buffer: cameraBuffer } },
      { binding: 2, resource: { buffer: meshTypeBuffer } },
      { binding: 3, resource: { buffer: xAxisLines.instancesBuffer } },
      { binding: 4, resource: { buffer: zAxisLines.instancesBuffer } },
      { binding: 5, resource: { buffer: cubeInstances.instancesBuffer } },
      { binding: 6, resource: { buffer: cubeInstances.colorsBuffer } },
      {
        binding: 7,
        resource: { buffer: cubeDensityInstances.instancesBuffer },
      },
      { binding: 8, resource: { buffer: cubeDensityInstances.colorsBuffer } },
    ],
  });
};

const createPipeline = (
  shader: string,
  device: GPUDevice,
  presentationFormat: GPUTextureFormat,
  cubeBuffer: GPUVertexBufferLayout,
  bindGroupLayout: GPUBindGroupLayout,
  depthStencilState: GPUDepthStencilState
): GPURenderPipeline => {
  const layout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  return device.createRenderPipeline({
    label: "my pipeline",
    layout: layout,
    vertex: {
      module: device.createShaderModule({ code: shader }),
      entryPoint: "vs_main",
      buffers: [cubeBuffer],
    },
    fragment: {
      module: device.createShaderModule({ code: shader }),
      entryPoint: "fs_main",
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      topology: "triangle-list",
    },
    depthStencil: depthStencilState,
  });
};

const makeDepthBufferResources = (device: GPUDevice): DepthBufferResources => {
  const depthStencilState = {
    format: "depth24plus-stencil8",
    depthWriteEnabled: true,
    depthCompare: "less-equal",
  };

  const size: GPUExtent3D = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    depthOrArrayLayers: 1,
  };

  const depthBufferDescriptor: GPUTextureDescriptor = {
    size: size,
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  };

  const depthStencilBuffer = device.createTexture(depthBufferDescriptor);

  const viewDescriptor: GPUTextureViewDescriptor = {
    format: "depth24plus-stencil8",
    dimension: "2d",
    aspect: "all",
  };
  const depthStencilView = depthStencilBuffer.createView();

  const depthStencilAttachment = {
    view: depthStencilView,
    depthClearValue: 1.0,
    depthLoadOp: "clear",
    depthStoreOp: "store",
    stencilLoadOp: "clear",
    stencilStoreOp: "discard",
  };

  return {
    depthStencilState,
    depthStencilBuffer,
    depthStencilView,
    depthStencilAttachment,
  };
};

type DepthBufferResources = {
  depthStencilState: GPUDepthStencilState;
  depthStencilBuffer: GPUTexture;
  depthStencilView: GPUTextureView;
  depthStencilAttachment: GPURenderPassDepthStencilAttachment;
};

export const createIdentityMatrix = () => {
  const m = mat4.create();
  mat4.identity(m);
  return m;
};

export const origin = () => {
  const m = vec3.create();
  vec3.zero(m);
  return m;
};

export const createMatrixUniformBuffer = (device: GPUDevice): GPUBuffer => {
  return device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
};

export const createMeshTypeUniformBuffer = (device: GPUDevice): GPUBuffer => {
  return device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
};

export const createZ0PlaneHorizontalLinesTranslationMatrix = (
  y: number
): mat4 => {
  const m = mat4.create();
  mat4.fromTranslation(m, vec3.fromValues(0, y, 0));
  return m;
};

export const createY0PlaneHorizontalLinesTranslationMatrix = (
  z: number
): mat4 => {
  const m = mat4.create();
  mat4.fromTranslation(m, vec3.fromValues(0, 0, z));
  return m;
};

export const createY0PlaneVerticalLinesTranslationMatrix = (
  x: number
): mat4 => {
  const m = mat4.create();
  mat4.fromTranslation(m, vec3.fromValues(x, 0, 0));
  return m;
};

const generateInitCubePositions = (cubeCount: number): vec3[] => {
  let positions = [];
  for (let i = 0; i < cubeCount; i++) {
    const m = mat4.create();
    mat4.identity(m);
    // random position on y = 0 plane
    const bound = 4; // TODO derive
    const randomX = Math.random() * bound - bound / 2;
    const randomZ = Math.random() * bound - bound / 2;
    const randomY = Math.random() * bound - bound / 2;
    const v = vec3.fromValues(randomX, randomY, randomZ);
    positions.push(v);
  }
  return positions;
};
