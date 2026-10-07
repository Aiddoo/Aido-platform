export const HttpLogEvent = {
  REQUEST_COMPLETED: "http.request.completed",
  REQUEST_FAILED: "http.request.failed",
} as const;

export function httpRequestPath(url: string | undefined): string {
  return url?.split("?", 1)[0] ?? "/";
}
