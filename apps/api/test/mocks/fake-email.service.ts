import type { InquiryTemplateData } from "@/modules/email/templates/inquiry.template";
import type {
	EmailSendResult,
	EmailTag,
	EmailType,
} from "@/modules/email/types/email.types";

/**
 * 발송된 이메일 기록
 */
interface SentEmail {
	code: string;
	type: EmailType;
	sentAt: Date;
	idempotencyKey?: string;
	tags?: EmailTag[];
}

/**
 * 테스트용 FakeEmailService
 *
 * 실제 이메일을 발송하지 않고, 발송된 코드를 메모리에 저장합니다.
 * 테스트에서 getLastCode()로 마지막 발송된 코드를 조회할 수 있습니다.
 *
 * 추가 기능:
 * - Idempotency Key 지원 (중복 발송 감지)
 * - 실패 시뮬레이션 (재시도 로직 테스트용)
 * - 태그 저장 및 조회
 */
/**
 * 발송된 문의 이메일 기록
 */
interface SentInquiry {
	to: string;
	data: InquiryTemplateData;
	sentAt: Date;
}

export class FakeEmailService {
	private _sentEmails: Map<string, SentEmail> = new Map();
	private _sentInquiries: SentInquiry[] = [];
	private _idempotencyKeys: Set<string> = new Set();

	/** 실패 시뮬레이션 설정 */
	private _shouldFail = false;
	private _failureCount = 0;
	private _maxFailures = 0;

	/**
	 * 이메일 인증 코드 발송 (Mock)
	 */
	async sendVerificationCode(
		to: string,
		data: { code: string; expiryMinutes: number },
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		// Idempotency 체크 - 이미 처리된 요청이면 중복으로 표시
		if (idempotencyKey && this._idempotencyKeys.has(idempotencyKey)) {
			console.log(
				`📧 [FakeEmail] Duplicate request detected (${idempotencyKey})`,
			);
			return {
				success: true,
				messageId: `fake-duplicate-${Date.now()}`,
				retryCount: 0,
			};
		}

		// 실패 시뮬레이션 체크
		const failureResult = this._checkFailureSimulation();
		if (failureResult) {
			return failureResult;
		}

		// Idempotency Key 저장
		if (idempotencyKey) {
			this._idempotencyKeys.add(idempotencyKey);
		}

		const tags: EmailTag[] = [
			{ name: "type", value: "verification" },
			{ name: "environment", value: "test" },
		];

		this._sentEmails.set(to, {
			code: data.code,
			type: "verification",
			sentAt: new Date(),
			idempotencyKey,
			tags,
		});

		console.log(`📧 [FakeEmail] Verification code sent to ${to}: ${data.code}`);
		return { success: true, messageId: `fake-${Date.now()}`, retryCount: 0 };
	}

	/**
	 * 비밀번호 재설정 코드 발송 (Mock)
	 */
	async sendPasswordResetCode(
		to: string,
		data: { code: string; expiryMinutes: number },
		idempotencyKey?: string,
	): Promise<EmailSendResult> {
		// Idempotency 체크
		if (idempotencyKey && this._idempotencyKeys.has(idempotencyKey)) {
			console.log(
				`📧 [FakeEmail] Duplicate request detected (${idempotencyKey})`,
			);
			return {
				success: true,
				messageId: `fake-duplicate-${Date.now()}`,
				retryCount: 0,
			};
		}

		// 실패 시뮬레이션 체크
		const failureResult = this._checkFailureSimulation();
		if (failureResult) {
			return failureResult;
		}

		// Idempotency Key 저장
		if (idempotencyKey) {
			this._idempotencyKeys.add(idempotencyKey);
		}

		const tags: EmailTag[] = [
			{ name: "type", value: "password-reset" },
			{ name: "environment", value: "test" },
		];

		this._sentEmails.set(to, {
			code: data.code,
			type: "password-reset",
			sentAt: new Date(),
			idempotencyKey,
			tags,
		});

		console.log(
			`📧 [FakeEmail] Password reset code sent to ${to}: ${data.code}`,
		);
		return { success: true, messageId: `fake-${Date.now()}`, retryCount: 0 };
	}

	/**
	 * 문의 이메일 발송 (Mock)
	 */
	async sendInquiry(
		to: string,
		data: InquiryTemplateData,
	): Promise<EmailSendResult> {
		// 실패 시뮬레이션 체크
		const failureResult = this._checkFailureSimulation();
		if (failureResult) {
			return failureResult;
		}

		this._sentInquiries.push({
			to,
			data,
			sentAt: new Date(),
		});

		console.log(`📧 [FakeEmail] Inquiry sent to ${to}: ${data.categoryLabel}`);
		return { success: true, messageId: `fake-${Date.now()}`, retryCount: 0 };
	}

	// ===== 기존 테스트 유틸리티 메서드 =====

	/**
	 * 특정 이메일로 발송된 마지막 코드 조회
	 */
	getLastCode(email: string): string | undefined {
		return this._sentEmails.get(email)?.code;
	}

	/**
	 * 모든 발송 기록 초기화
	 */
	clear(): void {
		this._sentEmails.clear();
		this._sentInquiries = [];
		this._idempotencyKeys.clear();
		this._resetFailureSimulation();
	}

	/**
	 * 특정 이메일로 발송된 기록이 있는지 확인
	 */
	hasSentTo(email: string): boolean {
		return this._sentEmails.has(email);
	}

	// ===== 새로운 테스트 유틸리티 메서드 =====

	/**
	 * 특정 이메일로 발송된 전체 기록 조회
	 */
	getSentEmail(email: string): SentEmail | undefined {
		return this._sentEmails.get(email);
	}

	/**
	 * 저장된 모든 Idempotency Key 조회
	 */
	getIdempotencyKeys(): Set<string> {
		return new Set(this._idempotencyKeys);
	}

	/**
	 * 특정 Idempotency Key가 이미 사용되었는지 확인
	 */
	hasIdempotencyKey(key: string): boolean {
		return this._idempotencyKeys.has(key);
	}

	/**
	 * 모든 발송된 이메일 조회
	 */
	getAllSentEmails(): Map<string, SentEmail> {
		return new Map(this._sentEmails);
	}

	/**
	 * 발송된 이메일 수 조회
	 */
	getSentCount(): number {
		return this._sentEmails.size;
	}

	// ===== 문의 이메일 유틸리티 =====

	/**
	 * 마지막 발송된 문의 조회
	 */
	getLastInquiry(): SentInquiry | undefined {
		return this._sentInquiries[this._sentInquiries.length - 1];
	}

	/**
	 * 발송된 문의 수 조회
	 */
	getInquiryCount(): number {
		return this._sentInquiries.length;
	}

	// ===== 실패 시뮬레이션 메서드 =====

	/**
	 * 실패 시뮬레이션 활성화
	 * @param count 실패할 횟수 (이후 성공으로 전환)
	 */
	simulateFailures(count: number): void {
		this._shouldFail = true;
		this._maxFailures = count;
		this._failureCount = 0;
	}

	/**
	 * 실패 시뮬레이션 비활성화 및 초기화
	 */
	resetFailureSimulation(): void {
		this._resetFailureSimulation();
	}

	/**
	 * 현재 실패 횟수 조회 (테스트 검증용)
	 */
	getFailureCount(): number {
		return this._failureCount;
	}

	// ===== Private 메서드 =====

	/**
	 * 실패 시뮬레이션 체크 및 실패 결과 반환
	 */
	private _checkFailureSimulation(): EmailSendResult | null {
		if (this._shouldFail && this._failureCount < this._maxFailures) {
			this._failureCount++;
			console.log(
				`📧 [FakeEmail] Simulated failure (${this._failureCount}/${this._maxFailures})`,
			);
			return {
				success: false,
				error: "Simulated failure for testing",
				retryCount: 0,
			};
		}
		return null;
	}

	/**
	 * 실패 시뮬레이션 상태 초기화
	 */
	private _resetFailureSimulation(): void {
		this._shouldFail = false;
		this._maxFailures = 0;
		this._failureCount = 0;
	}
}
