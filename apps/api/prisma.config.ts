import path from "node:path";
import { defineConfig } from "prisma/config";

// .env 파일에서 환경변수 로드 (dotenv가 없는 Docker 빌드 환경에서도 동작)
try {
	const { config } = require("dotenv");
	config({ path: path.resolve(__dirname, ".env") });
} catch {
	// dotenv 미설치 환경 (Docker build) — DATABASE_URL fallback 사용
}

// DATABASE_URL (prisma generate는 실제 연결 불필요, placeholder 허용)
const DATABASE_URL =
	process.env.DATABASE_URL ||
	"postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
	earlyAccess: true,
	schema: path.resolve(__dirname, "prisma/schema.prisma"),
	datasource: {
		url: DATABASE_URL,
	},
});
