const PAGE_SIZE = 500;
const ID_CHUNK_SIZE = 100;

type Page<T> = { data: T[] | null; error: unknown };

export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data) throw new Error("Veri sayfası alınamadı.");
    if (data.length === 0) return rows;
    rows.push(...data);
    from += data.length;
  }
}

export async function readAllByIds<T>(ids: string[], fetchPage: (ids: string[], from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; start < ids.length; start += ID_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + ID_CHUNK_SIZE);
    rows.push(...await readAllPages((from, to) => fetchPage(chunk, from, to)));
  }
  return rows;
}
