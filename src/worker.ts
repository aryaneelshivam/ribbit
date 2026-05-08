// ─── Worker Thread ─────────────────────────────────────────────────────────────
// Runs inside a worker_thread. Receives a batch of file paths, parses each one
// using the parser router, and posts the results back to the main thread.

import { parentPort, workerData } from "worker_threads";
import { parseFile } from "./parser/index";
import { WorkerResult } from "./types";

interface WorkerPayload {
  files: Array<{ filePath: string; hash: string }>;
  root: string;
}

if (!parentPort) {
  throw new Error("worker.ts must be run inside a worker_thread");
}

const payload = workerData as WorkerPayload;
const { files, root } = payload;

const results: WorkerResult = {
  results: [],
  errors: [],
};

for (const { filePath, hash } of files) {
  try {
    const result = parseFile(filePath, hash, root);
    results.results.push(result);
    if (result.error) {
      results.errors.push(`${filePath}: ${result.error}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.errors.push(`${filePath}: ${message}`);
  }
}

parentPort.postMessage(results);
