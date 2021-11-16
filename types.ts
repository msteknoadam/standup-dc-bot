export interface ConfigType {
	DISCORD_TOKEN: string;
	commandPrefix: string;
	reportServers: { [serverId: string]: string }; // { server1Id: reportChannel1Id, server2Id: reportChannel2-1Id, server2Id: reportChannel2-2Id }
	standupServers: { [serverId: string]: string }; // { server1Id: standupChannel1Id, server2Id: standupChannel2-1Id, server2Id: standupChannel2-2Id }
	developerUserId: string;
	firstMeetingDay: string; // YYYY-MM-DD
	// UTC
	meetingTime: {
		hour: number;
		minute: number;
	};
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

export enum notesCommands {
	"help" = "help",
	"add" = "add",
	"new" = "new", // alias for add
	"write" = "write", // alias for add
	"get" = "get",
	"list" = "list", // alias for get
	"delete" = "delete",
	"remove" = "remove" // alias for delete
}

export interface OngoingChats {
	[userId: string]: { currentStatus: userChatStatuses; yesterday: string[]; today: string[]; blocks: string[] };
}
