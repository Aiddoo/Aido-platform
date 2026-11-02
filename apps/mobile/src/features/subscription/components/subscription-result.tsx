import catAnchorImage from '@assets/images/cat_weather_anchor.png';
import { ReadableContent, Result, StyledSafeAreaView } from '@src/shared/ui';
import { type ComponentProps, useEffect } from 'react';
import { AccessibilityInfo, Image } from 'react-native';

interface SubscriptionResultProps extends Omit<
  ComponentProps<typeof Result>,
  'icon' | 'className'
> {
  /** 화면이 실패 안내로 바뀌면 스크린 리더에도 알린다 */
  isAlert?: boolean;
}

/** 구독 화면의 오프라인·실패 안내. 같은 고양이 그림과 자리로 상태만 바꿔 보여 준다 */
export function SubscriptionResult({
  isAlert = false,
  title,
  description,
  ...props
}: SubscriptionResultProps) {
  useEffect(() => {
    if (!isAlert) {
      return;
    }
    AccessibilityInfo.announceForAccessibilityWithOptions(
      description == null ? title : `${title}. ${description}`,
      { queue: true },
    );
  }, [isAlert, title, description]);

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <ReadableContent className="flex-1 px-6" accessibilityRole={isAlert ? 'alert' : undefined}>
        <Result
          icon={
            <Image
              source={catAnchorImage}
              accessibilityIgnoresInvertColors
              className="size-[120px]"
              resizeMode="contain"
            />
          }
          title={title}
          description={description}
          {...props}
        />
      </ReadableContent>
    </StyledSafeAreaView>
  );
}
