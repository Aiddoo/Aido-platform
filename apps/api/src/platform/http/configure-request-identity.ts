import type { INestApplication } from "@nestjs/common";
import type { Express } from "express";

/** host-local Nginx 한 홉만 신뢰해 어댑터가 canonical client IP(`request.ip`)를 계산하게 한다. */
export function configureRequestIdentity(app: INestApplication): void {
  // Express 전용 설정이다. HTTP 어댑터를 바꾸면 그 어댑터의 proxy 신뢰 설정으로 옮긴다
  const express: Express = app.getHttpAdapter().getInstance();
  express.set("trust proxy", 1);
}
