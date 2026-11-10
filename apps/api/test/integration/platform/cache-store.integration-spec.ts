import { Redis } from "ioredis";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { z } from "zod";

import { RedisCacheStore } from "#api/platform/cache/adapters/redis-cache.store";
import { describeCacheStoreContract } from "#test/contracts/platform/cache-store.contract";

const REDIS_PORT = 6_379;

describe.each([
  { name: "Redis", image: "redis:7.4-alpine" },
  { name: "Valkey", image: "valkey/valkey:8-alpine" },
])("RedisCacheStore ($name 컨테이너)", ({ name, image }) => {
  let container: StartedTestContainer;
  let redis: Redis;

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
    const broken = new Redis({
      host: container.getHost(),
      port: container.getMappedPort(REDIS_PORT),
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
    });
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
