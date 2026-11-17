import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * 앱이 읽는 HTTP 요청 모양. Node 요청에 HTTP 어댑터와 인증 가드가 더하는 칸만 얹는다.
 * Express 타입을 직접 import하지 않고 이 타입을 써서 어댑터를 바꿀 때 이 파일만 고친다.
 */
export interface HttpRequest extends IncomingMessage {
  // 서버가 받은 요청은 Node가 method·url을 늘 채운다(비어 있는 쪽은 클라이언트 응답이다)
  readonly method: string;
  readonly url: string;
  // 인증 가드가 검증한 사용자를 두는 자리. 읽는 쪽은 각자 schema로 확인한다
  user?: unknown;
  // 어댑터가 trust proxy 설정으로 계산한 클라이언트 IP
  readonly ip?: string;
  // 어댑터가 고른 route. 모양은 어댑터마다 달라 readRouteTemplate이 확인한다
  readonly route?: unknown;
}

export type HttpResponse = ServerResponse;
