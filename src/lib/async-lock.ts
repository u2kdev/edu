/**
 * In-process keyed mutex to serialize concurrent critical operations per key (e.g. group enrollment).
 */
const queues = new Map<string, Promise<void>>();

export async function withKeyedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();

  let release!: () => void;
  const lock = new Promise<void>((resolve) => {
    release = resolve;
  });

  const chained = previous.then(
    () => lock,
    () => lock
  );
  queues.set(key, chained);

  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (queues.get(key) === chained) {
      queues.delete(key);
    }
  }
}
