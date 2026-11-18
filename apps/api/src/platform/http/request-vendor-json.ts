import {
  type HttpClient,
  type HttpHeadersInit,
  type HttpQuery,
  HttpParseError,
} from "@nestjs/http-client";

export type VendorJsonOutcome =
  | { readonly kind: "success"; readonly body: unknown }
  | { readonly kind: "http_failure"; readonly statusCode: number };

/**
 * 벤더 JSON API를 호출하고 성공 본문과 HTTP 실패 상태를 구분해 돌려준다.
 *
 * client는 `throwOnHttpError: false`로 등록되어 있어야 한다. 본문 형태 검증은 호출부가
 * 자신의 스키마로 수행하며, 2xx 응답의 잘못된 JSON과 전송 오류는 그대로 던진다.
 */
export interface VendorJsonRequest {
  readonly url: string;
  readonly query: HttpQuery;
  readonly headers?: HttpHeadersInit;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export async function requestVendorJson(
  http: HttpClient,
  request: VendorJsonRequest,
): Promise<VendorJsonOutcome> {
  try {
    const response = await http.request(request.url, {
      query: request.query,
      responseType: "json",
      headers: request.headers,
      signal: request.signal,
      timeout: request.timeoutMs,
    });
    if (!response.ok) {
      return { kind: "http_failure", statusCode: response.status };
    }
    return { kind: "success", body: response.data };
  } catch (error) {
    if (error instanceof HttpParseError && !isSuccessStatus(error.status)) {
      return { kind: "http_failure", statusCode: error.status };
    }
    throw error;
  }
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/** 회로가 실패로 세는 응답: 공급자 쪽 장애(5xx). 4xx는 그 요청의 문제다. */
export function isServerFailureOutcome(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result != null &&
    "kind" in result &&
    result.kind === "http_failure" &&
    "statusCode" in result &&
    typeof result.statusCode === "number" &&
    result.statusCode >= 500
  );
}

/** 회로를 연 벤더 실패를 로그·경보용 고정 기호로 줄인다. */
export function describeVendorFailure(failure: unknown): Readonly<Record<string, string>> {
  if (
    typeof failure === "object" &&
    failure != null &&
    "statusCode" in failure &&
    typeof failure.statusCode === "number"
  ) {
    return { statusCode: String(failure.statusCode) };
  }
  return failure instanceof Error ? { errorType: failure.name } : {};
}
