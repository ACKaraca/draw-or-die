type BatchErrorContext = {
  batchIndex: number;
  batchSize: number;
};

type BatchErrorHandler = (error: unknown, context: BatchErrorContext) => void;

export async function runInParallelBatches<T>(
  items: readonly T[],
  batchSize: number,
  worker: (item: T) => Promise<void>,
  onError: BatchErrorHandler,
): Promise<void> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`Invalid batchSize: ${batchSize}`);
  }

  for (let batchIndex = 0; batchIndex < items.length; batchIndex += batchSize) {
    const batch = items.slice(batchIndex, batchIndex + batchSize);
    await Promise.all(
      batch.map(async (item) => {
        try {
          await worker(item);
        } catch (error) {
          onError(error, { batchIndex, batchSize });
        }
      }),
    );
  }
}
