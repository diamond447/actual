/**
 * pdf.js reads the text of a page with `for await` over a ReadableStream,
 * which older Safari versions do not support. Without this, every
 * statement fails to read there.
 */
export function ensureReadableStreamIteration() {
  if (
    typeof ReadableStream === 'undefined' ||
    Symbol.asyncIterator in ReadableStream.prototype
  ) {
    return;
  }
  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
    configurable: true,
    writable: true,
    value: async function* iterate<T>(this: ReadableStream<T>) {
      const reader = this.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            return;
          }
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  });
}
