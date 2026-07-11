import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	createLocaleMessageCache,
	NotificationMessageBuilder,
	NotificationService,
	resolveTemplateLocale,
} from "@/notification";
import { WeatherFacade } from "@/weather";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "../../domain/services/timezone-context";
import {
	WEATHER_REMINDER_READER,
	type WeatherReminderReaderPort,
} from "../ports/weather-reminder-reader.port";

interface VerifiedUserWithLocation {
	readonly id: string;
	readonly preference: { readonly locale: string } | null;
	readonly location: {
		readonly latitude: number;
		readonly longitude: number;
		readonly gridX: number;
		readonly gridY: number;
	};
}

@Injectable()
export class WeatherMorningStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(WeatherMorningStrategy.name);

	constructor(
		@Inject(WEATHER_REMINDER_READER)
		private readonly reader: WeatherReminderReaderPort,
		private readonly notificationService: NotificationService,
		private readonly weatherFacade: WeatherFacade,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz, localHour, localMinute, today } = ctx;

		// 1단계: 위치 있는 유저 → 날씨 알림
		const weatherSent = await this.#sendWeatherNotifications(ctx, today);

		// 2단계: 위치 없는 유저 → 폴백 알림
		const fallbackSent = await this.#sendFallbackNotifications(ctx, today);

		const total = weatherSent + fallbackSent;
		if (total > 0) {
			this.#logger.log(
				`Weather morning: tz=${tz}, time=${localHour}:${String(localMinute).padStart(2, "0")}, weather=${weatherSent}, fallback=${fallbackSent}`,
			);
		}
		return { sent: total };
	}

	async #sendWeatherNotifications(
		ctx: TimezoneContext,
		today: Date,
	): Promise<number> {
		const users = await this.reader.findWeatherMorningUsersWithLocation({
			tz: ctx.tz,
			hour: ctx.localHour,
			minute: ctx.localMinute,
			userId: ctx.userId,
		});

		const usersWithLocation = users.filter(
			(u): u is VerifiedUserWithLocation => u.location !== null,
		);
		if (usersWithLocation.length === 0) {
			return 0;
		}

		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: usersWithLocation.map((u) => u.id),
				type: "WEATHER_MORNING",
				notificationDate: today,
			});
		const filtered = usersWithLocation.filter(
			(u) => !alreadyNotified.has(u.id),
		);
		if (filtered.length === 0) {
			return 0;
		}

		const gridGroups = this.#groupByGrid(filtered);
		const gridInputs = [...gridGroups.values()].flatMap((group) => {
			const first = group[0];
			if (!first) {
				return [];
			}
			return [
				{
					gridX: first.location.gridX,
					gridY: first.location.gridY,
					lat: first.location.latitude,
					lon: first.location.longitude,
				},
			];
		});
		const forecasts = await this.weatherFacade.getForecastsByGridBatch(
			gridInputs,
			today,
		);

		const notifications = filtered
			.map((user) => {
				const loc = user.location;
				const key = `${loc.gridX}:${loc.gridY}`;
				const forecast = forecasts.get(key);
				if (!forecast) {
					return null;
				}

				const message = NotificationMessageBuilder.weatherMorning(
					forecast,
					resolveTemplateLocale(user.preference?.locale),
				);
				return {
					userId: user.id,
					type: "WEATHER_MORNING" as const,
					title: message.title,
					body: message.body,
					notificationDate: today,
				};
			})
			.filter((n): n is NonNullable<typeof n> => n !== null);

		if (notifications.length === 0) {
			return 0;
		}

		await this.notificationService.createAndSendBatch(notifications);
		return notifications.length;
	}

	async #sendFallbackNotifications(
		ctx: TimezoneContext,
		today: Date,
	): Promise<number> {
		const users = await this.reader.findWeatherMorningFallbackUsers({
			tz: ctx.tz,
			hour: ctx.localHour,
			minute: ctx.localMinute,
			userId: ctx.userId,
		});

		if (users.length === 0) {
			return 0;
		}

		const alreadyNotified =
			await this.notificationService.findAlreadyNotifiedUserIds({
				userIds: users.map((u) => u.id),
				type: "WEATHER_MORNING",
				notificationDate: today,
			});
		const filtered = users.filter((u) => !alreadyNotified.has(u.id));
		if (filtered.length === 0) {
			return 0;
		}

		const getMessage = createLocaleMessageCache((locale) =>
			NotificationMessageBuilder.weatherMorningFallback(locale),
		);
		const notifications = filtered.map((user) => {
			const message = getMessage(
				resolveTemplateLocale(user.preference?.locale),
			);
			return {
				userId: user.id,
				type: "WEATHER_MORNING" as const,
				title: message.title,
				body: message.body,
				notificationDate: today,
			};
		});

		await this.notificationService.createAndSendBatch(notifications);
		return notifications.length;
	}

	#groupByGrid(
		users: VerifiedUserWithLocation[],
	): Map<string, VerifiedUserWithLocation[]> {
		const groups = new Map<string, VerifiedUserWithLocation[]>();
		for (const user of users) {
			const loc = user.location;
			const key = `${loc.gridX}:${loc.gridY}`;
			const arr = groups.get(key) ?? [];
			arr.push(user);
			groups.set(key, arr);
		}
		return groups;
	}
}
