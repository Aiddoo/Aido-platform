/**
 * CheerController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/decorators";

import { CheerController } from "./cheer.controller";
import { CheerMapper } from "./cheer.mapper";
import { CheerService } from "./cheer.service";
import type {
	GetCheersQueryDto,
	MarkCheersReadDto,
	SendCheerDto,
} from "./dtos";
import type {
	CheerCooldownInfo,
	CheerLimitInfo,
	CheerWithRelations,
} from "./types";

describe("CheerController — 응원 컨트롤러", () => {
	let controller: CheerController;
	let mockCheerService: Mocked<CheerService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	const mockCheerWithRelations: CheerWithRelations = {
		id: 1,
		senderId: "user-123",
		receiverId: "user-456",
		message: "화이팅!",
		createdAt: new Date("2026-03-01T10:00:00Z"),
		readAt: null,
		sender: {
			id: "user-123",
			userTag: "sender#1234",
			profile: { name: "보내는사람", profileImage: null },
		},
		receiver: {
			id: "user-456",
			userTag: "receiver#5678",
			profile: { name: "받는사람", profileImage: null },
		},
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(CheerController).compile();

		controller = unit;
		mockCheerService = unitRef.get(CheerService);
	});

	describe("sendCheer", () => {
		it("응원 보내기 요청을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -응원 보내기 DTO와 서비스 응답이 준비되었을 때
			const dto = {
				receiverId: "user-456",
				message: "화이팅!",
			} as unknown as SendCheerDto;
			const tz = "Asia/Seoul";
			mockCheerService.sendCheer.mockResolvedValue(mockCheerWithRelations);

			// When -sendCheer를 호출하면
			const result = await controller.sendCheer(mockUser, dto, tz);

			// Then -서비스에 senderId, receiverId, message, tz를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockCheerService.sendCheer).toHaveBeenCalledWith(
				{
					senderId: mockUser.userId,
					receiverId: dto.receiverId,
					message: dto.message,
				},
				tz,
			);
			expect(result).toEqual({
				message: "응원을 보냈어요! 🎉",
				cheer: CheerMapper.toDto(mockCheerWithRelations),
			});
		});
	});

	describe("getReceivedCheers", () => {
		it("받은 응원 목록 조회 요청을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -받은 응원 목록 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = {
				limit: 20,
				cursor: undefined,
			} as unknown as GetCheersQueryDto;
			const items = [mockCheerWithRelations];
			const serviceResult = {
				items,
				pagination: { hasNext: false, nextCursor: null, size: 20 },
			};
			mockCheerService.getReceivedCheers.mockResolvedValue(serviceResult);
			mockCheerService.countReceivedCheers.mockResolvedValue(5);
			mockCheerService.countUnreadReceivedCheers.mockResolvedValue(3);

			// When -getReceivedCheers를 호출하면
			const result = await controller.getReceivedCheers(mockUser, query);

			// Then -서비스에 userId, cursor, size를 전달하고 별도 count 쿼리 결과를 반환해야 한다
			expect(mockCheerService.getReceivedCheers).toHaveBeenCalledWith({
				userId: mockUser.userId,
				cursor: query.cursor,
				size: query.limit,
			});
			expect(mockCheerService.countReceivedCheers).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(mockCheerService.countUnreadReceivedCheers).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({
				cheers: CheerMapper.toDetailDtoList(items),
				totalCount: 5,
				unreadCount: 3,
				hasMore: false,
			});
		});
	});

	describe("getSentCheers", () => {
		it("보낸 응원 목록 조회 요청을 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -보낸 응원 목록 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = {
				limit: 20,
				cursor: undefined,
			} as unknown as GetCheersQueryDto;
			const items = [mockCheerWithRelations];
			const serviceResult = {
				items,
				pagination: { hasNext: true, nextCursor: 1, size: 20 },
			};
			mockCheerService.getSentCheers.mockResolvedValue(serviceResult);
			mockCheerService.countSentCheers.mockResolvedValue(10);

			// When -getSentCheers를 호출하면
			const result = await controller.getSentCheers(mockUser, query);

			// Then -서비스에 userId, cursor, size를 전달하고 별도 count 쿼리 결과를 반환해야 한다
			expect(mockCheerService.getSentCheers).toHaveBeenCalledWith({
				userId: mockUser.userId,
				cursor: query.cursor,
				size: query.limit,
			});
			expect(mockCheerService.countSentCheers).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({
				cheers: CheerMapper.toDetailDtoList(items),
				totalCount: 10,
				hasMore: true,
			});
		});
	});

	describe("getLimitInfo", () => {
		it("일일 응원 제한 정보 조회를 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given -제한 정보 서비스 응답이 준비되었을 때
			const tz = "Asia/Seoul";
			const limitInfo: CheerLimitInfo = {
				dailyLimit: 3,
				used: 1,
				remaining: 2,
			};
			mockCheerService.getLimitInfo.mockResolvedValue(limitInfo);

			// When -getLimitInfo를 호출하면
			const result = await controller.getLimitInfo(mockUser, tz);

			// Then -서비스에 userId와 tz를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockCheerService.getLimitInfo).toHaveBeenCalledWith(
				mockUser.userId,
				tz,
			);
			expect(result).toEqual(CheerMapper.toLimitInfoDto(limitInfo));
		});
	});

	describe("getCooldownInfo", () => {
		it("특정 친구에 대한 쿨다운 상태를 서비스에서 조회하고 결과를 반환해야 한다", async () => {
			// Given -쿨다운 정보 서비스 응답이 준비되었을 때
			const targetUserId = "user-456";
			const cooldownInfo: CheerCooldownInfo = {
				isActive: true,
				canCheerAt: new Date("2026-03-02T10:00:00Z"),
				remainingSeconds: 3600,
			};
			mockCheerService.getCooldownInfoForUser.mockResolvedValue(cooldownInfo);

			// When -getCooldownInfo를 호출하면
			const result = await controller.getCooldownInfo(mockUser, targetUserId);

			// Then -서비스에 userId와 targetUserId를 전달하고 변환된 결과를 반환해야 한다
			expect(mockCheerService.getCooldownInfoForUser).toHaveBeenCalledWith(
				mockUser.userId,
				targetUserId,
			);
			expect(result).toEqual({
				userId: targetUserId,
				canCheer: false,
				remainingSeconds: 3600,
				cooldownEndsAt: "2026-03-02T10:00:00.000Z",
			});
		});

		it("쿨다운이 없을 때 응원 가능 상태를 반환해야 한다", async () => {
			// Given -쿨다운이 없을 때
			const targetUserId = "user-789";
			const cooldownInfo: CheerCooldownInfo = {
				isActive: false,
				canCheerAt: null,
				remainingSeconds: 0,
			};
			mockCheerService.getCooldownInfoForUser.mockResolvedValue(cooldownInfo);

			// When -getCooldownInfo를 호출하면
			const result = await controller.getCooldownInfo(mockUser, targetUserId);

			// Then -canCheer가 true이고 cooldownEndsAt이 null이어야 한다
			expect(result).toEqual({
				userId: targetUserId,
				canCheer: true,
				remainingSeconds: 0,
				cooldownEndsAt: null,
			});
		});
	});

	describe("markAsRead", () => {
		it("응원 읽음 처리 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -읽음 처리할 응원 ID가 있을 때
			const cheerId = 1;
			mockCheerService.markAsRead.mockResolvedValue(undefined);

			// When -markAsRead를 호출하면
			const result = await controller.markAsRead(mockUser, { id: cheerId });

			// Then -서비스에 userId와 cheerId를 전달하고 결과를 반환해야 한다
			expect(mockCheerService.markAsRead).toHaveBeenCalledWith(
				mockUser.userId,
				cheerId,
			);
			expect(result).toEqual({
				message: "확인했습니다.",
				readCount: 1,
			});
		});
	});

	describe("markManyAsRead", () => {
		it("여러 응원 읽음 처리 요청을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -읽음 처리할 응원 ID 배열이 있을 때
			const dto = { cheerIds: [1, 2, 3] } as unknown as MarkCheersReadDto;
			mockCheerService.markManyAsRead.mockResolvedValue(3);

			// When -markManyAsRead를 호출하면
			const result = await controller.markManyAsRead(mockUser, dto);

			// Then -서비스에 userId와 cheerIds를 전달하고 결과를 반환해야 한다
			expect(mockCheerService.markManyAsRead).toHaveBeenCalledWith(
				mockUser.userId,
				dto.cheerIds,
			);
			expect(result).toEqual({
				message: "3개의 응원을 확인했습니다.",
				readCount: 3,
			});
		});
	});
});
