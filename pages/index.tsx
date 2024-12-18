import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import styles from "../styles/Home.module.css";
import { App } from "../lib/app";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../lib/constants";

export default function Home() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const nested = async () => {
      if (canvasRef.current) {
        const app = new App(document, canvasRef.current);
        await app.init(navigator);
        app.run(performance.now());
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
