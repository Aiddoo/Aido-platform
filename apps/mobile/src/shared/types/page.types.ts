export interface Page<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  /** id 기반 커서가 불가능한 목록(관련도 랭킹 등)용 불투명 커서 */
  nextCursor?: string | null;
}
