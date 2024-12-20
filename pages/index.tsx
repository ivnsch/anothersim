import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import styles from "../styles/Home.module.css";
import { App } from "../lib/app";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../lib/constants";
import { parseObjFile } from "../lib/obj_parser";
import { ObjFileEntity } from "../lib/obj_file_entity";

export default function Home() {
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);

  useEffect(() => {
    const nested = async () => {
      if (canvasRef.current) {
        // fetch("/models/cube.obj")
        fetch("/models/sphere.obj")
          .then((res) => res.text())
          .then(async (text) => {
            const parsedObj = parseObjFile(text);
            if (canvasRef.current) {
              const app = new App(document, canvasRef.current, parsedObj);
              await app.init(navigator);
              app.run(performance.now());
            } else {
              // we checked before doing the async call
              console.error("unexpected: lost canvas reference");
            }
          });
      }
    };
    nested();
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <canvas
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          ref={canvasRef}
        ></canvas>
      </main>
    </div>
  );
}
