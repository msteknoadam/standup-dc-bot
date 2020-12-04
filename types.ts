export enum exitTypes {
	"exit" = "exit",
	"SIGINT" = "SIGINT",
	"SIGUSR1" = "SIGUSR1",
	"SIGUSR2" = "SIGUSR2",
	"SIGTERM" = "SIGTERM"
}

export enum userChatStatuses {
	"YESTERDAY" = "yesterday", // User is telling what they did yesterday.
	"TODAY" = "today", // User is telling what they have planned to do.
	"BLOCKS" = "blocks" // User is telling what might block them on their work today.
}

export enum dmCommands {
	"start" = "start",
	"next" = "next",
	"end" = "end"
}
