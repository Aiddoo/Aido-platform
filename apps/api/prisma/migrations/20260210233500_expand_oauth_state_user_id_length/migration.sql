-- OAuthState.userId is reused to temporarily store providerAccountId in link mode.
-- Existing length (VARCHAR(30)) is too short for some providers.
ALTER TABLE "OAuthState"
ALTER COLUMN "userId" TYPE VARCHAR(255);
