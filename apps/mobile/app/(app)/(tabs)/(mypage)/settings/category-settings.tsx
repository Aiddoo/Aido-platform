import Add from '@expo/material-symbols/add.xml';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { CategoryList } from '@src/features/planning/category/components/category-list';
import {
  CATEGORY_SETTINGS_VIEW,
  categorySettingsViewSchema,
} from '@src/features/planning/category/schemas/category-settings-params.schema';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useView } from '@src/shared/hooks/use-view';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorBoundary,
  ReadableContent,
  SegmentTabTrigger,
  SettingsListGroup,
  StyledSafeAreaView,
  ViewTabs,
} from '@src/shared/ui';
import { Stack, router } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

const ADD_ICON = process.env.EXPO_OS === 'ios' ? 'plus' : Add;

export default function TodoCategorySettingsScreen() {
  const { t } = useTranslation('settings');
  const push = useSingleTap(router.push);
  const [view, setView] = useView('view', categorySettingsViewSchema);
  const gate = useEntitlementGate('TODO_CATEGORY', { surface: 'category_create' });

  // 이름을 다 쓴 뒤에 막히지 않게 시트를 열기 전에 확인한다
  const handleAddPress = () => {
    if (gate.promptIfBlocked()) {
      return;
    }
    push('/todo-categories/new');
  };

  // 목록이 스스로 스크롤해 `SettingsScreenLayout`(ScrollView) 대신 같은 여백의 고정 틀을 쓴다
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right', 'bottom']}>
      {/* 큰 글꼴에서도 탭과 겹치지 않게 추가는 헤더 오른쪽 주요 동작으로 둔다 */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={ADD_ICON}
          accessibilityLabel={t('categorySettings.add')}
          onPress={handleAddPress}
        >
          {t('categorySettings.add')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <ReadableContent flex={1} gap={12} className="px-4 pt-5 pb-4">
        <ViewTabs
          schema={categorySettingsViewSchema}
          value={view}
          onValueChange={setView}
          variant="primary"
        >
          <Tabs.List>
            <Tabs.Indicator />
            <SegmentTabTrigger value={CATEGORY_SETTINGS_VIEW.edit}>
              {t('categorySettings.editTab')}
            </SegmentTabTrigger>
            <SegmentTabTrigger value={CATEGORY_SETTINGS_VIEW.reorder}>
              {t('categorySettings.reorderTab')}
            </SegmentTabTrigger>
          </Tabs.List>
        </ViewTabs>

        <SettingsListGroup label={t('categorySettings.listLabel')} className="flex-1">
          <QueryErrorBoundary fallback={CategoryList.Error}>
            <Suspense fallback={<CategoryList.Loading />}>
              {match(view)
                .with(CATEGORY_SETTINGS_VIEW.edit, () => <CategoryList />)
                .with(CATEGORY_SETTINGS_VIEW.reorder, () => <CategoryList.Reorder />)
                .exhaustive()}
            </Suspense>
          </QueryErrorBoundary>
        </SettingsListGroup>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
