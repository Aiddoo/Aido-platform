import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { CategoryList } from '@src/features/planning/category/components/category-list';
import {
  CATEGORY_SETTINGS_VIEW,
  categorySettingsViewSchema,
} from '@src/features/planning/category/schemas/category-settings-params.schema';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useView } from '@src/shared/hooks/use-view';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  H3,
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  ReadableContent,
  SegmentTabTrigger,
  Spacing,
  StyledSafeAreaView,
  Text,
  ViewTabs,
  VStack,
} from '@src/shared/ui';
import { router } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function TodoCategorySettingsScreen() {
  const fontScaledSize = useFontScaledSize();
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

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right', 'bottom']}>
      <ReadableContent flex={1} className="px-4">
        <VStack flex={1}>
          <Spacing size={16} />
          <H3>{t('categorySettings.header')}</H3>
          <Spacing size={24} />

          <HStack justify="between" align="center">
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

            <Button
              size="small"
              variant="weak"
              color="primary"
              display="inline"
              radius="full"
              onPress={handleAddPress}
            >
              <HStack align="center" gap={4}>
                <PlusIcon
                  width={fontScaledSize(16)}
                  height={fontScaledSize(16)}
                  colorClassName="text-main"
                />
                <Text size="b4" tone="brand" weight="semibold">
                  {t('categorySettings.add')}
                </Text>
              </HStack>
            </Button>
          </HStack>

          <Spacing size={20} />

          <QueryErrorBoundary>
            <Suspense fallback={<CategoryList.Loading />}>
              {match(view)
                .with(CATEGORY_SETTINGS_VIEW.edit, () => <CategoryList />)
                .with(CATEGORY_SETTINGS_VIEW.reorder, () => <CategoryList.Reorder />)
                .exhaustive()}
            </Suspense>
          </QueryErrorBoundary>
        </VStack>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
