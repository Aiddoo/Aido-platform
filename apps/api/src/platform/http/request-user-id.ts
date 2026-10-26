import type { Request } from "express";

/** 인증 strategy가 `req.user`에 둔 사용자 ID를 읽는다. 인증 전 요청이면 undefined다. */
export function readRequestUserId(request: Request): string | undefined {
  const user: unknown = request.user;
  if (typeof user !== "object" || user == null || !("userId" in user)) {
    return undefined;
  }
  return typeof user.userId === "string" ? user.userId : undefined;
}
