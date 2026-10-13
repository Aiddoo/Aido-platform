import { CategoryCreateBottomSheet } from '@src/features/todo/components/category-create-bottom-sheet';
import { CategoryList } from '@src/features/todo/components/category-list';
import { useTranslation } from '@src/shared/i18n';
import {
  Flex,
  H3,
  HStack,
  PlusIcon,
  QueryErrorBoundary,
  StyledSafeAreaView,
  Text,
  useOverlay,
} from '@src/shared/ui';
import { fontScaledSize } from '@src/shared/utils/scale';
import { PressableFeedback, Tabs } from 'heroui-native';
import { Suspense, useState } from 'react';
import { z } from 'zod';

const TAB = {
  edit: 'edit',
  reorder: 'reorder',
} as const;

const categoryTabSchema = z.enum(TAB);
type TabValue = z.infer<typeof categoryTabSchema>;

function TodoCategorySettingsScreen() {
  const { t } = useTranslation('settings');
  const createOverlay = useOverlay();
  const [tab, setTab] = useState<TabValue>(TAB.edit);

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
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <Flex direction="column" gap={8} flex={1} className="px-4">
        <Flex direction="column" gap={4} className="my-4">
          <H3>{t('categorySettings.header')}</H3>
        </Flex>

        <HStack justify="between" align="center" className="mb-3">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              const parsed = categoryTabSchema.safeParse(value);
              if (parsed.success) {
                setTab(parsed.data);
              }
            }}
            variant="primary"
          >
            <Tabs.List>
              <Tabs.Indicator />
              <Tabs.Trigger value={TAB.edit}>
                {({ isSelected }) => (
                  <Tabs.Label>
                    <Text
                      size="b4"
                      weight={isSelected ? 'bold' : 'medium'}
                      shade={isSelected ? 8 : 6}
                    >
                      {t('categorySettings.editTab')}
                    </Text>
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value={TAB.reorder}>
                {({ isSelected }) => (
                  <Tabs.Label>
                    <Text
                      size="b4"
                      weight={isSelected ? 'bold' : 'medium'}
                      shade={isSelected ? 8 : 6}
                    >
                      {t('categorySettings.reorderTab')}
                    </Text>
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
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
            <CategoryList mode={tab} />
          </Suspense>
        </QueryErrorBoundary>
      </Flex>
    </StyledSafeAreaView>
  );
}

export default TodoCategorySettingsScreen;
