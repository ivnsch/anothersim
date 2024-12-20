export function parseObjFile(objText: string): ParsedObjFile {
  const vertices: number[] = [];
  const indices: number[] = [];

  const lines = objText.split("\n");

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const type = parts[0];

    if (type === "v") {
      const verticesParts = parts.slice(1);
      verticesParts.forEach((part) => {
        const n = Number(part);
        vertices.push(n);
      });
    } else if (type === "f") {
      parts.slice(1).forEach((faceStr: string) => {
        const faceParts = faceStr.split("/");
        const face = faceParts.map((index: string) => parseInt(index) - 1);
        indices.push(face[0]);
      });
    }
  }

  indices.reverse();

  return { vertices, indices };
}

export type ParsedObjFile = {
  vertices: number[];
  indices: number[];
};
