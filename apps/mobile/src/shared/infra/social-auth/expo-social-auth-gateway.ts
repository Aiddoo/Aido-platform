import type { SocialAuthGateway } from '@src/core/ports/social-auth-gateway';
import { ENV } from '@src/shared/config/env';
import { toHex } from '@src/shared/utils/to-hex';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { WebBrowserResultType } from 'expo-web-browser';
import { match } from 'ts-pattern';

function readQueryParams(url: string): Record<string, string> {
  const entries = Object.entries(Linking.parse(url).queryParams ?? {});
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

async function createNonce() {
  const nonce = toHex(Crypto.getRandomBytes(32));
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  return { nonce, hashedNonce };
}

function readErrorCode(error: unknown): unknown {
  return error instanceof Error && 'code' in error ? error.code : undefined;
}

export const expoSocialAuthGateway: SocialAuthGateway = {
  completeOAuthSession: () => {
    WebBrowser.maybeCompleteAuthSession();
  },
  openOAuthSession: async ({ startPath, callbackPath, params }) => {
    const redirectUri = makeRedirectUri({ scheme: ENV.SCHEME, path: callbackPath });
    const query = new URLSearchParams({ redirect_uri: redirectUri, ...params });

    const result = await WebBrowser.openAuthSessionAsync(
      `${ENV.API_URL}/${startPath}?${query.toString()}`,
      redirectUri,
      { createTask: false },
    );

    if (result.type === 'success') {
      return { type: 'success', url: result.url, queryParams: readQueryParams(result.url) };
    }
    if (
      result.type === WebBrowserResultType.CANCEL ||
      result.type === WebBrowserResultType.DISMISS
    ) {
      return { type: 'cancelled' };
    }
    return { type: 'failed' };
  },

  signInWithApple: async () => {
    try {
      const { nonce, hashedNonce } = await createNonce();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        return { type: 'no-token' };
      }
      return {
        type: 'success',
        identityToken: credential.identityToken,
        nonce,
        givenName: credential.fullName?.givenName ?? null,
      };
    } catch (error) {
      return match(readErrorCode(error))
        .with('ERR_REQUEST_CANCELED', () => ({ type: 'cancelled' as const }))
        .with('ERR_REQUEST_FAILED', 'ERR_INVALID_RESPONSE', () => ({
          type: 'invalid-response' as const,
        }))
        .with('ERR_NOT_AVAILABLE', () => ({ type: 'unavailable' as const }))
        .otherwise(() => ({ type: 'failed' as const }));
    }
  },
};
