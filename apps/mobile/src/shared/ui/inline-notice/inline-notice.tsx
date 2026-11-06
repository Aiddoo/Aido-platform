import { useTranslation } from '@src/shared/i18n';
import { Alert, CloseButton } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';
import { match } from 'ts-pattern';

import { Text, type TextTone } from '../text';

type InlineNoticeStatus = NonNullable<ComponentProps<typeof Alert>['status']>;

export interface InlineNoticeProps extends Omit<ComponentProps<typeof Alert>, 'children'> {
  title: string;
  description?: string;
  /** 제목 앞 그림. 없으면 상태에 맞는 기본 표시를 그린다 */
  image?: ReactNode;
  /** 설명 아래 행동. 버튼 같은 눌리는 요소 */
  action?: ReactNode;
  /** 넘기면 닫기 버튼을 그린다 */
  onClose?: () => void;
}

/**
 * 흐름 안에서 할 일이나 상태를 알리는 배너. 첫 안내처럼 특정 버튼을 가리키는 말풍선은
 * `CoachmarkPopover`가 맡고, 그 밖의 인라인 안내는 모두 이 부품으로 한다.
 */
export function InlineNotice({
  status = 'default',
  title,
  description,
  image,
  action,
  onClose,
  ...props
}: InlineNoticeProps) {
  const { t } = useTranslation('common');

  return (
    <Alert status={status} {...props}>
      {image ?? <Alert.Indicator />}
      <Alert.Content>
        <Alert.Title>
          <Text size="b3" weight="semibold" tone={toneOf(status)}>
            {title}
          </Text>
        </Alert.Title>
        {description != null && (
          <Alert.Description>
            <Text size="b4" shade={6}>
              {description}
            </Text>
          </Alert.Description>
        )}
        {action}
      </Alert.Content>
      {onClose != null && (
        <CloseButton variant="ghost" accessibilityLabel={t('actions.close')} onPress={onClose} />
      )}
    </Alert>
  );
}

function toneOf(status: InlineNoticeStatus): TextTone {
  return match(status)
    .with('default', () => 'neutral' as const)
    .with('accent', () => 'brand' as const)
    .with('success', () => 'success' as const)
    .with('warning', () => 'warning' as const)
    .with('danger', () => 'danger' as const)
    .exhaustive();
}
