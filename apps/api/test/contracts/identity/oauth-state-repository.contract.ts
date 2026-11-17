import type {
  OAuthStateRepositoryPort,
  NewOAuthState,
} from "#api/modules/identity/oauth-states/application/ports/oauth-state.repository.port";
import type { OAuthState } from "#api/modules/identity/oauth-states/domain/oauth-state.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  AUTH_FIXTURE_NOW,
  AUTH_FIXTURE_OTHER_USER_ID,
  AUTH_FIXTURE_USER_ID,
} from "#test/fixtures/identity/session.fixture";

const EXPIRES_AT = AUTH_FIXTURE_NOW.add({ minutes: 10 });
let stateSequence = 0;

async function createState(
  repository: OAuthStateRepositoryPort,
  overrides: Partial<NewOAuthState> = {},
): Promise<OAuthState> {
  stateSequence += 1;
  const state = `state-${stateSequence}`;
  await repository.create({
    state,
    provider: "GOOGLE",
    redirectUri: "aido://auth/callback",
    expiresAt: EXPIRES_AT,
    ...overrides,
  });
  const created = await repository.findByState(overrides.state ?? state, AUTH_FIXTURE_NOW);
  if (created == null) {
    throw new Error("만든 OAuth state를 찾지 못했다");
  }
  return created;
}

async function saveLoginExchange(
  repository: OAuthStateRepositoryPort,
  state: OAuthState,
): Promise<string> {
  const exchangeCode = repository.generateExchangeCode();
  await repository.saveExchangeData(state.id, {
    exchangeCode,
    accessToken: "access-token",
    refreshToken: "refresh-token",
    userId: AUTH_FIXTURE_USER_ID,
    userName: "아이도",
    accountRestored: false,
    isNewUser: true,
  });
  return exchangeCode;
}

async function findByCode(
  repository: OAuthStateRepositoryPort,
  exchangeCode: string,
): Promise<OAuthState> {
  const found = await repository.findByExchangeCode(exchangeCode, AUTH_FIXTURE_NOW);
  if (found == null) {
    throw new Error("교환 코드로 OAuth state를 찾지 못했다");
  }
  return found;
}

export function describeOAuthStateRepositoryContract(
  createRepository: () => Promise<OAuthStateRepositoryPort>,
): void {
  describe("OAuth state 저장소 계약", () => {
    it("만든 state는 만료 전까지 시작 정보와 함께 읽는다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const created = await createState(repository, {
        provider: "KAKAO",
        redirectUri: "aido://auth/kakao",
        mode: "link",
        initiatingUserId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
      });
      const atExpiry = await repository.findByState(created.state, EXPIRES_AT);

      // Then
      expect(created.toPrimitives()).toMatchObject({
        provider: "KAKAO",
        redirectUri: "aido://auth/kakao",
        mode: "link",
        initiatingUserId: AUTH_FIXTURE_USER_ID,
        exchangeCode: null,
        expiresAt: EXPIRES_AT,
        exchangedAt: null,
      });
      expect(atExpiry).toBeNull();
    });

    it("모드·시작 사용자를 비우면 null로 읽는다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const created = await createState(repository);

      // Then
      expect(created.toPrimitives()).toMatchObject({ mode: null, initiatingUserId: null });
    });

    it("로그인 교환 코드로 저장한 토큰을 평문으로 다시 읽는다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createState(repository);

      // When
      const exchangeCode = await saveLoginExchange(repository, created);
      const found = await repository.findByExchangeCode(exchangeCode, AUTH_FIXTURE_NOW);

      // Then
      expect(found?.loginExchange()).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        userId: AUTH_FIXTURE_USER_ID,
      });
      expect(found?.toPrimitives()).toMatchObject({
        userName: "아이도",
        accountRestored: false,
        isNewUser: true,
      });
    });

    it("교환한 state 저장은 한 번만 성공하고 저장한 토큰을 지운다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createState(repository);
      const exchangeCode = await saveLoginExchange(repository, created);
      const first = await findByCode(repository, exchangeCode);
      const stale = await findByCode(repository, exchangeCode);
      first.consume(AUTH_FIXTURE_NOW);
      stale.consume(AUTH_FIXTURE_NOW);

      // When
      const firstSaved = await repository.save(first);
      const staleSaved = await repository.save(stale);
      const byCode = await repository.findByExchangeCode(exchangeCode, AUTH_FIXTURE_NOW);
      const byState = await repository.findByState(created.state, AUTH_FIXTURE_NOW);

      // Then
      expect({ firstSaved, staleSaved, byCode }).toEqual({
        firstSaved: true,
        staleSaved: false,
        byCode: null,
      });
      expect(byState?.toPrimitives()).toMatchObject({
        accessToken: null,
        refreshToken: null,
        exchangedAt: AUTH_FIXTURE_NOW,
      });
    });

    it("교환하지 않은 state와 만료 시각부터의 교환은 저장하지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createState(repository);
      const exchangeCode = await saveLoginExchange(repository, created);
      const untouched = await findByCode(repository, exchangeCode);
      const late = await findByCode(repository, exchangeCode);

      // When
      const consumedAtExpiry = late.consume(EXPIRES_AT);
      const savedUntouched = await repository.save(untouched);

      // Then
      expect({ consumedAtExpiry, savedUntouched }).toEqual({
        consumedAtExpiry: false,
        savedUntouched: false,
      });
    });

    it("연결 교환은 공급자 계정 id를 남기고 시작한 사용자만 교환할 수 있다", async () => {
      // Given
      const repository = await createRepository();
      const created = await createState(repository, {
        mode: "link",
        initiatingUserId: UserId.reconstitute(AUTH_FIXTURE_USER_ID),
      });
      const exchangeCode = repository.generateExchangeCode();
      await repository.saveLinkingData(created.id, {
        exchangeCode,
        provider: "NAVER",
        providerAccountId: "naver-account",
      });

      // When
      const found = await findByCode(repository, exchangeCode);
      const byOther = found.canLinkFor(AUTH_FIXTURE_OTHER_USER_ID);
      const byOwner = found.canLinkFor(AUTH_FIXTURE_USER_ID);
      found.consume(AUTH_FIXTURE_NOW);
      const saved = await repository.save(found);

      // Then
      expect(found.provider).toBe("NAVER");
      expect(found.linkedProviderAccountId()).toBe("naver-account");
      expect({ byOther, byOwner, saved }).toEqual({ byOther: false, byOwner: true, saved: true });
    });

    it("시작 사용자가 없는 옛 연결 state는 누구의 연결이든 받고 로그인 state는 연결로 받지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const legacyLink = await createState(repository, { mode: "link" });
      const login = await createState(repository, { mode: "login" });
      const legacyCode = repository.generateExchangeCode();
      const loginCode = repository.generateExchangeCode();
      const linking = { provider: "GOOGLE", providerAccountId: "google-account" } as const;
      await repository.saveLinkingData(legacyLink.id, { ...linking, exchangeCode: legacyCode });
      await repository.saveLinkingData(login.id, { ...linking, exchangeCode: loginCode });

      // When
      const legacy = (await findByCode(repository, legacyCode)).canLinkFor(
        AUTH_FIXTURE_OTHER_USER_ID,
      );
      const loginAsLink = (await findByCode(repository, loginCode)).canLinkFor(
        AUTH_FIXTURE_USER_ID,
      );

      // Then
      expect({ legacy, loginAsLink }).toEqual({ legacy: true, loginAsLink: false });
    });

    it("교환 코드는 만들 때마다 다르다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const codes = [repository.generateExchangeCode(), repository.generateExchangeCode()];

      // Then
      expect(codes[0]).not.toBe(codes[1]);
    });
  });
}
