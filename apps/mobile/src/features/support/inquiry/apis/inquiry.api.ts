import { type CreateInquiryInput, createInquiryResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { toInquiryResult } from './inquiry.mapper';

export class InquiryApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  createInquiry = async (input: CreateInquiryInput) =>
    parseApiResponse(
      await this.#httpClient.post('v1/inquiries', input),
      createInquiryResponseSchema,
      toInquiryResult,
      '[InquiryApi] Invalid createInquiry response',
    );
}
