import '@src/shared/i18n/init';
import { ErrorCode } from '@aido/api/errors';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { err, ok } from '@src/core/errors/result';
import {
  createEntitlementSnapshot,
  createEntitlementSnapshotDto,
  createFeatureQuotaDto,
  createLimitApiError,
} from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { SheetRouteScreen } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { View } from 'react-native';

import { createTodoCategoryWithCount } from '../__tests__/todo-category.fixtures';
import { TODO_CATEGORY_QUERY_KEYS } from '../queries/todo-category-query-keys';
import { CategoryCreateBottomSheet } from './category-create-bottom-sheet';

type HostNode = ReturnType<typeof screen.getByTestId>;

function findLayoutHost(node: HostNode): HostNode | null {
  if ('onLayout' in node.props) {
    return node;
  }
  for (const child of node.children) {
    const found = typeof child === 'string' ? null : findLayoutHost(child);
    if (found != null) {
      return found;
    }
  }
  return null;
}

/** 무료 한도(3개)가 찬 계정이 링크(`todo-categories/new`)로 추가 시트 route를 바로 연다 */
async function renderLinkedCreateSheet() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto()));
  httpClient.post.mockResolvedValue(
    err(
      createLimitApiError(
        ErrorCode.TODO_CATEGORY_0857,
        {
          charged: false,
          featureQuota: createFeatureQuotaDto('TODO_CATEGORY', {
            used: PLAN_CATALOG.TODO_CATEGORY.free,
          }),
        },
        403,
      ),
    ),
  );
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-1' }));
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), createEntitlementSnapshot());
  queryClient.setQueryData(TODO_CATEGORY_QUERY_KEYS.list(), {
    categories: [createTodoCategoryWithCount({ id: 1, name: '할 일' })],
  });
  await renderScreen(
    <View testID="sheet-route">
      <SheetRouteScreen>
        <CategoryCreateBottomSheet />
      </SheetRouteScreen>
    </View>,
    {
      queryClient,
      withLocalDate: true,
      di: {
        httpClient,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
      },
    },
  );
  const layoutHost = findLayoutHost(screen.getByTestId('sheet-route'));
  if (layoutHost != null) {
    await fireEvent(layoutHost, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });
  }

  return { httpClient };
}

async function saveCategory(user: ReturnType<typeof userEvent.setup>) {
  await user.press(await screen.findByRole('button', { name: '확인' }));
}

describe('CategoryCreateBottomSheet', () => {
  setupFakeTimersPerTest();
  it('링크로 연 추가 시트에서 서버가 한도로 막으면 오류 토스트 없이 같은 업셀 시트를 시트 route 위에 띄운다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderLinkedCreateSheet();
    await user.type(await screen.findByPlaceholderText('카테고리 이름을 입력해주세요'), '운동');

    // When
    await saveCategory(user);

    // Then
    const sheetRoute = screen.getByTestId('sheet-route');
    expect(await within(sheetRoute).findByRole('button', { name: '나중에' })).toBeTruthy();
    expect(within(sheetRoute).getAllByText('카테고리를 더 만들 수 없어요')).not.toHaveLength(0);
    expect(screen.queryByText('잠시 후 다시 추가해보세요')).toBeNull();
  });

  it('같은 날 업셀을 닫은 뒤 다시 막히면 시트 route 안의 토스트에서 프리미엄 보기를 누를 수 있다', async () => {
    // Given
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderLinkedCreateSheet();
    await user.type(await screen.findByPlaceholderText('카테고리 이름을 입력해주세요'), '운동');
    await saveCategory(user);
    await user.press(await screen.findByRole('button', { name: '나중에' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '나중에' })).toBeNull());
    // 연타 가드(600ms)가 지난 뒤의 두 번째 저장이다
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // When
    await saveCategory(user);

    // Then
    const [toastAction] = await within(screen.getByTestId('sheet-route')).findAllByRole('button', {
      name: '프리미엄 보기',
    });
    if (toastAction != null) {
      await user.press(toastAction);
    }
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { feature: 'TODO_CATEGORY' },
    });
  });
});
