import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { type Href, Stack, router } from 'expo-router';

import { STACK_BACK_ICON } from './stack-back-icon';

interface UseStackBackToolbarParams {
  /** 돌아갈 화면이 없을 때(푸시·딥링크로 바로 연 경우) 대신 여는 화면 */
  fallbackHref?: Href;
}

/**
 * 중첩 Stack의 첫 화면은 이전 화면이 부모 Stack에 있어 네이티브 뒤로가기가 그려지지 않는다.
 * 같은 자리에 네이티브 툴바 버튼을 두어 iPhone Duo 레일에도 들어가게 한다.
 * 레이아웃의 `Stack.Screen` 자식으로 넣는다.
 */
export function useStackBackToolbar({ fallbackHref }: UseStackBackToolbarParams = {}) {
  const { t } = useTranslation('common');
  const goBack = useSingleTap(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref != null) {
      router.replace(fallbackHref);
    }
  });

  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button
        icon={STACK_BACK_ICON}
        accessibilityLabel={t('actions.goBack')}
        onPress={goBack}
      />
    </Stack.Toolbar>
  );
}
