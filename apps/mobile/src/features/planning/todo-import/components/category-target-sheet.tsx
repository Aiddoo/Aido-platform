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
  H4,
  HStack,
  KeyboardBottomSheet,
  LockIcon,
  PlusIcon,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  SettingsListGroup,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { match, P } from 'ts-pattern';

import type { ImportTarget } from '../domains/todo-import-target.model';

/** 잠긴 새 카테고리·이름 바꾸기는 시트를 닫은 뒤 부른 쪽이 안내·입력 시트를 연다 */
export type CategoryTargetChoice =
  | ImportTarget
  | { kind: 'NEW_CATEGORY_LOCKED' }
  | { kind: 'NEW_CATEGORY_EDIT' };

interface CategoryTargetSheetProps {
  /** 무엇을 넣는지. 캘린더 하나면 "대한민국의 휴일 캘린더", 모으면 "고른 캘린더 3개 모두" */
  subject: string;
  /** 캘린더 색. 여러 캘린더를 모으면 null이다 */
  subjectColor: string | null;
  /** 새로 만들 때의 이름·색. 이름은 캘린더 이름 규칙(계정 이메일 대신 종류 이름, 50자)을 따른다 */
  newCategory: { name: string; color: string };
  /** 이름이 같은 카테고리. 있으면 새로 만들지 않고 그 카테고리에 넣는다 */
  sameNameCategoryId: number | null;
  canCreateCategory: boolean;
  /** 무료 요금제의 카테고리 한도. 프리미엄이면 null이다 */
  freeCategoryLimit: number | null;
  defaultCategoryId: number;
  onChoose: (choice: CategoryTargetChoice) => void;
}

const ICON_SIZE = 18;

/** 질문과 대상을 위에 두고, 새로 만들 카테고리를 이름·색까지 보인 뒤 이미 있는 카테고리를 고르게 한다 */
export function CategoryTargetSheet({
  subject,
  subjectColor,
  newCategory,
  sameNameCategoryId,
  canCreateCategory,
  freeCategoryLimit,
  defaultCategoryId,
  onChoose,
}: CategoryTargetSheetProps) {
  const { t } = useTranslation('todoImport');

  return (
    <VStack gap={20}>
      <VStack gap={6}>
        <H4 accessibilityRole="header">{t('categories.sheet.title')}</H4>
        <HStack align="center" gap={6}>
          {subjectColor != null && <ColorDot color={subjectColor} />}
          <Text size="b3" shade={6} numberOfLines={2} className="shrink">
            {subject}
          </Text>
        </HStack>
      </VStack>

      <VStack gap={8}>
        <CategoryTargetSheet.NewCategoryOption
          newCategory={newCategory}
          sameNameCategoryId={sameNameCategoryId}
          canCreateCategory={canCreateCategory}
          freeCategoryLimit={freeCategoryLimit}
          onChoose={onChoose}
        />
        {canCreateCategory && (
          <TextButton
            size="small"
            className="self-start"
            onPress={() => onChoose({ kind: 'NEW_CATEGORY_EDIT' })}
          >
            {t('categories.editNewCategory')}
          </TextButton>
        )}
      </VStack>

      <DashedDivider />

      <QueryErrorBoundary fallback={CategoryTargetSheet.Error}>
        <Suspense fallback={<CategoryPickForm.Loading />}>
          <CategoryPickForm
            title={t('categories.sheet.existingTitle')}
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

type NewCategoryOptionProps = Pick<
  CategoryTargetSheetProps,
  'newCategory' | 'sameNameCategoryId' | 'canCreateCategory' | 'freeCategoryLimit' | 'onChoose'
>;

/**
 * "새 카테고리 만들기" 행. 둘째 줄이 만들어질 이름·색을 그대로 보인다. 같은 이름이 있으면 그 카테고리에 넣는다고,
 * 자리가 없으면 왜 못 만드는지 알리고 누르면 한도 안내를 연다
 */
CategoryTargetSheet.NewCategoryOption = function NewCategoryOption({
  newCategory,
  sameNameCategoryId,
  canCreateCategory,
  freeCategoryLimit,
  onChoose,
}: NewCategoryOptionProps) {
  const { t } = useTranslation('todoImport');
  const fontScaledSize = useFontScaledSize();
  const iconSize = fontScaledSize(ICON_SIZE);

  const option = match({ sameNameCategoryId, canCreateCategory })
    .returnType<{
      description: string;
      choice: CategoryTargetChoice;
      accessory: 'create' | 'existing' | 'locked';
    }>()
    .with({ sameNameCategoryId: P.nonNullable }, ({ sameNameCategoryId: categoryId }) => ({
      description: t('categories.sheet.sameName', { name: newCategory.name }),
      choice: { kind: 'EXISTING_CATEGORY', categoryId },
      accessory: 'existing',
    }))
    .with({ canCreateCategory: true }, () => ({
      description: newCategory.name,
      choice: { kind: 'NEW_CATEGORY', ...newCategory },
      accessory: 'create',
    }))
    .otherwise(() => ({
      description:
        freeCategoryLimit == null
          ? t('categories.sheet.locked')
          : t('categories.sheet.lockedFree', { limit: freeCategoryLimit }),
      choice: { kind: 'NEW_CATEGORY_LOCKED' },
      accessory: 'locked',
    }));

  return (
    <SettingsListGroup>
      <SettingsListGroup.Item
        label={t('categories.sheet.newTitle')}
        description={option.description}
        icon={<ColorDot color={newCategory.color} />}
        // 이미 있는 카테고리로 가면 다른 행처럼 화살표를 둔다
        right={match(option.accessory)
          .with('create', () => (
            <PlusIcon width={iconSize} height={iconSize} colorClassName="text-main" />
          ))
          .with('locked', () => (
            <LockIcon width={iconSize} height={iconSize} colorClassName="text-gray-6" />
          ))
          .with('existing', () => undefined)
          .exhaustive()}
        onPress={() => onChoose(option.choice)}
      />
    </SettingsListGroup>
  );
};

/** 기존 카테고리를 읽지 못해도 새 카테고리는 고를 수 있어 시트를 닫지 않는다 */
CategoryTargetSheet.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation('todoImport');

  return <QueryErrorFallback.Inline message={t('categories.loadFailed')} reset={reset} />;
};

interface NewCategoryProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  defaultValues: TodoCategoryFormValues;
  onConfirm: (values: TodoCategoryFormValues) => void;
}

/** 만드는 것은 가져오기를 확정할 때 서버가 한다 */
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

function ColorDot({ color }: { color: string }) {
  return <Box className="size-2.5 rounded-full" style={{ backgroundColor: color }} />;
}
