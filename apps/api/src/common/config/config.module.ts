import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { validateEnv } from "./schemas";
import { TypedConfigService } from "./services/config.service";

/**
 * 환경변수 설정 모듈
 *
 * 환경별 .env 파일을 로드하고 Zod로 검증합니다.
 * - development/test: .env.development
 * - production: .env
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
 * - 그 외 (development, test) → .env.development
 */
function getEnvFilePath(): string {
	const env = process.env.NODE_ENV || "development";
	return env === "production" ? ".env" : ".env.development";
}
