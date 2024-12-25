import { vec2, vec4 } from "gl-matrix";
import { Entity } from "./entity";
import { CANVAS_HEIGHT, CANVAS_WIDTH, THROWAWAY_ID } from "./constants";

export class DensityLayer extends Entity {
  static POINTS_COUNT = 300; // has to match shader

  pointsBuffer: GPUBuffer;
  pointVectorFloatCount = 4; // 4 floats in vec4

  points: vec4[];
  pointsFlat = new Float32Array(
    this.pointVectorFloatCount * DensityLayer.POINTS_COUNT
  );

  constructor(device: GPUDevice, points: vec4[]) {
    super(device, [], THROWAWAY_ID);

    this.points = points;
    this.mapPointsToWorldCoords();
    this.updateFlatPoints();

    this.pointsBuffer = this.createPointsBuffer(
      device,
      "my density points buffer"
    );
  }

  mapPointsToWorldCoords = () => {
    const screenSize = vec2.fromValues(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.points.forEach((point, i) => {
      const worldCoords = toWorldCoords(screenSize, point);
      point[0] = worldCoords[0];
      point[1] = worldCoords[1];
    });
  };

  updateFlatPoints = () => {
    const pointSize = 4; // vec4
    this.points.forEach((point, i) => {
      this.pointsFlat.set(point, i * pointSize);
    });
  };

  private createPointsBuffer = (
    device: GPUDevice,
    label: string
  ): GPUBuffer => {
    // const bufferSize = DensityLayer.POINTS_COUNT * this.pointVectorFloatCount;
    // const bufferSize = 1600; // console says should have this value so hardcoded
    const bufferSize = 4800; // console says should have this value so hardcoded
    return device.createBuffer({
      label: label,
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  };

  render = (device: GPUDevice) => {
    // note that the point's positions (movement simulation) are updated in a compute shader
  };
}

// as defined in the shader as well
const toWorldCoords = (screen_size: vec2, screen_pos: vec4): vec4 => {
  let offset_x = screen_pos[0] - screen_size[0] / 2;
  let offset_y = screen_pos[1] - screen_size[1] / 2;
  let normalized_x = (offset_x / screen_size[0]) * 2;
  let normalized_y = (offset_y / screen_size[1]) * 2;

  return vec4.fromValues(normalized_x, normalized_y, 0, 0);
};
