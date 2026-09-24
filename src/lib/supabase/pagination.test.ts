import { describe, expect, it } from "vitest";
import { readAllByIds, readAllPages } from "./pagination";

describe("Supabase pagination", () => {
  it("reads beyond the 1,000-row API cap without dropping a final full page", async () => {
    const source = Array.from({ length: 1_205 }, (_, id) => ({ id }));
    const requested: number[] = [];
    const rows = await readAllPages(async (from, to) => {
      requested.push(from);
      return { data: source.slice(from, to + 1), error: null };
    });
    expect(rows).toEqual(source);
    expect(requested).toEqual([0, 500, 1_000, 1_205]);
  });

  it("pages participant rows within bounded ID filters", async () => {
    const ids = Array.from({ length: 101 }, (_, id) => `expense-${id}`);
    const chunks: number[] = [];
    const rows = await readAllByIds(ids, async (chunk, from, to) => {
      if (from === 0) chunks.push(chunk.length);
      const source = chunk.flatMap((id) => Array.from({ length: 6 }, (_, index) => `${id}-member-${index}`));
      return { data: source.slice(from, to + 1), error: null };
    });
    expect(chunks).toEqual([100, 1]);
    expect(rows).toHaveLength(606);
    expect(rows.at(-1)).toBe("expense-100-member-5");
  });

  it("continues when the server caps each response below the requested range", async () => {
    const source = Array.from({ length: 235 }, (_, id) => id);
    const rows = await readAllPages(async (from) => ({ data: source.slice(from, from + 100), error: null }));
    expect(rows).toEqual(source);
  });

  it("fails instead of accepting an errored or missing page", async () => {
    const failure = new Error("query failed");
    await expect(readAllPages(async () => ({ data: null, error: failure }))).rejects.toBe(failure);
    await expect(readAllPages(async () => ({ data: null, error: null }))).rejects.toThrow("Veri sayfası alınamadı");
  });
});
