import { useTranslation } from '@src/shared/i18n';
import { H4, VStack } from '@src/shared/ui';
import type { ReactNode } from 'react';

export function PawPrintBoardCard({ children }: { children: ReactNode }) {
  const { t } = useTranslation('invite');

  return (
    <VStack gap={14} className="rounded-3xl border border-gray-2 bg-gray-1 px-[18px] py-5">
      <H4>{t('pawPrintBoard.title')}</H4>
      {children}
    </VStack>
  );
}
