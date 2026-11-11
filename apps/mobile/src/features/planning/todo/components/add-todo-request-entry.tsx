import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { useTranslation } from '@src/shared/i18n';
import { Box, Result, Text } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { match } from 'ts-pattern';

import { useFeedAction, useFeedDateKey } from '../hooks/use-feed-params';

/** 위젯·딥링크·다른 탭의 할 일 추가 요청을 받아 기본 카테고리로 추가 시트를 연다. 피드 위에 열어야 만든 할 일이 시트 뒤에 보인다 */
export function AddTodoRequestEntry() {
  const { t } = useTranslation(['widget', 'common']);
  const [action, setAction] = useFeedAction();
  const [selectedDateKey] = useFeedDateKey();
  const isRequested = action != null;
  const categories = useQuery({
    ...useGetTodoCategoriesQueryOptions(),
    enabled: isRequested,
    throwOnError: false,
  });
  const categoryId = TodoCategoryPolicy.getInitialCategoryId(
    categories.data?.categories ?? [],
    null,
  );

  useEffect(() => {
    if (!isRequested || categoryId == null) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      setAction(undefined);
      router.push({
        pathname: '/todo/new',
        params: {
          date: selectedDateKey,
          categoryId,
          ...(action === 'add-voice-todo' && { startVoice: '1' }),
        },
      });
    });
    return () => cancelAnimationFrame(frameId);
  }, [action, isRequested, categoryId, selectedDateKey, setAction]);

  const createEntryStatus = !isRequested
    ? ('idle' as const)
    : match(categories)
        .with({ isLoading: true }, () => 'loading' as const)
        .with({ isError: true }, () => 'error' as const)
        .with({ isSuccess: true }, () =>
          categoryId == null ? ('empty' as const) : ('idle' as const),
        )
        .otherwise(() => 'idle' as const);

  return match(createEntryStatus)
    .with('loading', () => (
      <Box px={16} py={8}>
        <Text size="b4" shade={6}>
          {t('widget:entry.loading')}
        </Text>
      </Box>
    ))
    .with('error', () => (
      <Box px={16} py={8}>
        <Result
          title={t('widget:entry.loadError')}
          button={
            <Result.Button onPress={() => categories.refetch()}>
              {t('common:actions.retry')}
            </Result.Button>
          }
        />
      </Box>
    ))
    .with('empty', () => (
      <Box px={16} py={8}>
        <Result
          title={t('widget:entry.emptyCategory')}
          button={
            <Result.Button
              onPress={() => {
                setAction(undefined);
                router.navigate('/settings/category-settings');
              }}
            >
              {t('widget:entry.manageCategories')}
            </Result.Button>
          }
        />
      </Box>
    ))
    .with('idle', () => null)
    .exhaustive();
}
