-- AlterEnum: NotificationType에 점심 넛지 + 스트릭 위기 타입 추가
ALTER TYPE "NotificationType" ADD VALUE 'LUNCH_NUDGE';
ALTER TYPE "NotificationType" ADD VALUE 'STREAK_AT_RISK';
