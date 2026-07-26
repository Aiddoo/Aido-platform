import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import { createActivationProgressRepository } from './repositories/activation-progress.repository';
import { ActivationService } from './services/activation.service';

export const activationService = new ActivationService(
  createActivationProgressRepository(mmkvSyncStorage),
);
