import { CategoryList } from '@src/features/planning/category/components/category-list';
import { useCategorySettingsViewParam } from '@src/features/planning/category/hooks/use-category-settings-view-param';
import {
  CATEGORY_SETTINGS_VIEW,
  type CategorySettingsView,
  categorySettingsViewSchema,
} from '@src/features/planning/category/schemas/category-settings-params.schema';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  H3,
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  ReadableContent,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { router } from 'expo-router';
import { PressableFeedback, Tabs } from 'heroui-native';
import { Suspense } from 'react';

const VIEW_LABEL_KEYS = {
  edit: 'categorySettings.editTab',
  reorder: 'categorySettings.reorderTab',
} as const satisfies Record<CategorySettingsView, string>;

function TodoCategorySettingsScreen() {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('settings');
  const push = useSingleTap(router.push);
  const [view, setView] = useCategorySettingsViewParam();

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right', 'bottom']}>
      <ReadableContent flex={1} className="px-4">
        <VStack gap={8} flex={1}>
          <H3 className="my-4">{t('categorySettings.header')}</H3>

          <HStack justify="between" align="center" className="mb-3">
            <Tabs
              value={view}
              onValueChange={(value) => {
                const parsed = categorySettingsViewSchema.safeParse(value);
                if (parsed.success) {
                  setView(parsed.data);
                }
              }}
              variant="primary"
            >
              <Tabs.List>
                <Tabs.Indicator />
                <ViewTab view={CATEGORY_SETTINGS_VIEW.edit} />
                <ViewTab view={CATEGORY_SETTINGS_VIEW.reorder} />
              </Tabs.List>
            </Tabs>

            <PressableFeedback onPress={() => push('/todo-categories/new')}>
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

          <QueryErrorBoundary>
            <Suspense fallback={<CategoryList.Loading />}>
              <CategoryList mode={view} />
            </Suspense>
          </QueryErrorBoundary>
        </VStack>
      </ReadableContent>
    </StyledSafeAreaView>
  );
}

export default TodoCategorySettingsScreen;

function ViewTab({ view }: { view: CategorySettingsView }) {
  const { t } = useTranslation('settings');

  return (
    <Tabs.Trigger value={view}>
      {({ isSelected }) => (
        <Tabs.Label>
          <Text size="b4" weight={isSelected ? 'bold' : 'medium'} shade={isSelected ? 8 : 6}>
            {t(VIEW_LABEL_KEYS[view])}
          </Text>
        </Tabs.Label>
      )}
    </Tabs.Trigger>
  );
}
