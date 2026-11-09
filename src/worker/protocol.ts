import type { Analysis } from '../lib/pipeline';

export type ToWorker =
  | { type: 'load'; files: File[] | { name: string; text: string }[]; factionId: string; date: string | null }
  | { type: 'analyze'; factionId: string; date: string | null };

export interface LoadInfo {
  files: string[];
  total: number;
  parsed: number;
  skipped: number;
  duplicates: number;
}

export type FromWorker =
  | { type: 'progress'; phase: 'read' | 'parse' | 'compute'; done: number; total: number }
  | { type: 'loaded'; info: LoadInfo }
  | { type: 'result'; analysis: Analysis; ms: number }
  | { type: 'error'; code: 'not-logs' | 'disabled' | 'failed'; message: string };
