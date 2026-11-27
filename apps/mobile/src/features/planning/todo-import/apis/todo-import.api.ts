import {
  activeTodoImportResponseSchema,
  receiveTodoImportItemsResponseSchema,
  todoImportResponseSchema,
} from '@aido/api/contracts/todo-import/v1';
import { IDEMPOTENCY_KEY_HEADER } from '@aido/api/vocabulary';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { TodoImportItem } from '../domains/todo-import-item.model';
import type { TodoImportSelection } from '../domains/todo-import-selection.model';
import {
  toReceiveTodoImportItemsRequest,
  toStartTodoImportRequest,
  toTodoImport,
} from './todo-import.mapper';

export class TodoImportApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  /** 같은 키로 다시 보내면 서버가 처음 만든 가져오기를 돌려준다. 앱이 꺼졌다 켜져도 두 번 만들지 않는다 */
  startImport = async (
    selection: TodoImportSelection,
    idempotencyKey: string,
    signal?: AbortSignal,
  ) =>
    parseApiResponse(
      await this.#httpClient.post('v1/todo-imports', toStartTodoImportRequest(selection), {
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        signal,
      }),
      todoImportResponseSchema,
      ({ todoImport }) => toTodoImport(todoImport),
      '[TodoImportApi] Invalid startImport response',
    );

  /** 이미 받은 일정 키는 서버가 무시해 끊긴 묶음을 다시 보내도 된다 */
  uploadItems = async (importId: string, items: readonly TodoImportItem[], signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.post(
        `v1/todo-imports/${encodeURIComponent(importId)}/items`,
        toReceiveTodoImportItemsRequest(items),
        { signal },
      ),
      receiveTodoImportItemsResponseSchema,
      ({ receivedItemCount }) => ({ receivedItemCount }),
      '[TodoImportApi] Invalid uploadItems response',
    );

  commitImport = async (importId: string, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.post(
        `v1/todo-imports/${encodeURIComponent(importId)}/commit`,
        undefined,
        { signal },
      ),
      todoImportResponseSchema,
      ({ todoImport }) => toTodoImport(todoImport),
      '[TodoImportApi] Invalid commitImport response',
    );

  getImport = async (importId: string, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/todo-imports/${encodeURIComponent(importId)}`, { signal }),
      todoImportResponseSchema,
      ({ todoImport }) => toTodoImport(todoImport),
      '[TodoImportApi] Invalid getImport response',
    );

  getActiveImport = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/todo-imports/active', { signal }),
      activeTodoImportResponseSchema,
      ({ todoImport }) => (todoImport == null ? null : toTodoImport(todoImport)),
      '[TodoImportApi] Invalid getActiveImport response',
    );

  cancelImport = async (importId: string) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/todo-imports/${encodeURIComponent(importId)}`),
      todoImportResponseSchema,
      ({ todoImport }) => toTodoImport(todoImport),
      '[TodoImportApi] Invalid cancelImport response',
    );

  /** 완료한 할 일은 남기고 미완료만 지운다. 판단과 기한은 서버가 한다 */
  undoImport = async (importId: string) =>
    parseApiResponse(
      await this.#httpClient.post(`v1/todo-imports/${encodeURIComponent(importId)}/undo`),
      todoImportResponseSchema,
      ({ todoImport }) => toTodoImport(todoImport),
      '[TodoImportApi] Invalid undoImport response',
    );
}
