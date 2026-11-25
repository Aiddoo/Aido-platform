import { zodResolver } from '@hookform/resolvers/zod';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { CategoryFormFields } from '@src/features/planning/category/components/category-form-fields';
import {
  type TodoCategory,
  TodoCategoryPolicy,
} from '@src/features/planning/category/domains/todo-category.model';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import { todoCategoryFormSchema } from '@src/features/planning/category/schemas/todo-category-form.schema';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  BottomSheet,
  Button,
  H4,
  HStack,
  Input,
  KeyboardBottomSheet,
  LockIcon,
  PlusIcon,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  SettingsListGroup,
  Text,
  TextButton,
  useOpenKeyboardSheet,
  VStack,
} from '@src/shared/ui';
import { usePrefetchQuery, useSuspenseQueries } from '@tanstack/react-query';
import { noop, pick } from 'es-toolkit';
import { RadioGroup } from 'heroui-native';
import { Fragment, Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { match, P } from 'ts-pattern';

import { CalendarSourceBadge } from '../components/calendar-source-badge';
import { ColorDot } from '../components/color-dot';
import {
  type TodoImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import {
  createNewCategoryTarget,
  type TodoImportTarget,
  TodoImportTargetPolicy,
} from '../domains/todo-import-target.model';
import { useNewCategoryDefaults } from './use-new-category-defaults';

/** 무엇을 넣는지. 캘린더 하나, 또는 고른 캘린더 모두다 */
type CategoryTargetSubject =
  | { kind: 'calendar'; collection: TodoImportCollection }
  | { kind: 'allCalendars'; collections: readonly TodoImportCollection[] };

interface CategoryTargetSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** 닫힘 애니메이션을 시작한다. 다 내려간 뒤 `onOpenChange(false)`가 온다 */
  close: () => void;
  subject: CategoryTargetSubject;
  /** 지금 넣을 곳. 새로 만들 카테고리면 맨 위에 골라진 채 보인다 */
  current: TodoImportTarget;
  /** 다른 캘린더가 가리키는 곳. 새 카테고리를 더 만들 수 있는지 셀 때 함께 센다 */
  otherTargets: readonly TodoImportTarget[];
  onChoose: (target: TodoImportTarget) => void;
  /** 새 카테고리를 더 만들 수 없는데 눌렀다. 이 시트를 먼저 내리고 부른 쪽이 안내를 띄운다 */
  onLocked: () => void;
}

type SheetView = 'pick' | 'create';

/** 카테고리가 이보다 많으면 맨 위에 이름 찾기 칸을 둔다 */
const SEARCH_THRESHOLD_COUNT = 8;
const NEW_CATEGORY_VALUE = 'new';
const ICON_SIZE = 18;

type OpenCategoryTargetSheetOptions = Omit<
  CategoryTargetSheetProps,
  'isOpen' | 'onOpenChange' | 'close' | 'onLocked'
>;

/**
 * 넣을 곳을 고르는 시트를 연다. 고르면 `onChoose`가 불리고 시트는 내려간 뒤에 지워진다.
 * 새 카테고리 이름·색은 같은 시트 안에서 받아, 내려가는 시트 위에 다른 시트를 띄워 얼지 않게 한다
 */
export function useOpenCategoryTargetSheet(): (options: OpenCategoryTargetSheetOptions) => void {
  const openKeyboardSheet = useOpenKeyboardSheet();

  // 넣을 곳 시트가 기다리지 않고 바로 올라오도록 시트가 읽을 요금제(새 카테고리 자리)를 미리 받아 둔다
  usePrefetchQuery(useGetEntitlementsQueryOptions());

  // 요금제 안내는 시트가 아니라 이 단계가 띄워, 넣을 곳 시트가 지워진 뒤에도 남는다
  const categoryGate = useEntitlementGate('TODO_CATEGORY', { surface: 'todo_import' });

  return (options) => {
    let isLockedPressed = false;
    openKeyboardSheet(({ isOpen, onOpenChange, close }) => {
      // 잠긴 새 카테고리를 누르면 시트를 먼저 내리고 다 내려간 뒤 안내를 띄워, 토스트가 시트 뒤에 가리거나
      // 내려가는 시트 위에 안내 시트가 겹치지 않는다
      const handleOpenChange = (nextIsOpen: boolean) => {
        onOpenChange(nextIsOpen);
        if (!nextIsOpen && isLockedPressed) {
          isLockedPressed = false;
          categoryGate.promptLimit();
        }
      };
      const handleLocked = () => {
        isLockedPressed = true;
        close();
      };

      return (
        <QueryErrorBoundary
          fallback={(props) => (
            <CategoryTargetSheet.Error {...props} isOpen={isOpen} onOpenChange={onOpenChange} />
          )}
        >
          {/* 카테고리는 여는 칸이, 요금제는 위에서 이미 받아 둔 캐시라 기다리지 않고 바로 올라온다 */}
          <Suspense fallback={null}>
            <CategoryTargetSheet
              {...options}
              isOpen={isOpen}
              onOpenChange={handleOpenChange}
              close={close}
              onLocked={handleLocked}
            />
          </Suspense>
        </QueryErrorBoundary>
      );
    });
  };
}

/**
 * 넣을 아이두 카테고리를 고르는 시트. 줄을 누르면 바로 골라지고 닫힌다. 새 카테고리는 같은 시트 안에서 이름·색을
 * 정해 시트를 겹쳐 띄우지 않는다. 카테고리·요금제는 여는 단계가 이미 받아 둔 캐시를 읽는다
 */
function CategoryTargetSheet({
  isOpen,
  onOpenChange,
  close,
  subject,
  current,
  otherTargets,
  onChoose,
  onLocked,
}: CategoryTargetSheetProps) {
  const { t } = useTranslation(['todoImport', 'common']);
  const [{ data: categoriesResult }, { data: snapshot }] = useSuspenseQueries({
    queries: [useGetTodoCategoriesQueryOptions(), useGetEntitlementsQueryOptions()],
  });
  const newCategoryDefaults = useNewCategoryDefaults();
  const [view, setView] = useState<SheetView>('pick');

  const categories = categoriesResult.categories.filter(
    (category) => !TodoCategoryPolicy.isOptimisticCategory(category),
  );
  const newCategory =
    current.kind === 'NEW_CATEGORY'
      ? current
      : createNewCategoryTarget(
          subject.kind === 'calendar' ? subject.collection : null,
          newCategoryDefaults,
        );
  const remainingCategorySlots = EntitlementPolicy.findRemainingCount(snapshot, 'TODO_CATEGORY');
  // 이 대상의 새 카테고리를 더해도 남은 자리 안이어야 한다. 이름이 같은 새 카테고리는 하나로 센다
  const canCreateCategory =
    remainingCategorySlots == null ||
    TodoImportTargetPolicy.calculateNewCategoryCount([...otherTargets, newCategory]) <=
      remainingCategorySlots;
  const freeCategoryLimit = EntitlementPolicy.hasFullAccess(snapshot)
    ? null
    : EntitlementPolicy.findLimit(snapshot, 'TODO_CATEGORY');
  const form = useForm({
    resolver: zodResolver(todoCategoryFormSchema),
    defaultValues: pick(newCategory, ['name', 'color']),
    mode: 'onChange',
  });

  const choose = (target: TodoImportTarget) => {
    onChoose(target);
    close();
  };
  // 이름을 바꿔 이미 있는 카테고리와 같아지면 새로 만들지 않고 그 카테고리에 넣는다
  const confirmNewCategory = () => {
    form
      .handleSubmit((values) => {
        const created = { kind: 'NEW_CATEGORY', ...values } as const;
        const sameNameCategory = TodoImportTargetPolicy.findSameNameCategory(created, categories);
        choose(
          sameNameCategory == null
            ? created
            : { kind: 'EXISTING_CATEGORY', categoryId: sameNameCategory.id },
        );
      })()
      .catch(noop);
  };

  return (
    <KeyboardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      footer={match(view)
        .with('pick', () => undefined)
        .with('create', () => (
          <Button size="large" onPress={confirmNewCategory}>
            {t('common:actions.confirm')}
          </Button>
        ))
        .exhaustive()}
    >
      {match(view)
        .with('pick', () => (
          <VStack gap={20}>
            <CategoryTargetSheet.Title subject={subject} />
            <CategoryTargetSheet.Choices
              categories={categories}
              current={current}
              onChoose={choose}
            />
            <CategoryTargetSheet.NewCategoryOption
              newCategoryName={newCategory.name}
              sameNameCategoryId={
                TodoImportTargetPolicy.findSameNameCategory(newCategory, categories)?.id ?? null
              }
              canCreateCategory={canCreateCategory}
              freeCategoryLimit={freeCategoryLimit}
              onChooseExisting={(categoryId) => choose({ kind: 'EXISTING_CATEGORY', categoryId })}
              onCreate={() => setView('create')}
              onLocked={onLocked}
            />
          </VStack>
        ))
        .with('create', () => (
          <VStack gap={20}>
            <HStack align="center" justify="between" gap={12}>
              <H4 accessibilityRole="header" className="shrink">
                {t('categories.sheet.newTitle')}
              </H4>
              <TextButton onPress={() => setView('pick')}>{t('common:actions.back')}</TextButton>
            </HStack>
            <CategoryFormFields control={form.control} onSubmit={confirmNewCategory} />
          </VStack>
        ))
        .exhaustive()}
    </KeyboardBottomSheet>
  );
}

/** 질문과 무엇을 넣는지. 캘린더 하나면 출처 배지를 함께 둔다 */
CategoryTargetSheet.Title = function Title({ subject }: { subject: CategoryTargetSubject }) {
  const { t } = useTranslation('todoImport');

  return (
    <VStack gap={6}>
      <H4 accessibilityRole="header">{t('categories.sheet.title')}</H4>
      {match(subject)
        .with({ kind: 'calendar' }, ({ collection }) => (
          <HStack align="center" gap={6}>
            <CalendarSourceBadge provider={collection.accountProvider} />
            <Text size="b3" shade={6} numberOfLines={2} className="shrink tabular-nums">
              {t('categories.sheet.calendar', {
                name: collection.title,
                count: collection.itemCount,
              })}
            </Text>
          </HStack>
        ))
        .with({ kind: 'allCalendars' }, ({ collections }) => (
          <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
            {t('categories.sheet.allCalendars', {
              calendarCount: collections.length,
              count: TodoImportCollectionPolicy.calculateItemCount(collections),
            })}
          </Text>
        ))
        .exhaustive()}
    </VStack>
  );
};

interface ChoicesProps {
  categories: readonly TodoCategory[];
  current: TodoImportTarget;
  onChoose: (target: TodoImportTarget) => void;
}

/**
 * 내 아이두 카테고리 라디오 목록. 고른 줄은 지금 넣을 곳 그대로이고, 새로 만들 카테고리면 맨 위에 둔다.
 * 남은 자리는 고른 뒤 넣을 곳 카드가 서버 값으로 알린다. 줄마다 묻지 않는다
 */
CategoryTargetSheet.Choices = function Choices({ categories, current, onChoose }: ChoicesProps) {
  const { t } = useTranslation('todoImport');
  const [query, setQuery] = useState('');

  const visibleCategories = categories.filter((category) =>
    TodoCategoryPolicy.filterByName(category, query),
  );
  const currentValue = match(current)
    .with({ kind: 'NEW_CATEGORY' }, () => NEW_CATEGORY_VALUE)
    .with({ kind: 'EXISTING_CATEGORY' }, ({ categoryId }) => String(categoryId))
    .exhaustive();

  // 고른 줄을 다시 눌러도 고른 것으로 보고 시트를 닫는다
  const handleValueChange = (value: string) => {
    if (value === currentValue) {
      onChoose(current);
      return;
    }
    const category = categories.find(({ id }) => String(id) === value);
    if (category != null) {
      onChoose({ kind: 'EXISTING_CATEGORY', categoryId: category.id });
    }
  };

  return (
    <VStack gap={8}>
      {SEARCH_THRESHOLD_COUNT < categories.length && (
        <Input
          value={query}
          onChange={setQuery}
          placeholder={t('categories.sheet.searchPlaceholder')}
          size="medium"
          renderErrorMessage={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      )}
      <Text size="b3" weight="semibold" shade={8} accessibilityRole="header">
        {t('categories.sheet.existingTitle')}
      </Text>
      <SettingsListGroup>
        <RadioGroup value={currentValue} onValueChange={handleValueChange} className="gap-0">
          {current.kind === 'NEW_CATEGORY' && (
            <SettingsListGroup.Radio
              value={NEW_CATEGORY_VALUE}
              label={current.name}
              description={t('categories.sheet.pendingNew')}
              icon={<ColorDot color={current.color} />}
            />
          )}
          {visibleCategories.map((category, index) => (
            <Fragment key={category.id}>
              {(index > 0 || current.kind === 'NEW_CATEGORY') && <SettingsListGroup.Separator />}
              <SettingsListGroup.Radio
                value={String(category.id)}
                label={category.name}
                icon={<ColorDot color={category.color} />}
              />
            </Fragment>
          ))}
        </RadioGroup>
        {visibleCategories.length === 0 && (
          <SettingsListGroup.Custom>
            <Text size="b3" shade={6}>
              {t('categories.sheet.noMatch')}
            </Text>
          </SettingsListGroup.Custom>
        )}
      </SettingsListGroup>
    </VStack>
  );
};

interface NewCategoryOptionProps {
  newCategoryName: string;
  /** 이름이 같은 카테고리. 있으면 새로 만들지 않고 그 카테고리를 고른다 */
  sameNameCategoryId: number | null;
  canCreateCategory: boolean;
  /** 무료 요금제의 카테고리 한도. 프리미엄이면 null이다 */
  freeCategoryLimit: number | null;
  onChooseExisting: (categoryId: number) => void;
  onCreate: () => void;
  onLocked: () => void;
}

/**
 * "새 카테고리 만들기" 줄. 누르면 늘 무언가 보인다: 이름·색 입력, 같은 이름의 카테고리 고르기, 또는 왜 더 만들 수
 * 없는지 알리는 안내
 */
CategoryTargetSheet.NewCategoryOption = function NewCategoryOption({
  newCategoryName,
  sameNameCategoryId,
  canCreateCategory,
  freeCategoryLimit,
  onChooseExisting,
  onCreate,
  onLocked,
}: NewCategoryOptionProps) {
  const { t } = useTranslation('todoImport');
  const fontScaledSize = useFontScaledSize();
  const iconSize = fontScaledSize(ICON_SIZE);

  const option = match({ sameNameCategoryId, canCreateCategory })
    .returnType<{ description: string; isLocked: boolean; onPress: () => void }>()
    .with({ sameNameCategoryId: P.nonNullable }, ({ sameNameCategoryId: categoryId }) => ({
      description: t('categories.sheet.sameName', { name: newCategoryName }),
      isLocked: false,
      onPress: () => onChooseExisting(categoryId),
    }))
    .with({ canCreateCategory: true }, () => ({
      description: t('categories.sheet.newDescription', { name: newCategoryName }),
      isLocked: false,
      onPress: onCreate,
    }))
    .otherwise(() => ({
      description:
        freeCategoryLimit == null
          ? t('categories.sheet.locked')
          : t('categories.sheet.lockedFree', { limit: freeCategoryLimit }),
      isLocked: true,
      onPress: onLocked,
    }));

  return (
    <SettingsListGroup>
      <SettingsListGroup.Item
        label={t('categories.sheet.newTitle')}
        description={option.description}
        icon={
          option.isLocked ? (
            <LockIcon width={iconSize} height={iconSize} colorClassName="text-gray-6" />
          ) : (
            <PlusIcon width={iconSize} height={iconSize} colorClassName="text-main" />
          )
        }
        onPress={option.onPress}
      />
    </SettingsListGroup>
  );
};

interface ErrorProps extends QueryErrorFallbackProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** 카테고리를 읽지 못해도 누른 자리에 시트가 떠 다시 시도할 수 있다 */
CategoryTargetSheet.Error = function ErrorFallback({ isOpen, onOpenChange, reset }: ErrorProps) {
  const { t } = useTranslation('todoImport');

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <QueryErrorFallback.Inline message={t('categories.loadFailed')} reset={reset} />
    </BottomSheet>
  );
};
