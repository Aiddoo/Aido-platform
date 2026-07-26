import { useLogger } from '@src/bootstrap/providers/di-context';
import type { User } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { toError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { ConfirmDialog, useOverlay } from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import * as StoreReview from 'expo-store-review';
import { useCallback, useRef } from 'react';
import { createStoreReviewPromptRepository } from '../../repositories/store-review-prompt.repository';
import {
  type StoreReviewDecision,
  type StoreReviewGateway,
  StoreReviewPromptService,
} from '../../services/store-review-prompt.service';

const expoStoreReviewGateway: StoreReviewGateway = {
  isAvailable: StoreReview.isAvailableAsync,
  requestReview: StoreReview.requestReview,
};
const storeReviewPromptService = new StoreReviewPromptService(
  createStoreReviewPromptRepository(mmkvSyncStorage),
  expoStoreReviewGateway,
);

interface StoreReviewPromptDialogProps {
  isOpen: boolean;
  onDecision: (decision: StoreReviewDecision) => void;
}

function StoreReviewPromptDialog({ isOpen, onDecision }: StoreReviewPromptDialogProps) {
  const { t } = useTranslation('storeReview');
  const settledRef = useRef(false);
  const settle = (decision: StoreReviewDecision) => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    onDecision(decision);
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          settle('dismiss');
        }
      }}
      title={<ConfirmDialog.Title>{t('title')}</ConfirmDialog.Title>}
      description={<ConfirmDialog.Description>{t('description')}</ConfirmDialog.Description>}
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => settle('dismiss')}>
          {t('later')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={() => settle('review')}>
          {t('review')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

export function useStoreReviewPrompt() {
  const queryClient = useQueryClient();
  const { currentLocalDateKey } = useLocalDate();
  const overlay = useOverlay();
  const logger = useLogger();

  const promptAfterSuccessfulCompletion = useCallback(
    async (todoId: number): Promise<boolean> => {
      const accountId = queryClient.getQueryData<User>(USER_QUERY_KEYS.me())?.id;
      if (!accountId) {
        return false;
      }

      try {
        return await storeReviewPromptService.recordSuccessfulCompletion(
          { accountId, todoId, localDate: currentLocalDateKey },
          () =>
            overlay.open<StoreReviewDecision>(({ isOpen, close, exit }) => (
              <StoreReviewPromptDialog
                isOpen={isOpen}
                onDecision={(decision) => {
                  close(decision);
                  exit();
                }}
              />
            )),
        );
      } catch (error) {
        logger.warn('[StoreReview] Prompt skipped', { error: toError(error).message });
        return false;
      }
    },
    [currentLocalDateKey, logger, overlay, queryClient],
  );

  return { promptAfterSuccessfulCompletion };
}
