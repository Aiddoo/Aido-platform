import type { INestApplication } from "@nestjs/common";
import { json, type NextFunction, type Request, type Response } from "express";

/**
 * 기본 한도(100KB)보다 큰 본문을 받는 라우트. 같은 경로의 기본 파서보다 먼저 등록하고, 본문을 읽고 나면
 * 기본 파서는 건너뛴다. 녹음 정리는 전사 전체와 문장 목록을 함께 보낸다. 한도 초과는 Nest express 어댑터가
 * 413 HttpException으로 바꿔 전역 필터가 다른 경로와 같은 SYS_0002로 답한다.
 */
const ROUTE_BODY_LIMITS = [{ path: "/v1/voice-notes/digest", limit: "256kb" }] as const;

export function configureRouteBodyLimits(app: INestApplication): void {
  for (const { path, limit } of ROUTE_BODY_LIMITS) {
    const parse = json({ limit });
    // 이름이 jsonParser인 미들웨어가 이미 있으면 Nest가 전역 JSON 파서를 등록하지 않아 감싼다
    app.use(path, (request: Request, response: Response, next: NextFunction) => {
      parse(request, response, next);
    });
  }
}
