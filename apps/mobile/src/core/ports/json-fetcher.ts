/**
 * Envelope가 없는 공개 JSON 응답을 읽는 포트.
 *
 * 기존 HttpClient는 Aido의 `{ success, data, timestamp }` envelope 계약을 소유하므로,
 * 원문 응답을 반환하는 additive app-config API와 혼용하지 않는다.
 */
export interface JsonFetcher {
  get(url: string): Promise<unknown>;
}
