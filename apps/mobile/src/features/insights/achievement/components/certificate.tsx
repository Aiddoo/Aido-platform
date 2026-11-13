import { useTranslation } from '@src/shared/i18n';
import { Box, H3, Text, VStack } from '@src/shared/ui';
import type { ReactNode } from 'react';

/** 주간 달성 배지 상장. 머리말·제목·부제목과 이중 테두리를 고정하고 본문만 children으로 받는다. */
export function Certificate({ subtitle, children }: { subtitle?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation('achievement');

  return (
    <Box className="overflow-hidden rounded-sm bg-gray-1 p-3">
      <CertificateBorder>
        <Box className="px-5 pt-7 pb-5">
          <VStack align="center" gap={4}>
            <Text size="e1" tone="brand" className="tracking-widest">
              {t('card.eyebrow')}
            </Text>
            <H3 className="tracking-wider">{t('card.title')}</H3>
            {subtitle}
          </VStack>
          {children}
        </Box>
      </CertificateBorder>
    </Box>
  );
}

Certificate.Subtitle = function Subtitle({ children }: { children: string }) {
  return (
    <Text size="b4" shade={6} weight="medium">
      {children}
    </Text>
  );
};

Certificate.Ornament = function Ornament() {
  return (
    <Text tone="brand" align="center">
      {'── ✦ ──'}
    </Text>
  );
};

/** 상장 느낌의 이중 라운드 테두리. 바깥은 굵고 진하게, 안쪽은 가늘고 옅게 겹쳐 그린다 */
function CertificateBorder({ children }: { children: ReactNode }) {
  return (
    <Box className="relative">
      <Box className="absolute inset-[1.25px] rounded-[2px] border-[1.5px] border-main/60" />
      <Box className="absolute inset-[6.75px] rounded-[1px] border-[0.5px] border-main/35" />
      <Box className="m-2">{children}</Box>
    </Box>
  );
}
