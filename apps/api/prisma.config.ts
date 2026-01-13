import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// .env 파일에서 환경변수 로드
config({ path: path.resolve(__dirname, ".env") });

// 필수 환경변수 검증
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
	earlyAccess: true,
	schema: path.resolve(__dirname, "prisma/schema.prisma"),
	datasource: {
		url: DATABASE_URL,
	},
});
