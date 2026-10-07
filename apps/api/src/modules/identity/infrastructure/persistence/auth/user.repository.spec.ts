import { vi } from "vitest";

import { AuthPersistenceConflict } from "#api/modules/identity/application/ports/auth/index";
import { databaseDate, databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type { UserStatus } from "#api/platform/database/database.types";
import { UserBuilder } from "#test/builders/index";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
  nativeSqlParameters,
  sqlQueryError,
} from "#test/mocks/database.mock";
import { asMock, createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { UserRepository, type UserWithProfile } from "./user.repository.js";

/**
 * findByEmailWithCredential의 select 결과 타입
 */
interface UserWithCredential {
  id: string;
  email: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  accounts: Array<{
    id: number;
    provider: string;
    password: string | null;
  }>;
}

// 테스트용 상수
const TEST_USER_TAG = "XY7Z9W3K";

// userTag 알파벳(혼동 문자 0/O/1/I/L 제외)과 길이(8자)에 대응하는 검증 패턴.
// generateUserTag는 vendor 경계(node:crypto)를 사용하는 실제 순수 함수이므로 mock 없이
// 실행하고, 생성된 태그가 유효 문자 집합을 따르는지로 호출을 검증한다.
const USER_TAG_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

describe("UserRepository — 사용자 리포지토리", () => {
  let repository: UserRepository;
  let db: MockDatabaseContext;

  // Builder로 기본 테스트 사용자 생성
  const mockUser = UserBuilder.create()
    .withId("user-123")
    .withEmail("test@example.com")
    .withUserTag("ABC12DEF")
    .verified()
    .build();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-31T23:59:00.000Z"));
    db = createMockDatabaseContext();

    repository = new UserRepository(createMockTransactionHost(db));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("findByEmail", () => {
    it("이메일로 사용자를 찾아 반환한다", async () => {
      // Given - 사용자가 존재하는 경우를 모킹
      db.orm.public.User.first.mockResolvedValue(databaseFixture("User", mockUser));

      // When - 이메일로 사용자 조회
      const result = await repository.findByEmail("test@example.com");

      // Then - 사용자 정보를 반환하고 올바른 쿼리가 실행됨
      expect(result).toEqual(mockUser);
      assertNativeWhere("User", db.orm.public.User.where.mock.calls[0]?.[0], (row) =>
        row.email.eq(varchar("test@example.com", 255)),
      );
    });

    it("사용자가 없으면 null을 반환한다", async () => {
      // Given - 사용자가 존재하지 않는 경우를 모킹
      db.orm.public.User.first.mockResolvedValue(databaseFixture("User", null));

      // When - 존재하지 않는 이메일로 조회
      const result = await repository.findByEmail("notfound@example.com");

      // Then - null 반환
      expect(result).toBeNull();
    });
  });

  describe("findByEmailWithCredential", () => {
    it("이메일로 사용자와 Credential 계정을 조회한다", async () => {
      // Given - Credential 계정을 가진 사용자 데이터 준비
      const userWithAccount: UserWithCredential = {
        id: mockUser.id,
        email: mockUser.email,
        status: mockUser.status,
        emailVerifiedAt: mockUser.emailVerifiedAt,
        accounts: [
          {
            id: 1,
            provider: "CREDENTIAL",
            password: "hashed-password",
          },
        ],
      };
      asMock(db.orm.public.User.first).mockResolvedValue(databaseFixture("User", userWithAccount));

      // When - 이메일로 사용자와 Credential 계정 조회
      const result = await repository.findByEmailWithCredential("test@example.com");

      // Then - 사용자와 계정 정보가 함께 반환되고 올바른 select 쿼리가 실행됨
      expect(result).toEqual(userWithAccount);
      assertNativeWhere("User", db.orm.public.User.where.mock.calls[0]?.[0], (row) =>
        row.email.eq(varchar("test@example.com", 255)),
      );
    });
  });

  describe("findById", () => {
    it("ID로 사용자를 찾아 반환한다", async () => {
      // Given - 사용자가 존재하는 경우를 모킹
      db.orm.public.User.first.mockResolvedValue(databaseFixture("User", mockUser));

      // When - ID로 사용자 조회
      const result = await repository.findById("user-123");

      // Then - 사용자 정보를 반환하고 올바른 쿼리가 실행됨
      expect(result).toEqual(mockUser);
      assertNativeWhere("User", db.orm.public.User.where.mock.calls[0]?.[0], (row) =>
        row.id.eq("user-123"),
      );
    });

    it("사용자가 없으면 null을 반환한다", async () => {
      // Given - 사용자가 존재하지 않는 경우를 모킹
      db.orm.public.User.first.mockResolvedValue(databaseFixture("User", null));

      // When - 존재하지 않는 ID로 조회
      const result = await repository.findById("nonexistent-id");

      // Then - null 반환
      expect(result).toBeNull();
    });
  });

  describe("findByIdWithProfile", () => {
    it("ID로 사용자와 프로필을 조회한다", async () => {
      // Given - 프로필이 있는 사용자 데이터 준비
      const userWithProfile: UserWithProfile = {
        id: mockUser.id,
        email: mockUser.email,
        userTag: mockUser.userTag,
        role: mockUser.role,
        status: mockUser.status,
        emailVerifiedAt: mockUser.emailVerifiedAt,
        subscriptionStatus: mockUser.subscriptionStatus,
        subscriptionExpiresAt: mockUser.subscriptionExpiresAt,
        createdAt: mockUser.createdAt,
        deletedAt: mockUser.deletedAt,
        lastLoginAt: mockUser.lastLoginAt,
        profile: {
          name: "Test User",
          profileImage: null,
        },
        accounts: [{ provider: "CREDENTIAL" }],
      };
      asMock(db.orm.public.User.first).mockResolvedValue(databaseFixture("User", userWithProfile));

      // When - ID로 사용자와 프로필 조회
      const result = await repository.findByIdWithProfile("user-123");

      // Then - 사용자와 프로필 정보가 함께 반환되고 올바른 select 쿼리가 실행됨
      expect(result).toEqual(userWithProfile);
      assertNativeWhere("User", db.orm.public.User.where.mock.calls[0]?.[0], (row) =>
        row.id.eq("user-123"),
      );
    });

    it("프로필이 없는 사용자도 조회한다", async () => {
      // Given - 프로필이 없는 사용자 데이터 준비
      const userWithoutProfile: UserWithProfile = {
        id: mockUser.id,
        email: mockUser.email,
        userTag: mockUser.userTag,
        role: mockUser.role,
        status: mockUser.status,
        emailVerifiedAt: mockUser.emailVerifiedAt,
        subscriptionStatus: mockUser.subscriptionStatus,
        subscriptionExpiresAt: mockUser.subscriptionExpiresAt,
        createdAt: mockUser.createdAt,
        deletedAt: mockUser.deletedAt,
        lastLoginAt: mockUser.lastLoginAt,
        profile: null,
        accounts: [{ provider: "CREDENTIAL" }],
      };
      asMock(db.orm.public.User.first).mockResolvedValue(
        databaseFixture("User", userWithoutProfile),
      );

      // When - ID로 프로필이 없는 사용자 조회
      const result = await repository.findByIdWithProfile("user-123");

      // Then - 프로필이 null인 상태로 반환
      expect(result?.profile).toBeNull();
    });
  });

  describe("existsByEmail", () => {
    it("이메일이 존재하면 true를 반환한다", async () => {
      // Given - 해당 이메일의 사용자가 1명 존재하는 경우를 모킹
      db.orm.public.User.aggregate.mockResolvedValue({ count: 1 });

      // When - 이메일 존재 여부 확인
      const result = await repository.existsByEmail("test@example.com");

      // Then - true 반환하고 올바른 count 쿼리가 실행됨
      expect(result).toBe(true);
      assertNativeWhere("User", db.orm.public.User.where.mock.calls.at(-1)?.[0], (row) =>
        row.email.eq(varchar("test@example.com", 255)),
      );
    });

    it("이메일이 존재하지 않으면 false를 반환한다", async () => {
      // Given - 해당 이메일의 사용자가 없는 경우를 모킹
      db.orm.public.User.aggregate.mockResolvedValue({ count: 0 });

      // When - 존재하지 않는 이메일로 확인
      const result = await repository.existsByEmail("notfound@example.com");

      // Then - false 반환
      expect(result).toBe(false);
    });
  });

  describe("create", () => {
    it("새 사용자를 생성한다", async () => {
      // Given - 사용자 생성 데이터 준비 및 userTag 중복 없음 모킹
      const createData: { email: string; status: UserStatus } = {
        email: "new@example.com",
        status: "PENDING_VERIFY",
      };
      const newUser = UserBuilder.create()
        .withId("new-user-123")
        .withEmail(createData.email)
        .withUserTag(TEST_USER_TAG)
        .withStatus(createData.status)
        .build();

      db.orm.public.User.first.mockResolvedValue(databaseFixture("User", null));
      db.orm.public.User.create.mockResolvedValue(databaseFixture("User", newUser));

      // When - 새 사용자 생성
      const result = await repository.create(createData);

      // Then - 생성된 사용자 반환하고 userTag가 자동 생성됨
      expect(result.email).toBe("new@example.com");
      expect(result.userTag).toBe(TEST_USER_TAG);
      expect(db.orm.public.User.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("User", {
            email: createData.email,
            status: createData.status,
            userTag: expect.stringMatching(USER_TAG_PATTERN),
          }),
        ),
      );
    });

    it("이메일 유니크 충돌을 애플리케이션 경계 오류로 변환한다", async () => {
      // Given - 가입 전 조회 이후 동시에 같은 이메일이 생성된 상황
      db.orm.public.User.first.mockResolvedValue(databaseFixture("User", null));
      db.orm.public.User.create.mockRejectedValue(sqlQueryError("23505", "User_email_key"));

      // When / Then - Prisma 오류가 애플리케이션으로 누출되지 않음
      await expect(
        repository.create({
          email: "new@example.com",
          status: "PENDING_VERIFY",
        }),
      ).rejects.toMatchObject<AuthPersistenceConflict>({
        name: "AuthPersistenceConflict",
        message: "EMAIL_ALREADY_EXISTS",
        kind: "EMAIL_ALREADY_EXISTS",
      });
    });
  });

  describe("updateStatus", () => {
    it("사용자 상태를 업데이트한다", async () => {
      // Given - 상태가 업데이트된 사용자 데이터 모킹
      const updatedUser = UserBuilder.create().withId("user-123").suspended().build();
      db.orm.public.User.update.mockResolvedValue(databaseFixture("User", updatedUser));

      // When - 사용자 상태를 SUSPENDED로 업데이트
      const result = await repository.updateStatus("user-123", "SUSPENDED");

      // Then - 업데이트된 사용자 반환하고 올바른 update 쿼리가 실행됨
      expect(result.status).toBe("SUSPENDED");
      expect(db.orm.public.User.update).toHaveBeenCalledWith(
        expect.objectContaining(databaseWriteExpectation("User", { status: "SUSPENDED" })),
      );
    });
  });

  describe("markEmailVerified", () => {
    it("이메일 인증을 완료 처리한다", async () => {
      // Given - 이메일 인증 완료된 사용자 데이터 모킹
      const verifiedUser = UserBuilder.create().withId("user-123").verified().build();
      db.orm.public.User.update.mockResolvedValue(databaseFixture("User", verifiedUser));

      // When - 이메일 인증 완료 처리
      const result = await repository.markEmailVerified("user-123");

      // Then - 인증 완료된 사용자 반환하고 상태가 ACTIVE로 변경됨
      expect(result.status).toBe("ACTIVE");
      expect(result.emailVerifiedAt).toBeDefined();
      expect(db.orm.public.User.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("User", {
            emailVerifiedAt: expect.any(String),
            status: "ACTIVE",
          }),
        ),
      );
    });
  });

  describe("updateLastLoginAt", () => {
    it("마지막 로그인 시간을 업데이트한다", async () => {
      // Given - 로그인 시간이 업데이트된 사용자 데이터 모킹
      const userWithLogin = UserBuilder.create()
        .withId("user-123")
        .withLastLoginAt(new Date())
        .build();
      db.orm.public.User.update.mockResolvedValue(databaseFixture("User", userWithLogin));

      // When - 마지막 로그인 시간 업데이트
      await repository.updateLastLoginAt("user-123");

      // Then - 올바른 update 쿼리가 실행됨
      expect(db.orm.public.User.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("User", { lastLoginAt: expect.any(String) }),
        ),
      );
    });
  });

  describe("updateLastActiveAt", () => {
    it("사용자 현지 날짜의 활동 행과 lastActiveAt을 한 트랜잭션에서 기록한다", async () => {
      // Given - UTC 기준 다음 현지 날짜가 되는 서울 요청 시각
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-26T15:30:00.000Z"));

      try {
        // When - 인증 사용자 활동을 기록하면
        await repository.updateLastActiveAt("user-123", "Asia/Seoul");

        // Then - 한 SQL 경계에 사용자·현지 날짜·관측 시각을 바인딩한다
        expect(db.execute).toHaveBeenCalledTimes(1);
        const rawParameters = nativeSqlParameters(db.execute.mock.calls[0]?.[0]);
        expect(rawParameters).toEqual([
          databaseTimestamp(new Date("2026-07-26T15:30:00.000Z")),
          databaseTimestamp(new Date("2026-07-26T15:30:00.000Z")),
          databaseTimestamp(new Date("2026-07-26T15:30:00.000Z")),
          "user-123",
          databaseDate(new Date("2026-07-27T00:00:00.000Z")),
          "Asia/Seoul",
          databaseTimestamp(new Date("2026-07-26T15:30:00.000Z")),
          databaseTimestamp(new Date("2026-07-26T15:30:00.000Z")),
        ]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("restore", () => {
    it("사용자의 deletedAt을 null로, status를 ACTIVE로 업데이트한다", async () => {
      // Given - 탈퇴된 사용자
      const deletedUser = UserBuilder.create().withId("user-123").deleted().build();
      db.orm.public.User.update.mockResolvedValue(
        databaseFixture("User", {
          ...deletedUser,
          deletedAt: null,
          status: "ACTIVE",
        }),
      );

      // When
      const result = await repository.restore("user-123");

      // Then
      expect(db.orm.public.User.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("User", { deletedAt: null, status: "ACTIVE" }),
        ),
      );
      expect(result.deletedAt).toBeNull();
      expect(result.status).toBe("ACTIVE");
    });
  });
});
