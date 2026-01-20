import { TokenStore } from '@src/shared/storage/token-store';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { AuthTokens, CurrentUser } from '../../domain/models/user.model';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async exchangeCodeAndSaveTokens(code: string): Promise<AuthTokens> {
    const tokens = await this.repository.exchangeCode({ code });
    await TokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    return await this.repository.getCurrentUser();
  }

  async logout(): Promise<void> {
    try {
      await this.repository.logout();
    } catch {
      // API 실패 시에도 로컬 토큰은 삭제
    } finally {
      await TokenStore.clearTokens();
    }
  }

  async openKakaoLogin(): Promise<string | null> {
    const redirectUri = Linking.createURL('auth/kakao');
    const authUrl = this.repository.getKakaoAuthUrl(redirectUri);

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      const parsed = Linking.parse(result.url);
      return (parsed.queryParams?.code as string) ?? null;
    }

    return null;
  }
}
