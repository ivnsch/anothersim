const len = 10;
const width = 0.01;
const hw = width / 2;

export const xAxisVertices = (): number[] => {
  // x y z
  // prettier-ignore
  return [
        -len, hw, 0, 
        len, hw, 0, 
        -len, -hw, 0, 

        -len, -hw, 0, 
        len, hw, 0, 
        len, -hw, 0, 
    ]
};

export const yAxisVertices = (): number[] => {
  // x y z
  // prettier-ignore
  return [
        -hw, len, 0, 
        hw, len, 0, 
        -hw, -len, 0, 

        -hw, -len, 0, 
        hw, len, 0, 
        hw, -len, 0, 
    ]
};

export const zAxisVertices = (): number[] => {
  // x y z
  // prettier-ignore
  return [
          0, hw, len, 
          0, hw, -len, 
          0, -hw, -len, 
  
          0, -hw, -len, 
          0, hw, len, 
          0, -hw, len, 
      ]
};
