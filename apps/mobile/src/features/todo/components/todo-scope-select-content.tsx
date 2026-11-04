import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Box,
  HStack,
  ListRow,
  Text,
  TrashIcon,
  VStack,
} from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import type { TodoEditScope } from '../domains/todo-repeat.model';

type TodoScopeAction = 'edit' | 'delete';

interface ScopeRowProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  label: string;
  isDanger?: boolean;
}

function ScopeRow({ label, isDanger = false, ...pressableProps }: ScopeRowProps) {
  return (
    <PressableFeedback accessibilityRole="button" accessibilityLabel={label} {...pressableProps}>
      <ListRow
        horizontalPadding="medium"
        verticalPadding="medium"
        contents={
          <ListRow.Texts
            type="1RowTypeA"
            top={label}
            topProps={{ size: 'b2', ...(isDanger && { tone: 'danger' as const }) }}
          />
        }
        right={
          isDanger ? (
            <TrashIcon width={16} height={16} colorClassName="text-error" />
          ) : (
            <ArrowRightIcon width={16} height={16} colorClassName="text-gray-7" />
          )
        }
      />
    </PressableFeedback>
  );
}

interface TodoScopeSelectContentProps {
  action: TodoScopeAction;
  onChange: (scope: TodoEditScope) => void;
  /** 같은 시트 안의 한 단계로 보일 때, 누르면 앞 화면으로 돌아간다 */
  onBack?: () => void;
}

export function TodoScopeSelectContent({ action, onChange, onBack }: TodoScopeSelectContentProps) {
  const { t } = useTranslation(['todo', 'common']);

  return (
    <VStack gap={8} testID="todo-scope-select">
      <HStack align="center" px={16} className="py-2">
        <Box className="flex-1 items-start">
          {onBack != null && (
            <PressableFeedback
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common:actions.goBack')}
            >
              <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-8" />
            </PressableFeedback>
          )}
        </Box>
        <Text size="b2" weight="semibold" tone="neutral" shade={8} align="center">
          {action === 'edit' ? t('scope.editTitle') : t('scope.deleteTitle')}
        </Text>
        <Box className="flex-1" />
      </HStack>
      {action === 'edit' ? (
        <>
          <ScopeRow label={t('scope.editTHIS_ONLY')} onPress={() => onChange('THIS_ONLY')} />
          <ScopeRow
            label={t('scope.editTHIS_AND_FOLLOWING')}
            onPress={() => onChange('THIS_AND_FOLLOWING')}
          />
        </>
      ) : (
        <>
          <ScopeRow label={t('scope.deleteTHIS_ONLY')} onPress={() => onChange('THIS_ONLY')} />
          <ScopeRow
            label={t('scope.deleteTHIS_AND_FOLLOWING')}
            onPress={() => onChange('THIS_AND_FOLLOWING')}
          />
          <ScopeRow isDanger label={t('scope.deleteALL')} onPress={() => onChange('ALL')} />
          <Text
            size="b4"
            tone="neutral"
            shade={6}
            className="px-4"
            lineBreakStrategyIOS="hangul-word"
          >
            {t('scope.deleteAllHint')}
          </Text>
        </>
      )}
    </VStack>
  );
}
