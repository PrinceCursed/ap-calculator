/// <reference lib="webworker" />
import { analyze, GroupDisabledError, loadFiles, type Loaded } from '../lib/pipeline';
import type { FromWorker, ToWorker } from './protocol';

// Разобранные строки хранятся в воркере: при смене даты/фракции файл не перечитывается.
let loaded: Loaded | null = null;

const post = (m: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

function runAnalyze(factionId: string, date: string | null) {
  if (!loaded) return;
  const t0 = performance.now();
  post({ type: 'progress', phase: 'compute', done: 0, total: 1 });
  try {
    const analysis = analyze(loaded, factionId, date);
    post({ type: 'result', analysis, ms: Math.round(performance.now() - t0) });
  } catch (e) {
    if (e instanceof GroupDisabledError) post({ type: 'error', code: 'disabled', message: e.message });
    else post({ type: 'error', code: 'failed', message: String((e as Error)?.message ?? e) });
  }
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'load') {
      post({ type: 'progress', phase: 'read', done: 0, total: msg.files.length });
      const files: { name: string; text: string }[] = [];
      for (const f of msg.files) {
        files.push('text' in f && typeof f.text === 'string' ? (f as { name: string; text: string }) : { name: f.name, text: await (f as File).text() });
      }
      let last = 0;
      loaded = loadFiles(files, (done, total) => {
        const now = performance.now();
        if (now - last > 30 || done === total) {
          last = now;
          post({ type: 'progress', phase: 'parse', done, total });
        }
      });
      post({
        type: 'loaded',
        info: { files: files.map((f) => f.name), total: loaded.total, parsed: loaded.lines.length, skipped: loaded.skipped, duplicates: loaded.duplicates },
      });
      if (loaded.lines.length === 0) {
        post({ type: 'error', code: 'not-logs', message: 'Файл не похож на логи' });
        return;
      }
      runAnalyze(msg.factionId, msg.date);
    } else if (msg.type === 'analyze') {
      runAnalyze(msg.factionId, msg.date);
    }
  } catch (e) {
    post({ type: 'error', code: 'failed', message: String((e as Error)?.message ?? e) });
  }
};
