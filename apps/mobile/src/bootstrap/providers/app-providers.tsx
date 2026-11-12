import { openSupportMail } from '@src/bootstrap/navigation/open-support-mail';
import { AuthBootProvider } from '@src/bootstrap/providers/auth-boot-provider';
import type { AppContainerPorts } from '@src/bootstrap/providers/create-app-container';
import type { CompositionRoot } from '@src/bootstrap/providers/create-composition-root';
import { DIProvider } from '@src/bootstrap/providers/di-provider';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { NotificationProvider } from '@src/bootstrap/providers/notification-provider';
import { OnlineManagerProvider } from '@src/bootstrap/providers/online-manager-provider';
import { PurchasesProvider } from '@src/bootstrap/providers/purchases-provider';
import { QueryProvider } from '@src/bootstrap/providers/query-provider';
import { MutationErrorFeedback } from '@src/bootstrap/query/mutation-error-feedback';
import { QueryErrorReport } from '@src/bootstrap/query/query-error-report';
import { toError } from '@src/shared/errors';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { LanguageProvider } from '@src/shared/providers/language-provider';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import {
  OfflineBanner,
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
  /** 프로세스 수명 객체의 주인. 운영은 `compositionRoot`, 테스트는 stub 포트로 만든 것 */
  root: CompositionRoot;
}

/** 저장소를 열 때까지 null이라 호출부는 스플래시를 유지한다. 이미 열었으면(루트 "다시 시도") 첫 렌더부터 같은 포트를 쓴다 */
function useAppPorts(root: CompositionRoot): AppContainerPorts | null {
  const [ports, setPorts] = useState(() => root.getOpenedPorts());
  const [failure, setFailure] = useState<Error | null>(null);

  useEffect(() => {
    if (ports != null) {
      return undefined;
    }
    let isCurrent = true;
    root.openPorts().then(
      (opened) => {
        if (isCurrent) {
          setPorts(opened);
        }
      },
      (error: unknown) => {
        if (isCurrent) {
          setFailure(toError(error));
        }
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [root, ports]);

  // 조립이 실패하면 렌더에서 던져 루트 오류 화면이 받게 한다
  if (failure != null) {
    throw failure;
  }
  return ports;
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

export function AppProviders({ children, root }: AppProvidersProps) {
  const ports = useAppPorts(root);

  if (ports == null) {
    return null;
  }

  return (
    <GestureHandlerProvider>
      <KeyboardProvider>
        <FontScaleProvider>
          <LanguageProvider>
            <ThemeProvider>
              <HeroUIProvider>
                <QueryProvider
                  client={ports.queryClient}
                  cacheStorage={ports.queryCacheStorage}
                  appLifecycle={ports.appLifecycle}
                >
                  <DIProvider ports={ports}>
                    <MutationErrorFeedback />
                    <QueryErrorReport />
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
