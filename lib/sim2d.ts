import { vec3, vec4 } from "gl-matrix";
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
import points_shader from "./shaders/points_render_shader.wgsl";
import { DensityLayer } from "./density_layer";

export class Sim2d {
  adapter: GPUAdapter | null = null;
  device: GPUDevice | null = null;
  context: GPUCanvasContext;

  presentationFormat: GPUTextureFormat;

  renderPipeline: GPURenderPipeline | null = null;
  computePipeline: GPUComputePipeline | null = null;
  renderPointsPipeline: GPURenderPipeline | null = null;

  renderPassDescriptor: GPURenderPassDescriptor | null = null;

  projection: Projection | null = null;
  camera: Camera | null = null;

  entities: Entity[] = [];

  colorBuffer: ColorBuffer | null = null;
  sampler: GPUSampler | null = null;

  computeBindGroup: GPUBindGroup | null = null;
  renderBindGroup: GPUBindGroup | null = null;
  renderPointsBindGroup: GPUBindGroup | null = null;

  densityLayer: DensityLayer | null = null;

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

    const colorBuffer = initColorBuffer(device);
    this.colorBuffer = colorBuffer;
    const sampler = createSampler(device);
    this.sampler = sampler;

    const points: vec4[] = [];
    // for (let index = 0; index < DensityLayer.POINTS_COUNT; index++) {
    //   points.push(
    //     vec4.fromValues(
    //       Math.random() * CANVAS_WIDTH,
    //       Math.random() * CANVAS_HEIGHT,
    //       0,
    //       0
    //     )
    //   );
    // }
    populate(points);
    const densityLayer = new DensityLayer(device, points);
    this.densityLayer = densityLayer;

    this.entities = [densityLayer];

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
      projection,
      densityLayer
    );
    this.computePipeline = createComputePipeline(
      my_compute_shader,
      device,
      computeBindGroupLayout
    );

    const renderPointsBindGroupLayout = createRenderPointsBindGroupLayout(
      this.device
    );
    this.renderPointsBindGroup = createRenderPointsBindGroup(
      renderPointsBindGroupLayout,
      device,
      densityLayer.pointsBuffer
    );
    this.renderPointsPipeline = createRenderPointsPipeline(
      points_shader,
      device,
      this.presentationFormat,
      renderPointsBindGroupLayout
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
        this.renderPointsPipeline &&
        this.renderPointsBindGroup &&
        this.projection &&
        this.camera &&
        this.densityLayer
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
      this.renderPointsPipeline,
      this.renderPointsBindGroup,
      this.entities,
      this.projection,
      this.camera,
      this.densityLayer
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

// note that entities are only for the render pass / pipeline
// compute and render-points don't use them
// TODO structure this better
const render = (
  time: number,
  device: GPUDevice,
  context: GPUCanvasContext,
  computePipeline: GPUComputePipeline,
  computeBindGroup: GPUBindGroup,
  renderPipeline: GPURenderPipeline,
  renderBindGroup: GPUBindGroup,
  renderPointsPipeline: GPURenderPipeline,
  renderPointsBindGroup: GPUBindGroup,
  entities: Entity[],
  projection: Projection,
  camera: Camera,
  densityLayer: DensityLayer
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
  renderPointsPass(
    device,
    commandEncoder,
    renderPointsPipeline,
    renderPointsBindGroup,
    context,
    densityLayer
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

const renderPointsPass = (
  device: GPUDevice,
  commandEncoder: GPUCommandEncoder,
  pipeline: GPURenderPipeline,
  bindGroup: GPUBindGroup,
  context: GPUCanvasContext,
  densityLayer: DensityLayer
) => {
  const textureView: GPUTextureView = context.getCurrentTexture().createView();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        loadOp: "load",
        storeOp: "store",
      },
    ],
  });
  renderPass.setPipeline(pipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(3, 300);
  renderPass.end();

  device.queue.writeBuffer(
    densityLayer.pointsBuffer,
    0,
    densityLayer.pointsFlat.buffer,
    densityLayer.pointsFlat.byteOffset,
    densityLayer.pointsFlat.byteLength
  );
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
      {
        binding: 3,
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

const createRenderPointsBindGroupLayout = (
  device: GPUDevice
): GPUBindGroupLayout => {
  return device.createBindGroupLayout({
    label: "my render points bind group layout",
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }],
  });
};

const createRenderPointsBindGroup = (
  layout: GPUBindGroupLayout,
  device: GPUDevice,
  points: GPUBuffer
): GPUBindGroup => {
  return device.createBindGroup({
    layout: layout,
    entries: [{ binding: 0, resource: { buffer: points } }],
  });
};

const createRenderPointsPipeline = (
  shader: string,
  device: GPUDevice,
  presentationFormat: GPUTextureFormat,
  bindGroupLayout: GPUBindGroupLayout
): GPURenderPipeline => {
  const layout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  return device.createRenderPipeline({
    label: "my render points pipeline",
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
  projection: Projection,
  densityLayer: DensityLayer
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
      {
        binding: 3,
        resource: {
          buffer: densityLayer.pointsBuffer,
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

const populate = (points: vec4[]) => {
  points.push(vec4.fromValues(974.4603836605445, 491.4438205363069, 0, 0));
  points.push(vec4.fromValues(609.4298012821633, 562.7798610467628, 0, 0));
  points.push(vec4.fromValues(627.772664957815, 309.2650527173925, 0, 0));
  points.push(vec4.fromValues(879.7300767394363, 390.4634547527604, 0, 0));
  points.push(vec4.fromValues(937.6234671304686, 417.82521442432176, 0, 0));
  points.push(vec4.fromValues(111.89822801825544, 378.6994500428254, 0, 0));
  points.push(vec4.fromValues(37.76773279642121, 432.4750947009759, 0, 0));
  points.push(vec4.fromValues(459.8988017919543, 212.146896792828, 0, 0));
  points.push(vec4.fromValues(957.6326432152953, 121.82118492625142, 0, 0));
  points.push(vec4.fromValues(463.96061037929235, 512.7927750245698, 0, 0));
  points.push(vec4.fromValues(619.2807194415908, 246.6075309039823, 0, 0));
  points.push(vec4.fromValues(782.4441492540011, 40.64774665952391, 0, 0));
  points.push(vec4.fromValues(754.8821084893378, 300.0269160839619, 0, 0));
  points.push(vec4.fromValues(705.9521626295275, 402.9769865786534, 0, 0));
  points.push(vec4.fromValues(517.0427090678542, 264.4068269212878, 0, 0));
  points.push(vec4.fromValues(694.3884218629062, 436.65922750679886, 0, 0));
  points.push(vec4.fromValues(615.8290608643193, 555.5188745987249, 0, 0));
  points.push(vec4.fromValues(439.20493163026333, 466.47894524810823, 0, 0));
  points.push(vec4.fromValues(597.0016940210414, 313.2165565461345, 0, 0));
  points.push(vec4.fromValues(968.0168529621271, 396.5980665823118, 0, 0));
  points.push(vec4.fromValues(120.55388099605358, 68.5513735273541, 0, 0));
  points.push(vec4.fromValues(325.2165693017481, 28.114147531074618, 0, 0));
  points.push(vec4.fromValues(930.7169574257094, 463.4641259946246, 0, 0));
  points.push(vec4.fromValues(485.3089264378403, 152.9035786387755, 0, 0));
  points.push(vec4.fromValues(582.7371665187442, 424.3538889427936, 0, 0));
  points.push(vec4.fromValues(369.7338693426766, 5.555385154668313, 0, 0));
  points.push(vec4.fromValues(722.5478757188781, 493.7534384576524, 0, 0));
  points.push(vec4.fromValues(969.2403760054242, 585.3182190702532, 0, 0));
  points.push(vec4.fromValues(865.3975557950401, 67.66478221129084, 0, 0));
  points.push(vec4.fromValues(906.3892557119088, 89.57890205195645, 0, 0));
  points.push(vec4.fromValues(471.41035954605235, 339.7083382316566, 0, 0));
  points.push(vec4.fromValues(255.95649045366753, 188.72121553965934, 0, 0));
  points.push(vec4.fromValues(943.4332460821535, 241.10504012677615, 0, 0));
  points.push(vec4.fromValues(165.01852748685118, 280.9633419861639, 0, 0));
  points.push(vec4.fromValues(65.8280015998356, 48.46847902436009, 0, 0));
  points.push(vec4.fromValues(813.0180632395529, 498.91541460084636, 0, 0));
  points.push(vec4.fromValues(162.6682492707203, 270.7916420749874, 0, 0));
  points.push(vec4.fromValues(300.8062947419772, 21.44467002173669, 0, 0));
  points.push(vec4.fromValues(40.28002098511352, 491.5848128989163, 0, 0));
  points.push(vec4.fromValues(717.0463113031087, 215.31352343560948, 0, 0));
  points.push(vec4.fromValues(429.6780236522122, 372.6241821994298, 0, 0));
  points.push(vec4.fromValues(247.3582980778162, 452.3474963424781, 0, 0));
  points.push(vec4.fromValues(90.476383214519, 263.4566294739242, 0, 0));
  points.push(vec4.fromValues(72.60196927962981, 273.63317634259204, 0, 0));
  points.push(vec4.fromValues(624.1638630726811, 41.94238044051502, 0, 0));
  points.push(vec4.fromValues(787.3093223340078, 216.1955249504378, 0, 0));
  points.push(vec4.fromValues(978.4212633000036, 276.666270279961, 0, 0));
  points.push(vec4.fromValues(470.3355972108816, 494.5193668558581, 0, 0));
  points.push(vec4.fromValues(87.22981661729756, 517.3909732371809, 0, 0));
  points.push(vec4.fromValues(403.58897194831945, 580.8981154907406, 0, 0));
  points.push(vec4.fromValues(732.0140804750246, 254.795846354436, 0, 0));
  points.push(vec4.fromValues(56.81906330593955, 398.7385355262239, 0, 0));
  points.push(vec4.fromValues(715.4610247879878, 313.90475730408195, 0, 0));
  points.push(vec4.fromValues(991.8335448863173, 236.69994687200523, 0, 0));
  points.push(vec4.fromValues(83.85676722321134, 507.9615827248973, 0, 0));
  points.push(vec4.fromValues(719.3301273131456, 356.45234376446876, 0, 0));
  points.push(vec4.fromValues(601.0653646360873, 397.6727240890102, 0, 0));
  points.push(vec4.fromValues(880.1558991597287, 323.42847017866853, 0, 0));
  points.push(vec4.fromValues(510.5469124935205, 349.0580766370225, 0, 0));
  points.push(vec4.fromValues(494.82886909448484, 488.33643629068587, 0, 0));
  points.push(vec4.fromValues(61.67705414555269, 52.291473523735334, 0, 0));
  points.push(vec4.fromValues(851.9178347538312, 534.93734534771, 0, 0));
  points.push(vec4.fromValues(120.2391539368699, 383.41894264175596, 0, 0));
  points.push(vec4.fromValues(381.39568127206604, 467.4438689670832, 0, 0));
  points.push(vec4.fromValues(412.3985284440326, 551.2673573120021, 0, 0));
  points.push(vec4.fromValues(514.4673590903666, 578.6642517130068, 0, 0));
  points.push(vec4.fromValues(264.4084947565926, 177.3736950858253, 0, 0));
  points.push(vec4.fromValues(345.1136724414934, 61.339691059407464, 0, 0));
  points.push(vec4.fromValues(236.70071313059847, 403.4966856070866, 0, 0));
  points.push(vec4.fromValues(331.8173607135582, 557.5546562381907, 0, 0));
  points.push(vec4.fromValues(170.42965567672886, 177.71920344825625, 0, 0));
  points.push(vec4.fromValues(522.2246524687779, 261.9981502179876, 0, 0));
  points.push(vec4.fromValues(620.2149934828274, 208.39145162191392, 0, 0));
  points.push(vec4.fromValues(57.836030089185584, 116.43929990153663, 0, 0));
  points.push(vec4.fromValues(432.2181128770115, 523.5236049626661, 0, 0));
  points.push(vec4.fromValues(632.4793175173744, 292.27187690189413, 0, 0));
  points.push(vec4.fromValues(763.1932637760077, 129.91093641463866, 0, 0));
  points.push(vec4.fromValues(339.9122520515361, 32.74472436904996, 0, 0));
  points.push(vec4.fromValues(767.7814506198206, 269.23075197247255, 0, 0));
  points.push(vec4.fromValues(998.3333692669298, 68.31704836911716, 0, 0));
  points.push(vec4.fromValues(218.36874882091627, 337.23554456592234, 0, 0));
  points.push(vec4.fromValues(873.8545662211836, 11.815333375133097, 0, 0));
  points.push(vec4.fromValues(378.44344711564503, 308.84970897191255, 0, 0));
  points.push(vec4.fromValues(705.8178594293141, 558.8056217237263, 0, 0));
  points.push(vec4.fromValues(525.7651639488325, 336.17827210772305, 0, 0));
  points.push(vec4.fromValues(545.6916700447725, 362.7618754572739, 0, 0));
  points.push(vec4.fromValues(541.6063795920079, 158.11352667202266, 0, 0));
  points.push(vec4.fromValues(647.3424939483272, 78.63605821407327, 0, 0));
  points.push(vec4.fromValues(290.58716368799395, 532.5355435306031, 0, 0));
  points.push(vec4.fromValues(95.31506206664253, 244.89709674602537, 0, 0));
  points.push(vec4.fromValues(323.21299735841126, 526.7624510493148, 0, 0));
  points.push(vec4.fromValues(793.2752936227985, 43.28607739097197, 0, 0));
  points.push(vec4.fromValues(786.3017395876999, 362.6972621270943, 0, 0));
  points.push(vec4.fromValues(234.72183179859195, 571.5410708595481, 0, 0));
  points.push(vec4.fromValues(605.5821575177233, 323.142805978288, 0, 0));
  points.push(vec4.fromValues(54.4661428609039, 5.854615670201602, 0, 0));
  points.push(vec4.fromValues(470.0213057959826, 521.0162145210674, 0, 0));
  points.push(vec4.fromValues(29.674486037732926, 347.3674753350869, 0, 0));
  points.push(vec4.fromValues(610.2968526853814, 136.23570413170148, 0, 0));
  points.push(vec4.fromValues(201.8627625401188, 202.05927185696973, 0, 0));
  points.push(vec4.fromValues(865.0180962484073, 187.63789104798963, 0, 0));
  points.push(vec4.fromValues(163.73630081219747, 20.044358468440215, 0, 0));
  points.push(vec4.fromValues(29.412049276994257, 580.4260233465336, 0, 0));
  points.push(vec4.fromValues(61.991214746146326, 518.168030707104, 0, 0));
  points.push(vec4.fromValues(77.3586933624797, 251.1140333447567, 0, 0));
  points.push(vec4.fromValues(19.84316017082466, 468.5127255980261, 0, 0));
  points.push(vec4.fromValues(130.6137906465432, 60.6252191577914, 0, 0));
  points.push(vec4.fromValues(413.03233106444816, 415.95566899431844, 0, 0));
  points.push(vec4.fromValues(592.5392282475026, 209.4848512649035, 0, 0));
  points.push(vec4.fromValues(261.36297556736565, 480.7299498237012, 0, 0));
  points.push(vec4.fromValues(10.660833356754829, 430.97029708648716, 0, 0));
  points.push(vec4.fromValues(574.3376195246776, 507.7203501782054, 0, 0));
  points.push(vec4.fromValues(823.6891745950556, 238.87713688973986, 0, 0));
  points.push(vec4.fromValues(290.5060040798841, 137.06102980646085, 0, 0));
  points.push(vec4.fromValues(25.16573217391116, 552.1322852733196, 0, 0));
  points.push(vec4.fromValues(62.593220683527576, 165.42068040182104, 0, 0));
  points.push(vec4.fromValues(308.9296936603738, 295.78159815434947, 0, 0));
  points.push(vec4.fromValues(714.3418230011445, 488.7342521221322, 0, 0));
  points.push(vec4.fromValues(889.1527083587445, 573.1951317387725, 0, 0));
  points.push(vec4.fromValues(289.60327672536937, 4.059129683004414, 0, 0));
  points.push(vec4.fromValues(867.7012425498782, 224.04695750755644, 0, 0));
  points.push(vec4.fromValues(708.0395468294151, 243.16095488558966, 0, 0));
  points.push(vec4.fromValues(74.55560654448989, 209.732163837739, 0, 0));
  points.push(vec4.fromValues(322.0446222038247, 388.19179646951324, 0, 0));
  points.push(vec4.fromValues(322.54381722874734, 249.87349147393996, 0, 0));
  points.push(vec4.fromValues(743.4255510449743, 553.953925685093, 0, 0));
  points.push(vec4.fromValues(46.10101588837479, 16.77738747008042, 0, 0));
  points.push(vec4.fromValues(213.5186466855532, 580.0040619239671, 0, 0));
  points.push(vec4.fromValues(78.30611472429183, 4.872456586374652, 0, 0));
  points.push(vec4.fromValues(971.0565724104721, 555.1014008923031, 0, 0));
  points.push(vec4.fromValues(861.8706208131816, 386.8092000923721, 0, 0));
  points.push(vec4.fromValues(822.3518930316733, 467.26947002702946, 0, 0));
  points.push(vec4.fromValues(447.8924756166416, 125.26427521938336, 0, 0));
  points.push(vec4.fromValues(688.9275272961423, 19.34870856777571, 0, 0));
  points.push(vec4.fromValues(881.7667186517773, 111.6351681833473, 0, 0));
  points.push(vec4.fromValues(205.7769273948493, 341.4112716878359, 0, 0));
  points.push(vec4.fromValues(506.8274907423247, 126.03243454032858, 0, 0));
  points.push(vec4.fromValues(966.5979459164524, 596.67586576005, 0, 0));
  points.push(vec4.fromValues(357.19934971611565, 362.5089345424879, 0, 0));
  points.push(vec4.fromValues(937.0438075724528, 115.88897227303869, 0, 0));
  points.push(vec4.fromValues(548.0368523212404, 2.8211642170869577, 0, 0));
  points.push(vec4.fromValues(235.74956559299665, 312.6241006096868, 0, 0));
  points.push(vec4.fromValues(857.1206789145577, 172.35267819674783, 0, 0));
  points.push(vec4.fromValues(458.34349453882515, 74.47594192922998, 0, 0));
  points.push(vec4.fromValues(6.846835523433459, 82.36622134310454, 0, 0));
  points.push(vec4.fromValues(579.014148036469, 375.9701079130475, 0, 0));
  points.push(vec4.fromValues(687.5503679346216, 490.0319878458364, 0, 0));
  points.push(vec4.fromValues(265.90670879071234, 245.4650395759499, 0, 0));
  points.push(vec4.fromValues(480.90378554059976, 398.547343631969, 0, 0));
  points.push(vec4.fromValues(385.57645102666595, 193.60060230197308, 0, 0));
  points.push(vec4.fromValues(214.0070232094924, 238.03288988651911, 0, 0));
  points.push(vec4.fromValues(11.468329308848002, 321.32541643665087, 0, 0));
  points.push(vec4.fromValues(240.36618624493954, 328.49816476678416, 0, 0));
  points.push(vec4.fromValues(80.96035062391582, 596.4445640103536, 0, 0));
  points.push(vec4.fromValues(290.1621612437821, 316.24275675034943, 0, 0));
  points.push(vec4.fromValues(857.0609203562432, 130.84676852484338, 0, 0));
  points.push(vec4.fromValues(97.03659472274673, 509.12124837899444, 0, 0));
  points.push(vec4.fromValues(759.5934884632723, 464.1069792086842, 0, 0));
  points.push(vec4.fromValues(397.39625239533495, 266.10773714486027, 0, 0));
  points.push(vec4.fromValues(24.48619271579311, 299.62491151770803, 0, 0));
  points.push(vec4.fromValues(807.9183040870705, 295.81609793083186, 0, 0));
  points.push(vec4.fromValues(827.7667029986362, 380.8788342495444, 0, 0));
  points.push(vec4.fromValues(364.49982791464276, 482.75665255394165, 0, 0));
  points.push(vec4.fromValues(716.4191193029133, 568.5559652872442, 0, 0));
  points.push(vec4.fromValues(488.2314470866753, 327.0149962793777, 0, 0));
  points.push(vec4.fromValues(210.25452141697355, 16.899112996682007, 0, 0));
  points.push(vec4.fromValues(874.7811229392705, 436.40408896780036, 0, 0));
  points.push(vec4.fromValues(804.1262217308578, 143.0896491446848, 0, 0));
  points.push(vec4.fromValues(476.8819263019046, 450.34314596179183, 0, 0));
  points.push(vec4.fromValues(145.58012758325867, 510.4267528268008, 0, 0));
  points.push(vec4.fromValues(532.0783205001891, 484.49661413794774, 0, 0));
  points.push(vec4.fromValues(880.6662149487458, 404.3092140759654, 0, 0));
  points.push(vec4.fromValues(344.4900614025008, 119.69066475371721, 0, 0));
  points.push(vec4.fromValues(860.6584926415146, 508.9813622929786, 0, 0));
  points.push(vec4.fromValues(914.1191167254613, 181.3145752417009, 0, 0));
  points.push(vec4.fromValues(304.3448825884474, 509.6680534313186, 0, 0));
  points.push(vec4.fromValues(951.3937714839132, 32.191812046206266, 0, 0));
  points.push(vec4.fromValues(447.0368084798828, 455.6349807416715, 0, 0));
  points.push(vec4.fromValues(914.789837889763, 487.2091702167044, 0, 0));
  points.push(vec4.fromValues(830.2360704507968, 458.82274005462915, 0, 0));
  points.push(vec4.fromValues(991.5525813696324, 343.8454395052106, 0, 0));
  points.push(vec4.fromValues(707.7330175356924, 425.1913958084692, 0, 0));
  points.push(vec4.fromValues(155.5000727696183, 282.2859704962378, 0, 0));
  points.push(vec4.fromValues(987.7807662721884, 522.7995413260272, 0, 0));
  points.push(vec4.fromValues(214.88822476099756, 344.47971441775724, 0, 0));
  points.push(vec4.fromValues(921.5758210421156, 92.0022274386996, 0, 0));
  points.push(vec4.fromValues(991.6607371712878, 262.99629211378164, 0, 0));
  points.push(vec4.fromValues(514.4368476925063, 290.88653761827896, 0, 0));
  points.push(vec4.fromValues(799.567723236952, 438.5233673399072, 0, 0));
  points.push(vec4.fromValues(67.02296738941449, 83.40600998387578, 0, 0));
  points.push(vec4.fromValues(118.11842607011735, 518.1112201819574, 0, 0));
  points.push(vec4.fromValues(685.8627110020657, 318.60592938415056, 0, 0));
  points.push(vec4.fromValues(742.1684289740502, 451.2519821125877, 0, 0));
  points.push(vec4.fromValues(753.0966688585752, 242.1766807569738, 0, 0));
  points.push(vec4.fromValues(678.1196640945697, 552.4601791458358, 0, 0));
  points.push(vec4.fromValues(422.62401158057486, 382.164583876861, 0, 0));
  points.push(vec4.fromValues(36.39087380548833, 318.6071046667537, 0, 0));
  points.push(vec4.fromValues(69.95291974571383, 272.84530767545186, 0, 0));
  points.push(vec4.fromValues(146.59205080289883, 449.6407220730662, 0, 0));
  points.push(vec4.fromValues(265.1554167946124, 579.0377886644042, 0, 0));
  points.push(vec4.fromValues(527.0642275037541, 297.7603238751785, 0, 0));
  points.push(vec4.fromValues(386.07831075304676, 440.15340676542064, 0, 0));
  points.push(vec4.fromValues(809.5291956112259, 200.38004859214342, 0, 0));
  points.push(vec4.fromValues(3.9691456036365924, 349.465138104299, 0, 0));
  points.push(vec4.fromValues(853.3023961003465, 338.8830810783636, 0, 0));
  points.push(vec4.fromValues(282.60696061963444, 369.5889667135841, 0, 0));
  points.push(vec4.fromValues(450.7066786936709, 523.931278666297, 0, 0));
  points.push(vec4.fromValues(115.35390532893098, 499.3563001087331, 0, 0));
  points.push(vec4.fromValues(611.3115944724368, 113.30312299080947, 0, 0));
  points.push(vec4.fromValues(856.9077809648509, 93.69376663272612, 0, 0));
  points.push(vec4.fromValues(243.2447387302734, 55.510644077325026, 0, 0));
  points.push(vec4.fromValues(403.1656155707419, 540.1294891529544, 0, 0));
  points.push(vec4.fromValues(561.4453623929107, 171.59586873952017, 0, 0));
  points.push(vec4.fromValues(541.3618442160666, 78.6046660028926, 0, 0));
  points.push(vec4.fromValues(564.1367712307261, 361.3218906692219, 0, 0));
  points.push(vec4.fromValues(280.0375586124895, 57.17595386839034, 0, 0));
  points.push(vec4.fromValues(570.7789425707075, 177.7752225195252, 0, 0));
  points.push(vec4.fromValues(829.1910949681732, 66.44371853313675, 0, 0));
  points.push(vec4.fromValues(906.0993417714889, 275.2175729978219, 0, 0));
  points.push(vec4.fromValues(173.96220475297787, 561.0907826149967, 0, 0));
  points.push(vec4.fromValues(884.8090327453775, 556.4587982003252, 0, 0));
  points.push(vec4.fromValues(203.93600867073914, 507.2866919890646, 0, 0));
  points.push(vec4.fromValues(701.6847580197297, 520.6614525885359, 0, 0));
  points.push(vec4.fromValues(265.4841162465365, 35.46567523387827, 0, 0));
  points.push(vec4.fromValues(77.83893961554811, 417.98184027966965, 0, 0));
  points.push(vec4.fromValues(892.6550472367123, 202.29241865055414, 0, 0));
  points.push(vec4.fromValues(66.41586301390645, 344.04164557971603, 0, 0));
  points.push(vec4.fromValues(82.64608256682493, 270.69210687944263, 0, 0));
  points.push(vec4.fromValues(14.579701204277873, 573.904932689261, 0, 0));
  points.push(vec4.fromValues(286.6002014927544, 420.84796821208977, 0, 0));
  points.push(vec4.fromValues(552.8481562332302, 46.262038604300805, 0, 0));
  points.push(vec4.fromValues(663.4093783487014, 265.6974644982571, 0, 0));
  points.push(vec4.fromValues(456.4509002113295, 247.0663136616428, 0, 0));
  points.push(vec4.fromValues(318.0419564468042, 88.48937389023948, 0, 0));
  points.push(vec4.fromValues(487.44953069229456, 405.8838095923932, 0, 0));
  points.push(vec4.fromValues(969.1934781027629, 287.756837894457, 0, 0));
  points.push(vec4.fromValues(296.6903192719663, 377.7438328008019, 0, 0));
  points.push(vec4.fromValues(630.7193393275936, 154.9146837384165, 0, 0));
  points.push(vec4.fromValues(586.0751221907161, 557.7784700122302, 0, 0));
  points.push(vec4.fromValues(991.2785916551337, 542.0367455542306, 0, 0));
  points.push(vec4.fromValues(93.91677497900442, 574.9820737486588, 0, 0));
  points.push(vec4.fromValues(362.97663380891174, 451.02820968544705, 0, 0));
  points.push(vec4.fromValues(49.54058686184415, 84.3121958398779, 0, 0));
  points.push(vec4.fromValues(286.2847326877156, 544.3291075232679, 0, 0));
  points.push(vec4.fromValues(472.17641472236215, 5.105751085835131, 0, 0));
  points.push(vec4.fromValues(897.8284146088156, 463.5645485210273, 0, 0));
  points.push(vec4.fromValues(567.5986639102755, 203.96511652723996, 0, 0));
  points.push(vec4.fromValues(197.94380147568603, 271.1040319895649, 0, 0));
  points.push(vec4.fromValues(251.4578110277721, 452.51025787561383, 0, 0));
  points.push(vec4.fromValues(258.4206775832096, 331.9540541410302, 0, 0));
  points.push(vec4.fromValues(971.5603847247256, 33.1808195995884, 0, 0));
  points.push(vec4.fromValues(833.5857558805598, 521.9088809258145, 0, 0));
  points.push(vec4.fromValues(694.4876583334783, 540.1816274363026, 0, 0));
  points.push(vec4.fromValues(15.25012605368059, 160.1439451262487, 0, 0));
  points.push(vec4.fromValues(1.820716897573904, 17.79951557615793, 0, 0));
  points.push(vec4.fromValues(247.16594473508403, 456.95176025207076, 0, 0));
  points.push(vec4.fromValues(402.0520195873627, 436.8016804395961, 0, 0));
  points.push(vec4.fromValues(255.9132115883136, 579.8673426849499, 0, 0));
  points.push(vec4.fromValues(294.3179596683021, 208.39525894838627, 0, 0));
  points.push(vec4.fromValues(591.2945889525001, 335.2337302843824, 0, 0));
  points.push(vec4.fromValues(61.30517642098465, 527.4607216123607, 0, 0));
  points.push(vec4.fromValues(773.2795678469262, 519.0430623146077, 0, 0));
  points.push(vec4.fromValues(626.3754036533458, 120.51524918518038, 0, 0));
  points.push(vec4.fromValues(167.68356871829604, 287.59656339868746, 0, 0));
  points.push(vec4.fromValues(382.4008934849976, 212.96083374462665, 0, 0));
  points.push(vec4.fromValues(890.6371440840588, 462.2015107174033, 0, 0));
  points.push(vec4.fromValues(0.21649954272806582, 191.5041146505601, 0, 0));
  points.push(vec4.fromValues(211.47363241540097, 293.6206415719343, 0, 0));
  points.push(vec4.fromValues(893.6099631967809, 374.2390411411418, 0, 0));
  points.push(vec4.fromValues(602.3677444818886, 24.80807724958205, 0, 0));
  points.push(vec4.fromValues(849.5250092150932, 251.58152972958968, 0, 0));
  points.push(vec4.fromValues(80.29671322421183, 516.3247088669688, 0, 0));
  points.push(vec4.fromValues(126.55185566093175, 220.88660954223278, 0, 0));
  points.push(vec4.fromValues(196.2809918409305, 233.8710352178841, 0, 0));
  points.push(vec4.fromValues(817.3816803760685, 81.49506306164982, 0, 0));
  points.push(vec4.fromValues(401.83288843490294, 41.28623014069612, 0, 0));
  points.push(vec4.fromValues(239.50103393281586, 88.12430164681876, 0, 0));
  points.push(vec4.fromValues(924.3105595413043, 203.5591095297596, 0, 0));
  points.push(vec4.fromValues(685.9303814653101, 18.11907262639796, 0, 0));
  points.push(vec4.fromValues(71.38976193706048, 446.566105110198, 0, 0));
  points.push(vec4.fromValues(832.0687384336238, 292.63952430481396, 0, 0));
  points.push(vec4.fromValues(805.1920421407522, 403.0754397708745, 0, 0));
  points.push(vec4.fromValues(997.852755086477, 222.65546614151535, 0, 0));
  points.push(vec4.fromValues(769.2775006355761, 153.72482711186555, 0, 0));
  points.push(vec4.fromValues(415.1903312598224, 511.4955385839542, 0, 0));
  points.push(vec4.fromValues(624.8232347446134, 439.904880097955, 0, 0));
  points.push(vec4.fromValues(44.93584473270529, 220.03097026119906, 0, 0));
  points.push(vec4.fromValues(276.5530425491569, 264.4570578351724, 0, 0));
  points.push(vec4.fromValues(362.2966872786091, 215.87844652350276, 0, 0));
  points.push(vec4.fromValues(711.8491784775076, 250.9261969066146, 0, 0));
  points.push(vec4.fromValues(813.1005824895464, 314.21329301448145, 0, 0));
  points.push(vec4.fromValues(178.8274626900208, 77.61959138917321, 0, 0));
  points.push(vec4.fromValues(916.300046394371, 465.27049906335327, 0, 0));
  points.push(vec4.fromValues(694.5524950851252, 378.50388312724164, 0, 0));
  points.push(vec4.fromValues(32.182228077707094, 328.5786971767725, 0, 0));
  points.push(vec4.fromValues(302.8422340499175, 115.19543693348852, 0, 0));
  points.push(vec4.fromValues(691.3006065157509, 0.7228736494413912, 0, 0));
  points.push(vec4.fromValues(550.4385514035783, 172.07513613542673, 0, 0));
  points.push(vec4.fromValues(325.5545603266372, 411.6642744076703, 0, 0));
  points.push(vec4.fromValues(497.60836528731335, 5.444585508497912, 0, 0));
};
