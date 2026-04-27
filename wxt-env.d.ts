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
}

type Translations = string[]; 

interface SeriesContext {
  title: string;
  summary: string;
  dictionary: string;
  // Keep only the last 5 pages here for the LLM prompt
  recentHistory: Translations[];
  translatedCount: number;
}

interface PageCache {
  bboxes: Bbox[];
  translations: Translations;
}
