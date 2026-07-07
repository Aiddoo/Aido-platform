-- AI 리포트 생성 언어 (기존 리포트 전부 'ko' — 콘텐츠와 일치)
ALTER TABLE "AiReport" ADD COLUMN "locale" VARCHAR(10) NOT NULL DEFAULT 'ko';
