import { ensureReadableStreamIteration } from './readableStreamIteration';

describe('ensureReadableStreamIteration', () => {
  const prototype = ReadableStream.prototype;
  const original = Object.getOwnPropertyDescriptor(
    prototype,
    Symbol.asyncIterator,
  );

  afterEach(() => {
    if (original) {
      Object.defineProperty(prototype, Symbol.asyncIterator, original);
    }
  });

  it('lets streams be read with for await where the browser cannot', async () => {
    Reflect.deleteProperty(prototype, Symbol.asyncIterator);
    expect(Symbol.asyncIterator in prototype).toBe(false);

    ensureReadableStreamIteration();

    const stream = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
        controller.enqueue(2);
        controller.close();
      },
    });
    const values: number[] = [];
    for await (const value of stream) {
      values.push(value);
    }
    expect(values).toEqual([1, 2]);
    expect(stream.locked).toBe(false);
  });

  it('keeps the browser implementation when there is one', () => {
    ensureReadableStreamIteration();
    expect(
      Object.getOwnPropertyDescriptor(prototype, Symbol.asyncIterator),
    ).toEqual(original);
  });
});
