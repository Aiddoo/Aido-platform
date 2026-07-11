import { isSameDay } from "@/shared/domain/date/utils/compare";

export interface NudgeTargetTodoProps {
	ownerId: string;
	visibility: string;
	startDate: Date;
	endDate: Date | null;
}

/**
 * NudgeTargetTodo — 콕 찌르기 대상 할 일 값 객체.
 *
 * 콕 찌르기가 성립하려면 대상 할 일이 (1) 수신자의 것이고 (2) 공개(PUBLIC)이며
 * (3) 오늘에 해당해야 한다. 이 세 가지 판정 규칙만 소유하며, 어떤 예외를 던질지는 use-case가 정한다
 * (규칙별 에러코드가 다르므로).
 */
export class NudgeTargetTodo {
	private constructor(private readonly props: NudgeTargetTodoProps) {}

	static of(props: NudgeTargetTodoProps): NudgeTargetTodo {
		return new NudgeTargetTodo(props);
	}

	isOwnedBy(userId: string): boolean {
		return this.props.ownerId === userId;
	}

	isPublic(): boolean {
		return this.props.visibility === "PUBLIC";
	}

	/**
	 * 주어진 오늘 날짜(수신자 타임존 기준)에 해당하는 할 일인지 판정한다.
	 * 기간 할 일은 [startDate, endDate] 포함 여부로, 당일 할 일은 startDate 동일 여부로 판단한다.
	 */
	isActiveOn(today: Date): boolean {
		if (this.props.endDate) {
			return this.props.startDate <= today && today <= this.props.endDate;
		}
		return isSameDay(this.props.startDate, today);
	}
}
