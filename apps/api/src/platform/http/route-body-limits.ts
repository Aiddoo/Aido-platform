import type { INestApplication } from "@nestjs/common";
import { PayloadTooLargeException } from "@nestjs/common";
import { json, type NextFunction, type Request, type Response } from "express";

/**
 * 기본 한도(100KB)보다 큰 본문을 받는 라우트. 같은 경로의 기본 파서보다 먼저 등록하고, 본문을 읽고 나면
 * 기본 파서는 건너뛴다. 녹음 정리는 전사 전체와 문장 목록을 함께 보낸다.
 */
const ROUTE_BODY_LIMITS = [{ path: "/v1/voice-notes/digest", limit: "256kb" }] as const;

function isBodyTooLarge(error: unknown): boolean {
  return error instanceof Error && "type" in error && error.type === "entity.too.large";
}

export function configureRouteBodyLimits(app: INestApplication): void {
  for (const { path, limit } of ROUTE_BODY_LIMITS) {
    const parse = json({ limit });
    app.use(path, (request: Request, response: Response, next: NextFunction) => {
      parse(request, response, (error?: unknown) => {
        // 파서 오류는 HttpException이 아니라 그대로 두면 전역 필터가 500으로 답한다.
        next(
          isBodyTooLarge(error) ? new PayloadTooLargeException("요청 본문이 너무 큽니다.") : error,
        );
      });
    });
  }
}
