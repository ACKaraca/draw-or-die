import { runInParallelBatches } from '@/lib/run-in-parallel-batches';

describe('runInParallelBatches', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid batch size %s',
    async (batchSize) => {
      await expect(runInParallelBatches([], batchSize, async () => undefined, jest.fn())).rejects.toThrow(
        `Invalid batchSize: ${batchSize}`,
      );
    },
  );

  it('runs each item once without exceeding the batch size', async () => {
    const processed: number[] = [];
    let activeWorkers = 0;
    let maximumActiveWorkers = 0;

    await runInParallelBatches(
      [1, 2, 3, 4, 5],
      2,
      async (item) => {
        activeWorkers += 1;
        maximumActiveWorkers = Math.max(maximumActiveWorkers, activeWorkers);
        await Promise.resolve();
        processed.push(item);
        activeWorkers -= 1;
      },
      jest.fn(),
    );

    expect(processed.sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5]);
    expect(maximumActiveWorkers).toBeLessThanOrEqual(2);
  });

  it('finishes one batch before starting the next', async () => {
    const events: string[] = [];

    await runInParallelBatches(
      [1, 2, 3],
      2,
      async (item) => {
        events.push(`start:${item}`);
        await Promise.resolve();
        events.push(`finish:${item}`);
      },
      jest.fn(),
    );

    expect(events.indexOf('start:3')).toBeGreaterThan(events.indexOf('finish:1'));
    expect(events.indexOf('start:3')).toBeGreaterThan(events.indexOf('finish:2'));
  });

  it('reports a worker error and continues later work', async () => {
    const expectedError = new Error('write failed');
    const processed: number[] = [];
    const onError = jest.fn();

    await expect(
      runInParallelBatches(
        [1, 2, 3],
        2,
        async (item) => {
          if (item === 2) throw expectedError;
          processed.push(item);
        },
        onError,
      ),
    ).resolves.toBeUndefined();

    expect(processed).toEqual([1, 3]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expectedError, { batchIndex: 0, batchSize: 2 });
  });

  it('does not call the worker for an empty list', async () => {
    const worker = jest.fn<Promise<void>, [number]>().mockResolvedValue(undefined);

    await runInParallelBatches([], 2, worker, jest.fn());

    expect(worker).not.toHaveBeenCalled();
  });
});
