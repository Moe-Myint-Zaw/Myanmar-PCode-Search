const fs = require('node:fs');

const { scanCompactDatasetStream } = require('./dataset-stream');

const datasetPath = `${process.cwd()}/data/pcode-compact.json`;

describe('scanCompactDatasetStream with the generated official dataset', () => {
  it('validates the complete dataset without collecting all places in memory', async () => {
    const descriptor = fs.openSync(datasetPath, 'r');
    const stream = new ReadableStream({
      pull(controller) {
        const chunk = new Uint8Array(64 * 1024);
        const bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null);
        if (bytesRead === 0) {
          controller.close();
          return;
        }
        controller.enqueue(chunk.subarray(0, bytesRead));
      },
      cancel() {
        fs.closeSync(descriptor);
      },
    });

    try {
      const result = await scanCompactDatasetStream(stream);
      expect(result.metadata.datasetVersion).toBe('9.7');
      expect(result.recordCount).toBe(90678);
      expect(result.checksum).toBe('b7d6ba7ab79a527fbd9a7d9bf2e52af026247fbaf38f580d3806559aca469e04');
    } finally {
      fs.closeSync(descriptor);
    }
  }, 30000);
});
