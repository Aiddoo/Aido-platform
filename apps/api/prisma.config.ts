import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// .env 파일에서 환경변수 로드
config({ path: path.resolve(__dirname, ".env") });

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
