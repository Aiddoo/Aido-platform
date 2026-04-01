/**
 * 프로필 템플릿 선택기
 *
 * 집계 데이터 기반으로 AI 프롬프트의 summary 작성 템플릿을 선택합니다.
 * 달성률과 이전 기간 대비 변화율에 따라 4가지 템플릿 중 하나를 반환합니다.
 */

export interface ProfileTemplateInput {
	readonly completionRate: number;
	readonly rateChange: number | null;
}

/**
 * 데이터 프로필에 따른 summary 작성 템플릿 반환
 */
export function selectProfileTemplate(input: ProfileTemplateInput): string {
	const { completionRate, rateChange } = input;

	if (completionRate >= 80) {
		return TEMPLATE_HIGH_ACHIEVER;
	}

	if (completionRate < 50) {
		return TEMPLATE_ENCOURAGEMENT;
	}

	if (rateChange !== null && Math.abs(rateChange) >= 15) {
		return TEMPLATE_BIG_CHANGE;
	}

	return TEMPLATE_DEEP_ANALYSIS;
}

const TEMPLATE_HIGH_ACHIEVER = `## ★ summary 작성법: 축하 + 숨은 약점 발굴
1문장: 칭찬 — 이 달성률에서 보이는 강점을 한마디로
2문장: 숨은 약점 — 높은 달성률에 가려진 불균형 포인트 (카테고리 편중, 주말 공백 등)
3문장: 습관 루프 분석 — 이미 형성된 루프와 아직 부족한 루프
4문장: 도전 제안 — 한 단계 올라갈 수 있는 구체적 행동`;

const TEMPLATE_ENCOURAGEMENT = `## ★ summary 작성법: 공감 + 작은 성공 스포트라이트
1문장: 공감 — 힘든 주였을 수 있다는 점을 인정 (절대 비난 아님)
2문장: 작은 성공 — 가장 잘한 요일이나 카테고리를 크게 강조
3문장: 최소 유효 용량 — 할 일 수를 줄이는 것이 오히려 달성률을 올리는 이유
4문장: 다음 주 딱 1가지만 — 구체적이고 달성 가능한 미니 목표`;

const TEMPLATE_BIG_CHANGE = `## ★ summary 작성법: 변화 원인 심층 분석
1문장: 변화 크기 + 방향에 대한 반응
2문장: 원인 추론 — 어떤 요일/카테고리/시간대가 변화를 만들었는지
3문장: 지속 가능성 — 이 변화가 일시적인지, 습관이 바뀌고 있는 건지 판단
4문장: 다음 주 전략 — 상승이면 유지법, 하락이면 회복법`;

const TEMPLATE_DEEP_ANALYSIS = `## ★ summary 작성법: 심층 패턴 분석
1문장: 행동 유형 진단 — 데이터에서 보이는 사용자 유형
2문장: 교차 분석 — 요일×카테고리, 시간대×완료율 등 복합 인사이트
3문장: 습관 정착 단계 — 완벽한 날 비율과 스트릭으로 현재 위치 진단
4문장: 맞춤 전략 — 다음 단계로 가기 위한 구체적 행동`;
