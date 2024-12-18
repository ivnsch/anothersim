import { vec3 } from "gl-matrix";
import { Sim, origin } from "./sim";

export class App {
  renderer: Sim;

  objPitch: number = 0;
  objYaw: number = 0;
  objRoll: number = 0;

  cameraPitch: number = 0;
  cameraYaw: number = 0;
  cameraRoll: number = 0;
  cameraPos: vec3 = vec3.create();

  constructor(document: Document, canvas: HTMLCanvasElement) {
    this.cameraPos = origin();
    this.cameraPos[2] += 4;

    this.renderer = new Sim(canvas, this.cameraPos);

    document.addEventListener("keydown", (e) => {
      this.handleKeypress(e);
    });
  }

  async init(navigator: Navigator) {
    await this.renderer.init(navigator);
  }

  handleKeypress(event: any) {
    const deltaObj = 0.05;
    const deltaCameraRot = 2;
    const deltaCameraTrans = 0.3;
    if (event.code == "KeyX") {
      this.objPitch += deltaObj;
    }
    if (event.code == "KeyY") {
      this.objYaw += deltaObj;
    }
    if (event.code == "KeyZ") {
      this.objRoll += deltaObj;
    }
    if (event.code == "KeyI") {
      this.cameraPitch += deltaCameraRot;
    }
    if (event.code == "KeyO") {
      this.cameraYaw += deltaCameraRot;
    }
    if (event.code == "KeyP") {
      this.cameraRoll += deltaCameraRot;
    }
    if (event.code == "KeyQ") {
      this.cameraPos[1] -= deltaCameraTrans;
    }
    if (event.code == "KeyE") {
      this.cameraPos[1] += deltaCameraTrans;
    }
    if (event.code == "KeyA") {
      this.cameraPos[0] -= deltaCameraTrans;
    }
    if (event.code == "KeyD") {
      this.cameraPos[0] += deltaCameraTrans;
    }
    if (event.code == "KeyW") {
      this.cameraPos[2] -= deltaCameraTrans;
    }
    if (event.code == "KeyS") {
      this.cameraPos[2] += deltaCameraTrans;
    }

    this.renderer.setTriangleEulers(this.objPitch, this.objYaw, this.objRoll);
    this.renderer.setCameraEulers(
      this.cameraPitch,
      this.cameraYaw,
      this.cameraRoll
    );
    this.renderer.setCameraTranslation(this.cameraPos);
  }

  run = () => {
    this.renderer.render();

    requestAnimationFrame(this.run);
  };
}
