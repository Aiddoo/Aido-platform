import type { DateKey } from '@src/shared/date/date-key';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  Box,
  CalendarIcon,
  HStack,
  ListRow,
  RepeatIcon,
  Text,
  TrashIcon,
  VStack,
  IconButton,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

import type { TodoEditScope } from '../domains/todo-repeat.model';

type TodoScopeAction = 'edit' | 'delete';

interface ScopeRowProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  icon: ReactNode;
  label: string;
  description: string;
  isDanger?: boolean;
}

function ScopeRow({
  icon,
  label,
  description,
  isDanger = false,
  ...pressableProps
}: ScopeRowProps) {
  return (
    <PressableFeedback accessibilityRole="button" accessibilityLabel={label} {...pressableProps}>
      <ListRow
        horizontalPadding="medium"
        verticalPadding="medium"
        left={
          <Box
            className={cn(
              'size-7 items-center justify-center rounded-full',
              isDanger && 'bg-error/10 dark:bg-error/20',
              !isDanger && 'bg-gray-2',
            )}
          >
            {icon}
          </Box>
        }
        contents={
          <ListRow.Texts
            type="2RowTypeA"
            top={label}
            topProps={{ size: 'b2', ...(isDanger && { tone: 'danger' as const }) }}
            bottom={description}
            bottomProps={{ size: 'e1', shade: 6, lineBreakStrategyIOS: 'hangul-word' }}
          />
        }
      />
    </PressableFeedback>
  );
}

interface TodoScopeSelectProps {
  action: TodoScopeAction;
  /** 범위를 정하는 할 일의 날짜(YYYY-MM-DD). 설명에 "n월 n일"로 보인다 */
  date: DateKey;
  /** 보일 범위. 규칙 변경은 이후만, 규칙 없는 묶음의 삭제는 이후가 없다 */
  scopes: readonly TodoEditScope[];
  onChange: (scope: TodoEditScope) => void;
  onBack?: () => void;
}

export function TodoScopeSelect({ action, date, scopes, onChange, onBack }: TodoScopeSelectProps) {
  const { t } = useTranslation(['todo', 'common']);
  const dateFormatContext = useDateFormatContext();
  const todayKey = useTodayKey();
  const dateLabel = formatYearAwareDateKeyLabel(date, todayKey, dateFormatContext);
  const calendarIcon = <CalendarIcon width={16} height={16} colorClassName="text-gray-7" />;
  const repeatIcon = <RepeatIcon width={16} height={16} colorClassName="text-gray-7" />;

  return (
    <VStack gap={8} testID="todo-scope-select">
      <HStack align="center" className="py-2 px-4">
        <Box className="flex-1 items-start">
          {onBack != null && (
            <IconButton
              accessibilityLabel={t('common:actions.goBack')}
              icon={<ArrowLeftIcon width={20} height={20} colorClassName="text-gray-8" />}
              className="min-h-0 min-w-0"
              hitSlop={12}
              onPress={onBack}
            />
          )}
        </Box>
        <Text size="b2" weight="semibold" tone="neutral" shade={8} align="center">
          {action === 'edit' ? t('scope.editTitle') : t('scope.deleteTitle')}
        </Text>
        <Box className="flex-1" />
      </HStack>
      {scopes.includes('THIS_ONLY') && (
        <ScopeRow
          icon={calendarIcon}
          label={t('scope.thisOnly')}
          description={t(
            action === 'edit' ? 'scope.editThisOnlyHint' : 'scope.deleteThisOnlyHint',
            { date: dateLabel },
          )}
          onPress={() => onChange('THIS_ONLY')}
        />
      )}
      {scopes.includes('THIS_AND_FOLLOWING') && (
        <ScopeRow
          icon={repeatIcon}
          label={t('scope.thisAndFollowing')}
          description={t(
            action === 'edit' ? 'scope.editFollowingHint' : 'scope.deleteFollowingHint',
            { date: dateLabel },
          )}
          onPress={() => onChange('THIS_AND_FOLLOWING')}
        />
      )}
      {scopes.includes('ALL') && (
        <ScopeRow
          isDanger
          icon={<TrashIcon width={16} height={16} colorClassName="text-error" />}
          label={t('scope.allRepeats')}
          description={t('scope.deleteAllHint')}
          onPress={() => onChange('ALL')}
        />
      )}
    </VStack>
  );
}
