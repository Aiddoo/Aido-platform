import { z } from "zod/v4";

export const webhookSchema = z.object({
	DISCORD_SIGNUP_WEBHOOK_URL: z
		.string()
		.optional()
		.refine(
			(val) => !val || val.startsWith("https://discord.com/api/webhooks/"),
			{
				message:
					"DISCORD_SIGNUP_WEBHOOK_URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)",
			},
		),
	DISCORD_PAYMENT_WEBHOOK_URL: z
		.string()
		.optional()
		.refine(
			(val) => !val || val.startsWith("https://discord.com/api/webhooks/"),
			{
				message:
					"DISCORD_PAYMENT_WEBHOOK_URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)",
			},
		),
});

export type WebhookConfig = z.infer<typeof webhookSchema>;
