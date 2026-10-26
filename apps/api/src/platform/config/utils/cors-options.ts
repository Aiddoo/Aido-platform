import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

import type { EnvConfig } from "../schemas/index.js";

const DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:19000",
  "http://localhost:19006",
];

// 랜딩의 초대 미리보기(aido.kr/i/{code})가 공개 API를 브라우저에서 부른다
const PUBLIC_WEB_ORIGINS = ["https://aido.kr", "https://www.aido.kr"];

export function createCorsOptions(
  nodeEnv: EnvConfig["NODE_ENV"],
  corsOrigins: string[],
): CorsOptions {
  return {
    origin:
      nodeEnv === "development"
        ? DEVELOPMENT_ORIGINS
        : [...new Set([...corsOrigins, ...PUBLIC_WEB_ORIGINS])],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Timezone",
      "X-App-Version",
    ],
  };
}
