import { ErrorCode } from "@aido/errors";
import { DomainException, ValueObject } from "@/shared/domain";

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

	/**
	 * DB 행에서 복원합니다(불변식 재검증 없음 — Todo.reconstitute와 같은 원칙).
	 *
	 * 가드 도입 이전에 저장된 위반 데이터가 있어도 복원은 항상 성공해야 합니다.
	 */
	static reconstitute(props: TodoScheduleProps): TodoSchedule {
		return new TodoSchedule(props);
	}

	/**
	 * 부분 패치를 머지해 새 VO를 반환합니다 (undefined 키는 변경하지 않음).
	 *
	 * 날짜(startDate/endDate)가 패치에 포함될 때만 `create`로 순서 불변식을
	 * 재검증합니다 — 시간/종일 여부만 바꾸는 패치가 가드 도입 이전의 위반
	 * 데이터 때문에 실패하지 않도록(기존 API 동작 보존).
	 */
	patch(partial: Partial<TodoScheduleProps>): TodoSchedule {
		const merged: TodoScheduleProps = {
			startDate: partial.startDate ?? this.getStartDate(),
			endDate:
				partial.endDate !== undefined ? partial.endDate : this.getEndDate(),
			scheduledTime:
				partial.scheduledTime !== undefined
					? partial.scheduledTime
					: this.getScheduledTime(),
			isAllDay: partial.isAllDay ?? this.value.isAllDay,
		};

		const touchesDates =
			partial.startDate !== undefined || partial.endDate !== undefined;
		if (touchesDates) {
			return TodoSchedule.create(merged);
		}
		return TodoSchedule.reconstitute(merged);
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
