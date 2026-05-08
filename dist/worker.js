"use strict";
// ─── Worker Thread ─────────────────────────────────────────────────────────────
// Runs inside a worker_thread. Receives a batch of file paths, parses each one
// using the parser router, and posts the results back to the main thread.
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const index_1 = require("./parser/index");
if (!worker_threads_1.parentPort) {
    throw new Error("worker.ts must be run inside a worker_thread");
}
const payload = worker_threads_1.workerData;
const { files, root } = payload;
const results = {
    results: [],
    errors: [],
};
for (const { filePath, hash } of files) {
    try {
        const result = (0, index_1.parseFile)(filePath, hash, root);
        results.results.push(result);
        if (result.error) {
            results.errors.push(`${filePath}: ${result.error}`);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.errors.push(`${filePath}: ${message}`);
    }
}
worker_threads_1.parentPort.postMessage(results);
//# sourceMappingURL=worker.js.map