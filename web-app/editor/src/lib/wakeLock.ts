/**
 * Keeps the screen on while a long job runs, so a phone does not sleep and pause the tab halfway
 * through a conversion. Browsers without the Screen Wake Lock API, or that refuse it (battery
 * saver, a hidden tab), simply run without it.
 *
 * @returns Releases the lock; safe to call more than once.
 */
export async function holdScreenAwake(): Promise<() => void> {
  const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
  if (!wakeLock) return () => undefined;
  try {
    const sentinel = await wakeLock.request('screen');
    return () => void sentinel.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}

/**
 * Time left for a job running at a steady pace, from how long the done part took.
 *
 * @param elapsedMs Time spent so far, in ms.
 * @param done Units finished.
 * @param total Units in the job.
 * @returns Whole minutes left (at least 1), or null before 3 units are done, when the estimate
 *   would be noise.
 */
export function minutesLeft(elapsedMs: number, done: number, total: number): number | null {
  if (done < 3 || done >= total) return null;
  return Math.max(1, Math.round((elapsedMs / done) * (total - done) / 60000));
}
