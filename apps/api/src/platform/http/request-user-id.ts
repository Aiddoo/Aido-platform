import type { HttpRequest } from "./http-request.js";

/** 인증 가드가 `request.user`에 둔 사용자 ID를 읽는다. 인증 전 요청이면 undefined다. */
export function readRequestUserId(request: HttpRequest): string | undefined {
  const { user } = request;
  if (typeof user !== "object" || user == null || !("userId" in user)) {
    return undefined;
  }
  return typeof user.userId === "string" ? user.userId : undefined;
}
