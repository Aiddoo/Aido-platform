/**
 * ai (Vercel AI SDK) Mock
 *
 * v7부터 ESM-only 빌드라 jest 29(CJS)에서 로드할 수 없는 문제를 해결하기
 * 위한 모킹 — jose.mock.ts와 동일한 패턴. 실제 LLM 호출은 테스트하지
 * 않으므로 import 표면(APICallError, generateObject)만 제공한다.
 * (개별 spec의 jest.mock("ai", factory)가 있으면 그쪽이 우선한다)
 */

export class APICallError extends Error {
	readonly statusCode?: number;

	constructor(message = "API call error", statusCode?: number) {
		super(message);
		this.statusCode = statusCode;
	}

	static isInstance(error: unknown): error is APICallError {
		return error instanceof APICallError;
	}
}

export const generateObject = jest.fn().mockResolvedValue({
	object: {},
	usage: { inputTokens: 0, outputTokens: 0 },
});
