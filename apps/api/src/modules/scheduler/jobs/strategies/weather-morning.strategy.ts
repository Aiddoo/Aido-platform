import { Injectable, Logger } from "@nestjs/common";

import { DatabaseService } from "@/database/database.service";
import { NotificationService } from "@/modules/notification/notification.service";
import {
	NotificationMessageBuilder,
	resolveTemplateLocale,
} from "@/modules/notification/templates/notification-templates";
import { createLocaleMessageCache } from "@/modules/notification/templates/user-locale.util";
import { WeatherService } from "@/modules/weather/services/weather.service";

import type {
	ITimezoneStrategy,
	TimezoneContext,
} from "./timezone-reminder-strategy.interface";

interface VerifiedUserWithLocation {
	id: string;
	preference: { locale: string } | null;
	location: {
		latitude: number;
		longitude: number;
		gridX: number;
		gridY: number;
	};
}

@Injectable()
export class WeatherMorningStrategy implements ITimezoneStrategy {
	readonly #logger = new Logger(WeatherMorningStrategy.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		private readonly weatherService: WeatherService,
	) {}

	async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
		const { tz, localHour, localMinute, today } = ctx;

		const preferenceWhere = {
			weatherMorningEnabled: true,
			timezone: tz,
			weatherMorningHour: localHour,
			weatherMorningMinute: localMinute,
		};

		// 1단계: 위치 있는 유저 → 날씨 알림
		const weatherSent = await this.#sendWeatherNotifications(
			ctx,
			preferenceWhere,
			today,
		);

		// 2단계: 위치 없는 유저 → 폴백 알림
		const fallbackSent = await this.#sendFallbackNotifications(
			ctx,
			preferenceWhere,
			today,
		);

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
		preferenceWhere: Record<string, unknown>,
		today: Date,
	): Promise<number> {
		const users = await this.database.user.findMany({
			where: {
				...(ctx.userId ? { id: ctx.userId } : {}),
				status: "ACTIVE",
				deletedAt: null,
				preference: preferenceWhere,
				location: { isNot: null },
			},
			select: {
				id: true,
				preference: { select: { locale: true } },
				location: {
					select: {
						latitude: true,
						longitude: true,
						gridX: true,
						gridY: true,
					},
				},
			},
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
		const forecasts = await this.weatherService.getForecastsByGridBatch(
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
		preferenceWhere: Record<string, unknown>,
		today: Date,
	): Promise<number> {
		const users = await this.database.user.findMany({
			where: {
				...(ctx.userId ? { id: ctx.userId } : {}),
				status: "ACTIVE",
				deletedAt: null,
				preference: preferenceWhere,
				location: null,
			},
			select: { id: true, preference: { select: { locale: true } } },
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
