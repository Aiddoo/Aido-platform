import { type CreateNudgeResponse, createNudgeResponseSchema } from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { SendNudgeInput, SendNudgeResult, TodoNudgeRepository } from './todo-nudge.repository';

export class TodoNudgeRepositoryImpl implements TodoNudgeRepository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async sendNudge(input: SendNudgeInput): Promise<Result<SendNudgeResult, ApiError>> {
    const result = await this.#httpClient.post<CreateNudgeResponse>('v1/nudges', {
      receiverId: input.receiverId,
      todoId: input.todoId,
      message: input.message,
    });

    if (!result.ok) return result;

    const parsed = createNudgeResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[TodoNudgeRepository] Invalid sendNudge response:', parsed.error);
      throw new ParseError();
    }

    return ok({ message: parsed.data.message });
  }
}
