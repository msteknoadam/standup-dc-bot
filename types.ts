export interface ConfigType {
	DISCORD_TOKEN: string;
	commandPrefix: string;
	reportServers: { [serverId: string]: string }; // { server1Id: reportChannel1Id, server2Id: reportChannel2-1Id, server2Id: reportChannel2-2Id }
	standupServers: { [serverId: string]: string }; // { server1Id: standupChannel1Id, server2Id: standupChannel2-1Id, server2Id: standupChannel2-2Id }
	developerUserId: string;
}

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
	"end" = "end",
	"delete" = "delete",
	"cancel" = "cancel",
	"notes" = "notes"
}

export interface OngoingChats {
	[s: string]: { currentStatus: userChatStatuses; yesterday: string[]; today: string[]; blocks: string[] };
}
