import { ThrottlerStorageService } from "@nestjs/throttler";
import { Redis } from "ioredis";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { z } from "zod";

import { RedisCacheStore } from "#api/platform/cache/adapters/redis-cache.store";
import { RedisDedupAdapter } from "#api/platform/dedup/adapters/redis-dedup.adapter";
import { RedisLockAdapter } from "#api/platform/lock/adapters/redis-lock.adapter";
import { RedisErrorLogSampler } from "#api/platform/redis/redis-error-log-sampler";
import { RedisThrottlerStorage } from "#api/platform/throttle/redis-throttler-storage";
import { describeCacheStoreContract } from "#test/contracts/platform/cache-store.contract";
import { describeDedupProviderContract } from "#test/contracts/platform/dedup-provider.contract";
import { describeLockProviderContract } from "#test/contracts/platform/lock-provider.contract";
import { describeThrottlerStorageContract } from "#test/contracts/platform/throttler-storage.contract";

const REDIS_PORT = 6379;

describeThrottlerStorageContract({
  name: "@nestjs/throttler 기본 in-memory",
  createStorage: () => new ThrottlerStorageService(),
});

describe.each([
  { name: "Redis", image: "redis:7.4-alpine" },
  { name: "Valkey", image: "valkey/valkey:8-alpine" },
])("Redis 어댑터 ($name 컨테이너)", ({ name, image }) => {
  let container: StartedTestContainer;
  let redis: Redis;

  // 오프라인 큐가 없어 연결이 없으면 모든 명령이 곧바로 실패한다(운영 command 클라이언트의 fail-fast와 같다)
  const createFailFastClient = (): Redis =>
    new Redis({
      host: container.getHost(),
      port: container.getMappedPort(REDIS_PORT),
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
    });

  beforeAll(async () => {
    container = await new GenericContainer(image)
      .withExposedPorts(REDIS_PORT)
      .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
      .start();
    redis = new Redis({
      host: container.getHost(),
      port: container.getMappedPort(REDIS_PORT),
      maxRetriesPerRequest: 1,
    });
  }, 120_000);

  afterAll(async () => {
    await redis?.quit();
    await container?.stop();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  describe("RedisCacheStore", () => {
    describeCacheStoreContract({
      name,
      createStore: () => new RedisCacheStore(redis, 60_000),
    });

    it("값은 운영 key prefix(cache:) 아래 JSON으로 저장한다", async () => {
      // Given
      const store = new RedisCacheStore(redis, 60_000);

      // When
      await store.set("prefix:key", { count: 1 });

      // Then
      expect(await redis.get("cache:prefix:key")).toBe('{"count":1}');
    });

    it("연결이 끊겨도 읽기는 미스, 쓰기는 조용히 넘어간다", async () => {
      // Given
      const broken = createFailFastClient();
      const store = new RedisCacheStore(broken, 60_000);

      // When
      await store.set("offline", 1);
      const value = await store.get("offline", z.number());

      // Then
      expect(value).toBeUndefined();
      expect(await store.has("offline")).toBe(false);
      expect(await store.ttl("offline")).toBe(-2);
      expect(await store.delByPattern("offline*")).toBe(0);
      broken.disconnect();
    });
  });

  describe("RedisLockAdapter", () => {
    describeLockProviderContract({
      name,
      createProvider: () => new RedisLockAdapter(redis),
    });

    it("Redis에 닿지 못하면 잠금을 얻지 못한 것으로, 리소스는 잠긴 것으로 답한다(fail-closed)", async () => {
      // Given
      const broken = createFailFastClient();
      const warnings: unknown[] = [];
      const lock = new RedisLockAdapter(
        broken,
        new RedisErrorLogSampler({ warn: (entry: unknown) => warnings.push(entry) }),
      );

      // When
      const release = await lock.acquire("resource", 5000);
      const isLocked = await lock.isLocked("resource");

      // Then
      expect(release).toBeNull();
      expect(isLocked).toBe(true);
      expect(warnings).toHaveLength(1);
      broken.disconnect();
    });

    it("해제 중 연결이 끊겨도 throw하지 않고 TTL 만료에 맡긴다", async () => {
      // Given
      const client = createFailFastClient();
      await client.connect();
      const warnings: unknown[] = [];
      const lock = new RedisLockAdapter(
        client,
        new RedisErrorLogSampler({ warn: (entry: unknown) => warnings.push(entry) }),
      );
      const release = await lock.acquire("resource", 5000);
      client.disconnect();

      // When / Then
      await expect(release?.()).resolves.toBeUndefined();
      expect(warnings).toHaveLength(1);
      expect(await redis.pttl("lock:resource")).toBeGreaterThan(0);
    });
  });

  describe("RedisDedupAdapter", () => {
    describeDedupProviderContract({
      name,
      createProvider: () => new RedisDedupAdapter(redis),
    });

    it("Redis에 닿지 못하면 처리된 항목이 없는 것으로 본다(fail-open, DB unique index가 최종 방어선)", async () => {
      // Given
      const broken = createFailFastClient();
      const dedup = new RedisDedupAdapter(broken);

      // When
      await dedup.addMembers("offline", ["a"], 60_000);

      // Then
      expect(await dedup.filterMembers("offline", ["a"])).toEqual(new Set());
      expect(await dedup.isMember("offline", "a")).toBe(false);
      broken.disconnect();
    });
  });

  describe("RedisThrottlerStorage", () => {
    describeThrottlerStorageContract({
      name,
      createStorage: () => new RedisThrottlerStorage(redis),
    });

    it("Redis에 닿지 못하면 요청을 막지 않는다(fail-open)", async () => {
      // Given
      const broken = createFailFastClient();
      const storage = new RedisThrottlerStorage(broken);

      // When
      const record = await storage.increment("offline", 60_000, 1, 60_000, "default");

      // Then
      expect(record).toEqual({
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
      broken.disconnect();
    });
  });
});
