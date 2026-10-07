import { TransactionHost } from "@nestjs-cls/transactional";
/**
 * Follow 모듈 통합 테스트 (Mock DB)
 *
 * @description
 * 클린아키텍처(무버스 use-case) 구조로 재작성. FollowFacade·use-case·FollowReader가
 * PrismaFollowRepository(Mock DB)·캐시/알림 어댑터와 함께 DI로 올바르게 조립되고
 * 동작하는지 검증한다. HTTP 계약(예외 정규화)은 e2e가 담당하고, 여기서는
 * 애플리케이션 예외(ApplicationException) 발생 여부만 확인한다.
 *
 * 실행: pnpm --filter @aido/server test follow.integration-spec
 */
import { Test, type TestingModule } from "@nestjs/testing";
import { and } from "@prisma/orm-postgres/orm-client";
import { vi } from "vitest";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import { NotificationQueueService } from "#api/modules/notification/notification-delivery-jobs.public";
import { FOLLOW_CACHE } from "#api/modules/social/application/ports/friends/follow-cache.port";
import { FOLLOW_NOTIFIER } from "#api/modules/social/application/ports/friends/follow-notifier.port";
import { FOLLOW_REPOSITORY } from "#api/modules/social/application/ports/friends/follow.repository.port";
import { FollowReader } from "#api/modules/social/application/services/friends/follow.reader";
import { AcceptFriendRequest } from "#api/modules/social/application/use-cases/friends/accept-friend-request.use-case";
import { RejectFriendRequest } from "#api/modules/social/application/use-cases/friends/reject-friend-request.use-case";
import { RemoveFriend } from "#api/modules/social/application/use-cases/friends/remove-friend.use-case";
import { SendFriendRequestByTag } from "#api/modules/social/application/use-cases/friends/send-friend-request-by-tag.use-case";
import { SendFriendRequest } from "#api/modules/social/application/use-cases/friends/send-friend-request.use-case";
import { FollowCacheAdapter } from "#api/modules/social/infrastructure/adapters/friends/follow-cache.adapter";
import { FollowNotifierAdapter } from "#api/modules/social/infrastructure/adapters/friends/follow-notifier.adapter";
import { PrismaFollowRepository } from "#api/modules/social/infrastructure/persistence/friends/prisma-follow.repository";
import { CacheService } from "#api/platform/cache/cache.service";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { UNIT_OF_WORK } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { FollowBuilder, UserBuilder } from "#test/builders/index";
import { asMock } from "#test/mocks/bull-job.mock";
import { createMockCacheService } from "#test/mocks/cache-test-utils";
import {
  assertNativeWhere,
  createMockDatabaseContext,
  databaseFixture,
  nativeRows,
} from "#test/mocks/database.mock";
import { createUnitOfWorkMock } from "#test/mocks/ports/index";
import { suppressLogger } from "#test/setup/suppress-logger";

import {
  acceptFriendRequestProvider,
  followReaderProvider,
  friendshipEffectsProvider,
  rejectFriendRequestProvider,
  removeFriendProvider,
  reorderFriendProvider,
  searchUsersProvider,
  sendFriendRequestByTagProvider,
  sendFriendRequestProvider,
} from "../../src/modules/social/social-friends-application.providers.js";
import { paginationServiceProvider } from "../../src/platform/pagination/pagination.providers.js";

describe("Follow 모듈 통합 테스트 (Mock DB)", () => {
  let module: TestingModule;
  let followReader: FollowReader;
  let sendUseCase: SendFriendRequest;
  let sendByTagUseCase: SendFriendRequestByTag;
  let acceptUseCase: AcceptFriendRequest;
  let rejectUseCase: RejectFriendRequest;
  let removeUseCase: RemoveFriend;

  const nativeContext = createMockDatabaseContext();
  const mockFollowDb = nativeContext.orm.public.Follow;
  const mockUserDb = nativeContext.orm.public.User;

  const mockNotificationQueueService = {
    enqueueFollowNew: vi.fn(),
    enqueueFollowMutual: vi.fn(),
    enqueueMilestoneReached: vi.fn(),
  };

  const mockCacheService = createMockCacheService();

  const mockUser = UserBuilder.create().withId("user-integration-123").verified().build();
  const mockTargetUser = UserBuilder.create()
    .withId("user-integration-456")
    .withUserTag("TGT67890")
    .verified()
    .build();
  const mockUserId = mockUser.id;
  const mockTargetUserId = mockTargetUser.id;
  const mockFollowId = "follow-integration-789";
  const mockTargetUserTag = mockTargetUser.userTag;

  beforeAll(async () => {
    suppressLogger();

    module = await Test.createTestingModule({
      providers: [
        followReaderProvider,
        friendshipEffectsProvider,
        sendFriendRequestProvider,
        sendFriendRequestByTagProvider,
        acceptFriendRequestProvider,
        rejectFriendRequestProvider,
        removeFriendProvider,
        reorderFriendProvider,
        searchUsersProvider,
        { provide: FOLLOW_REPOSITORY, useClass: PrismaFollowRepository },
        { provide: FOLLOW_CACHE, useClass: FollowCacheAdapter },
        { provide: FOLLOW_NOTIFIER, useClass: FollowNotifierAdapter },
        paginationServiceProvider,
        { provide: UNIT_OF_WORK, useValue: createUnitOfWorkMock() },
        {
          provide: TransactionHost,
          useValue: { tx: nativeContext },
        },
        {
          provide: TypedConfigService,
          useValue: {
            pagination: { defaultPageSize: 20, maxPageSize: 100 },
          },
        },
        {
          provide: NotificationQueueService,
          useValue: mockNotificationQueueService,
        },
        { provide: CacheService, useValue: mockCacheService },
        {
          provide: ENTITLEMENT_READER,
          useValue: {
            getResourceLimit: vi.fn().mockResolvedValue({
              maxCount: null,
              isAdmin: false,
              subscriptionStatus: "ACTIVE",
            }),
            enforceResourceLimit: vi.fn(),
          },
        },
      ],
    }).compile();

    followReader = module.get(FollowReader);
    sendUseCase = module.get(SendFriendRequest);
    sendByTagUseCase = module.get(SendFriendRequestByTag);
    acceptUseCase = module.get(AcceptFriendRequest);
    rejectUseCase = module.get(RejectFriendRequest);
    removeUseCase = module.get(RemoveFriend);
  });

  afterAll(async () => {
    await module.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheService.get.mockResolvedValue(undefined);
    mockCacheService.wrap.mockImplementation((_key, factory) => factory());
    asMock(mockFollowDb.aggregate).mockResolvedValue({ max_sortOrder: null, count: 0 });
  });

  describe("DI 통합", () => {
    it("FollowReader가 올바르게 조립된다", () => {
      expect(followReader).toBeDefined();
      expect(followReader).toBeInstanceOf(FollowReader);
    });

    it("FollowRepository 포트가 주입된다", () => {
      expect(module.get(FOLLOW_REPOSITORY)).toBeInstanceOf(PrismaFollowRepository);
    });
  });

  describe("친구 요청 (use-case)", () => {
    it("친구 요청이 Repository를 통해 생성된다", async () => {
      asMock(mockUserDb.first).mockResolvedValue(databaseFixture("User", mockTargetUser));
      asMock(mockFollowDb.first).mockResolvedValueOnce(databaseFixture("Follow", null));
      asMock(mockFollowDb.first).mockResolvedValueOnce(databaseFixture("Follow", null));
      asMock(mockFollowDb.create).mockResolvedValue(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockUserId, mockTargetUserId).withId(mockFollowId).pending().build(),
        ),
      );
      asMock(mockUserDb.first).mockResolvedValue(databaseFixture("User", mockTargetUser));

      const result = await sendUseCase.execute({
        userId: mockUserId,
        targetUserId: mockTargetUserId,
      });

      expect(result.follow.followerId).toBe(mockUserId);
      expect(result.follow.followingId).toBe(mockTargetUserId);
      expect(result.follow.status).toBe("PENDING");
      expect(result.autoAccepted).toBe(false);
    });

    it("자기 자신에게 요청 시 ApplicationException", async () => {
      await expect(
        sendUseCase.execute({ userId: mockUserId, targetUserId: mockUserId }),
      ).rejects.toThrow(ApplicationException);
    });

    it("존재하지 않는 사용자에게 요청 시 ApplicationException", async () => {
      asMock(mockUserDb.first).mockResolvedValue(databaseFixture("User", null));
      await expect(
        sendUseCase.execute({
          userId: mockUserId,
          targetUserId: mockTargetUserId,
        }),
      ).rejects.toThrow(ApplicationException);
    });

    it("이미 친구인 경우 ApplicationException", async () => {
      asMock(mockUserDb.first).mockResolvedValue(databaseFixture("User", mockTargetUser));
      asMock(mockFollowDb.first).mockResolvedValue(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockUserId, mockTargetUserId)
            .withId(mockFollowId)
            .accepted()
            .build(),
        ),
      );
      await expect(
        sendUseCase.execute({
          userId: mockUserId,
          targetUserId: mockTargetUserId,
        }),
      ).rejects.toThrow(ApplicationException);
    });

    it("상대방이 먼저 요청한 경우 자동 수락", async () => {
      asMock(mockUserDb.first).mockResolvedValue(databaseFixture("User", mockTargetUser));
      asMock(mockFollowDb.first).mockResolvedValueOnce(databaseFixture("Follow", null));
      asMock(mockFollowDb.first).mockResolvedValueOnce(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockTargetUserId, mockUserId)
            .withId("reverse-follow-id")
            .pending()
            .build(),
        ),
      );
      asMock(mockFollowDb.update).mockResolvedValue(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockTargetUserId, mockUserId).accepted().build(),
        ),
      );
      asMock(mockFollowDb.create).mockResolvedValue(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockUserId, mockTargetUserId)
            .withId(mockFollowId)
            .accepted()
            .build(),
        ),
      );
      asMock(mockUserDb.first).mockResolvedValue(
        databaseFixture("User", { ...mockUser, userTag: "USR12345", profile: { name: "User" } }),
      );

      const result = await sendUseCase.execute({
        userId: mockUserId,
        targetUserId: mockTargetUserId,
      });

      expect(result.follow.status).toBe("ACCEPTED");
      expect(result.autoAccepted).toBe(true);
    });
  });

  describe("친구 요청 by tag (facade)", () => {
    it("userTag로 요청하면 Follow가 생성된다", async () => {
      asMock(mockUserDb.first).mockResolvedValue(databaseFixture("User", mockTargetUser));
      asMock(mockFollowDb.first).mockResolvedValueOnce(databaseFixture("Follow", null));
      asMock(mockFollowDb.first).mockResolvedValueOnce(databaseFixture("Follow", null));
      asMock(mockFollowDb.create).mockResolvedValue(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockUserId, mockTargetUserId).withId(mockFollowId).pending().build(),
        ),
      );
      asMock(mockUserDb.first).mockResolvedValue(databaseFixture("User", mockTargetUser));

      const result = await sendByTagUseCase.execute({
        userId: mockUserId,
        targetUserTag: mockTargetUserTag,
      });

      expect(result.follow.status).toBe("PENDING");
      expect(result.autoAccepted).toBe(false);
    });

    it("존재하지 않는 userTag → ApplicationException", async () => {
      asMock(mockUserDb.first).mockResolvedValue(databaseFixture("User", null));
      await expect(
        sendByTagUseCase.execute({
          userId: mockUserId,
          targetUserTag: "NOTEXIST",
        }),
      ).rejects.toThrow(ApplicationException);
    });
  });

  describe("친구 요청 수락 (facade)", () => {
    it("수락 시 양방향 관계가 성립된다", async () => {
      const pendingRequest = FollowBuilder.create(mockTargetUserId, mockUserId)
        .withId(mockFollowId)
        .pending()
        .build();
      const myFollow = FollowBuilder.create(mockUserId, mockTargetUserId)
        .withId("my-follow-id")
        .accepted()
        .build();

      asMock(mockFollowDb.first).mockResolvedValueOnce(databaseFixture("Follow", pendingRequest));
      asMock(mockFollowDb.update).mockResolvedValue(
        databaseFixture("Follow", {
          ...pendingRequest,
          status: "ACCEPTED",
        }),
      );
      asMock(mockFollowDb.first).mockResolvedValueOnce(databaseFixture("Follow", null));
      asMock(mockFollowDb.create).mockResolvedValue(databaseFixture("Follow", myFollow));
      asMock(mockFollowDb.first).mockResolvedValueOnce(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockUserId, mockTargetUserId)
            .withId("my-follow-id")
            .accepted()
            .withFollowerUser({
              id: mockUserId,
              userTag: "MYTAG123",
              profile: { name: "My User", profileImage: null },
            })
            .withFollowingUser({
              id: mockTargetUserId,
              userTag: mockTargetUserTag,
              profile: { name: "Target User", profileImage: null },
            })
            .buildWithUser(),
        ),
      );

      const result = await acceptUseCase.execute({
        userId: mockUserId,
        requesterUserId: mockTargetUserId,
      });

      expect(result.status).toBe("ACCEPTED");
      expect(mockFollowDb.create).toHaveBeenCalled();
    });

    it("존재하지 않는 요청 수락 → ApplicationException", async () => {
      asMock(mockFollowDb.first).mockResolvedValue(databaseFixture("Follow", null));
      await expect(
        acceptUseCase.execute({
          userId: mockUserId,
          requesterUserId: mockTargetUserId,
        }),
      ).rejects.toThrow(ApplicationException);
    });
  });

  describe("친구 요청 거절 / 삭제 (facade)", () => {
    it("거절 시 요청이 삭제된다", async () => {
      asMock(mockFollowDb.first).mockResolvedValue(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockTargetUserId, mockUserId).withId(mockFollowId).pending().build(),
        ),
      );
      asMock(mockFollowDb.delete).mockResolvedValue(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockUserId, mockTargetUserId).withId(mockFollowId).build(),
        ),
      );

      await rejectUseCase.execute({
        userId: mockUserId,
        requesterUserId: mockTargetUserId,
      });
      expect(mockFollowDb.delete).toHaveBeenCalled();
    });

    it("친구 삭제는 양방향으로 수행된다", async () => {
      asMock(mockFollowDb.first).mockResolvedValueOnce(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockUserId, mockTargetUserId)
            .withId(mockFollowId)
            .accepted()
            .build(),
        ),
      );
      asMock(mockFollowDb.delete).mockResolvedValue(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockUserId, mockTargetUserId).withId(mockFollowId).build(),
        ),
      );
      asMock(mockFollowDb.first).mockResolvedValueOnce(
        databaseFixture(
          "Follow",
          FollowBuilder.create(mockTargetUserId, mockUserId)
            .withId("their-follow-id")
            .accepted()
            .build(),
        ),
      );

      await removeUseCase.execute({
        userId: mockUserId,
        targetUserId: mockTargetUserId,
      });
      expect(mockFollowDb.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe("친구 목록 조회 (facade)", () => {
    it("친구 목록이 페이지네이션과 함께 조회된다", async () => {
      mockFollowDb.all.mockReturnValue(
        nativeRows(
          databaseFixture("Follow", [
            FollowBuilder.create(mockUserId, "friend-1")
              .withId("follow-1")
              .accepted()
              .buildWithUser(),
            FollowBuilder.create(mockUserId, "friend-2")
              .withId("follow-2")
              .accepted()
              .buildWithUser(),
          ]),
        ),
      );

      const result = await followReader.getFriends({ userId: mockUserId });
      expect(result.items).toHaveLength(2);
      expect(result.pagination).toBeDefined();
    });

    it("userTag 검색 조건이 쿼리에 포함된다", async () => {
      mockFollowDb.all.mockReturnValue(nativeRows(databaseFixture("Follow", [])));
      await followReader.getFriends({ userId: mockUserId, search: "TGT" });
      assertNativeWhere("Follow", mockFollowDb.where.mock.calls[0]?.[0], (row) =>
        and(
          row.followerId.eq(mockUserId),
          row.status.eq("ACCEPTED"),
          row.following.some((user) =>
            and(
              nativeContext.raw.sql`${user.userTag} ILIKE ${"%TGT%"}`
                .returns("pg/bool@1")
                .buildAst(),
              user.following.some((back) =>
                and(
                  back.followerId.neq(mockUserId),
                  back.followingId.eq(mockUserId),
                  back.status.eq("ACCEPTED"),
                ),
              ),
            ),
          ),
        ),
      );
    });
  });

  describe("맞팔 여부 / 집계 (facade)", () => {
    it("양방향 수락이면 맞팔이다", async () => {
      asMock(mockFollowDb.first)
        .mockResolvedValueOnce(
          databaseFixture(
            "Follow",
            FollowBuilder.create(mockUserId, mockTargetUserId).accepted().build(),
          ),
        )
        .mockResolvedValueOnce(
          databaseFixture(
            "Follow",
            FollowBuilder.create(mockTargetUserId, mockUserId).accepted().build(),
          ),
        );

      const result = await followReader.isMutualFriend(mockUserId, mockTargetUserId);
      expect(result).toBe(true);
    });

    it("일방적 팔로우는 맞팔이 아니다", async () => {
      asMock(mockFollowDb.first)
        .mockResolvedValueOnce(
          databaseFixture(
            "Follow",
            FollowBuilder.create(mockUserId, mockTargetUserId).accepted().build(),
          ),
        )
        .mockResolvedValueOnce(null);

      const result = await followReader.isMutualFriend(mockUserId, mockTargetUserId);
      expect(result).toBe(false);
    });

    it("친구 수가 집계된다", async () => {
      asMock(mockFollowDb.aggregate).mockResolvedValue({ count: 5 });
      expect(await followReader.countFriends(mockUserId)).toBe(5);
    });
  });
});
