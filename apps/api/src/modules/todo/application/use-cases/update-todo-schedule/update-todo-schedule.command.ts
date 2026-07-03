import type { Todo as TodoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";
import type { TodoScheduleProps } from "../../../domain/value-objects/todo-schedule.vo";

/**
 * 일정 변경 커맨드
 *
 * 날짜/시간 문자열 파싱(X-Timezone 반영)은 컨트롤러가 담당하고,
 * 커맨드는 파싱 완료된 Date 값만 운반합니다.
 */
export class UpdateTodoScheduleCommand extends Command<TodoResponse> {
	constructor(
		public readonly id: number,
		public readonly userId: string,
		public readonly schedule: TodoScheduleProps,
	) {
		super();
	}
}
