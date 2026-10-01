import { darknessOf, removeRedactedItems, textItemsFromContent } from './pageContent';
import type { PagePixels } from './pageContent';
import type { StatementPage, StatementTextItem } from './types';

/** Pages with fewer text items are treated as scanned images. */
const MIN_TEXT_ITEMS = 5;
/** Render scale for redaction detection and OCR (2 = 144 DPI). */
const RENDER_SCALE = 2;

export type StatementOcr = {
  /** Recognize words on a rendered page; coordinates in page points. */
  recognize: (
    image: OcrImage,
    scale: number,
  ) => Promise<StatementTextItem[]>;
  terminate: () => Promise<void>;
};

export type OcrImage = HTMLCanvasElement | OffscreenCanvas;

export type ReadStatementOptions = {
  password?: string;
  /** Created lazily, only when a page has no text layer. */
  createOcr?: () => Promise<StatementOcr>;
  onProgress?: (progress: { page: number; pageCount: number }) => void;
};

export class StatementPdfError extends Error {
  constructor(
    readonly reason: 'password-required' | 'wrong-password' | 'invalid-pdf',
  ) {
    super(reason);
  }
}

/**
 * Read the pages of a PDF bank statement in the browser. Text under
 * blacked-out areas is removed, and pages without a text layer go
 * through OCR. Nothing leaves the device.
 */
export async function readStatementPdf(
  data: ArrayBuffer,
  { password, createOcr, onProgress }: ReadStatementOptions = {},
): Promise<StatementPage[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: workerUrl } = await import(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
  );
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  let document;
  try {
    document = await pdfjs.getDocument({
      data: new Uint8Array(data),
      password,
      isEvalSupported: false,
    }).promise;
  } catch (error) {
    if (error instanceof pdfjs.PasswordException) {
      throw new StatementPdfError(
        error.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD
          ? 'wrong-password'
          : 'password-required',
      );
    }
    throw new StatementPdfError('invalid-pdf');
  }

  let ocr: StatementOcr | null = null;
  const pages: StatementPage[] = [];
  try {
    for (let number = 1; number <= document.numPages; number++) {
      onProgress?.({ page: number, pageCount: document.numPages });
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const textItems = textItemsFromContent(content.items, viewport.transform);

      const canvas = createCanvas(
        Math.ceil(viewport.width * RENDER_SCALE),
        Math.ceil(viewport.height * RENDER_SCALE),
      );
      await page.render({
        canvas: canvas as HTMLCanvasElement,
        viewport: page.getViewport({ scale: RENDER_SCALE }),
      }).promise;

      if (textItems.length < MIN_TEXT_ITEMS && createOcr) {
        ocr ??= await createOcr();
        pages.push({
          width: viewport.width,
          height: viewport.height,
          items: await ocr.recognize(canvas, RENDER_SCALE),
          redactions: [],
        });
      } else {
        const pixels = getPixels(canvas);
        const { items, redactions } = removeRedactedItems(textItems, rect =>
          darknessOf(pixels, rect, RENDER_SCALE),
        );
        pages.push({
          width: viewport.width,
          height: viewport.height,
          items,
          redactions,
        });
      }
      page.cleanup();
    }
  } finally {
    await ocr?.terminate();
    await document.destroy();
  }
  return pages;
}

function createCanvas(width: number, height: number): OcrImage {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = window.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getPixels(canvas: OcrImage): PagePixels {
  const context = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) {
    throw new Error('Canvas 2D context is not available');
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
