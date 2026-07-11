import type { CheerWithRelations } from "../application/ports/cheer.repository.port";
import type { CheerLimitInfo } from "../application/services/cheer.reader";
import { CheerMapper } from "./cheer.mapper";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const readAt = new Date("2026-01-02T00:00:00.000Z");

const cheer: CheerWithRelations = {
	id: 7,
	senderId: "s",
	receiverId: "r",
	message: "화이팅!",
	readAt,
	createdAt,
	sender: {
		id: "s",
		userTag: "SENDER12",
		profile: { name: "Sender", profileImage: "img" },
	},
	receiver: { id: "r", userTag: "RECEIVER", profile: null },
};

describe("CheerMapper", () => {
	it("toDto: 기본 필드 + ISO 직렬화", () => {
		expect(CheerMapper.toDto(cheer)).toEqual({
			id: 7,
			senderId: "s",
			receiverId: "r",
			message: "화이팅!",
			createdAt: createdAt.toISOString(),
			readAt: readAt.toISOString(),
		});
	});

	it("toDetailDto: sender 정보 포함", () => {
		const dto = CheerMapper.toDetailDto(cheer);
		expect(dto.sender).toEqual({
			id: "s",
			userTag: "SENDER12",
			name: "Sender",
			profileImage: "img",
		});
	});

	it("toLimitInfoDto: 무제한 판별", () => {
		const info: CheerLimitInfo = { dailyLimit: null, used: 5, remaining: null };
		expect(CheerMapper.toLimitInfoDto(info)).toEqual({
			dailyLimit: null,
			usedToday: 5,
			remainingToday: null,
			isUnlimited: true,
		});
	});
});
