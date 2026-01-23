import type { ExchangeCodeInput } from '@aido/validators';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { AuthTokens, User } from '../models/auth.model';
import type { AuthRepository } from '../repositories/auth.repository';
import { toAuthTokens, toUser } from './auth.mapper';

export class AuthService {
  constructor(private readonly _authRepository: AuthRepository) {}

  openKakaoLogin = async (): Promise<string | null> => {
    const redirectUri = Linking.createURL('auth/kakao');
    const authUrl = this._authRepository.getKakaoAuthUrl(redirectUri);

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type !== 'success') {
      return null;
    }

    const { queryParams } = Linking.parse(result.url);
    const code = queryParams?.code;

    return typeof code === 'string' ? code : null;
  };

  exchangeCode = async (request: ExchangeCodeInput): Promise<AuthTokens> => {
    const dto = await this._authRepository.exchangeCode(request);
    return toAuthTokens(dto);
  };

  getCurrentUser = async (): Promise<User> => {
    const dto = await this._authRepository.getCurrentUser();
    return toUser(dto);
  };

  logout = async (): Promise<void> => {
    return this._authRepository.logout();
  };
}
