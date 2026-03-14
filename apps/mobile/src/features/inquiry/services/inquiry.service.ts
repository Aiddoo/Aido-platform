import {
  type CreateInquiryInput,
  type CreateInquiryResponse,
  createInquiryResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { InquiryResult } from '../models/inquiry.model';
import { toInquiryResult } from './inquiry.mapper';

export class InquiryService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  createInquiry = async (input: CreateInquiryInput): Promise<Result<InquiryResult, ApiError>> => {
    const result = await this.#httpClient.post<CreateInquiryResponse>('v1/inquiries', input);

    if (!result.ok) {
      return result;
    }

    const parsed = createInquiryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[InquiryService] Invalid createInquiry response: ${parsed.error.message}`,
      );
    }

    return ok(toInquiryResult(parsed.data));
  };
}
