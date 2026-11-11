import { invalidUserSearchCursor } from "./friends.errors.js";

// 관련도 rank는 계산값이라 id만으로는 다음 페이지를 이어 줄 수 없어 (rank, id)를 함께 싣는다.
// id는 콜론이 없는 CUID라 첫 콜론으로 나눠도 안전하다
export interface UserSearchCursor {
  readonly rank: number;
  readonly id: string;
}

export function encodeUserSearchCursor(cursor: UserSearchCursor): string {
  return Buffer.from(`${cursor.rank}:${cursor.id}`, "utf8").toString("base64url");
}

export function decodeUserSearchCursor(raw: string): UserSearchCursor {
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex <= 0) {
    throw invalidUserSearchCursor(raw);
  }

  const rank = Number(decoded.slice(0, separatorIndex));
  const id = decoded.slice(separatorIndex + 1);
  if (!Number.isInteger(rank) || rank < 0 || id.length === 0) {
    throw invalidUserSearchCursor(raw);
  }
  return { rank, id };
}
