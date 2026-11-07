import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { ExternalLinkGateway, IncomingLinkGateway } from '@src/core/ports/external-link';
import type { HapticsGateway } from '@src/core/ports/haptics';
import type { Logger } from '@src/core/ports/logger';
import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { SystemShareGateway } from '@src/core/ports/system-share';
import type { FeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import type { DraftService } from '@src/shared/draft/draft.service';
import { createContext, use } from 'react';

/** shared 코드가 쓰는 의존성. bootstrap의 DI 컨테이너가 이 모양을 채워 Provider로 넘긴다 */
export interface SharedDependencies {
  logger: Logger;
  analytics: Analytics;
  errorReporter: ErrorReporter;
  haptics: HapticsGateway;
  featureAttribution: FeatureAttributionStore;
  draftService: DraftService;
  externalLink: ExternalLinkGateway;
  incomingLink: IncomingLinkGateway;
  systemShare: SystemShareGateway;
  syncStorage: ObservableSyncStorage;
}

export const SharedDIContext = createContext<SharedDependencies | null>(null);

function useSharedDI(): SharedDependencies {
  const context = use(SharedDIContext);

  if (!context) {
    throw new Error('useSharedDI must be used within DIProvider');
  }

  return context;
}

export function useLogger() {
  return useSharedDI().logger;
}

export function useAnalytics() {
  return useSharedDI().analytics;
}

export function useErrorReporter() {
  return useSharedDI().errorReporter;
}

export function useHaptics() {
  return useSharedDI().haptics;
}

export function useFeatureAttribution() {
  return useSharedDI().featureAttribution;
}

export function useDraftService() {
  return useSharedDI().draftService;
}

export function useExternalLink() {
  return useSharedDI().externalLink;
}

export function useSystemShare() {
  return useSharedDI().systemShare;
}

export function useIncomingLink() {
  return useSharedDI().incomingLink;
}

export function useSyncStorage() {
  return useSharedDI().syncStorage;
}
