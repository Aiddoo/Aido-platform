import { Box, FillCheckIcon, ListRow, Text } from '@src/shared/ui';
import type { ComponentProps } from 'react';

interface ReceiptBenefitRowProps {
  title: string;
  /** 영수증마다 본문 글자 진하기가 다르다(구독 영수증 8, 초대 카드 영수증 9) */
  shade: ComponentProps<typeof Text>['shade'];
}

/** 영수증의 혜택 한 줄. 체크 원과 혜택 이름 */
export function ReceiptBenefitRow({ title, shade }: ReceiptBenefitRowProps) {
  return (
    <ListRow
      verticalPadding="small"
      left={
        <Box className="size-5 items-center justify-center rounded-full bg-main">
          <FillCheckIcon width={12} height={12} colorClassName="text-white dark:text-gray-1" />
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
