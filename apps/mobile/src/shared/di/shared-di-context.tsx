import type { Analytics } from '@src/core/ports/analytics';
import type { AppLifecycleGateway } from '@src/core/ports/app-lifecycle-gateway';
import type { ClipboardGateway } from '@src/core/ports/clipboard-gateway';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { ExternalLinkGateway } from '@src/core/ports/external-link-gateway';
import type { HapticsGateway } from '@src/core/ports/haptics-gateway';
import type { IncomingLinkGateway } from '@src/core/ports/incoming-link-gateway';
import type { Logger } from '@src/core/ports/logger';
import type { ObservableSyncStorage } from '@src/core/ports/observable-sync-storage';
import type { EnumerableSyncStorage } from '@src/core/ports/sync-storage';
import type { SystemShareGateway } from '@src/core/ports/system-share-gateway';
import type { FeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import type { DraftService } from '@src/shared/draft/draft.service';
import type { MinuteClockStore } from '@src/shared/stores/minute-clock-store';
import { createContext, use } from 'react';

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
  clipboard: ClipboardGateway;
  appLifecycle: AppLifecycleGateway;
  /** 분 단위로 지금을 읽는 소비자들이 함께 쓰는 시계 */
  minuteClock: MinuteClockStore;
  /** 앱과 위젯이 함께 읽는 기기 저장소. 키별 구독과 키 목록을 준다 */
  syncStorage: ObservableSyncStorage & Pick<EnumerableSyncStorage, 'keys'>;
  /** 로그아웃 때 통째로 비우는 암호화 저장소. 계정 범위 저장 값(`area: 'account'`)을 둔다 */
  accountSyncStorage: ObservableSyncStorage;
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

export function useClipboard() {
  return useSharedDI().clipboard;
}

export function useSystemShare() {
  return useSharedDI().systemShare;
}

export function useAppLifecycle() {
  return useSharedDI().appLifecycle;
}

export function useMinuteClock() {
  return useSharedDI().minuteClock;
}

export function useIncomingLink() {
  return useSharedDI().incomingLink;
}

export function useSyncStorage() {
  return useSharedDI().syncStorage;
}

export function useAccountSyncStorage() {
  return useSharedDI().accountSyncStorage;
}
