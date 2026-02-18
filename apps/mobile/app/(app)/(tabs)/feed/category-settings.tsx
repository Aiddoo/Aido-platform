import { CategoryCreateBottomSheet } from '@src/features/todo/presentations/components/CategoryCreateBottomSheet';
import { CategoryList } from '@src/features/todo/presentations/components/CategoryList';
import type { ButtonProps } from '@src/shared/ui/Button';
import { Flex } from '@src/shared/ui/Flex/Flex';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { PlusIcon } from '@src/shared/ui/Icon';
import { useOverlay } from '@src/shared/ui/Overlay';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Text } from '@src/shared/ui/Text/Text';
import { PressableFeedback } from 'heroui-native';
import { Suspense } from 'react';

const TodoCategorySettingsScreen = () => {
  const createOverlay = useOverlay();

  const handleCreateCategory = () => {
    createOverlay.open(({ isOpen, close, exit }) => (
      <CategoryCreateBottomSheet
        isOpen={isOpen}
        onRequestClose={close}
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
        <HStack justify="end" className="mb-3">
          <CreateCategoryButton onPress={handleCreateCategory}>
            <PlusIcon width={14} height={14} colorClassName="text-main" />
            <Text size="b3" tone="brand">
              카테고리 추가
            </Text>
          </CreateCategoryButton>
        </HStack>

        <QueryErrorBoundary>
          <Suspense fallback={<CategoryList.Loading />}>
            <CategoryList />
          </Suspense>
        </QueryErrorBoundary>
      </Flex>
    </StyledSafeAreaView>
  );
};

export default TodoCategorySettingsScreen;

const CreateCategoryButton = ({ onPress, children, ...props }: ButtonProps) => {
  return (
    <PressableFeedback onPress={onPress} {...props}>
      <HStack align="center" gap={4}>
        {children}
      </HStack>
    </PressableFeedback>
  );
};
