import type { ReleaseId } from '../domains/whats-new.model';
import { useWhatsNewCampaign } from './use-whats-new-campaign';

/** 서버 캠페인이 가리키는 출시를 이 계정이 아직 보지 않았으면 그 id. 메뉴 점과 목록의 새 기능 표시가 이 값 하나를 본다 */
export function useUnseenCampaignReleaseId(): ReleaseId | null {
  const { release, hasSeen } = useWhatsNewCampaign();

  return release == null || hasSeen ? null : release.id;
}
