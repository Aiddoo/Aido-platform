import { ErrorCode } from "@aido/errors";
import { DomainException, ValueObject } from "@/common/domain";

/**
 * Todo 일정 VO 프로퍼티
 */
export interface TodoScheduleProps {
	startDate: Date;
	endDate: Date | null;
	scheduledTime: Date | null;
	isAllDay: boolean;
}

/**
 * Todo 일정 VO
 *
 * 시작/종료 날짜·예정 시간·종일 여부를 하나의 값으로 묶고,
 * `endDate >= startDate` 불변식을 생성 시점에 강제합니다.
 * (Zod가 경계에서 동일 규칙을 검증하지만, 도메인은 스스로를 방어합니다.)
 */
export class TodoSchedule extends ValueObject<TodoScheduleProps> {
	static create(props: TodoScheduleProps): TodoSchedule {
		if (props.endDate && props.endDate < props.startDate) {
			throw new DomainException(
				ErrorCode.SYS_0002,
				{ startDate: props.startDate, endDate: props.endDate },
				"종료 날짜는 시작 날짜보다 빠를 수 없습니다.",
			);
		}
		return new TodoSchedule(props);
	}

	getStartDate(): Date {
		return new Date(this.value.startDate);
	}

	getEndDate(): Date | null {
		return this.value.endDate ? new Date(this.value.endDate) : null;
	}

	getScheduledTime(): Date | null {
		return this.value.scheduledTime ? new Date(this.value.scheduledTime) : null;
	}

	isAllDay(): boolean {
		return this.value.isAllDay;
	}

	/** 내부 Date 참조 누출을 막기 위해 방어 복사본으로 반환합니다. */
	override getValue(): TodoScheduleProps {
		return {
			startDate: this.getStartDate(),
			endDate: this.getEndDate(),
			scheduledTime: this.getScheduledTime(),
			isAllDay: this.value.isAllDay,
		};
	}
}
