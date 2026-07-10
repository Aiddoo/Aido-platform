/**
 * AI 사용량 값 객체
 *
 * 월간 AI 파싱 사용량 스냅샷(사용 횟수·한도·다음 리셋 시각)을 표현한다.
 * 한도(null=무제한) 대비 초과 여부 판정을 도메인이 소유한다.
 */
export interface AiUsageView {
	/** 이번 달 사용한 횟수 */
	used: number;
	/** 월간 제한 횟수 (null = 무제한) */
	limit: number | null;
	/** 다음 리셋 시각 (ISO 8601, UTC — KST 매월 1일 00:00) */
	resetsAt: string;
}

export class AiUsage {
	private constructor(
		private readonly _used: number,
		private readonly _limit: number | null,
		private readonly _resetsAt: string,
	) {}

	static of(used: number, limit: number | null, resetsAt: string): AiUsage {
		return new AiUsage(used, limit, resetsAt);
	}

	get used(): number {
		return this._used;
	}

	get limit(): number | null {
		return this._limit;
	}

	get resetsAt(): string {
		return this._resetsAt;
	}

	/** 한도 초과 여부 (무제한이면 항상 false). */
	isExceeded(): boolean {
		return this._limit !== null && this._used >= this._limit;
	}

	/** 프레젠테이션/응답용 평면 뷰. */
	toView(): AiUsageView {
		return { used: this._used, limit: this._limit, resetsAt: this._resetsAt };
	}
}
