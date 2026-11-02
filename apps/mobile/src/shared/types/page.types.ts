export interface Page<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  /** 서버 제공 불투명 커서 (관련도 랭킹 등 id 기반 커서가 불가능한 목록용, 선택) */
  nextCursor?: string | null;
}
