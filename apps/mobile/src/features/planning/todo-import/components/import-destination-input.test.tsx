import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { createCoachmarkStorage } from '@src/features/device/coachmark/__tests__/coachmark.fixtures';
import { CoachmarkPopover } from '@src/features/device/coachmark/components/coachmark-popover';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { QueryErrorBoundary } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createTestDi,
  respondByPath,
  setupViewMeasurePerTest,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { Suspense } from 'react';

import { createTodoImportCollection } from '../__tests__/todo-import.fixtures';
import type { TodoImportPlan } from '../domains/todo-import-plan.model';
import { ImportDestinationInput } from './import-destination-input';

const COACHMARK_KIND = 'todo-import-destination';
/** 말풍선은 포커스 뒤 450ms를 기다렸다가 연다 */
const POPOVER_WAIT = { timeout: 2_000 };
const PLAN: TodoImportPlan = {
  collections: [createTodoImportCollection()],
  categoryMode: 'single',
  singleTarget: null,
  targets: {},
};

/** 화면처럼 처음 한 번 넣을 곳을 짚는 코치마크로 감싼 넣을 곳 칸 */
async function renderDestinationWithCoachmark() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/entitlements': ok(createEntitlementSnapshotDto()),
      'v1/todo-categories': ok(createTodoCategoryListDto()),
      'v1/todos/resource-limit': ok({ maxPerCategory: 300, activeCount: 5 }),
    }),
  );
  const { syncStorage, records } = createCoachmarkStorage();
  const analytics = createAnalyticsStub();

  await renderScreen(
    <QueryErrorBoundary>
      <Suspense fallback={null}>
        <CoachmarkPopover kind={COACHMARK_KIND} description="안내 설명" isPassThrough>
          <ImportDestinationInput plan={PLAN} errorMessage={null} onChange={noop} />
        </CoachmarkPopover>
      </Suspense>
    </QueryErrorBoundary>,
    {
      di: createTestDi({ ports: { httpClient, syncStorage, analytics } }),
      withLocalDate: true,
      withOverlay: true,
    },
  );

  return {
    analytics,
    hasSeenCoachmark: () =>
      records.hasSeen({ accountId: createCurrentUserDto().userId, kind: COACHMARK_KIND }),
  };
}

describe('ImportDestinationInput', () => {
  setupViewMeasurePerTest({ measure: [0, 0, 44, 44, 16, 300] });

  // 재현: 부품이 나머지 props 뒤에 onPress를 덮어, 코치마크 트리거가 넣은 누름이 사라지고 안내가 끝나지 않았다
  it('코치마크가 떠 있을 때 넣을 곳을 누르면 시트가 열리고 같은 탭이 안내도 끝낸다', async () => {
    // Given
    const { analytics, hasSeenCoachmark } = await renderDestinationWithCoachmark();
    await screen.findByTestId('hint-popover', {}, POPOVER_WAIT);

    // When
    await fireEvent.press(screen.getByRole('button', { name: /^넣을 곳, 기본/ }));

    // Then
    expect(await screen.findByText('내 아이두 카테고리')).toBeOnTheScreen();
    expect(hasSeenCoachmark()).toBe(true);
    expect(analytics.trackEvent).toHaveBeenCalledWith('coachmark_dismissed', {
      kind: COACHMARK_KIND,
    });
  });
});
