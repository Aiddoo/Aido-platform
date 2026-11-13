import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useTranslation } from '@src/shared/i18n';
import { type Href, Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { STACK_BACK_ICON } from './stack-back-icon';

interface UseStackBackToolbarOptions {
  /** 돌아갈 화면이 없을 때(푸시·딥링크로 바로 연 경우) 대신 여는 화면 */
  fallbackHref?: Href;
  /** Android 버튼 뒤 둥근 면 색. 같은 화면의 오른쪽 버튼과 모양을 맞출 때 쓴다. */
  buttonContainerColor?: ComponentProps<typeof Stack.Toolbar>['buttonContainerColor'];
  icon?: ComponentProps<typeof Stack.Toolbar.Button>['icon'];
  accessibilityLabel?: string;
}

/** 중첩 Stack의 첫 화면은 이전 화면이 부모 Stack에 있어 네이티브 뒤로가기가 그려지지 않는다. `Stack.Screen`은 직접 자식인 `Stack.Toolbar`만 읽어 컴포넌트로 감싸면 툴바가 사라지므로 요소를 돌려주는 훅으로 둔다 */
export function useStackBackToolbar({
  fallbackHref,
  buttonContainerColor,
  icon = STACK_BACK_ICON,
  accessibilityLabel,
}: UseStackBackToolbarOptions = {}) {
  const { t } = useTranslation('common');
  const goBack = useGoBack({ fallbackHref });

  return (
    <Stack.Toolbar placement="left" buttonContainerColor={buttonContainerColor}>
      <Stack.Toolbar.Button
        icon={icon}
        accessibilityLabel={accessibilityLabel ?? t('actions.goBack')}
        onPress={goBack}
      />
    </Stack.Toolbar>
  );
}
