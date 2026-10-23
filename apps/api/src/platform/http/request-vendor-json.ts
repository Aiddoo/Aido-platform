import { type HttpClient, type HttpQuery, HttpParseError } from "@nestjs/http-client";

export type VendorJsonOutcome =
  | { readonly kind: "success"; readonly body: unknown }
  | { readonly kind: "http_failure"; readonly statusCode: number };

/**
 * 벤더 JSON API를 호출하고 성공 본문과 HTTP 실패 상태를 구분해 돌려준다.
 *
 * client는 `throwOnHttpError: false`로 등록되어 있어야 한다. 본문 형태 검증은 호출부가
 * 자신의 스키마로 수행하며, 2xx 응답의 잘못된 JSON과 전송 오류는 그대로 던진다.
 */
export async function requestVendorJson(
  http: HttpClient,
  url: string,
  query: HttpQuery,
): Promise<VendorJsonOutcome> {
  try {
    const response = await http.request(url, { query, responseType: "json" });
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
