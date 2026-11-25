import {
  type CreateInquiryInput,
  createInquiryResponseSchema,
} from '@aido/api/contracts/inquiry/v1';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { noop } from 'es-toolkit';

export class InquiryApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  // 접수 안내는 앱 문구로 하고 응답의 안내 글은 쓰지 않는다
  createInquiry = async (input: CreateInquiryInput) =>
    parseApiResponse(
      await this.#httpClient.post('v1/inquiries', input),
      createInquiryResponseSchema,
      noop,
      '[InquiryApi] Invalid createInquiry response',
    );
}
