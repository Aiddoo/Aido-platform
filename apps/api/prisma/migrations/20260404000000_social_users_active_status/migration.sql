-- 소셜 로그인 유저의 PENDING_VERIFY → ACTIVE 전환
-- 이메일 인증은 credential 가입 전용이므로, 소셜 로그인 유저는 ACTIVE가 올바른 상태
UPDATE "User"
SET status = 'ACTIVE', "emailVerifiedAt" = NOW()
WHERE status = 'PENDING_VERIFY'
  AND id IN (SELECT "userId" FROM "Account" WHERE provider != 'CREDENTIALS');
