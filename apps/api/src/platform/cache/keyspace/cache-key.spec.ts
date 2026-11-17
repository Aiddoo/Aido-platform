import { CACHE_KEY_PREFIX, cacheKey, cachePattern } from "./cache-key.js";

describe("버전이 명시된 Infrastructure keyspace", () => {
  it("bounded context와 resource를 포함한 고정 prefix를 사용한다", () => {
    // When
    const key = cacheKey("auth", "session", "sess-1");

    // Then
    expect(CACHE_KEY_PREFIX).toBe("aido:v1");
    expect(key).toBe("aido:v1:auth:session:sess-1");
  });

  it("식별자의 구분자 문자를 인코딩한다", () => {
    // When
    const key = cacheKey("auth", "session", "tenant:user:1");

    // Then
    expect(key).toBe("aido:v1:auth:session:tenant%3Auser%3A1");
  });

  it.each(["", " "])("빈 segment(%p)를 거부한다", (empty) => {
    // When
    const createKey = () => cacheKey("auth", "session", empty);

    // Then
    expect(createKey).toThrow("must not be blank");
  });

  it("wildcard는 pattern의 마지막 segment에서만 생성한다", () => {
    // When
    const pattern = cachePattern("follow", "relation", "user-1");
    const createWildcardKey = () => cacheKey("follow", "relation", "user*");

    // Then
    expect(pattern).toBe("aido:v1:follow:relation:user-1:*");
    expect(createWildcardKey).toThrow("must not contain wildcard");
  });
});
