import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { cn } from '@src/shared/utils/cn';
import { Alert, CloseButton, PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { match } from 'ts-pattern';

import { Box } from '../box';
import { CloseIcon } from '../icon';
import { Text, type TextTone } from '../text';

const CLOSE_ICON_SIZE = 20;
/** 닫기 버튼은 작게 그리고 손가락 닿는 자리는 44로 맞춘다 */
const CLOSE_HIT_SLOP = 12;

type InlineAlertStatus = NonNullable<ComponentProps<typeof Alert>['status']>;

export interface InlineAlertProps extends Omit<ComponentProps<typeof Alert>, 'children'> {
  /** 강조 단어가 있으면 글자 조각을 넘긴다. 한 문장 안내는 비우고 description만 쓴다 */
  title?: ReactNode;
  description?: string;
  /** 제목 앞 그림. 넘기지 않으면 상태에 맞는 기본 표시, null이면 표시 없음 */
  image?: ReactNode;
  /** 설명 아래 행동. 버튼 같은 눌리는 요소 */
  action?: ReactNode;
  /** 넘기면 닫기 버튼을 뺀 자리 전체가 눌린다 */
  onPress?: () => void;
  pressLabel?: string;
  /** 넘기면 닫기 버튼을 그린다 */
  onClose?: () => void;
  /** 닫기 버튼 스크린 리더 이름. 기본은 "닫기" */
  closeLabel?: string;
}

/** 특정 버튼을 가리키는 말풍선은 `CoachmarkPopover`가 맡고 그 밖의 인라인 안내는 이 부품으로 한다 */
export function InlineAlert({
  status = 'default',
  title,
  description,
  image = <Alert.Indicator />,
  action,
  onPress,
  pressLabel,
  onClose,
  closeLabel,
  className,
  ...props
}: InlineAlertProps) {
  const { t } = useTranslation('common');
  const fontScaledSize = useFontScaledSize();

  const contents = (
    <Alert.Content>
      {/* HeroUI Title·Description은 Text라 안쪽 글자는 중첩 Text가 된다. iOS는 바깥 Text의 줄바꿈 규칙만 따라 규칙을 바깥에 준다 */}
      {title != null && (
        <Alert.Title lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          <Text size="b3" weight="medium" tone={getTextTone(status)}>
            {title}
          </Text>
        </Alert.Title>
      )}
      {description != null && (
        <Alert.Description lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
          <Text size={title == null ? 'b4' : 'e1'} shade={6}>
            {description}
          </Text>
        </Alert.Description>
      )}
      {action != null && <Box className="mt-2 self-start">{action}</Box>}
    </Alert.Content>
  );

  return (
    <Alert
      status={status}
      className={cn('items-center rounded-xl bg-gray-1 px-4 py-3.5 shadow-none', className)}
      {...props}
    >
      {onPress == null ? (
        <>
          {image}
          {contents}
        </>
      ) : (
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={pressLabel}
          onPress={onPress}
          className="flex-1 flex-row items-center gap-3"
        >
          {image}
          {contents}
        </PressableFeedback>
      )}
      {onClose != null && (
        <CloseButton
          variant="ghost"
          className="size-5"
          hitSlop={CLOSE_HIT_SLOP}
          accessibilityLabel={closeLabel ?? t('actions.close')}
          onPress={onClose}
        >
          <CloseIcon
            width={fontScaledSize(CLOSE_ICON_SIZE)}
            height={fontScaledSize(CLOSE_ICON_SIZE)}
            colorClassName="text-gray-6"
          />
        </CloseButton>
      )}
    </Alert>
  );
}

function getTextTone(status: InlineAlertStatus): TextTone {
  return match(status)
    .with('default', () => 'neutral' as const)
    .with('accent', () => 'brand' as const)
    .with('success', () => 'success' as const)
    .with('warning', () => 'warning' as const)
    .with('danger', () => 'danger' as const)
    .exhaustive();
}
