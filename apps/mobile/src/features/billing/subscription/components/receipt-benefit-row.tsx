import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { Box, CheckmarkIcon, ListRow, Text } from '@src/shared/ui';
import type { ComponentProps } from 'react';

interface ReceiptBenefitRowProps {
  title: string;
  /** 영수증마다 본문 글자 진하기가 다르다(구독 영수증 8, 초대 카드 영수증 9) */
  shade: ComponentProps<typeof Text>['shade'];
}

export function ReceiptBenefitRow({ title, shade }: ReceiptBenefitRowProps) {
  const fontScaledSize = useFontScaledSize();

  return (
    <ListRow
      verticalPadding="small"
      left={
        <Box className="size-5 items-center justify-center rounded-full bg-main">
          <CheckmarkIcon
            width={fontScaledSize(12)}
            height={fontScaledSize(12)}
            colorClassName="text-white dark:text-gray-9"
          />
        </Box>
      }
      contents={
        <Text size="b3" shade={shade}>
          {title}
        </Text>
      }
    />
  );
}
