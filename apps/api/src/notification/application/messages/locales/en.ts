import type {
	NotificationCopy,
	NotificationCopyFactory,
	RetentionNotificationCopyCatalog,
	SchedulerNotificationCopyCatalog,
	SocialNotificationCopyCatalog,
	SystemNotificationCopyCatalog,
	WeatherFallbackCopyCatalog,
	WeatherNotificationCopyCatalog,
} from "../notification-copy.types.js";

export const SOCIAL_SENDER_FALLBACK = "A friend";

const staticCopy =
	(title: string, body: string): NotificationCopyFactory<undefined> =>
	() => ({
		title,
		body,
	});

const copy = (title: string, body: string): NotificationCopy => ({ title, body });

const REPLY_LABEL = {
	STARTING: "I’ll get started",
	THANKFUL: "Thanks for cheering me on",
	LATER: "I’ll do it later",
};

export const SCHEDULER_TEMPLATES = {
	TODO_REMINDER_60MIN: {
		variants: [
			({ todoTitle }) => copy("One hour to go ⏰", `Get ready for “${todoTitle}”`),
			({ todoTitle }) => copy("A little time to prepare", `“${todoTitle}” is in one hour`),
			({ todoTitle }) => copy("Your next plan is coming", `One hour until “${todoTitle}”`),
		],
	},
	TODO_REMINDER_10MIN: {
		variants: [
			({ todoTitle }) => copy("Ten minutes left ⏰", `“${todoTitle}” starts soon`),
			({ todoTitle }) => copy("A quick reminder", `Ten minutes to “${todoTitle}”`),
			({ todoTitle }) => copy("Nearly time to start", `Get set for “${todoTitle}”`),
		],
	},
	TODO_REMINDER_IMMEDIATE: {
		variants: [
			({ todoTitle }) => copy("Time for your to-do 🐾", `Let’s start “${todoTitle}”`),
			({ todoTitle }) => copy("Your reminder is here", `It’s time for “${todoTitle}”`),
			({ todoTitle }) => copy("One small start", `Begin with “${todoTitle}”`),
		],
	},
	MORNING_REMINDER: {
		variants: [
			({ count }) => copy(`${count} to-dos today ☀️`, "Start with one easy task"),
			({ count }) => copy(`Morning! ${count} plans ready`, "Choose what matters today"),
			({ count }) => copy(`Your ${count} to-dos are ready`, "Take a look and pick your first"),
			({ count }) => copy(`${count} plans, at your pace`, "The cat will walk with you 🐾"),
			({ count }) => copy("A small start for today", `Pick one of your ${count} to-dos`),
		],
	},
	EVENING_COMPLETE: {
		variants: [
			staticCopy("All done for today 🎉", "You’ve earned a quiet evening"),
			staticCopy("You did it today", "Every to-do has its checkmark"),
			staticCopy("Every box is checked", "A happy finish with your cat 🐾"),
			staticCopy("Your plans are complete", "Take a look at what you finished"),
			staticCopy("A day well spent", "Your finished tasks tell the story"),
		],
	},
	EVENING_PARTIAL: {
		variants: [
			({ remaining }) => copy(`${remaining} to-dos left today`, "Try one more if you have time"),
			({ remaining }) => copy(`${remaining} still in progress`, "Remember what you did finish"),
			({ remaining }) => copy(`${remaining} plans to go`, "One small task is a fine next step 🐾"),
			({ remaining }) => copy(`${remaining} on today’s list`, "Finish what fits your evening"),
		],
	},
	EVENING_NONE: {
		variants: [
			staticCopy("A quiet day so far 🌙", "Try one small task if it fits"),
			staticCopy("There’s still room to start", "Choose your easiest to-do"),
			staticCopy("One small task tonight?", "Take a look at today’s list"),
			staticCopy("Go at your own pace", "It’s okay to need a rest day"),
		],
	},
	MORNING_NO_TODO: {
		variants: [
			staticCopy("One plan for today? ☀️", "Start with a small thing on your mind"),
			staticCopy("Keep a small plan handy", "Write one thing you want to do"),
			staticCopy("What’s your first to-do?", "Make a little plan with your cat 🐾"),
		],
	},
	EVENING_STREAK: {
		variants: [
			({ streak, next }) => copy(`${streak} all-clear days 🔥`, `Tomorrow could make it ${next}`),
			({ streak, next }) =>
				copy(`${streak} days of steady steps`, `Your next step could be day ${next}`),
			({ streak }) => copy(`${streak} days recorded`, "Another day of paw prints 🐾"),
		],
	},
	EVENING_STREAK_7: {
		copy: staticCopy("Seven all-clear days 🎉", "You kept going for a whole week"),
	},
	EVENING_STREAK_14: {
		copy: staticCopy("Two weeks, all clear 🏆", "Fourteen days of steady progress"),
	},
	EVENING_STREAK_30: {
		copy: ({ streak }) => copy(`${streak} all-clear days 🐾`, "Look back at a month of progress"),
	},
	EVENING_STREAK_RISK_PARTIAL: {
		variants: [
			({ streak, remaining }) =>
				copy(`${streak}-day streak, ${remaining} left`, "Keep going one task at a time"),
			({ remaining, streak }) =>
				copy(`${remaining} left to keep your streak`, `Take your time after ${streak} days 🔥`),
			({ remaining }) => copy(`${remaining} left for today`, "Pick a small task that fits"),
		],
	},
	EVENING_STREAK_RISK_NONE: {
		variants: [
			({ streak }) =>
				copy(`Continue your ${streak}-day streak?`, "Finish one to-do to keep it going"),
			({ streak }) => copy("One step for today", `Add to your ${streak}-day streak 🐾`),
			({ streak }) =>
				copy(`You’ve kept going for ${streak} days`, "Start with something you can do"),
		],
	},
	LUNCH_NUDGE: {
		variants: [
			staticCopy("A small start after lunch?", "Pick a task that takes five minutes"),
			staticCopy("Your first afternoon check", "Choose an easy task from your list"),
			staticCopy("A quick look at your list? 🐾", "One doable task is enough"),
			staticCopy("Start small today", "Finish one task and find your rhythm"),
		],
	},
	STREAK_AT_RISK: {
		variants: [
			({ streak }) => copy(`Keep your ${streak}-day streak 🔥`, "One finished task keeps it going"),
			({ streak }) => copy("One more small step today?", `Check your ${streak}-day streak`),
			({ streak }) => copy(`${streak} days of steady progress`, "Choose one doable task for today"),
		],
	},
} satisfies SchedulerNotificationCopyCatalog;

export const WEATHER_TEMPLATES = {
	MORNING_CLEAR: {
		variants: [
			({ skyLabel, tempMin, tempMax }) =>
				copy(`Today: ${skyLabel} ☀️`, `${tempMin}–${tempMax}°C. Plan your time outside`),
			({ tempMin, tempMax, skyLabel }) =>
				copy(`${tempMin}–${tempMax}°C today`, `${skyLabel}. Dress for your plans`),
		],
	},
	MORNING_RAIN: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(`${precipProb}% chance of rain ☔`, `${tempMin}–${tempMax}°C. Take an umbrella`),
			({ precipProb, tempMin, tempMax }) =>
				copy("Rain in today’s forecast", `${precipProb}% chance, ${tempMin}–${tempMax}°C`),
		],
	},
	MORNING_SNOW: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(`${precipProb}% chance of snow ❄️`, `${tempMin}–${tempMax}°C. Wrap up warm`),
			({ precipProb, tempMin, tempMax }) =>
				copy("Snow in today’s forecast", `${precipProb}% chance, ${tempMin}–${tempMax}°C`),
		],
	},
	EVENING_CLEAR: {
		variants: [
			({ skyLabel, tempMin, tempMax }) =>
				copy(`Tomorrow: ${skyLabel} 🌙`, `${tempMin}–${tempMax}°C. Get ready for tomorrow`),
			({ tempMin, tempMax, skyLabel }) =>
				copy(`${tempMin}–${tempMax}°C tomorrow`, `${skyLabel}. Check before heading out`),
		],
	},
	EVENING_RAIN: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(`${precipProb}% rain tomorrow ☔`, `${tempMin}–${tempMax}°C. Have an umbrella ready`),
			({ precipProb, tempMin, tempMax }) =>
				copy("Rain forecast for tomorrow", `${precipProb}% chance, ${tempMin}–${tempMax}°C`),
		],
	},
	EVENING_SNOW: {
		variants: [
			({ precipProb, tempMin, tempMax }) =>
				copy(`${precipProb}% snow tomorrow ❄️`, `${tempMin}–${tempMax}°C. Allow extra travel time`),
			({ precipProb, tempMin, tempMax }) =>
				copy("Snow forecast for tomorrow", `${precipProb}% chance, ${tempMin}–${tempMax}°C`),
		],
	},
} satisfies WeatherNotificationCopyCatalog;

export const SOCIAL_TEMPLATES = {
	NUDGE_REPLIED: {
		copy: ({ senderName, todoTitle, replyKind }) =>
			copy(`${senderName} replied to your nudge`, `“${todoTitle}” · “${REPLY_LABEL[replyKind]}”`),
	},
	NUDGE_THANKED: {
		copy: ({ senderName, todoTitle }) =>
			copy(
				`A thank-you from ${senderName} 🐾`,
				`“${todoTitle}” is done. Thanks for cheering them on!`,
			),
	},
	FOLLOW_NEW: {
		variants: [
			({ senderName }) =>
				copy(`A friend request from ${senderName}`, "Accept to cheer each other on"),
			({ senderName }) =>
				copy(`${senderName} wants to be friends`, "Share your plans and cheer each other on 🐾"),
			({ senderName }) => copy("A new friend request", `Meet ${senderName} in Aido`),
		],
	},
	FOLLOW_ACCEPTED: {
		variants: [
			({ senderName }) =>
				copy(`${senderName} accepted your request`, "You can cheer each other on now"),
			({ senderName }) =>
				copy(`You’re friends with ${senderName} 🎉`, "A little support for each other’s day"),
			({ senderName }) => copy("One more friend in Aido", `Say hello to ${senderName} 🐾`),
		],
	},
	NUDGE_RECEIVED: {
		variants: [
			({ senderName, todoTitle }) =>
				copy(
					`A nudge from ${senderName} 🐾`,
					todoTitle
						? `They’re cheering you on for “${todoTitle}”`
						: "They’re cheering you on today",
				),
			({ senderName, todoTitle }) =>
				copy(
					`${senderName} is cheering you on`,
					todoTitle ? `Ready to start “${todoTitle}”?` : "Pick one thing you can do now",
				),
			({ todoTitle, senderName }) =>
				copy(
					"A little encouragement from a friend",
					todoTitle
						? `${senderName} nudged “${todoTitle}”`
						: `${senderName} is cheering you on today`,
				),
		],
	},
	NUDGE_RECEIVED_WITH_MESSAGE: {
		copy: ({ senderName, todoTitle, message }) =>
			copy(
				`${senderName} sent a nudge and a note`,
				todoTitle ? `“${todoTitle}” · ${message}` : message,
			),
	},
	REMIND_NUDGE_RECEIVED: {
		variants: [
			({ senderName }) =>
				copy(`${senderName} is cheering you on today`, "Start with one small to-do 🐾"),
			({ senderName }) =>
				copy(`A nudge from ${senderName}`, "Start with a small thing on your mind"),
			({ senderName }) =>
				copy("A friend is cheering you on", `${senderName} sent a little check-in`),
		],
	},
	REMIND_NUDGE_RECEIVED_WITH_MESSAGE: {
		copy: ({ senderName, message }) => copy(`A nudge and note from ${senderName}`, message),
	},
	CHEER_RECEIVED: {
		copy: ({ senderName, message }) => copy(`A cheer from ${senderName}`, message),
	},
	CHEER_RECEIVED_NO_MESSAGE: {
		variants: [
			({ senderName }) => copy(`${senderName} sent a cheer 🐾`, "Keep going at your own pace"),
			({ senderName }) =>
				copy(`A little cheer from ${senderName}`, "A little support for your day"),
			({ senderName }) => copy("A friend is cheering you on", `${senderName} is rooting for you`),
		],
	},
	FRIEND_COMPLETED: {
		variants: [
			({ friendName }) =>
				copy(`${friendName} finished today’s plans ✨`, "Every to-do is checked off"),
			({ friendName }) =>
				copy(`All done today for ${friendName}`, "Send a little cheer to your friend"),
			({ friendName }) => copy("Your friend’s day is all clear", `Cheer for ${friendName} 🐾`),
		],
	},
	SOCIAL_DIGEST_MULTI: {
		variants: [
			({ completedFriendCount }) =>
				copy(`${completedFriendCount} friends finished today ✨`, "Send them a little cheer"),
			({ completedFriendCount }) =>
				copy(`${completedFriendCount} friends, all clear`, "Take a moment to say well done"),
			({ completedFriendCount }) =>
				copy(
					`${completedFriendCount} friends completed their plans`,
					"See their progress together 🐾",
				),
		],
	},
	SOCIAL_DIGEST_SINGLE: {
		variants: [
			({ friendName }) => copy(`${friendName} is all done today ✨`, "Send a little cheer"),
			({ friendName }) => copy(`A completed day for ${friendName}`, "A kind word goes a long way"),
			({ friendName }) => copy("Your friend finished today’s plans", `Cheer for ${friendName} 🐾`),
		],
	},
	NUDGE_SUGGEST: {
		variants: [
			({ friendName }) => copy(`Check in with ${friendName}?`, "Send a gentle nudge 🐾"),
			({ friendName }) =>
				copy("A little cheer for your friend", `Say hello to ${friendName} with a nudge`),
			({ friendName }) =>
				copy("A little company for today?", `Take a look at ${friendName}’s plans`),
		],
	},
	TODO_COMMENT: {
		variants: [
			({ senderName }) =>
				copy(`${senderName} left a comment`, "There’s a new comment on your to-do"),
			({ senderName }) =>
				copy(`A new comment from ${senderName}`, "Read the conversation in Aido 🐾"),
			({ senderName }) => copy("Your to-do has a new comment", `Read what ${senderName} shared`),
		],
	},
	TODO_COMMENT_CHAIN: {
		variants: [
			({ count, senderName }) =>
				copy(`${count} comments from ${senderName}`, "Read the new comments in Aido"),
			({ senderName, count }) =>
				copy(`${senderName} added ${count} comments`, "Your to-do’s conversation continues 🐾"),
			({ count, senderName }) =>
				copy(`${count} new comments to read`, `See what ${senderName} shared`),
		],
	},
	TODO_COMMENT_REPLY: {
		variants: [
			({ senderName }) =>
				copy(`${senderName} replied to your comment`, "There’s a new reply to read"),
			({ senderName }) =>
				copy(`A reply from ${senderName}`, "Continue the conversation in Aido 🐾"),
			({ senderName }) => copy("Your comment has a new reply", `Read what ${senderName} added`),
		],
	},
	TODO_COMMENT_REPLY_CHAIN: {
		variants: [
			({ count, senderName }) =>
				copy(`${count} replies from ${senderName}`, "See the conversation in Aido"),
			({ senderName, count }) =>
				copy(`${senderName} added ${count} replies`, "Catch up on the new replies 🐾"),
			({ count, senderName }) =>
				copy(`${count} new replies to read`, `${senderName} continued the conversation`),
		],
	},
	TODO_COMMENT_LIKE: {
		variants: [
			({ senderName }) =>
				copy(`${senderName} liked your comment`, "A little heart for your words ❤️"),
			({ senderName }) =>
				copy(`${senderName} liked what you shared`, "A little support for your comment"),
			({ senderName }) => copy("Someone liked your comment", `${senderName} left a heart`),
		],
	},
} satisfies SocialNotificationCopyCatalog;

export const SYSTEM_TEMPLATES = {
	WINBACK_DAY3: {
		variants: [
			staticCopy("Ready to ease back in?", "Write one small thing you need today"),
			staticCopy("Your progress is still here", "Start with one task that fits"),
			staticCopy("One step with your cat? 🐾", "Choose your first to-do for today"),
		],
	},
	WINBACK_DAY7: {
		variants: [
			staticCopy("A fresh week to start", "Write one thing you need this week"),
			staticCopy("Begin again at your pace", "One small plan is enough"),
			staticCopy("Your plans are here for you 🐾", "Write down what’s on your mind"),
		],
	},
	WINBACK_DAY14: {
		variants: [
			staticCopy("Ready for a fresh plan?", "Begin with what you need today"),
			staticCopy("A restart is a good start", "One small to-do is enough"),
			staticCopy("Plan today with your cat 🐾", "Choose what fits your day now"),
		],
	},
	WINBACK_DAY21: {
		variants: [
			staticCopy("Take your time getting started", "Write one task you can do now"),
			staticCopy("Room for a new plan", "Start with what you need today"),
			staticCopy("Ready when you are 🐾", "Make one small plan with your cat"),
		],
	},
	WINBACK_DAY30: {
		variants: [
			staticCopy("A fresh plan for today?", "Choose what matters to you now"),
			staticCopy("A familiar place to begin", "Write one to-do and take your time"),
			staticCopy("A fresh start with your cat 🐾", "Plan only what fits today"),
		],
	},
	WEEKLY_ACHIEVEMENT: {
		variants: [
			({ completedCount }) =>
				copy(`${completedCount} finished this week 🐾`, "Look back at your progress"),
			({ completedCount }) =>
				copy(`${completedCount} to-dos done this week`, "Your week, all in one place"),
			({ completedCount }) =>
				copy(`${completedCount} little achievements`, "See the small wins from your week"),
		],
	},
	WEEKLY_ACHIEVEMENT_PERFECT: {
		variants: [
			staticCopy("100% complete this week 🏆", "You finished every planned to-do"),
			staticCopy("Every plan is done this week", "Look back at your steady progress"),
			staticCopy("An all-clear week", "A week to remember with your cat 🐾"),
		],
	},
	WEEKLY_ACHIEVEMENT_ALMOST: {
		variants: [
			({ rate }) => copy(`${rate}% complete this week`, "Look back at what you finished"),
			({ rate }) => copy(`You completed ${rate}% of your plans`, "Your paw prints for the week 🐾"),
			({ rate }) => copy(`Your week: ${rate}% complete`, "Start with the things you did well"),
		],
	},
	WEEKLY_REPORT: {
		copy: staticCopy("Your weekly recap is ready 📊", "See your completions and patterns"),
	},
	MONTHLY_REPORT: {
		copy: staticCopy("Your monthly recap is ready 📈", "See the progress you made this month"),
	},
	AI_SUGGESTION: {
		copy: staticCopy("A routine we noticed ✨", "Make a repeating to-do to save time"),
	},
	BILLING_ISSUE: {
		copy: staticCopy("Check your payment details", "Update payment to keep your plan active."),
	},
	ONBOARDING_DAY0: {
		copy: staticCopy("Let’s make your first to-do 🌱", "One small thing is enough to start"),
	},
	ONBOARDING_DAY1: {
		copy: staticCopy("A small plan for today", "Write it down and take one step 🐾"),
	},
	ONBOARDING_DAY2: {
		copy: staticCopy("Share your day with a friend?", "See each other’s plans and send cheers"),
	},
	ONBOARDING_DAY3: {
		copy: staticCopy("A reminder when you need it ⏰", "Set the times that work for you"),
	},
	ONBOARDING_DAY5: {
		copy: ({ completedCount }) =>
			copy(`${completedCount} to-dos finished`, "Your small steps are adding up 🐾"),
	},
	ONBOARDING_DAY7: {
		copy: ({ completedCount }) =>
			copy("Your first week in Aido 🎉", `Look back at ${completedCount} finished to-dos`),
	},
	MILESTONE_FIRST_COMPLETE: {
		copy: staticCopy("Your first to-do is done ✨", "Your first little win, saved"),
	},
	MILESTONE_10: {
		copy: staticCopy("Ten to-dos completed", "Your small wins are adding up 🐾"),
	},
	MILESTONE_50: {
		copy: staticCopy("Fifty to-dos completed 🎉", "A little progress, time after time"),
	},
	MILESTONE_100: {
		copy: staticCopy("One hundred to-dos done 🏆", "One task at a time brought you here"),
	},
	MILESTONE_STREAK_3: {
		copy: staticCopy("Three days in a row 🔥", "Another day, another small step"),
	},
	MILESTONE_FIRST_FRIEND: {
		copy: staticCopy("Your first friend in Aido 🐾", "Share a little support for your days"),
	},
} satisfies SystemNotificationCopyCatalog;

export const SKY_LABEL_MAP = { CLEAR: "Clear", PARTLY_CLOUDY: "Partly cloudy", CLOUDY: "Cloudy" };

export const WEATHER_FALLBACK = {
	MORNING: {
		copy: staticCopy("Add weather to your plans? ☀️", "Set a location in Korea for forecasts"),
	},
	EVENING: {
		copy: staticCopy("Plan with tomorrow’s weather 🌙", "Choose a location in Korea for forecasts"),
	},
} satisfies WeatherFallbackCopyCatalog;

export const RETENTION_TEMPLATES = {
	"D0:d0_no_todo": {
		variants: [
			staticCopy("Start with one small to-do 🌱", "Write down what’s on your mind"),
			staticCopy("A first plan with your cat?", "Write one thing to remember 🐾"),
			staticCopy("Create your first to-do", "One doable thing is enough"),
		],
	},
	"D1:d1_no_todo": {
		variants: [
			staticCopy("What’s one plan for today?", "Write one thing you want to do"),
			staticCopy("There’s room to make a plan", "Start with one thing on your mind 🐾"),
			staticCopy("Keep one small plan handy", "Begin with something that fits today"),
		],
	},
	"D1:d1_has_todo_no_completion": {
		variants: [
			staticCopy("Ready for your first check? ✅", "Pick your easiest to-do"),
			staticCopy("Start with a plan you wrote", "A five-minute task is a good first step"),
			staticCopy("A first check with your cat 🐾", "Start with one doable task"),
		],
	},
	"D3:d3_restart": {
		variants: [
			staticCopy("A fresh start for today 🌱", "Write one thing you need now"),
			staticCopy("Keep today’s plan simple", "Restart with one small task"),
			staticCopy("Another step with your cat 🐾", "Start with what fits today"),
		],
	},
	"D7:d7_has_progress": {
		variants: [
			staticCopy("Look back at your first week 🎉", "Your finished to-dos are all here"),
			staticCopy("Small wins made up your week", "See the paw prints you left 🐾"),
			staticCopy("See your first week’s rhythm", "Use your progress to plan what’s next"),
		],
	},
	"D7:d7_restart": {
		variants: [
			staticCopy("A new week, a small plan", "Write one thing you can do now"),
			staticCopy("It’s okay to begin again", "One useful to-do is enough to restart"),
			staticCopy("A new week with your cat? 🐾", "Choose one easy to-do to begin"),
		],
	},
} satisfies RetentionNotificationCopyCatalog;
