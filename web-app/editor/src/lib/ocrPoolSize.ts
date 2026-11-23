/** What the browser says about the device, for sizing the OCR worker pool. */
export type DeviceHints = {
  /** Logical cores (navigator.hardwareConcurrency); 0 when unknown. */
  cores: number;
  /** Approximate memory in GB (navigator.deviceMemory, Chromium only); undefined when unknown. */
  memoryGb: number | undefined;
  /** Whether this is a phone or tablet browser. */
  mobile: boolean;
};

/**
 * How many OCR workers per language may run at once. Each Hindi worker holds the Tesseract model
 * (measured: about 70 MB more per extra worker), so the count follows memory, and it leaves one core
 * for the page. Phones that do not report memory (Safari) are treated as 4 GB.
 *
 * @returns 1 on ≤ 2 GB devices, at most 2 on ≤ 4 GB devices and phones without a memory figure,
 *   at most 4 otherwise; never more than cores − 1, never less than 1.
 */
export function poolSizeFor(hints: DeviceHints): number {
  const memoryGb = hints.memoryGb ?? (hints.mobile ? 4 : 8);
  const byMemory = memoryGb <= 2 ? 1 : memoryGb <= 4 ? 2 : 4;
  const cores = hints.cores > 0 ? hints.cores : 2;
  return Math.max(1, Math.min(byMemory, cores - 1));
}

/** Device hints from the current browser. */
export function currentDeviceHints(): DeviceHints {
  // deviceMemory and userAgentData are Chromium-only; absent elsewhere.
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  return {
    cores: nav.hardwareConcurrency || 0,
    memoryGb: nav.deviceMemory,
    mobile: nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent),
  };
}
