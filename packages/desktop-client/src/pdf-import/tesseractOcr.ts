import type { OcrImage, StatementOcr } from './readStatementPdf';
import type { StatementTextItem } from './types';

/**
 * OCR for scanned statements, using tesseract.js with Czech and English
 * models. The worker, wasm core and language data are served by the app
 * itself from /ocr (see stageOcrAssets in vite.config.mts), never from a CDN.
 */
export async function createTesseractOcr(): Promise<StatementOcr> {
  const { createWorker, OEM } = await import('tesseract.js');
  const base = new URL('ocr/', window.document.baseURI).href;
  const worker = await createWorker(['ces', 'eng'], OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: `${base}lang`,
    workerBlobURL: false,
    gzip: true,
  });

  return {
    async recognize(image: OcrImage, scale: number) {
      const { data } = await worker.recognize(
        image as HTMLCanvasElement,
        {},
        { blocks: true, text: false },
      );
      const items: StatementTextItem[] = [];
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              if (word.confidence < 30 || word.text.trim() === '') {
                continue;
              }
              const { x0, y0, x1, y1 } = word.bbox;
              items.push({
                text: word.text,
                x: x0 / scale,
                y: y0 / scale,
                width: (x1 - x0) / scale,
                height: (y1 - y0) / scale,
                isWord: true,
              });
            }
          }
        }
      }
      return items;
    },
    async terminate() {
      await worker.terminate();
    },
  };
}
