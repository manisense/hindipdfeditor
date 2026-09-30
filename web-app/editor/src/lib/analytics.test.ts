import { afterEach, expect, it, vi } from "vitest";
import { trackToolEvent } from "./analytics";

afterEach(() => {
  delete window.gtag;
});
it("records only the approved workflow fields", () => {
  window.gtag = vi.fn();
  document.documentElement.lang = "hi";
  trackToolEvent("export_success", "edit");
  expect(window.gtag).toHaveBeenCalledExactlyOnceWith(
    "event",
    "export_success",
    { tool_id: "edit", ui_language: "hi" },
  );
});
it("does not break exports if telemetry is unavailable or throws", () => {
  expect(() => trackToolEvent("export_success", "edit")).not.toThrow();
  window.gtag = () => {
    throw new Error("blocked telemetry");
  };
  expect(() => trackToolEvent("export_success", "edit")).not.toThrow();
});
