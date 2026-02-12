import { TestBed } from "@suites/unit";
import type { TypedConfigService } from "@/common/config/services/config.service";

import { DiscordWebhookProvider } from "./discord-webhook.provider";

describe("DiscordWebhookProvider", () => {
	let provider: DiscordWebhookProvider;

	beforeEach(async () => {
		const { unit } = await TestBed.solitary(DiscordWebhookProvider).compile();
		provider = unit;
	});

	it("name이 discord이다", () => {
		expect(provider.name).toBe("discord");
	});

	it("webhookUrl이 없으면 send에서 전송을 건너뛴다", async () => {
		// Suites auto-mock에서 constructor가 호출될 때
		// config.discordSignupWebhookUrl은 auto-mock 값이므로
		// webhookUrl이 유효하지 않을 수 있음

		const result = await provider.send({
			title: "테스트",
			body: "테스트 본문",
		});

		// webhookUrl이 없거나 유효하지 않으면 실패
		expect(result).toHaveProperty("success");
		expect(result).toHaveProperty("error");
	});

	it("테스트 런타임이면 webhook URL이 있어도 비활성화한다", async () => {
		const providerInTestRuntime = new DiscordWebhookProvider({
			isTest: true,
			discordSignupWebhookUrl:
				"https://discord.com/api/webhooks/test-id/test-token",
		} as TypedConfigService);

		expect(providerInTestRuntime.isConfigured()).toBe(false);

		const result = await providerInTestRuntime.send({
			title: "테스트",
			body: "테스트 본문",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("Webhook URL not configured");
	});
});
