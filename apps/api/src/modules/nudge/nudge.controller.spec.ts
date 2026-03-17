/**
 * NudgeController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import type { GetNudgesQueryDto, SendNudgeDto } from "./dtos";
import { NudgeController } from "./nudge.controller";
import { NudgeMapper } from "./nudge.mapper";
import { NudgeService } from "./nudge.service";
import type {
	NudgeCooldownInfo,
	NudgeLimitInfo,
	NudgeWithRelations,
} from "./types";

describe("NudgeController", () => {
	let controller: NudgeController;
	let mockNudgeService: Mocked<NudgeService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	const mockNudgeWithRelations: NudgeWithRelations = {
		id: 1,
		senderId: "user-123",
		receiverId: "user-456",
		todoId: 10,
		message: "할 일 하자!",
		createdAt: new Date("2026-03-01T10:00:00Z"),
		readAt: null,
		sender: {
			id: "user-123",
			userTag: "SNDR1234",
			profile: { name: "보내는사람", profileImage: null },
		},
		receiver: {
			id: "user-456",
			userTag: "RCVR5678",
			profile: { name: "받는사람", profileImage: null },
		},
		todo: {
			id: 10,
			title: "운동하기",
			completed: false,
		},
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(NudgeController).compile();

		controller = unit;
		mockNudgeService = unitRef.get(NudgeService);
	});

	describe("sendNudge", () => {
		it("콕 찌르기 요청을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -콕 찌르기 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				receiverId: "user-456",
				todoId: 10,
				message: "할 일 하자!",
			} as unknown as SendNudgeDto;
			const tz = "Asia/Seoul";
			mockNudgeService.sendNudge.mockResolvedValue(mockNudgeWithRelations);

			// When - sendNudge를 호출하면
			const result = await controller.sendNudge(mockUser, dto, tz);

			// Then - 서비스에 senderId, receiverId, todoId, message, tz를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockNudgeService.sendNudge).toHaveBeenCalledWith(
				{
					senderId: mockUser.userId,
					receiverId: dto.receiverId,
					todoId: dto.todoId,
					message: dto.message,
				},
				tz,
			);
			expect(result).toEqual({
				message: "콕! 찔렀습니다 👆",
				nudge: NudgeMapper.toDto(mockNudgeWithRelations),
			});
		});
	});

	describe("getReceivedNudges", () => {
		it("받은 콕 찌름 목록 조회를 서비스에 위임하고 별도 count 쿼리 결과를 반환해야 한다", async () => {
			// Given -받은 콕 찌름 목록 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = {
				limit: 20,
				cursor: undefined,
			} as unknown as GetNudgesQueryDto;
			const items = [mockNudgeWithRelations];
			const serviceResult = {
				items,
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			};
			mockNudgeService.getReceivedNudges.mockResolvedValue(serviceResult);
			mockNudgeService.countReceivedNudges.mockResolvedValue(8);
			mockNudgeService.countUnreadReceivedNudges.mockResolvedValue(4);

			// When - getReceivedNudges를 호출하면
			const result = await controller.getReceivedNudges(mockUser, query);

			// Then - 서비스에 userId, cursor, size를 전달하고 별도 count 쿼리 결과를 반환해야 한다
			expect(mockNudgeService.getReceivedNudges).toHaveBeenCalledWith({
				userId: mockUser.userId,
				cursor: query.cursor,
				size: query.limit,
			});
			expect(mockNudgeService.countReceivedNudges).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(mockNudgeService.countUnreadReceivedNudges).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({
				nudges: NudgeMapper.toDetailDtoList(items),
				totalCount: 8,
				unreadCount: 4,
				hasMore: false,
			});
		});
	});

	describe("getSentNudges", () => {
		it("보낸 콕 찌름 목록 조회를 서비스에 위임하고 별도 count 쿼리 결과를 반환해야 한다", async () => {
			// Given -보낸 콕 찌름 목록 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = {
				limit: 20,
				cursor: undefined,
			} as unknown as GetNudgesQueryDto;
			const items = [mockNudgeWithRelations];
			const serviceResult = {
				items,
				pagination: { hasNext: true, nextCursor: 1, size: 20 },
			};
			mockNudgeService.getSentNudges.mockResolvedValue(serviceResult);
			mockNudgeService.countSentNudges.mockResolvedValue(15);

			// When - getSentNudges를 호출하면
			const result = await controller.getSentNudges(mockUser, query);

			// Then - 서비스에 userId, cursor, size를 전달하고 별도 count 쿼리 결과를 반환해야 한다
			expect(mockNudgeService.getSentNudges).toHaveBeenCalledWith({
				userId: mockUser.userId,
				cursor: query.cursor,
				size: query.limit,
			});
			expect(mockNudgeService.countSentNudges).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({
				nudges: NudgeMapper.toDetailDtoList(items),
				totalCount: 15,
				hasMore: true,
			});
		});
	});

	describe("getLimitInfo", () => {
		it("일일 콕 찌르기 제한 정보 조회를 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -제한 정보 서비스 응답이 준비되었을 때
			const tz = "Asia/Seoul";
			const limitInfo: NudgeLimitInfo = {
				dailyLimit: 3,
				used: 1,
				remaining: 2,
			};
			mockNudgeService.getLimitInfo.mockResolvedValue(limitInfo);

			// When - getLimitInfo를 호출하면
			const result = await controller.getLimitInfo(mockUser, tz);

			// Then - 서비스에 userId와 tz를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockNudgeService.getLimitInfo).toHaveBeenCalledWith(
				mockUser.userId,
				tz,
			);
			expect(result).toEqual(NudgeMapper.toLimitInfoDto(limitInfo));
		});
	});

	describe("getCooldownInfo", () => {
		it("특정 친구에 대한 쿨다운 상태를 서비스에서 조회하고 결과를 반환해야 한다", async () => {
			// Given -쿨다운이 활성화된 상태일 때
			const targetUserId = "user-456";
			const cooldownInfo: NudgeCooldownInfo = {
				isActive: true,
				cooldownEndsAt: new Date("2026-03-02T10:00:00Z"),
				remainingSeconds: 3600,
			};
			mockNudgeService.getCooldownInfoForUser.mockResolvedValue(cooldownInfo);

			// When - getCooldownInfo를 호출하면
			const result = await controller.getCooldownInfo(mockUser, targetUserId);

			// Then - 서비스에 userId와 targetUserId를 전달하고 변환된 결과를 반환해야 한다
			expect(mockNudgeService.getCooldownInfoForUser).toHaveBeenCalledWith(
				mockUser.userId,
				targetUserId,
			);
			expect(result).toEqual({
				canNudge: false,
				cooldownEndsAt: "2026-03-02T10:00:00.000Z",
				remainingSeconds: 3600,
			});
		});

		it("쿨다운이 없을 때 콕 찌르기 가능 상태를 반환해야 한다", async () => {
			// Given -쿨다운이 없을 때
			const targetUserId = "user-789";
			const cooldownInfo: NudgeCooldownInfo = {
				isActive: false,
				cooldownEndsAt: null,
				remainingSeconds: 0,
			};
			mockNudgeService.getCooldownInfoForUser.mockResolvedValue(cooldownInfo);

			// When - getCooldownInfo를 호출하면
			const result = await controller.getCooldownInfo(mockUser, targetUserId);

			// Then - canNudge가 true이고 cooldownEndsAt이 null이어야 한다
			expect(result).toEqual({
				canNudge: true,
				cooldownEndsAt: null,
				remainingSeconds: null,
			});
		});
	});

	describe("markAsRead", () => {
		it("콕 찌름 읽음 처리 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -읽음 처리할 콕 찌름 ID가 있을 때
			const nudgeId = 1;
			mockNudgeService.markAsRead.mockResolvedValue(undefined);

			// When - markAsRead를 호출하면
			const result = await controller.markAsRead(mockUser, { id: nudgeId });

			// Then - 서비스에 userId와 nudgeId를 전달하고 결과를 반환해야 한다
			expect(mockNudgeService.markAsRead).toHaveBeenCalledWith(
				mockUser.userId,
				nudgeId,
			);
			expect(result).toEqual({
				message: "확인했습니다.",
				readCount: 1,
			});
		});
	});
});
