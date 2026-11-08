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
import { PressableFeedback, Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function TodoCategorySettingsScreen() {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('settings');
  const push = useSingleTap(router.push);
  const [view, setView] = useView('view', categorySettingsViewSchema);

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

            <PressableFeedback
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => push('/todo-categories/new')}
            >
              <HStack align="center" gap={4}>
                <PlusIcon
                  width={fontScaledSize(18)}
                  height={fontScaledSize(18)}
                  colorClassName="text-main"
                />
                <Text size="b3" tone="brand" weight="medium">
                  {t('categorySettings.add')}
                </Text>
              </HStack>
            </PressableFeedback>
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
