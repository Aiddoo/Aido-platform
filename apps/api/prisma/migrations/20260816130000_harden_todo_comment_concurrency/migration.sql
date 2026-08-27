-- clientRequestId가 원래의 todo/parent/order/content 명령과 같은지 검증하기 위한 지문입니다.
-- 기존 댓글은 지문이 없으므로 nullable로 추가하고 새 요청부터 채웁니다.
ALTER TABLE "TodoComment"
ADD COLUMN "requestFingerprint" CHAR(64);
