import { describe, expect, it } from "vitest";
import {
  TOOLS,
  readEditModeFromLocation,
  readToolIdFromLocation,
  toolHref,
} from "./tools";
import { seoForTool } from "./seo";

describe("public tool routes", () => {
  it("resolves task paths and metadata independently of query tool overrides", () => {
    for (const tool of TOOLS) {
      window.history.replaceState(
        {},
        "",
        `${tool.path}?tool=invalid&mode=erase&lang=hi`,
      );
      expect(readToolIdFromLocation()).toBe(tool.id);
      expect(readEditModeFromLocation()).toBe("erase");
      expect(toolHref(tool.id)).toBe(tool.path);
      expect(seoForTool(tool.id).canonicalPath).toBe(tool.path);
    }
  });
  it("still supports old query links during migration", () => {
    window.history.replaceState({}, "", "/edit/?tool=translate");
    expect(readToolIdFromLocation()).toBe("translate");
    window.history.replaceState({}, "", "/");
    expect(readToolIdFromLocation()).toBe(null);
    expect(seoForTool(null).canonicalPath).toBe("/");
  });
});
