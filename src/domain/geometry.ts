export type Millimetres = number;

export interface Point2D {
  x: Millimetres;
  y: Millimetres;
}

export interface Dimensions3D {
  widthMm: Millimetres;
  heightMm: Millimetres;
  depthMm: Millimetres;
}

export interface Transform3D {
  positionMm: [Millimetres, Millimetres, Millimetres];
  rotationDeg: [number, number, number];
  scale: [number, number, number];
}
