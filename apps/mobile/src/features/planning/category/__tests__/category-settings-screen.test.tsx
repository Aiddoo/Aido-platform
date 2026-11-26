import '@src/shared/i18n/init';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createRouteParamsFake,
  createTestDi,
  getTrackedEvents,
  respondByPath,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import TodoCategorySettingsScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/settings/category-settings';
import {
  createTodoCategoryDeletionPreviewDto,
  createTodoCategoryListDto,
} from './todo-category.fixtures';

const FREE_CATEGORY_LIMIT = PLAN_CATALOG.TODO_CATEGORY.free;

async function renderCategorySettings({ usedCategories = 2 }: { usedCategories?: number } = {}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(
    respondByPath({
      'v1/auth/me': ok(createCurrentUserDto()),
      'v1/entitlements': ok(
        createEntitlementSnapshotDto({ used: { TODO_CATEGORY: usedCategories } }),
      ),
      'v1/todo-categories': ok(createTodoCategoryListDto()),
    }),
  );
  const analytics = createAnalyticsStub();
  createRouteParamsFake();
  const { di } = await renderScreen(<TodoCategorySettingsScreen />, {
    di: createTestDi({ ports: { httpClient, analytics } }),
    withLocalDate: true,
    withOverlay: true,
  });
  await screen.findByText('업무');
  // 요금제를 받기 전에는 막지 않는다. 받은 뒤에 누른다
  await waitFor(() =>
    expect(di.queryClient.getQueryData(ENTITLEMENT_QUERY_KEYS.snapshot())).toBeDefined(),
  );

  return { analytics, httpClient };
}

describe('TodoCategorySettingsScreen', () => {
  describe('추가', () => {
    it('요금제 한도 안이면 카테고리 만들기로 간다', async () => {
      // Given
      const { analytics } = await renderCategorySettings({
        usedCategories: FREE_CATEGORY_LIMIT - 1,
      });

      // When
      await fireEvent.press(screen.getByLabelText('카테고리 추가'));

      // Then
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/todo-categories/new');
      expect(getTrackedEvents(analytics, 'limit_reached_shown')).toEqual([]);
    });

    it('요금제 한도만큼 만들었으면 만들기로 가지 않고 한도 안내를 띄운다', async () => {
      // Given
      const { analytics } = await renderCategorySettings({ usedCategories: FREE_CATEGORY_LIMIT });

      // When
      await fireEvent.press(screen.getByLabelText('카테고리 추가'));

      // Then
      expect(await screen.findByRole('button', { name: '프리미엄 보기' })).toBeOnTheScreen();
      expect(router.push).not.toHaveBeenCalled();
      expect(getTrackedEvents(analytics, 'limit_reached_shown')).toEqual([
        { feature: 'category_limit', surface: 'category_create', trigger: 'precheck' },
      ]);
    });
  });

  describe('편집 목록', () => {
    it('카테고리의 수정을 누르면 그 카테고리의 편집으로 간다', async () => {
      // Given
      await renderCategorySettings();
      const [, workEditButton] = screen.getAllByRole('button', { name: '수정' });
      if (workEditButton == null) {
        throw new Error('두 번째 카테고리의 수정 단추가 없습니다');
      }

      // When
      await fireEvent.press(workEditButton);

      // Then
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/todo-categories/[categoryId]/edit',
        params: { categoryId: 2 },
      });
    });

    it('카테고리의 삭제를 누르면 지울 때 남는 할 일을 미리 받으며 삭제 확인으로 간다', async () => {
      // Given
      const { httpClient } = await renderCategorySettings();
      httpClient.get.mockImplementation(
        respondByPath({
          'v1/todo-categories/2/deletion-preview': ok(
            createTodoCategoryDeletionPreviewDto({ categoryId: 2 }),
          ),
        }),
      );

      // When
      await fireEvent.press(screen.getByTestId('category-delete-2'));

      // Then
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/todo-categories/[categoryId]/delete',
        params: { categoryId: 2 },
      });
      await waitFor(() =>
        expect(httpClient.get).toHaveBeenCalledWith('v1/todo-categories/2/deletion-preview', {
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  it('순서 바꾸기 탭을 누르면 수정·삭제 없이 옮길 목록을 보인다', async () => {
    // Given
    await renderCategorySettings();
    expect(screen.getAllByRole('button', { name: '수정' })).toHaveLength(2);

    // When
    await fireEvent.press(screen.getByText('순서 바꾸기'));

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ view: 'reorder' });
    await waitFor(() => expect(screen.queryByRole('button', { name: '수정' })).toBeNull());
    expect(screen.getByText('업무')).toBeOnTheScreen();
    expect(screen.queryByTestId('category-delete-2')).toBeNull();
  });
});
