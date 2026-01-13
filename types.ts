
export interface ColorStop {
  offset: number;
  color: string;
  alpha: number; // 0 to 1
}

export interface IntensityMap {
  data: Float32Array; // Heat values 0.0 to 1.0
  labelMask: Uint8Array; // 1 for labels (don't cover), 0 for others
  width: number;
  height: number;
  originalImage: HTMLImageElement;
}

export interface GradientConfig {
  stops: ColorStop[];
}

export enum ProcessingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR'
}
