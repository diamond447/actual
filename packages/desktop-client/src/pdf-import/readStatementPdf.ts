import {
  measureArea,
  removeHiddenText,
  textItemsFromContent,
} from './pageContent';
import type { PagePixels } from './pageContent';
import { ensureReadableStreamIteration } from './readableStreamIteration';
import type { StatementPage, StatementTextItem } from './types';

/** Pages with fewer text items are treated as scanned images. */
const MIN_TEXT_ITEMS = 5;
/** Render scale for finding blacked-out text (2 = 144 DPI). */
const RENDER_SCALE = 2;
/** Small statement print needs a higher resolution for OCR (216 DPI). */
const OCR_SCALE = 3;

export type StatementOcr = {
  /** Recognize words on a rendered page; coordinates in page points. */
  recognize: (image: OcrImage, scale: number) => Promise<StatementTextItem[]>;
  terminate: () => Promise<void>;
};

export type OcrImage = HTMLCanvasElement | OffscreenCanvas;

export type ReadStatementOptions = {
  password?: string;
  /** Created lazily, only when a page has no text layer. */
  createOcr?: () => Promise<StatementOcr>;
  onProgress?: (progress: { page: number; pageCount: number }) => void;
};

type StatementPdfErrorReason =
  | 'password-required'
  | 'wrong-password'
  | 'invalid-pdf';

export class StatementPdfError extends Error {
  readonly reason: StatementPdfErrorReason;

  constructor(reason: StatementPdfErrorReason, options?: ErrorOptions) {
    super(reason, options);
    this.reason = reason;
  }
}

/** pdf.js data files, staged by stagePdfjsAssets in vite.config.mts. */
const pdfjsAssetsUrl = `${import.meta.env.BASE_URL}pdfjs/`;

/**
 * Read the pages of a PDF bank statement in the browser. Text the user
 * blacked out is removed, and pages without a text layer go through OCR.
 * Nothing leaves the device.
 */
export async function readStatementPdf(
  data: ArrayBuffer,
  { password, createOcr, onProgress }: ReadStatementOptions = {},
): Promise<StatementPage[]> {
  ensureReadableStreamIteration();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: workerUrl } =
    await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    password,
    // Needed to decode scanned images (JBIG2, CCITT, JPEG 2000) and to
    // render text in fonts that are not embedded
    wasmUrl: `${pdfjsAssetsUrl}wasm/`,
    standardFontDataUrl: `${pdfjsAssetsUrl}standard_fonts/`,
    cMapUrl: `${pdfjsAssetsUrl}cmaps/`,
    iccUrl: `${pdfjsAssetsUrl}iccs/`,
  });

  let document;
  try {
    document = await loadingTask.promise;
  } catch (error) {
    await loadingTask.destroy();
    if (error instanceof pdfjs.PasswordException) {
      throw new StatementPdfError(
        error.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD
          ? 'wrong-password'
          : 'password-required',
      );
    }
    throw new StatementPdfError('invalid-pdf', { cause: error });
  }

  // One canvas for all pages: Safari limits the total canvas memory
  const canvas = createCanvas();
  let ocr: StatementOcr | null = null;
  let isOcrUnavailable = false;
  const pages: StatementPage[] = [];
  try {
    for (let number = 1; number <= document.numPages; number++) {
      onProgress?.({ page: number, pageCount: document.numPages });
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const textItems = textItemsFromContent(content.items, viewport.transform);
      const hasTextLayer = textItems.length >= MIN_TEXT_ITEMS;
      const needsOcr = !hasTextLayer && !!createOcr && !isOcrUnavailable;

      const scale = needsOcr ? OCR_SCALE : RENDER_SCALE;
      canvas.width = Math.ceil(viewport.width * scale);
      canvas.height = Math.ceil(viewport.height * scale);
      await page.render({
        canvas: canvas as HTMLCanvasElement,
        viewport: page.getViewport({ scale }),
      }).promise;

      const pixels = getPixels(canvas);
      let { items, redactions } = removeHiddenText(textItems, rect =>
        measureArea(pixels, rect, scale),
      );
      let isRecognized = hasTextLayer;
      if (needsOcr && createOcr) {
        try {
          ocr ??= await createOcr();
          items = await ocr.recognize(canvas, scale);
          redactions = [];
          isRecognized = items.length > 0;
        } catch (error) {
          console.error('OCR of a statement page failed:', error);
          isOcrUnavailable = true;
        }
      }
      // A page with print on it that could not be read is reported, so a
      // failed OCR never hides transactions
      const isBlank =
        measureArea(
          pixels,
          { x: 0, y: 0, width: viewport.width, height: viewport.height },
          scale,
        ).ink < 0.001;

      pages.push({
        width: viewport.width,
        height: viewport.height,
        items,
        redactions,
        isUnreadable: !isRecognized && !isBlank,
      });
      page.cleanup();
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    await ocr?.terminate();
    await loadingTask.destroy();
  }
  return pages;
}

/**
 * A short technical reason for a failed read, shown so a failure can be
 * reported. Error messages describe the code, not the statement's text.
 */
export function describeReadError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 3; depth++) {
    parts.push(
      current instanceof Error
        ? `${current.name}: ${current.message}`
        : String(current),
    );
    current = current instanceof Error ? current.cause : null;
  }
  return parts.join(' ← ').slice(0, 300);
}

function createCanvas(): OcrImage {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(1, 1);
  }
  return window.document.createElement('canvas');
}

function getPixels(canvas: OcrImage): PagePixels {
  const context = (canvas as HTMLCanvasElement).getContext('2d', {
    willReadFrequently: true,
  });
  if (!context) {
    throw new Error('Canvas 2D context is not available');
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
