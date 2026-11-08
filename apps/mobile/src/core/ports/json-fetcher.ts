/** HttpClient는 Aido의 `{ success, data, timestamp }` envelope 계약을 소유하므로 원문 JSON을 반환하는 app-config API와 섞지 않는다 */
export interface JsonFetcher {
  get(url: string, signal?: AbortSignal): Promise<unknown>;
}
