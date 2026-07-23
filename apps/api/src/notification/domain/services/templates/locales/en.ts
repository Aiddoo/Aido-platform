import type { NotificationType } from "../../../types/notification-type";

import type {
	NotificationTemplate,
	WeatherFallbackTemplates,
} from "../template.types";

// English templates — same keys/variants as ko.ts (parity is unit-tested).
// No josa placeholders ({name:이/가}) — plain {name} substitution only.

export const SCHEDULER_TEMPLATES = {
	TODO_REMINDER: {
		title: "⏰ {todoTitle} starts in 1 hour!",
		body: "Getting it done early feels so much better",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{
				title: "⏰ {todoTitle} starts in 1 hour!",
				body: "Getting it done early feels so much better",
			},
			{ title: "1 hour until {todoTitle} ⏳", body: "Time to warm up?" },
			{
				title: "{todoTitle} is coming up in an hour 👀",
				body: "Start now and finish with time to spare",
			},
		],
	} satisfies NotificationTemplate,
	TODO_REMINDER_60MIN: {
		title: "⏰ {todoTitle} starts in 1 hour!",
		body: "Getting it done early feels so much better",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{
				title: "⏰ {todoTitle} starts in 1 hour!",
				body: "Getting it done early feels so much better",
			},
			{ title: "1 hour until {todoTitle} ⏳", body: "Time to warm up?" },
			{
				title: "{todoTitle} is coming up in an hour 👀",
				body: "Start now and finish with time to spare",
			},
		],
	} satisfies NotificationTemplate,
	TODO_REMINDER_10MIN: {
		title: "⏰ {todoTitle}, 10 minutes to go!",
		body: "Perfect timing — let's do this",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{
				title: "⏰ {todoTitle}, 10 minutes to go!",
				body: "Perfect timing — let's do this",
			},
			{ title: "10 minutes until {todoTitle} 🔥", body: "Ready?" },
			{
				title: "{todoTitle} starts in 10 minutes",
				body: "This is the golden hour ✨",
			},
		],
	} satisfies NotificationTemplate,
	TODO_REMINDER_IMMEDIATE: {
		title: "🚀 {todoTitle} — starting now!",
		body: "Starting is half the battle",
		type: "TODO_REMINDER",
		defaultRoute: "/todos/{todoId}",
		variants: [
			{
				title: "🚀 {todoTitle} — starting now!",
				body: "Starting is half the battle",
			},
			{ title: "It's time for {todoTitle} ⏰", body: "Let's go!" },
			{
				title: "Right now is the moment, {todoTitle} ✨",
				body: "Just 5 minutes — you'll hit your stride",
			},
		],
	} satisfies NotificationTemplate,
	MORNING_REMINDER: {
		title: "☀️ {count} to-dos today",
		body: "Start with the easiest one",
		type: "MORNING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "☀️ {count} to-dos today",
				body: "Start with the easiest one",
			},
			{
				title: "Today's missions: {count} 🎯",
				body: "Finish just one and you're rolling",
			},
			{
				title: "{count} to-dos are waiting for you 👋",
				body: "Knock them out this morning, relax tonight",
			},
			{
				title: "Good morning! {count} on deck today ☀️",
				body: "Grab a coffee and dive in?",
			},
			{
				title: "{count} to-dos just arrived 📬",
				body: "One at a time — you've got this",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_COMPLETE: {
		title: "🎉 All clear!",
		body: "You were amazing today",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
		variants: [
			{ title: "🎉 All clear!", body: "You were amazing today" },
			{
				title: "Everything done for today ✅",
				body: "Days like this add up to a whole new life",
			},
			{
				title: "Wait, you finished everything? 😎",
				body: "Round of applause for today's you",
			},
			{
				title: "Stamped: complete! 🏆",
				body: "Now go rest — you've more than earned it",
			},
			{
				title: "A perfect day ✨",
				body: "May tomorrow's you be just like today's",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_PARTIAL: {
		title: "{remaining} left until all clear 🔥",
		body: "You're so close — finish it here",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "{remaining} left until all clear 🔥",
				body: "You're so close — finish it here",
			},
			{
				title: "Just {remaining} more! 💪",
				body: "Clear them before bed and sleep like a baby",
			},
			{
				title: "Great job today, but {remaining} are still waiting 👀",
				body: "One last push?",
			},
			{
				title: "Only {remaining} to go ✨",
				body: "Finishing first hits different",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_NONE: {
		title: "Still 0 done today 🥲",
		body: "Just do one — that's all it takes",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "Still 0 done today 🥲",
				body: "Just do one — that's all it takes",
			},
			{
				title: "Your to-dos got tired of waiting 😢",
				body: "Complete just one before bed",
			},
			{
				title: "Busy day, huh 💦",
				body: "One small thing is tomorrow's head start",
			},
			{
				title: "Going to bed like this? 🌙",
				body: "How about one quick 5-minute task?",
			},
		],
	} satisfies NotificationTemplate,
	MORNING_NO_TODO: {
		title: "Your to-do list is empty today 📭",
		body: "Writing down just one changes the whole day",
		type: "MORNING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "Your to-do list is empty today 📭",
				body: "Writing down just one changes the whole day",
			},
			{
				title: "A blank slate today 📝",
				body: "Start with what you want to do most?",
			},
			{
				title: "0 to-dos, really? 👀",
				body: "Taking it easy, or putting it off?",
			},
		],
	} satisfies NotificationTemplate,
	// 스트릭 축하 (전체 완료 + 스트릭 2일+)
	EVENING_STREAK: {
		title: "🔥 {streak}-day all-clear streak!",
		body: "Tomorrow makes {next} — don't let this flame die",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
		variants: [
			{
				title: "🔥 {streak}-day all-clear streak!",
				body: "Tomorrow makes {next} — don't let this flame die",
			},
			{
				title: "{streak} days and counting 🏃",
				body: "Let's go grab day {next}",
			},
			{
				title: "{streak} days in a row?! Insane 🔥",
				body: "Keep this momentum going",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_STREAK_7: {
		title: "🎉 7 days straight! A full week all clear",
		body: "Is this real? Seriously impressive",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	EVENING_STREAK_14: {
		title: "🏆 2 weeks straight!",
		body: "At this point it's just a habit",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	EVENING_STREAK_30: {
		title: "👑 Day {streak} — becoming a legend",
		body: "Stopping now would be against the rules",
		type: "EVENING_REMINDER",
		defaultRoute: "/",
	} satisfies NotificationTemplate,
	// 스트릭 위기 (일부 완료 + 스트릭 2일+)
	EVENING_STREAK_RISK_PARTIAL: {
		title: "🚨 Your {streak}-day streak is in danger",
		body: "Finish just {remaining} and it's saved!",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "🚨 Your {streak}-day streak is in danger",
				body: "Finish just {remaining} and it's saved!",
			},
			{
				title: "{streak} days in — losing it now would hurt 😱",
				body: "Only {remaining} left",
			},
			{
				title: "There's still time ⏳",
				body: "Just {remaining} more and the streak is saved!",
			},
		],
	} satisfies NotificationTemplate,
	// 스트릭 위기 (하나도 안 함 + 스트릭 2일+)
	EVENING_STREAK_RISK_NONE: {
		title: "🚨 Your {streak}-day streak can still be saved",
		body: "Finish one and it survives",
		type: "EVENING_REMINDER",
		defaultRoute: "/todos",
		variants: [
			{
				title: "🚨 Your {streak}-day streak can still be saved",
				body: "Finish one and it survives",
			},
			{
				title: "Your {streak}-day flame is about to go out 🕯️",
				body: "One task today and it burns bright again",
			},
			{
				title: "You built up {streak} days 😢",
				body: "Just one keeps the record alive",
			},
		],
	} satisfies NotificationTemplate,
	// 점심 넛지 (12:30, 오늘 완료 0개)
	LUNCH_NUDGE: {
		title: "🍚 Done with lunch? How about one to-do?",
		body: "Afternoons start best with one thing done",
		type: "LUNCH_NUDGE",
		defaultRoute: "/feed",
		variants: [
			{
				title: "🍚 Done with lunch? How about one to-do?",
				body: "Afternoons start best with one thing done",
			},
			{
				title: "Still at 0 👀",
				body: "You paid for lunch — now earn your to-do keep",
			},
			{
				title: "Afternoon, go! 🏃",
				body: "Finish one and the momentum kicks in",
			},
			{
				title: "The cure for a food coma? Checking things off 💊",
				body: "Start with the easiest one",
			},
		],
	} satisfies NotificationTemplate,
	// 스트릭 위기 전용 알림 (20:15, 스트릭 3일+ & 미완료)
	STREAK_AT_RISK: {
		title: "🚨 Your {streak}-day streak comes down to today",
		body: "Finish one and keep the run going",
		type: "STREAK_AT_RISK",
		defaultRoute: "/feed",
		variants: [
			{
				title: "🚨 Your {streak}-day streak comes down to today",
				body: "Finish one and keep the run going",
			},
			{
				title: "{streak} days in — stopping here? 😱",
				body: "Just one!",
			},
			{
				title: "Your {streak}-day flame is flickering 🔥",
				body: "Finish one now and it's saved",
			},
		],
	} satisfies NotificationTemplate,
} as const;

export const WEATHER_TEMPLATES = {
	MORNING_CLEAR: {
		title: "☀️ {skyLabel} today, {tempMin}–{tempMax}°C",
		body: "Perfect weather for crushing your to-dos",
		type: "WEATHER_MORNING" as NotificationType,
		variants: [
			{
				title: "☀️ {skyLabel} today, {tempMin}–{tempMax}°C",
				body: "Perfect weather for crushing your to-dos",
			},
			{
				title: "{skyLabel} today, {tempMin}–{tempMax}°C 🌤️",
				body: "Got outdoor to-dos? Today's your chance!",
			},
		],
	} satisfies NotificationTemplate,
	MORNING_RAIN: {
		title: "☔ Rain expected today, {precipProb}% chance",
		body: "Don't forget your umbrella! {tempMin}–{tempMax}°C",
		type: "WEATHER_MORNING" as NotificationType,
		variants: [
			{
				title: "☔ Rain expected today, {precipProb}% chance",
				body: "Don't forget your umbrella! {tempMin}–{tempMax}°C",
			},
			{
				title: "🌧️ {precipProb}% chance of rain today",
				body: "Great day to knock out indoor to-dos ({tempMin}–{tempMax}°C)",
			},
		],
	} satisfies NotificationTemplate,
	MORNING_SNOW: {
		title: "❄️ Snow expected today, {precipProb}% chance",
		body: "Bundle up before heading out! {tempMin}–{tempMax}°C",
		type: "WEATHER_MORNING" as NotificationType,
		variants: [
			{
				title: "❄️ Snow expected today, {precipProb}% chance",
				body: "Bundle up before heading out! {tempMin}–{tempMax}°C",
			},
			{
				title: "☃️ It might snow today ({precipProb}%)",
				body: "Roads may be slippery — take it slow {tempMin}–{tempMax}°C",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_CLEAR: {
		title: "🌙 Tomorrow: {skyLabel}, {tempMin}–{tempMax}°C",
		body: "Plan tomorrow's to-dos now for an easier morning",
		type: "WEATHER_EVENING" as NotificationType,
		variants: [
			{
				title: "🌙 Tomorrow: {skyLabel}, {tempMin}–{tempMax}°C",
				body: "Plan tomorrow's to-dos now for an easier morning",
			},
			{
				title: "Tomorrow's weather: {skyLabel} {tempMin}–{tempMax}°C ✨",
				body: "Plan now and tomorrow's you will say thanks",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_RAIN: {
		title: "☔ {precipProb}% chance of rain tomorrow",
		body: "Get your umbrella ready! {tempMin}–{tempMax}°C",
		type: "WEATHER_EVENING" as NotificationType,
		variants: [
			{
				title: "☔ {precipProb}% chance of rain tomorrow",
				body: "Get your umbrella ready! {tempMin}–{tempMax}°C",
			},
			{
				title: "🌧️ Rain is coming tomorrow ({precipProb}%)",
				body: "Great day to batch indoor to-dos! {tempMin}–{tempMax}°C",
			},
		],
	} satisfies NotificationTemplate,
	EVENING_SNOW: {
		title: "❄️ {precipProb}% chance of snow tomorrow",
		body: "Dress warm and keep to-dos indoors! {tempMin}–{tempMax}°C",
		type: "WEATHER_EVENING" as NotificationType,
		variants: [
			{
				title: "❄️ {precipProb}% chance of snow tomorrow",
				body: "Dress warm and keep to-dos indoors! {tempMin}–{tempMax}°C",
			},
			{
				title: "☃️ Snow is coming tomorrow ({precipProb}%)",
				body: "Plan ahead and there's nothing to worry about {tempMin}–{tempMax}°C",
			},
		],
	} satisfies NotificationTemplate,
} as const;

export const SOCIAL_TEMPLATES = {
	FOLLOW_NEW: {
		title: "👋 Friend request from {senderName}",
		body: "Accept and you'll see each other's to-dos. Brace yourself",
		type: "FOLLOW_NEW",
		defaultRoute: "/friends/requests",
		variants: [
			{
				title: "👋 Friend request from {senderName}",
				body: "Accept and you'll see each other's to-dos. Brace yourself",
			},
			{
				title: "{senderName} wants to do this together! 🤝",
				body: "Everything's easier with a friend",
			},
			{
				title: "New friend request 💌",
				body: "{senderName} is waiting for you",
			},
		],
	} satisfies NotificationTemplate,
	FOLLOW_ACCEPTED: {
		title: "🎉 {senderName} is now your friend!",
		body: "You can see all of each other's to-dos. Brace yourself",
		type: "FOLLOW_ACCEPTED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "🎉 {senderName} is now your friend!",
				body: "You can see all of each other's to-dos. Brace yourself",
			},
			{
				title: "Connected with {senderName} 🤝",
				body: "From now on, you run together",
			},
			{
				title: "{senderName} accepted! ✅",
				body: "Cheer each other on and go",
			},
		],
	} satisfies NotificationTemplate,
	NUDGE_RECEIVED: {
		title: "👉 {senderName} nudged you about '{todoTitle}'!",
		body: "Still haven't done it? 😏",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "👉 {senderName} nudged you about '{todoTitle}'!",
				body: "Still haven't done it? 😏",
			},
			{
				title: "{senderName} poked you about '{todoTitle}' 👀",
				body: "That means hurry up",
			},
			{
				title: "Poke poke! {senderName} is rushing '{todoTitle}'",
				body: "They're waiting, you know",
			},
		],
	} satisfies NotificationTemplate,
	NUDGE_RECEIVED_WITH_MESSAGE: {
		title: "👉 {senderName} nudged you about '{todoTitle}'!",
		body: "💬 '{message}'",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	REMIND_NUDGE_RECEIVED: {
		title: "👉 {senderName} nudged you!",
		body: "They're saying make some to-dos 😆",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed",
		variants: [
			{
				title: "👉 {senderName} nudged you!",
				body: "They're saying make some to-dos 😆",
			},
			{
				title: "{senderName} is looking for you 👀",
				body: "How about writing down just one thing?",
			},
			{
				title: "Poke! {senderName} checked in on you 💌",
				body: "Jot down one thing you'll do today",
			},
		],
	} satisfies NotificationTemplate,
	REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
		title: "👉 {senderName} nudged you!",
		body: "💬 '{message}'",
		type: "NUDGE_RECEIVED",
		defaultRoute: "/feed",
	} satisfies NotificationTemplate,
	CHEER_RECEIVED: {
		title: "💌 A note from {senderName}",
		body: "{message}",
		type: "CHEER_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
	} satisfies NotificationTemplate,
	CHEER_RECEIVED_NO_MESSAGE: {
		title: "📣 {senderName} sent you a cheer",
		body: "They know you're doing great",
		type: "CHEER_RECEIVED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "📣 {senderName} sent you a cheer",
				body: "They know you're doing great",
			},
			{
				title: "{senderName} is rooting for you 💪",
				body: "Keep going — you've got this today",
			},
			{
				title: "A cheer from {senderName} just landed 💌",
				body: "You can absolutely do this",
			},
		],
	} satisfies NotificationTemplate,
	FRIEND_COMPLETED: {
		title: "✅ {friendName} finished everything today",
		body: "And you? 👀",
		type: "FRIEND_COMPLETED",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "✅ {friendName} finished everything today",
				body: "And you? 👀",
			},
			{
				title: "{friendName} got the all clear! 🎉",
				body: "You can't lose like this",
			},
			{
				title: "{friendName} is already done 🔥",
				body: "Let's go too",
			},
		],
	} satisfies NotificationTemplate,
	// 친구 활동 요약 (Social Digest)
	SOCIAL_DIGEST_MULTI: {
		title: "🔥 {completedFriendCount} friends finished everything today",
		body: "You're the only one left",
		type: "SOCIAL_DIGEST",
		defaultRoute: "/feed",
		variants: [
			{
				title: "🔥 {completedFriendCount} friends finished everything today",
				body: "You're the only one left",
			},
			{
				title: "{completedFriendCount} friends got the all clear! 👀",
				body: "Everyone but me?",
			},
			{
				title: "Your friends are pulling ahead 🏃",
				body: "Starting now isn't too late",
			},
		],
	} satisfies NotificationTemplate,
	SOCIAL_DIGEST_SINGLE: {
		title: "✅ {friendName} finished everything today",
		body: "You can do it too",
		type: "SOCIAL_DIGEST",
		defaultRoute: "/feed",
		variants: [
			{
				title: "✅ {friendName} finished everything today",
				body: "You can do it too",
			},
			{
				title: "{friendName} got the all clear! 🎉",
				body: "Just going to watch?",
			},
			{
				title: "{friendName} is already done 👀",
				body: "Now it's your turn",
			},
		],
	} satisfies NotificationTemplate,
	// 콕 찌르기 유도 (Nudge Suggest)
	NUDGE_SUGGEST: {
		title: "👀 {friendName} has been quiet for {days} days",
		body: "Nudge them awake?",
		type: "NUDGE_SUGGEST",
		defaultRoute: "/feed/friend/{friendId}",
		variants: [
			{
				title: "👀 {friendName} has been quiet for {days} days",
				body: "Nudge them awake?",
			},
			{
				title: "{friendName} hasn't shown up in {days} days 🫥",
				body: "Check in on them",
			},
			{
				title: "{friendName} has gone off the radar 🤿",
				body: "One nudge might bring them back?",
			},
		],
	} satisfies NotificationTemplate,
} as const;

export const SYSTEM_TEMPLATES = {
	// Win-back (비활성 유저 재방문 유도)
	WINBACK_DAY3: {
		title: "👀 Haven't seen you in 3 days, so I came by",
		body: "Your to-dos say they're waiting",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{
				title: "👀 Haven't seen you in 3 days, so I came by",
				body: "Your to-dos say they're waiting",
			},
			{ title: "It's been 3 days!", body: "How about one easy one?" },
			{
				title: "Where'd you go? 🥺",
				body: "Let's do just one together today",
			},
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY7: {
		title: "It's been a week 🥲",
		body: "Just one — that's enough",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "It's been a week 🥲", body: "Just one — that's enough" },
			{
				title: "7 quiet days 👀",
				body: "It's never too late to start again",
			},
			{
				title: "Missed you all week 💌",
				body: "How about creating just one to-do?",
			},
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY14: {
		title: "Two weeks! Good to see you 👋",
		body: "Today is your new Day 1",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{
				title: "Two weeks! Good to see you 👋",
				body: "Today is your new Day 1",
			},
			{
				title: "You almost got forgotten 🥲",
				body: "It's okay to start over",
			},
			{
				title: "That was a long break 🌱",
				body: "You can always come back — like right now",
			},
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY21: {
		title: "Three weeks! 🎈",
		body: "Let's restart with something small",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{ title: "Three weeks! 🎈", body: "Let's restart with something small" },
			{
				title: "I kept waiting 🥺",
				body: "One to-do and you're back in the game",
			},
			{
				title: "About time you came back 😎",
				body: "Today's a perfect day for a fresh start",
			},
		],
	} satisfies NotificationTemplate,
	WINBACK_DAY30: {
		title: "A whole month — missed you 💌",
		body: "You can always start again",
		type: "WINBACK",
		defaultRoute: "/feed",
		variants: [
			{
				title: "A whole month — missed you 💌",
				body: "You can always start again",
			},
			{
				title: "I believed you'd come back 🌱",
				body: "Today is your new Day 1",
			},
			{
				title: "Long time no see! 👋",
				body: "Let's do one, like the first time",
			},
		],
	} satisfies NotificationTemplate,
	// 주간 달성 배지
	WEEKLY_ACHIEVEMENT: {
		title: "📊 {completedCount} cleared this week",
		body: "Consistency is skill",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
		variants: [
			{
				title: "📊 {completedCount} cleared this week",
				body: "Consistency is skill",
			},
			{
				title: "{completedCount} done this week! ✅",
				body: "Bet you can go even further next week",
			},
			{
				title: "You knocked out {completedCount} this week 💪",
				body: "You keep getting better, bit by bit",
			},
		],
	} satisfies NotificationTemplate,
	WEEKLY_ACHIEVEMENT_PERFECT: {
		title: "🏆 100% all clear this week!",
		body: "A perfect week",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
		variants: [
			{ title: "🏆 100% all clear this week!", body: "A perfect week" },
			{
				title: "You finished everything this week 🎉",
				body: "Weeks like this make legends",
			},
			{
				title: "Perfect week achieved ✨",
				body: "Seriously amazing — applause!",
			},
		],
	} satisfies NotificationTemplate,
	WEEKLY_ACHIEVEMENT_ALMOST: {
		title: "{rate}% completion this week 🔥",
		body: "So close! Let's hit 100% next week",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
		variants: [
			{
				title: "{rate}% completion this week 🔥",
				body: "So close! Let's hit 100% next week",
			},
			{
				title: "{rate}% achieved! 💪",
				body: "Almost there — one last piece",
			},
			{
				title: "{rate}% this week! ✨",
				body: "You did great — can't wait for next week",
			},
		],
	} satisfies NotificationTemplate,
	WEEKLY_REPORT: {
		title: "📊 Your weekly report is here!",
		body: "Want to see how this week went?",
		type: "WEEKLY_REPORT",
		defaultRoute: "/reports",
	} satisfies NotificationTemplate,
	MONTHLY_REPORT: {
		title: "📈 Your monthly report is here!",
		body: "See how much you got done this month",
		type: "MONTHLY_REPORT",
		defaultRoute: "/reports",
	} satisfies NotificationTemplate,
	AI_SUGGESTION: {
		title: "✨ Recurring pattern spotted!",
		body: "Tired of creating it every time? I'll automate it",
		type: "AI_SUGGESTION",
		defaultRoute: "/suggestions",
	} satisfies NotificationTemplate,
	SYSTEM_NOTICE: {
		title: "Aido",
		body: "{message}",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	BILLING_ISSUE: {
		title: "💳 There's a problem with your payment",
		body: "Please check your payment method, or your subscription may pause",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	// 온보딩 시퀀스 (신규 유저 7일)
	ONBOARDING_DAY0: {
		title: "🌱 Ready to create your first to-do?",
		body: "One small thing is all it takes",
		type: "SYSTEM_NOTICE",
		defaultRoute: "/create-todo",
	} satisfies NotificationTemplate,
	ONBOARDING_DAY1: {
		title: "That to-do from yesterday — did you try it? ✅",
		body: "One checkmark and you'll feel great",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	ONBOARDING_DAY2: {
		title: "Together beats alone 🤝",
		body: "Add a friend and cheer each other on",
		type: "SYSTEM_NOTICE",
		defaultRoute: "/friends",
	} satisfies NotificationTemplate,
	ONBOARDING_DAY3: {
		title: "⏰ Set your reminder time yet?",
		body: "I'll ping you right on schedule",
		type: "SYSTEM_NOTICE",
		defaultRoute: "/settings",
	} satisfies NotificationTemplate,
	ONBOARDING_DAY5: {
		title: "Already {completedCount} done! 🔥",
		body: "At this pace it'll be a habit in no time",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	ONBOARDING_DAY7: {
		title: "🎉 First week complete!",
		body: "You finished {completedCount}. On to next week",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
	} satisfies NotificationTemplate,
	// 마일스톤 축하
	MILESTONE_FIRST_COMPLETE: {
		title: "🎉 First one done!",
		body: "Starting is half the battle — you're halfway there",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_10: {
		title: "Already 10 done! ✨",
		body: "Consistency is stacking up",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_50: {
		title: "🔥 Passed 50!",
		body: "That's pro level, officially",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_100: {
		title: "👑 100 done!",
		body: "Triple digits — truly amazing",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_STREAK_3: {
		title: "🔥 3 days in a row!",
		body: "This is how habits are born",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/stats",
	} satisfies NotificationTemplate,
	MILESTONE_FIRST_FRIEND: {
		title: "🎉 You made your first friend!",
		body: "Together, you'll do twice as well",
		type: "WEEKLY_ACHIEVEMENT",
		defaultRoute: "/friends",
	} satisfies NotificationTemplate,
} as const;

export const SKY_LABEL_MAP: Record<string, string> = {
	CLEAR: "clear",
	PARTLY_CLOUDY: "partly cloudy",
	CLOUDY: "cloudy",
};

/** 위치 미설정 유저용 날씨 폴백 메시지 */
export const WEATHER_FALLBACK: WeatherFallbackTemplates = {
	MORNING: {
		title: "Curious about today's weather? ☀️",
		body: "Set your location and I'll include the weather every morning",
	},
	EVENING: {
		title: "Want tomorrow's weather in advance? 🌙",
		body: "Set your location and planning tomorrow gets way easier",
	},
};

/**
 * 신규 유저 리텐션(D0/D1/D3/D7) 카피 (en).
 *
 * 키·variant 수·type·route는 ko와 반드시 동일해야 한다(locale-parity.spec).
 */
export const RETENTION_TEMPLATES: Record<string, NotificationTemplate> = {
	"D0:d0_no_todo": {
		title: "Ready for your first task? 🌱",
		body: "Write down one thing on your mind",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
		variants: [
			{
				title: "Ready for your first task? 🌱",
				body: "Write down one thing on your mind",
			},
			{
				title: "Add your first plan ✍️",
				body: "One small task is enough to begin",
			},
			{
				title: "Start with one small thing ☀️",
				body: "Add what matters most today",
			},
		],
	} satisfies NotificationTemplate,
	"D1:d1_no_todo": {
		title: "Pick one task for today 📝",
		body: "A small plan can shape your whole day",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
		variants: [
			{
				title: "Pick one task for today 📝",
				body: "A small plan can shape your whole day",
			},
			{
				title: "What will you start with? ☀️",
				body: "Add the easiest thing on your mind",
			},
			{
				title: "Add the first task to your list 🌱",
				body: "One plan can make today feel clearer",
			},
		],
	} satisfies NotificationTemplate,
	"D1:d1_has_todo_no_completion": {
		title: "Start with one task ✅",
		body: "Choose the easiest one and check it off",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
		variants: [
			{
				title: "Start with one task ✅",
				body: "Choose the easiest one and check it off",
			},
			{
				title: "Ready for your first check? 🌱",
				body: "Start with something that takes five minutes",
			},
			{
				title: "Your first check is waiting 👀",
				body: "Finishing one small thing builds momentum",
			},
		],
	} satisfies NotificationTemplate,
	"D3:d3_restart": {
		title: "You can restart today 🌱",
		body: "Add one thing that matters right now",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
		variants: [
			{
				title: "You can restart today 🌱",
				body: "Add one thing that matters right now",
			},
			{
				title: "Plans can always change ✨",
				body: "Start with what you can do today",
			},
			{
				title: "Build your rhythm again ☀️",
				body: "One easy task is enough to begin",
			},
		],
	} satisfies NotificationTemplate,
	"D7:d7_has_progress": {
		title: "Your first week is taking shape 🎉",
		body: "See the progress you made this week",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
		variants: [
			{
				title: "Your first week is taking shape 🎉",
				body: "See the progress you made this week",
			},
			{
				title: "Your weekly rhythm is visible 📊",
				body: "Review everything you checked off",
			},
			{
				title: "You made it through week one ✨",
				body: "See what you accomplished at a glance",
			},
		],
	} satisfies NotificationTemplate,
	"D7:d7_restart": {
		title: "Restart this week with one thing 🌱",
		body: "Add the task you need most right now",
		type: "SYSTEM_NOTICE",
		defaultRoute: null,
		variants: [
			{
				title: "Restart this week with one thing 🌱",
				body: "Add the task you need most right now",
			},
			{
				title: "Open the week with a small plan ☀️",
				body: "One doable task is enough",
			},
			{
				title: "Today is a good day to restart ✨",
				body: "Begin with a plan that feels light",
			},
		],
	} satisfies NotificationTemplate,
};
