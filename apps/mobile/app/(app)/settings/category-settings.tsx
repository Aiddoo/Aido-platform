import { CategoryCreateBottomSheet } from '@src/features/todo/components/category-create-bottom-sheet';
import { CategoryList } from '@src/features/todo/components/category-list';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  H3,
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  StyledSafeAreaView,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { PressableFeedback, Tabs } from 'heroui-native';
import { Suspense, useCallback } from 'react';
import { z } from 'zod';

const View = {
  edit: 'edit',
  reorder: 'reorder',
} as const;

const viewSchema = z.enum(View);
type View = z.infer<typeof viewSchema>;

const VIEW_LABEL_KEYS = {
  edit: 'categorySettings.editTab',
  reorder: 'categorySettings.reorderTab',
} as const satisfies Record<View, string>;

function useView() {
  const { view } = useLocalSearchParams();
  const setView = useCallback((next: View) => router.setParams({ view: next }), []);

  return [viewSchema.catch(View.edit).parse(view), setView] as const;
}

function TodoCategorySettingsScreen() {
  const fontScaledSize = useFontScaledSize();
  const { t } = useTranslation('settings');
  const createOverlay = useOverlay();
  const [view, setView] = useView();

  const handleCreateCategory = () => {
    createOverlay.open(({ isOpen, close, exit }) => (
      <CategoryCreateBottomSheet
        isOpen={isOpen}
        onClose={close}
        onExit={exit}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
      />
    ));
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['left', 'right', 'bottom']}>
      <VStack gap={8} flex={1} className="px-4">
        <H3 className="my-4">{t('categorySettings.header')}</H3>

        <HStack justify="between" align="center" className="mb-3">
          <Tabs
            value={view}
            onValueChange={(value) => {
              const parsed = viewSchema.safeParse(value);
              if (parsed.success) {
                setView(parsed.data);
              }
            }}
            variant="primary"
          >
            <Tabs.List>
              <Tabs.Indicator />
              <ViewTab view={View.edit} />
              <ViewTab view={View.reorder} />
            </Tabs.List>
          </Tabs>

          <PressableFeedback onPress={handleCreateCategory}>
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
    </StyledSafeAreaView>
  );
}

export default TodoCategorySettingsScreen;

function ViewTab({ view }: { view: View }) {
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
