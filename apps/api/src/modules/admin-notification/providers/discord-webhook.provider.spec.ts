import { DiscordWebhookProvider } from "./discord-webhook.provider";

describe("DiscordWebhookProvider", () => {
	it("name이 discord이다", () => {
		// Given
		const provider = new DiscordWebhookProvider(undefined);

		// When
		const name = provider.name;

		// Then
		expect(name).toBe("discord");
	});

	it("webhookUrl이 없으면 isConfigured가 false이다", () => {
		// Given
		const provider = new DiscordWebhookProvider(undefined);

		// When
		const configured = provider.isConfigured();

		// Then
		expect(configured).toBe(false);
	});

	it("webhookUrl이 있으면 isConfigured가 true이다", () => {
		// Given
		const provider = new DiscordWebhookProvider(
			"https://discord.com/api/webhooks/test-id/test-token",
		);

		// When
		const configured = provider.isConfigured();

		// Then
		expect(configured).toBe(true);
	});

	it("webhookUrl이 없으면 send에서 전송을 건너뛴다", async () => {
		// Given
		const provider = new DiscordWebhookProvider(undefined);

		// When
		const result = await provider.send({
			title: "테스트",
			body: "테스트 본문",
		});

		// Then
		expect(result.success).toBe(false);
		expect(result.error).toContain("Webhook URL not configured");
	});
});
