export const HttpLogEvent = {
  REQUEST_COMPLETED: "http.request.completed",
  REQUEST_FAILED: "http.request.failed",
  RESPONSE_CONTRACT_VIOLATED: "http.response-contract.violated",
} as const;

export function httpRequestPath(url: string | undefined): string {
  return url?.split("?", 1)[0] ?? "/";
}
