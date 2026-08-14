import { CACHE_KEY_PREFIX, cacheKey, cachePattern } from "./cache-key";

describe("versioned infrastructure keyspace", () => {
	it("bounded context와 resource를 포함한 고정 prefix를 사용한다", () => {
		expect(CACHE_KEY_PREFIX).toBe("aido:v1");
		expect(cacheKey("auth", "session", "sess-1")).toBe("aido:v1:auth:session:sess-1");
	});

	it("식별자의 구분자 문자를 인코딩한다", () => {
		expect(cacheKey("auth", "session", "tenant:user:1")).toBe(
			"aido:v1:auth:session:tenant%3Auser%3A1",
		);
	});

	it.each(["", " "])("빈 segment(%p)를 거부한다", (empty) => {
		expect(() => cacheKey("auth", "session", empty)).toThrow("must not be blank");
	});

	it("wildcard는 pattern의 마지막 segment에서만 생성한다", () => {
		expect(cachePattern("follow", "relation", "user-1")).toBe("aido:v1:follow:relation:user-1:*");
		expect(() => cacheKey("follow", "relation", "user*")).toThrow("must not contain wildcard");
	});
});
