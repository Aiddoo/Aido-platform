import { Box, Result } from '@src/shared/ui';
import { Image, type ImageSource } from 'expo-image';
import type { ComponentProps } from 'react';
import { withUniwind } from 'uniwind';

const StyledImage = withUniwind(Image);

interface WeatherResultProps extends Omit<ComponentProps<typeof Result>, 'icon'> {
  image: ImageSource | number;
}

/**
 * 날씨 화면의 안내·오류 상태. 하늘 장면 위에서도 읽히도록 테마 표면 위에 공용 Result를 둔다.
 * 마스코트 이미지는 장식이라 보조 기술에서 숨긴다.
 */
export function WeatherResult({ image, ...props }: WeatherResultProps) {
  return (
    <Box className="rounded-[22px] bg-white px-6 py-8">
      <Result
        icon={
          <StyledImage
            source={image}
            className="size-28"
            contentFit="contain"
            accessible={false}
            accessibilityIgnoresInvertColors
          />
        }
        {...props}
      />
    </Box>
  );
}
