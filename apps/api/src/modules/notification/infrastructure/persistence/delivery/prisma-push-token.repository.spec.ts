import { and } from "@prisma/orm-postgres/orm-client";

import { varchar } from "#api/platform/database/database-values";
import { PushTokenBuilder } from "#test/builders/index";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
  nativeRows,
} from "#test/mocks/database.mock";
import { asMock, createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import type {
  FindPushTokensParams,
  RegisterPushTokenData,
} from "../../../application/ports/delivery/notification-data.js";
import { PrismaPushTokenRepository } from "./prisma-push-token.repository.js";

describe("PrismaPushTokenRepository", () => {
  let repository: PrismaPushTokenRepository;
  let db: MockDatabaseContext;

  beforeEach(async () => {
    PushTokenBuilder.resetIdCounter();
    db = createMockDatabaseContext();
    repository = new PrismaPushTokenRepository(createMockTransactionHost(db));
  });

  it("사용자와 deviceId 복합 키로 푸시 토큰을 upsert한다", async () => {
    const data: RegisterPushTokenData = {
      userId: "user-1",
      token: "ExponentPushToken[valid]",
      deviceId: "device-1",
      platform: "IOS",
    };
    const expected = PushTokenBuilder.create("user-1").withDeviceId("device-1").build();
    asMock(db.orm.public.PushToken.upsert).mockResolvedValue(
      databaseFixture("PushToken", expected),
    );

    await expect(repository.registerPushToken(data)).resolves.toEqual(expected);
    expect(db.orm.public.PushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictOn: databaseWriteExpectation("PushToken", {
          userId: "user-1",
          deviceId: "device-1",
        }),
        create: expect.objectContaining(
          databaseWriteExpectation("PushToken", {
            userId: "user-1",
            token: data.token,
            deviceId: "device-1",
            platform: "IOS",
            isActive: true,
            payloadVersion: 1,
            appVersion: undefined,
          }),
        ),
        update: expect.objectContaining(
          databaseWriteExpectation("PushToken", {
            token: data.token,
            platform: "IOS",
            isActive: true,
            payloadVersion: 1,
            appVersion: undefined,
            updatedAt: expect.any(String),
          }),
        ),
      }),
    );
  });

  it("deviceId와 platform이 없으면 기존 호환 기본값을 유지한다", async () => {
    const expected = PushTokenBuilder.create("user-1").withDeviceId("default").build();
    asMock(db.orm.public.PushToken.upsert).mockResolvedValue(
      databaseFixture("PushToken", expected),
    );

    await repository.registerPushToken({ userId: "user-1", token: expected.token });
    expect(db.orm.public.PushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictOn: databaseWriteExpectation("PushToken", {
          userId: "user-1",
          deviceId: "default",
        }),
        create: expect.objectContaining(
          databaseWriteExpectation("PushToken", { deviceId: "default", platform: "IOS" }),
        ),
      }),
    );
  });

  it("사용자 토큰을 최신 갱신 순으로 조회한다", async () => {
    const params: FindPushTokensParams = { userId: "user-1" };
    const tokens = [PushTokenBuilder.create("user-1").build()];
    asMock(db.orm.public.PushToken.all).mockReturnValue(
      nativeRows(databaseFixture("PushToken", tokens)),
    );

    await expect(repository.findPushTokensByUser(params)).resolves.toEqual(tokens);
    assertNativeWhere("PushToken", db.orm.public.PushToken.where.mock.calls.at(-1)?.[0], (row) =>
      row.userId.eq("user-1"),
    );
  });

  it("activeOnly가 true이면 활성 토큰만 조회한다", async () => {
    asMock(db.orm.public.PushToken.all).mockReturnValue(
      nativeRows(databaseFixture("PushToken", [])),
    );

    await repository.findPushTokensByUser({ userId: "user-1", activeOnly: true });
    assertNativeWhere("PushToken", db.orm.public.PushToken.where.mock.calls.at(-1)?.[0], (row) =>
      and(row.userId.eq("user-1"), row.isActive.eq(true)),
    );
  });

  it("여러 사용자의 활성 토큰을 한 쿼리로 조회한다", async () => {
    asMock(db.orm.public.PushToken.all).mockReturnValue(
      nativeRows(databaseFixture("PushToken", [])),
    );

    await repository.findActivePushTokensByUsers(["user-1", "user-2"]);
    assertNativeWhere("PushToken", db.orm.public.PushToken.where.mock.calls.at(-1)?.[0], (row) =>
      and(row.userId.in(["user-1", "user-2"]), row.isActive.eq(true)),
    );
  });

  it("특정 device 토큰을 복합 키로 삭제한다", async () => {
    const token = PushTokenBuilder.create("user-1").build();
    asMock(db.orm.public.PushToken.delete).mockResolvedValue(databaseFixture("PushToken", token));

    await expect(repository.deletePushToken("user-1", "device-1")).resolves.toEqual(token);
    assertNativeWhere("PushToken", db.orm.public.PushToken.where.mock.calls.at(-1)?.[0], (row) =>
      and(row.userId.eq("user-1"), row.deviceId.eq(varchar("device-1", 255))),
    );
  });

  it("사용자의 모든 토큰을 삭제한다", async () => {
    asMock(db.orm.public.PushToken.deleteAndCount).mockResolvedValue(3);

    await expect(repository.deleteAllPushTokensByUser("user-1")).resolves.toEqual({ count: 3 });
    assertNativeWhere("PushToken", db.orm.public.PushToken.where.mock.calls.at(-1)?.[0], (row) =>
      row.userId.eq("user-1"),
    );
  });

  it("무효 토큰을 한 번의 updateMany로 비활성화한다", async () => {
    const tokens = ["invalid-1", "invalid-2"];
    asMock(db.orm.public.PushToken.updateAndCount).mockResolvedValue(2);

    await expect(repository.deactivateInvalidTokens(tokens)).resolves.toEqual({ count: 2 });
    expect(db.orm.public.PushToken.updateAndCount).toHaveBeenCalledWith(
      expect.objectContaining(databaseWriteExpectation("PushToken", { isActive: false })),
    );
  });
});
