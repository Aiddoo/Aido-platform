import { type LinkedAccount, LinkedAccountsPolicy } from './linked-accounts.model';

function createLinkedAccount(overrides: Partial<LinkedAccount> = {}): LinkedAccount {
  return {
    provider: 'KAKAO',
    linked: true,
    providerAccountId: 'kakao-1',
    linkedAt: null,
    ...overrides,
  };
}

describe('LinkedAccountsPolicy', () => {
  describe('countLinkedAccounts', () => {
    it('연결한 계정만 센다', () => {
      // Given
      const linkedAccounts = {
        accounts: [
          createLinkedAccount({ provider: 'KAKAO' }),
          createLinkedAccount({ provider: 'GOOGLE', linked: false, providerAccountId: null }),
          createLinkedAccount({ provider: 'APPLE' }),
        ],
        canUnlink: true,
      };

      // When
      const result = LinkedAccountsPolicy.countLinkedAccounts(linkedAccounts);

      // Then
      expect(result).toBe(2);
    });
  });

  describe('isProviderLinked', () => {
    it.each([
      ['KAKAO', true],
      ['GOOGLE', false],
      ['NAVER', false],
    ] as const)('%s가 연결돼 있는지 %s다', (provider, expected) => {
      // Given
      const linkedAccounts = {
        accounts: [
          createLinkedAccount({ provider: 'KAKAO' }),
          createLinkedAccount({ provider: 'GOOGLE', linked: false, providerAccountId: null }),
        ],
        canUnlink: false,
      };

      // When
      const result = LinkedAccountsPolicy.isProviderLinked(linkedAccounts, provider);

      // Then
      expect(result).toBe(expected);
    });
  });
});
