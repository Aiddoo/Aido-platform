import { AuthBootProvider } from '@src/bootstrap/providers/auth-boot-provider';
import { DIProvider } from '@src/bootstrap/providers/di-provider';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { NotificationProvider } from '@src/bootstrap/providers/notification-provider';
import { OnlineManagerProvider } from '@src/bootstrap/providers/online-manager-provider';
import { PurchasesProvider } from '@src/bootstrap/providers/purchases-provider';
import { QueryProvider } from '@src/bootstrap/providers/query-provider';
import { createQueryCacheStorage } from '@src/bootstrap/query/query-cache-persistence';
import type { EncryptedStorageBootstrap } from '@src/shared/infra/storage/encrypted-draft-storage';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { LanguageProvider } from '@src/shared/providers/language-provider';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import {
  OfflineBanner,
  openSupportMail,
  OverlayProvider,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { type PropsWithChildren, useEffect, useState } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ReservedRegionsProvider } from 'react-native-reserved-regions';
import { SafeAreaProvider } from 'react-native-safe-area-context';

interface AppProvidersProps extends PropsWithChildren {
  encryptedStorageBootstrap: EncryptedStorageBootstrap;
}

/** 이 경계가 그리면 AuthGateLayout이 내려가 있어 스플래시를 내릴 곳이 여기뿐이다 */
function BootQueryErrorFallback({ reset }: Pick<QueryErrorFallbackProps, 'reset'>) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(noop);
  }, []);

  return <QueryErrorFallback reset={reset} onInquiry={openSupportMail} />;
}

/** 경로는 여기서만 읽어 화면 이동마다 다른 Provider가 다시 그려지지 않게 한다 */
function RouteOverlayProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return <OverlayProvider resetKey={pathname}>{children}</OverlayProvider>;
}

export function AppProviders({ children, encryptedStorageBootstrap }: AppProvidersProps) {
  const [queryCacheStorage] = useState(() => {
    const storage = encryptedStorageBootstrap.queryCacheStorage;
    return storage == null ? null : createQueryCacheStorage(storage);
  });

  return (
    <GestureHandlerProvider>
      <KeyboardProvider>
        <FontScaleProvider>
          <LanguageProvider>
            <ThemeProvider>
              <HeroUIProvider>
                <QueryProvider cacheStorage={queryCacheStorage}>
                  <DIProvider
                    encryptedStorageBootstrap={encryptedStorageBootstrap}
                    queryCacheStorage={queryCacheStorage}
                  >
                    <OnlineManagerProvider>
                      <LocalDateProvider>
                        <AuthBootProvider>
                          <PurchasesProvider>
                            <NotificationProvider>
                              <ReservedRegionsProvider style={{ flex: 1 }}>
                                {/* 이 경계가 그리면 내비게이터가 내려가 있어 문의는 화면 이동 대신 메일로 연다 */}
                                <QueryErrorBoundary fallback={BootQueryErrorFallback}>
                                  <RouteOverlayProvider>
                                    <OfflineBanner />
                                    {/* 배너가 상태 표시줄 inset을 차지하면 아래 화면은 남은 inset만 받는다 */}
                                    <SafeAreaProvider style={{ flex: 1 }}>
                                      {children}
                                    </SafeAreaProvider>
                                  </RouteOverlayProvider>
                                </QueryErrorBoundary>
                              </ReservedRegionsProvider>
                            </NotificationProvider>
                          </PurchasesProvider>
                        </AuthBootProvider>
                      </LocalDateProvider>
                    </OnlineManagerProvider>
                  </DIProvider>
                </QueryProvider>
              </HeroUIProvider>
            </ThemeProvider>
          </LanguageProvider>
        </FontScaleProvider>
      </KeyboardProvider>
    </GestureHandlerProvider>
  );
}
