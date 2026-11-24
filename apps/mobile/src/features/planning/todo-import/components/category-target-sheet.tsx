import { zodResolver } from '@hookform/resolvers/zod';
import { CategoryFormFields } from '@src/features/planning/category/components/category-form-fields';
import { CategoryPickForm } from '@src/features/planning/category/components/category-pick-form';
import { TodoCategoryPolicy } from '@src/features/planning/category/domains/todo-category.model';
import {
  todoCategoryFormSchema,
  type TodoCategoryFormValues,
} from '@src/features/planning/category/schemas/todo-category-form.schema';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  DashedDivider,
  HStack,
  KeyboardBottomSheet,
  ListRow,
  LockIcon,
  PlusIcon,
  QueryErrorBoundary,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { PressableFeedback } from 'heroui-native';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';

import type { ImportTarget } from '../domains/todo-import-target.model';

/** 시트에서 고른 것. 잠긴 새 카테고리·이름 바꾸기는 시트를 닫은 뒤 부른 쪽이 안내·입력 시트를 연다 */
export type CategoryTargetChoice =
  | ImportTarget
  | { kind: 'NEW_CATEGORY_LOCKED' }
  | { kind: 'NEW_CATEGORY_EDIT' };

interface CategoryTargetSheetProps {
  /** 이 캘린더로 만들 새 카테고리(캘린더 이름·가까운 색) */
  newCategory: { name: string; color: string };
  /** 남은 카테고리 자리가 없으면 새 카테고리를 잠근다 */
  canCreateCategory: boolean;
  /** 기존 카테고리 목록에서 처음 고른 칸 */
  defaultCategoryId: number;
  onChoose: (choice: CategoryTargetChoice) => void;
}

const ICON_SIZE = 18;

/** 캘린더 하나(또는 전부)를 넣을 곳. 맨 위는 새 카테고리, 아래는 할 일 카테고리 바꾸기와 같은 고르기 폼이다 */
export function CategoryTargetSheet({
  newCategory,
  canCreateCategory,
  defaultCategoryId,
  onChoose,
}: CategoryTargetSheetProps) {
  const { t } = useTranslation('todoImport');
  const fontScaledSize = useFontScaledSize();
  const newCategoryLabel = t('categories.newCategory', { name: newCategory.name });

  return (
    <VStack gap={20}>
      <HStack align="center" gap={8}>
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={
            canCreateCategory
              ? newCategoryLabel
              : t('categories.newCategoryLocked', { name: newCategory.name })
          }
          onPress={() =>
            onChoose(
              canCreateCategory
                ? { kind: 'NEW_CATEGORY', ...newCategory }
                : { kind: 'NEW_CATEGORY_LOCKED' },
            )
          }
          className="flex-1 rounded-xl"
        >
          <PressableFeedback.Highlight className="rounded-xl" />
          <ListRow
            horizontalPadding="medium"
            className="rounded-xl bg-gray-1 dark:bg-gray-2"
            left={
              <Box className="size-2 rounded-full" style={{ backgroundColor: newCategory.color }} />
            }
            contents={
              <Text size="b3" numberOfLines={1}>
                {newCategoryLabel}
              </Text>
            }
            right={
              canCreateCategory ? (
                <PlusIcon
                  width={fontScaledSize(ICON_SIZE)}
                  height={fontScaledSize(ICON_SIZE)}
                  colorClassName="text-main"
                />
              ) : (
                <LockIcon
                  width={fontScaledSize(ICON_SIZE)}
                  height={fontScaledSize(ICON_SIZE)}
                  colorClassName="text-gray-6"
                />
              )
            }
          />
        </PressableFeedback>
        {canCreateCategory && (
          <TextButton size="small" onPress={() => onChoose({ kind: 'NEW_CATEGORY_EDIT' })}>
            {t('categories.editNewCategory')}
          </TextButton>
        )}
      </HStack>

      <DashedDivider />

      <QueryErrorBoundary fallback={CategoryTargetSheet.Error}>
        <Suspense fallback={<CategoryPickForm.Loading />}>
          <CategoryPickForm
            defaultValue={defaultCategoryId}
            filters={(category) => !TodoCategoryPolicy.isOptimisticCategory(category)}
            submitLabel={t('categories.useExisting')}
            onSubmit={(categoryId) => onChoose({ kind: 'EXISTING_CATEGORY', categoryId })}
          />
        </Suspense>
      </QueryErrorBoundary>
    </VStack>
  );
}

/** 기존 카테고리를 읽지 못해도 새 카테고리는 고를 수 있어 시트를 닫지 않는다 */
CategoryTargetSheet.Error = function ErrorFallback() {
  const { t } = useTranslation('todoImport');

  return (
    <Text size="b4" shade={6} align="center">
      {t('categories.loadFailed')}
    </Text>
  );
};

interface NewCategoryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  defaultValues: TodoCategoryFormValues;
  onConfirm: (values: TodoCategoryFormValues) => void;
}

/** 새 카테고리의 이름·색. 카테고리 만들기와 같은 입력이고, 만드는 것은 가져오기를 확정할 때 서버가 한다 */
CategoryTargetSheet.NewCategory = function NewCategory({
  isOpen,
  onOpenChange,
  defaultValues,
  onConfirm,
}: NewCategoryProps) {
  const { t } = useTranslation('common');
  const form = useForm({
    resolver: zodResolver(todoCategoryFormSchema),
    defaultValues,
    mode: 'onChange',
  });
  // 이름 규칙에 맞지 않으면 칸 오류로 보이고 시트를 닫지 않는다
  const confirm = () => {
    form.handleSubmit(onConfirm)().catch(noop);
  };

  return (
    <KeyboardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      footer={
        <Button size="large" onPress={confirm}>
          {t('actions.confirm')}
        </Button>
      }
    >
      <CategoryFormFields control={form.control} onSubmit={confirm} />
    </KeyboardBottomSheet>
  );
};
