import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider } from '@src/bootstrap/providers/auth-provider';
import { DIProvider } from '@src/bootstrap/providers/di-provider';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { NotificationProvider } from '@src/bootstrap/providers/notification-provider';
import { QueryProvider } from '@src/bootstrap/providers/query-provider';
import { RevenueCatProvider } from '@src/bootstrap/providers/revenuecat-provider';
import type { DraftStorageBootstrap } from '@src/shared/infra/storage/mmkv-draft-storage';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { LanguageProvider } from '@src/shared/providers/language-provider';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import { OverlayProvider, QueryErrorBoundary } from '@src/shared/ui';
import { usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

interface AppProvidersProps extends PropsWithChildren {
  draftStorageBootstrap: DraftStorageBootstrap;
}

export function AppProviders({ children, draftStorageBootstrap }: AppProvidersProps) {
  const pathname = usePathname();

  return (
    <GestureHandlerProvider>
      <KeyboardProvider>
        <FontScaleProvider>
          <LanguageProvider>
            <ThemeProvider>
              <HeroUIProvider>
                <QueryProvider>
                  <DIProvider draftStorageBootstrap={draftStorageBootstrap}>
                    <LocalDateProvider>
                      <AuthProvider>
                        <RevenueCatProvider>
                          <NotificationProvider>
                            <BottomSheetModalProvider>
                              <QueryErrorBoundary>
                                <OverlayProvider resetKey={pathname}>{children}</OverlayProvider>
                              </QueryErrorBoundary>
                            </BottomSheetModalProvider>
                          </NotificationProvider>
                        </RevenueCatProvider>
                      </AuthProvider>
                    </LocalDateProvider>
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
