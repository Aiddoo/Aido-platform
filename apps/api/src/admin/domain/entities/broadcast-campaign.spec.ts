/**
 * BroadcastCampaign 도메인 단위 테스트
 *
 * 프레임워크 없이 순수 도메인 불변식과 메시지 조립을 검증한다.
 */
import { BroadcastCampaign } from "./broadcast-campaign";

describe("BroadcastCampaign — 브로드캐스트 캠페인", () => {
	describe("create — 불변식", () => {
		it("제목/본문이 유효하면 캠페인을 생성한다", () => {
			const campaign = BroadcastCampaign.create({
				title: "공지",
				body: "점검 안내",
				targetFilter: "ALL",
			});
			expect(campaign.targetFilter).toBe("ALL");
		});

		it("제목이 공백뿐이면 SYS_0002로 거부한다", () => {
			expect(() =>
				BroadcastCampaign.create({
					title: "   ",
					body: "본문",
					targetFilter: "ALL",
				}),
			).toThrow(expect.objectContaining({ errorCode: "SYS_0002" }));
		});

		it("본문이 비어 있으면 SYS_0002로 거부한다", () => {
			expect(() =>
				BroadcastCampaign.create({
					title: "제목",
					body: "",
					targetFilter: "WITH_PUSH_TOKEN",
				}),
			).toThrow(expect.objectContaining({ errorCode: "SYS_0002" }));
		});
	});

	describe("toMessages — 메시지 조립", () => {
		it("사용자 ID마다 지정 타입의 메시지를 만든다", () => {
			const campaign = BroadcastCampaign.create({
				title: "제목",
				body: "본문",
				targetFilter: "ALL",
			});

			const messages = campaign.toMessages(["u1", "u2"], "ADMIN_BROADCAST");

			expect(messages).toHaveLength(2);
			expect(messages[0]).toMatchObject({
				userId: "u1",
				type: "ADMIN_BROADCAST",
				title: "제목",
				body: "본문",
			});
			expect(messages[0]?.metadata).toBeUndefined();
		});

		it("외부 URL 액션이 있으면 externalUrl 메타데이터를 부여한다", () => {
			const campaign = BroadcastCampaign.create({
				title: "제목",
				body: "본문",
				targetFilter: "ALL",
				action: { type: "BROWSER", url: "https://aido.kr/event" },
			});

			const messages = campaign.toMessages(["u1"], "ADMIN_TARGETED");

			expect(messages[0]).toMatchObject({
				type: "ADMIN_TARGETED",
				metadata: { externalUrl: "https://aido.kr/event" },
			});
		});

		it("제목/본문의 앞뒤 공백은 정규화된다", () => {
			const campaign = BroadcastCampaign.create({
				title: "  제목  ",
				body: "  본문  ",
				targetFilter: "ALL",
			});

			const messages = campaign.toMessages(["u1"], "ADMIN_BROADCAST");

			expect(messages[0]).toMatchObject({ title: "제목", body: "본문" });
		});
	});
});
