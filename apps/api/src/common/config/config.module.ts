import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { validateEnv } from "./schemas";
import { TypedConfigService } from "./services/config.service";

/**
 * 환경변수 설정 모듈
 *
 * 환경별 .env 파일을 로드하고 Zod로 검증합니다.
 * - development: .env.development
 * - production: .env.production
 * - test: .env.test (있으면)
 *
 * @Global() 데코레이터로 전역 모듈로 등록됩니다.
 */
@Global()
@Module({
	imports: [
		NestConfigModule.forRoot({
			isGlobal: true,
			// 환경별 .env 파일 로드 (NODE_ENV 기반)
			envFilePath: getEnvFilePath(),
			validate: validateEnv,
			// .env 파일이 없어도 process.env에서 로드
			ignoreEnvFile: false,
		}),
	],
	providers: [TypedConfigService],
	exports: [TypedConfigService],
})
export class AppConfigModule {}

/**
 * NODE_ENV에 따른 .env 파일 경로 반환
 */
function getEnvFilePath(): string[] {
	const env = process.env.NODE_ENV || "development";

	// 우선순위: 환경별 파일 > 기본 .env
	const paths: string[] = [];

	switch (env) {
		case "production":
			paths.push(".env.production");
			break;
		case "test":
			paths.push(".env.test");
			paths.push(".env.development"); // fallback
			break;
		default:
			// development 및 기타 모든 환경
			paths.push(".env.development");
			break;
	}

	// 기본 .env는 항상 fallback으로 포함
	paths.push(".env");

	return paths;
}
