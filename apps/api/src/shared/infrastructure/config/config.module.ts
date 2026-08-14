import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";

import { validateEnv } from "./schemas";
import { TypedConfigService } from "./services/config.service";

/**
 * 환경변수 설정 모듈
 *
 * 환경별 .env 파일을 로드하고 Zod로 검증합니다.
 * - production: .env
 * - test: .env.test
 * - development: .env.development
 *
 * @Global() 데코레이터로 전역 모듈로 등록됩니다.
 */
@Global()
@Module({
	imports: [
		NestConfigModule.forRoot({
			isGlobal: true,
			envFilePath: getEnvFilePath(),
			validate: validateEnv,
			ignoreEnvFile: false,
		}),
	],
	providers: [TypedConfigService],
	exports: [TypedConfigService],
})
export class AppConfigModule {}

/**
 * NODE_ENV에 따른 .env 파일 경로 반환
 *
 * - production → .env
 * - test → .env.test (외부 서비스 비활성)
 * - development → .env.development
 */
function getEnvFilePath(): string {
	const env = process.env.NODE_ENV || "development";
	if (env === "production") return ".env";
	if (env === "test") return ".env.test";
	return ".env.development";
}
