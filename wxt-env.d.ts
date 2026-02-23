/// <reference types="svelte" />
declare module "*.svelte" {
  import type { ComponentType } from "svelte";
  const component: ComponentType;
  export default component;
}

interface Bbox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence?: number;
  classId?: number;
}
