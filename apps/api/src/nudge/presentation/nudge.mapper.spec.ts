import type {
	NudgeWithRelations,
	ReminderNudgeWithRelations,
} from "../application/ports/nudge.repository.port";
import type { NudgeLimitInfo } from "../application/services/nudge.reader";
import { NudgeMapper } from "./nudge.mapper";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const readAt = new Date("2026-01-02T00:00:00.000Z");

const nudge: NudgeWithRelations = {
	id: 7,
	senderId: "s",
	receiverId: "r",
	todoId: 10,
	message: "콕!",
	readAt,
	createdAt,
	sender: {
		id: "s",
		userTag: "SENDER12",
		profile: { name: "Sender", profileImage: "img" },
	},
	receiver: { id: "r", userTag: "RECEIVER", profile: null },
	todo: { id: 10, title: "할 일", completed: false },
};

describe("NudgeMapper", () => {
	it("toDto: 기본 필드 + ISO 직렬화", () => {
		expect(NudgeMapper.toDto(nudge)).toEqual({
			id: 7,
			senderId: "s",
			receiverId: "r",
			todoId: 10,
			message: "콕!",
			createdAt: createdAt.toISOString(),
			readAt: readAt.toISOString(),
		});
	});

	it("toDetailDto: sender + todo 정보 포함", () => {
		const dto = NudgeMapper.toDetailDto(nudge);
		expect(dto.sender).toEqual({
			id: "s",
			userTag: "SENDER12",
			name: "Sender",
			profileImage: "img",
		});
		expect(dto.todo).toEqual({ id: 10, title: "할 일", completed: false });
	});

	it("toRemindNudgeDto: todo 없이 직렬화", () => {
		const remind: ReminderNudgeWithRelations = {
			id: 3,
			senderId: "s",
			receiverId: "r",
			message: null,
			createdAt,
			sender: { id: "s", userTag: "SENDER12", profile: null },
		};
		expect(NudgeMapper.toRemindNudgeDto(remind)).toEqual({
			id: 3,
			senderId: "s",
			receiverId: "r",
			message: null,
			createdAt: createdAt.toISOString(),
		});
	});

	it("toLimitInfoDto: 무제한 판별", () => {
		const info: NudgeLimitInfo = { dailyLimit: null, used: 5, remaining: null };
		expect(NudgeMapper.toLimitInfoDto(info)).toEqual({
			dailyLimit: null,
			usedToday: 5,
			remainingToday: null,
			isUnlimited: true,
		});
	});
});
