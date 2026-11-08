import { Box, CheckmarkIcon, ListRow, Text } from '@src/shared/ui';
import type { ComponentProps } from 'react';

interface ReceiptBenefitRowProps {
  title: string;
  shade: ComponentProps<typeof Text>['shade'];
}

export function ReceiptBenefitRow({ title, shade }: ReceiptBenefitRowProps) {
  return (
    <ListRow
      verticalPadding="small"
      left={
        <Box className="size-5 items-center justify-center rounded-full bg-main">
          <CheckmarkIcon width={12} height={12} colorClassName="text-white dark:text-gray-9" />
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
