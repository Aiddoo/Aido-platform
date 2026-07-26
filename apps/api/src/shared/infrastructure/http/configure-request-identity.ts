import type { INestApplication } from "@nestjs/common";
import type { Express } from "express";

/**
 * host-local Nginx 한 홉만 신뢰해 Express가 canonical client IP를 계산하게 한다.
 */
export function configureRequestIdentity(app: INestApplication): void {
	const express: Express = app.getHttpAdapter().getInstance();
	express.set("trust proxy", 1);
}
