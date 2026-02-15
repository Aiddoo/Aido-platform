-- DropIndex: @unique on userTag already creates a B-tree index
DROP INDEX "User_userTag_idx";

-- DropIndex: @unique on exchangeCode already creates a B-tree index
DROP INDEX "OAuthState_exchangeCode_idx";

-- DropIndex: @@unique([userId, date]) already creates a B-tree index
DROP INDEX "DailyCompletion_userId_date_idx";
