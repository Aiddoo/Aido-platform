import { readFileSync } from "node:fs";

type HttpResponseStep = () => Response;

export function resendResponseFixture(fileName: string, status = 200): HttpResponseStep {
  const body = readFileSync(
    new URL(`../fixtures/providers/resend/${fileName}`, import.meta.url),
    "utf8",
  );
  return () => new Response(body, { status, headers: { "content-type": "application/json" } });
}

export class StubResendHttp {
  readonly requests: Request[] = [];
  readonly unexpectedRequests: string[] = [];
  readonly #responses: HttpResponseStep[];

  constructor(responses: readonly HttpResponseStep[]) {
    this.#responses = [...responses];
  }

  get remainingResponses(): number {
    return this.#responses.length;
  }

  fetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    this.requests.push(request);
    const response = this.#responses.shift();
    if (
      request.url !== "https://api.resend.com/emails" ||
      request.method !== "POST" ||
      response === undefined
    ) {
      this.unexpectedRequests.push(`${request.method} ${request.url}`);
      throw new Error("준비되지 않은 Resend HTTP 요청입니다.");
    }
    return response();
  };

  request(index = 0): Request {
    const request = this.requests[index];
    if (request === undefined) throw new Error(`${index}번째 Resend 요청이 없습니다.`);
    return request;
  }
}
