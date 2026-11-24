import aidoAppIcon from '@assets/images/profile-icons/default.webp';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { Image } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { ComponentProps } from 'react';

interface AidoMarkProps extends Omit<ComponentProps<typeof Image>, 'source' | 'style'> {}

const MARK_SIZE = 16;

/** 넣을 곳이 아이두라는 표시. 기본 앱 아이콘 그림이고 글꼴 단계를 따라 커진다. 스크린 리더는 옆 글자로 읽는다 */
export function AidoMark({ className, ...props }: AidoMarkProps) {
  const fontScaledSize = useFontScaledSize();
  const size = fontScaledSize(MARK_SIZE);

  return (
    <Image
      source={aidoAppIcon}
      contentFit="cover"
      accessible={false}
      accessibilityIgnoresInvertColors
      importantForAccessibility="no"
      // 주황 면이 어두운 화면에서 번지지 않게 다크에서만 옅은 테두리를 두른다
      className={cn('rounded-[4px] dark:border dark:border-gray-3', className)}
      style={{ width: size, height: size }}
      {...props}
    />
  );
}
