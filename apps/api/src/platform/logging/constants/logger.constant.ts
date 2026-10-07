/**
 * 민감 정보를 마스킹할 경로들
 */
export const LOGGER_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.password",
  "req.body.currentPassword",
  "req.body.newPassword",
  "req.body.confirmPassword",
  "req.body.token",
  "req.body.refreshToken",
  "req.body.accessToken",
] as const;

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
