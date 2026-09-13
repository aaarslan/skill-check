import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { usePackageLoader } from "./usePackageLoader.ts";
import { useFileLoader } from "./useFileLoader.ts";

function delayedFile() {
  let resolveBytes!: (bytes: ArrayBuffer) => void;
  const promise = new Promise<ArrayBuffer>((resolve) => {
    resolveBytes = resolve;
  });
  const file = {
    name: "SKILL.md",
    webkitRelativePath: "demo/SKILL.md",
    size: 10,
    arrayBuffer: () => promise,
  } as File;
  return {
    file,
    finish: (text: string) => resolveBytes(new TextEncoder().encode(text).buffer),
  };
}

describe("input lifecycle", () => {
  it.each(["clear", "replace"] as const)(
    "prevents a stale folder read from overwriting %s",
    async (action) => {
      const { result } = renderHook(() => usePackageLoader());
      const delayed = delayedFile();
      let pending!: Promise<void>;
      act(() => {
        pending = result.current.load([delayed.file]);
      });
      act(() => {
        if (action === "clear") result.current.clear();
        else result.current.replace([{ path: "new.md", content: "# New" }]);
      });
      await act(async () => {
        delayed.finish("# Stale");
        await pending;
      });
      expect(result.current.sources.map((source) => source.path)).toEqual(
        action === "clear" ? [] : ["new.md"],
      );
      expect(result.current.loading).toBe(false);
    },
  );
  it("strips the chosen folder root and retains nested file paths", async () => {
    const { result } = renderHook(() => usePackageLoader());
    const file = {
      name: "test.md",
      webkitRelativePath: "demo/refs/test.md",
      size: 10,
      arrayBuffer: async () => new TextEncoder().encode("# Test").buffer,
    } as File;
    await act(async () => {
      await result.current.load([file]);
    });
    expect(result.current.sources[0]!.path).toBe("refs/test.md");
  });
  it("rejects unsupported files before reading their bytes", async () => {
    const { result } = renderHook(() => usePackageLoader());
    let read = false;
    const file = {
      name: "payload.zip",
      size: 10,
      arrayBuffer: async () => {
        read = true;
        return new ArrayBuffer(0);
      },
    } as File;
    await act(async () => {
      await result.current.load([file]);
    });
    expect(read).toBe(false);
    expect(result.current.error).toContain("supported text");
  });
  it("rejects malformed UTF-8 before package analysis", async () => {
    const { result } = renderHook(() => usePackageLoader());
    const file = {
      name: "broken.md",
      size: 3,
      arrayBuffer: async () => new Uint8Array([0xff, 0xfe, 0xff]).buffer,
    } as File;
    await act(async () => {
      await result.current.load([file]);
    });
    expect(result.current.sources).toEqual([]);
    expect(result.current.error).toContain("valid UTF-8");
  });
  it("rejects malformed UTF-8 in a single file", async () => {
    const { result } = renderHook(() => useFileLoader());
    const file = {
      name: "broken.md",
      size: 3,
      arrayBuffer: async () => new Uint8Array([0xff, 0xfe, 0xff]).buffer,
    } as File;
    act(() => result.current.loadFromFile(file));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({ message: expect.stringContaining("valid UTF-8") });
  });
  it("applies the same byte limit to pasted text", () => {
    const { result } = renderHook(() => useFileLoader());
    act(() => result.current.loadFromText("😀".repeat(65537)));
    expect(result.current.state.status).toBe("error");
    act(() => result.current.loadFromText("\uFEFF# Good\r\nText"));
    expect(result.current.state.status === "loaded" && result.current.state.file.content).toBe(
      "# Good\nText",
    );
  });
});
