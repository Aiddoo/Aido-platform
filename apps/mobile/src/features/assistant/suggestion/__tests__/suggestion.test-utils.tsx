import type { SuggestionListResponse } from '@aido/api/contracts/ai/v1';
import type { AccessTier } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createConsentDto } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { createTodoServer } from '@src/features/planning/todo/__tests__/todo.test-utils';

import { createSuggestionListDto } from './suggestion.fixtures';

/** 서울 2026-11-16 월요일 12:00 */
export const SUGGESTION_NOW = new Date('2026-11-16T03:00:00.000Z');

type GetResponse = Result<unknown, ApiError> | (() => Promise<Result<unknown, ApiError>>);

interface SuggestionServerOptions {
  tier?: AccessTier;
  /** 제안 목록. 흐름 중간에 바꾸려면 함수를 넘긴다 */
  list?: SuggestionListResponse | (() => SuggestionListResponse);
  /** path마다 덮어쓰는 GET 응답 */
  get?: Record<string, GetResponse>;
}

/** 제안 화면·수락 시트가 읽는 서버. 기본은 AI 동의를 한 프리미엄 사용자이고 제안이 하나 있다 */
export function createSuggestionHttpClient({
  tier = 'PREMIUM',
  list = createSuggestionListDto(),
  get = {},
}: SuggestionServerOptions = {}): jest.Mocked<HttpClient> {
  return createTodoServer({
    get: {
      'v1/entitlements': ok(createEntitlementSnapshotDto({ tier })),
      'v1/auth/consent': ok(
        createConsentDto({
          aiDataSharingDecision: 'AGREED',
          aiDataSharingAgreedAt: '2026-11-01T00:00:00.000Z',
        }),
      ),
      'v1/ai/suggestions': async () => ok(typeof list === 'function' ? list() : list),
      ...get,
    },
  });
}

/** 그 path로 보낸 쓰기 요청 수 */
export function countWriteRequests(
  httpClient: jest.Mocked<HttpClient>,
  method: 'post' | 'patch',
  path: string,
) {
  return httpClient[method].mock.calls.filter(([requestPath]) => requestPath === path).length;
}
