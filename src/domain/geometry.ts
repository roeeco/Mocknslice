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

export type Vector3Mm = [Millimetres, Millimetres, Millimetres];

export interface Bounds3D {
  minMm: Vector3Mm;
  maxMm: Vector3Mm;
}

export interface SerializableTriangleMesh {
  positionsMm: number[];
  indices: number[];
}

export interface Transform3D {
  positionMm: [Millimetres, Millimetres, Millimetres];
  rotationDeg: [number, number, number];
  scale: [number, number, number];
}
