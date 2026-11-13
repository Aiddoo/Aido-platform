import { invalidUserSearchCursor } from "./friends.errors.js";

// 관련도 rank는 계산값이라 id만으로는 다음 페이지를 이어 줄 수 없어 (rank, id)를 함께 싣는다.
// id는 콜론이 없는 CUID라 콜론으로 나눠도 안전하다
export interface UserSearchCursor {
  readonly rank: number;
  readonly id: string;
}

export interface UserSearchPageCursor {
  readonly position: UserSearchCursor;
  /** 첫 쪽에서 센 전체 수. 다음 쪽은 다시 세지 않는다. 총수 없이 만든 옛 커서면 null이라 다시 센다 */
  readonly totalCount: number | null;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

// 총수는 끝에 붙여 옛 서버가 첫 콜론으로 나눠도 rank를 그대로 읽는다
export function encodeUserSearchCursor({ position, totalCount }: UserSearchPageCursor): string {
  const fields = [position.rank, position.id, ...(totalCount == null ? [] : [totalCount])];
  return Buffer.from(fields.join(":"), "utf8").toString("base64url");
}

export function decodeUserSearchCursor(raw: string): UserSearchPageCursor {
  const [rankField, id, totalField, ...rest] = Buffer.from(raw, "base64url")
    .toString("utf8")
    .split(":");
  const rank = Number(rankField);
  const hasRank = rankField != null && rankField.length > 0 && isNonNegativeInteger(rank);
  const hasId = id != null && id.length > 0;
  const totalCount = totalField == null ? null : Number(totalField);
  const hasValidTotal =
    totalCount == null || (totalField !== "" && isNonNegativeInteger(totalCount));
  if (!hasRank || !hasId || !hasValidTotal || rest.length > 0) {
    throw invalidUserSearchCursor(raw);
  }
  return { position: { rank, id }, totalCount };
}
