/**
 * FakeLogger - E2E 테스트용 PinoLogger Mock
 *
 * PinoLogger의 인터페이스를 구현하여 테스트 환경에서
 * 로거 의존성을 안전하게 처리합니다.
 */
import { Injectable } from "@nestjs/common";

@Injectable()
export class FakeLogger {
	setContext(context: string): void {
		this.context = context;
	}

	trace(_message: string, ..._args: unknown[]): void {
		// 테스트에서는 로그 출력 생략
	}

	debug(_message: string, ..._args: unknown[]): void {
		// 테스트에서는 로그 출력 생략
	}

	info(_message: string, ..._args: unknown[]): void {
		// 테스트에서는 로그 출력 생략
	}

	warn(_message: string, ..._args: unknown[]): void {
		// 테스트에서는 로그 출력 생략
	}

	error(_message: string, ..._args: unknown[]): void {
		// 테스트에서는 로그 출력 생략
	}

	fatal(_message: string, ..._args: unknown[]): void {
		// 테스트에서는 로그 출력 생략
	}

	log(_message: string, ..._args: unknown[]): void {
		// 테스트에서는 로그 출력 생략
	}

	/**
	 * PinoLogger의 assign 메서드 구현
	 */
	assign(_bindings: Record<string, unknown>): void {
		// 테스트에서는 무시
	}
}
