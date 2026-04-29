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
  confidence: number;
}

type Translations = string[]; 

interface SeriesContext {
  seriesName: string;
  summary: string;
  dictionary: string;
  
  // Tracking the last translated position
  lastChapterId: string | null;
  lastPageIndex: number | null;

  recentHistory: {
    chapterId: string;
    pageIndex: number;
    text: string;
  }[];

  translatedCount: number;
}

interface PageCache {
  bboxes: Bbox[];
  translations: Translations;
}
