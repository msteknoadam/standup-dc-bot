import * as Discord from "discord.js";
import { dmCommands, exitTypes, notesCommands, OngoingChats, userChatStatuses } from "./types";
import Datastore from "nedb";
import path from "path";
import CONFIG from "./config";
import { dailyStatusChange, getTimeUntilMonday, sendErrorMessage } from "./util";
import { logger } from "./logger";

const notesDB = new Datastore({ filename: path.join(__dirname, "StandupNotes.db"), autoload: true });
const ongoingChats: OngoingChats = {};
const prefix = CONFIG.commandPrefix;

export async function createReportAndSend(userMessage: Discord.Message): Promise<void> {
	userMessage.channel.send("Thanks for your report, I will now send this information to the proper chat.");
	const uid = userMessage.author.id;
	const user = ongoingChats[uid];
	const reportServers = Object.keys(CONFIG.reportServers);
	if (reportServers.length === 0) {
		return sendErrorMessage(userMessage, { cause: "Report servers are not configured", code: 500, silent: true });
	}
	const embedFields: Discord.EmbedField[] = [];
	embedFields.push({ name: "What did I do yesterday?", value: user.yesterday.join("\n"), inline: false });
	embedFields.push({ name: "What will I do today?", value: user.today.join("\n"), inline: false });
	embedFields.push({
		name: "Anything that will block me in my work today?",
		value: user.blocks.join("\n"),
		inline: false
	});
	const embed = new Discord.MessageEmbed({
		author: {
			name: userMessage.author.username,
			iconURL: userMessage.author.avatarURL() || userMessage.author.defaultAvatarURL
		},
		color: Math.floor(Math.random() * 16777215 /** Gets random color each time for each message :) */),
		fields: embedFields
	});
	delete ongoingChats[uid];
	reportServers.forEach(async (serverId) => {
		const reportsServer = bot.guilds.cache.find((guild) => guild.id === serverId);
		if (!reportsServer) {
			delete ongoingChats[uid];
			return sendErrorMessage(userMessage, {
				cause: `Couldn't find the report server '${serverId}'. Maybe you forgot to invite bot to that server? `,
				code: 404,
				silent: true
			});
		}
		const channelId = CONFIG.reportServers[serverId];
		const reportsChat = reportsServer.channels.cache.get(channelId) as Discord.TextChannel | undefined;
		if (!reportsChat) {
			delete ongoingChats[uid];
			return sendErrorMessage(userMessage, {
				cause: `Couldn't find the report channel '${channelId}' inside server '${serverId}'. Make sure you set channelId correctly.`,
				code: 404,
				silent: true
			});
		}
		try {
			await reportsChat.send(embed);
			return;
		} catch (e) {
			logger.error(e);
			return sendErrorMessage(
				userMessage,
				e.message && e.message.includes("Missing Access")
					? {
							cause: `Bot doesn't have access to channel '${channelId}' inside server '${serverId}'.`,
							code: 401,
							silent: true
					  }
					: undefined
			);
		}
	});
}

async function handleDMmessage(message: Discord.Message): Promise<void> {
	let messageContent = message.content;
	const uid = message.author.id;
	const user = ongoingChats[uid];
	const notStartedInfoMessage = `You haven't started a conversation yet, please type \`\`\`${prefix}start\`\`\` first to start reporting your daily status or \`\`\`${prefix}notes help\`\`\` to learn how to use notes.`;
	try {
		if (messageContent.startsWith(prefix)) {
			messageContent = messageContent.slice(prefix.length);
			if (messageContent.startsWith(dmCommands.notes)) {
				message.content = message.content.slice(dmCommands.notes.length + 1); // + 1 for space character
				if (message.content.length === 0) {
					return void message.channel.send(
						`Please specify a notes command. If you don't know how to use notes, please type: \`\`\`${prefix}notes help\`\`\``
					);
				}
				return handleNotes(message);
			} else if (!user && messageContent !== dmCommands.start) {
				await message.channel.send(notStartedInfoMessage);
				return;
			}
			switch (messageContent as dmCommands) {
				case dmCommands.start:
					if (!user) {
						ongoingChats[uid] = {
							currentStatus: userChatStatuses.YESTERDAY,
							yesterday: [],
							today: [],
							blocks: []
						};
						await message.channel.send("What did you do yesterday?");
					} else {
						await message.channel.send(
							`You already have started your conversation. Please either type your next item in the list or type \`\`\`${prefix}end\`\`\` to finish your report.`
						);
					}
					break;
				case dmCommands.next:
					if (user.currentStatus === userChatStatuses.YESTERDAY) {
						if (!user.yesterday)
							await message.channel.send(
								"You cannot leave yesterday's note empty, please type something."
							);
						else {
							user.currentStatus = userChatStatuses.TODAY;
							await message.channel.send("What will you do today?");
						}
					} else if (user.currentStatus === userChatStatuses.TODAY) {
						if (!user.today)
							await message.channel.send("You cannot leave today's note empty, please type something.");
						else {
							user.currentStatus = userChatStatuses.BLOCKS;
							await message.channel.send("Anything that will block you in your work today?");
						}
					} else if (user.currentStatus === userChatStatuses.BLOCKS) {
						if (user.blocks.length === 0) user.blocks = ["- Nothing"];
						await createReportAndSend(message);
					}
					break;
				case dmCommands.end:
					if (user.currentStatus === userChatStatuses.BLOCKS) {
						if (user.blocks.length === 0) user.blocks = ["- Nothing"];
						await createReportAndSend(message);
					} else {
						await message.channel.send(
							`You haven't finished last question. If you have, please type \`\`\`${prefix}next\`\`\` to skip to the next question.`
						);
					}
					break;
				case dmCommands.delete:
					if (user[user.currentStatus].length > 0) {
						const removed = user[user.currentStatus].pop();
						if (!removed) return;
						await message.channel.send(
							dailyStatusChange("deleted", user, removed, {
								delete: true,
								addMore: true,
								next: true,
								cancel: true
							})
						);
					} else {
						await message.channel.send(
							"You haven't added anything to response for your last question. Please type something for your report."
						);
					}
					break;
				case dmCommands.cancel:
					delete ongoingChats[uid];
					await message.channel.send(
						`Successfully cancelled your report. Type \`\`\`${prefix}start\`\`\` if you want to start again.`
					);
					break;
			}
		} else {
			if (!user) {
				await message.channel.send(notStartedInfoMessage);
				return;
			} else {
				const messageSplit = messageContent.split("\n");
				if (messageSplit.length > 1) {
					messageSplit.forEach((line) => {
						const messageCopy = message;
						messageCopy.content = line;
						handleDMmessage(messageCopy);
					});
					return;
				}
				messageContent = `${messageContent[0].toUpperCase()}${messageContent.slice(1)}`;
				messageContent = messageContent.startsWith("-") ? messageContent : `- ${messageContent}`;
				user[user.currentStatus].push(messageContent);

				await message.channel.send(
					dailyStatusChange("recorded", user, messageContent, {
						delete: true,
						addMore: true,
						next: true,
						cancel: true
					})
				);
				return;
			}
		}
	} catch (e) {
		logger.error(e);
		await sendErrorMessage(message);
		return;
	}
}

async function handleNotes(message: Discord.Message): Promise<void> {
	const messageContent = message.content;
	const args = messageContent.slice(1).split(" ");
	const shifted = args.shift();
	if (!shifted) return;
	const cmd = shifted.toLowerCase();

	switch (cmd as notesCommands) {
		case "help": {
			return void message.channel.send(
				`\`\`\`
To add a new note -> ${prefix}notes add Your note here
To list current notes -> ${prefix}notes list
To delete one of the notes (You can see IDs of notes when you use list command) -> ${prefix}notes delete id\`\`\``
			);
		}
		case "add":
		case "new":
		case "write": {
			if (args.join(" ").length === 0) {
				return void message.channel.send(
					`Please type the command in the following format: \`\`\`${prefix}notes add Your note here\`\`\``
				);
			}
			const embedFields = [];
			embedFields.push({ name: "I noted: ", value: args.join(" "), inline: false });
			embedFields.push({ name: "Date ", value: new Date(), inline: false });

			const embedData = {
				author: {
					name: message.author.username,
					iconURL: message.author.avatarURL() || message.author.defaultAvatarURL
				},
				color: Math.floor(Math.random() * 16777215),
				fields: embedFields
			};

			notesDB.insert(embedData, (err) => {
				// Do not insert embed because it includes some other functions etc. which are not needed to be stored in db.
				if (err) {
					logger.error(
						`Error while inserting note. Stringified note: '${JSON.stringify(embedData)}' . Error: `,
						err
					);
					return sendErrorMessage(message);
				}

				return message.channel.send(new Discord.MessageEmbed(embedData));
			});
			break;
		}
		case "get":
		case "list": {
			notesDB
				.find({})
				.sort({ "fields.1.value": 1 })
				.exec((err, currentNotes) => {
					if (err) {
						logger.error("Error while running db.find.sort.exec on 'notes get' command. Error: ", err);
						return sendErrorMessage(message);
					}

					if (currentNotes.length <= 0) return void message.channel.send("There are no saved notes yet.");

					currentNotes.forEach((msg) => {
						const msgClone = { ...msg };
						msgClone.fields = [{ name: "ID", value: msg._id, inline: false }, ...msg.fields];
						message.channel.send(new Discord.MessageEmbed(msgClone));
					});
					return;
				});
			break;
		}
		case "delete":
		case "remove": {
			const index = args[0];
			notesDB.findOne({ _id: index }, (err, messageToRemove) => {
				if (err) {
					logger.error(`Error while finding note to delete. Requested id was '${index}'. Error: `, err);
					return sendErrorMessage(message);
				}

				if (!messageToRemove) return void message.channel.send(`There are no messages with ID ${index}`);

				return notesDB.remove({ _id: index }, {}, (err) => {
					if (err) {
						logger.error(`Error while finding note to delete. Requested id was '${index}'. Error: `, err);
						return sendErrorMessage(message);
					}

					messageToRemove.author = {
						name: `Removed By: ${message.author.username} | Added By: ${
							messageToRemove.author ? messageToRemove.author.name || "Unknown" : "Unknown"
						}`,
						iconURL: message.author.avatarURL() || message.author.defaultAvatarURL
					};
					return void message.channel.send(new Discord.MessageEmbed(messageToRemove));
				});
			});
			break;
		}
		default: {
			return void message.channel.send(
				`Unknown notes command '**${cmd}**'. Please use this command if you don't know how to use notes: \`\`\`${prefix}notes help\`\`\``
			);
		}
	}
}

function sendMondayStandupNotes(): void {
	logger.info("Starting to send standup notes.");
	const standupServers = Object.keys(CONFIG.standupServers);

	notesDB
		.find({})
		.sort({ "fields.1.value": 1 })
		.exec((err, notes) => {
			if (err) {
				logger.error(
					`Error while running db.find.sort.exec on 'sendMondayStandupNotes' function. Error: ${err}`
				);
				setTimeout(sendMondayStandupNotes, 5 * 60 * 1000);
				return;
			}

			new Promise((resolve, reject) => {
				standupServers.forEach(async (serverId, serverIndex) => {
					const standupServer = bot.guilds.cache.find((guild) => guild.id === serverId);
					if (!standupServer) {
						logger.warn(`Couldn't find the StandUp server with id ${serverId}`);
						if (serverIndex === standupServers.length - 1) resolve(null); // It's not a big issue so we can just resolve here if it was the last one.
						return;
					}
					const channelId = CONFIG.standupServers[serverId];
					const standupChat = standupServer.channels.cache.get(channelId) as Discord.TextChannel | undefined;
					if (!standupChat) {
						logger.warn(`Couldn't find the StandUp chat with id ${channelId} inside server ${serverId}`);
						if (serverIndex === standupServers.length - 1) resolve(null); // It's not a big issue so we can just resolve here if it was the last one.
						return;
					}

					standupChat.send(
						`StandUp time <@&${standupServer.roles.everyone.id}>! ${
							notes.length > 0
								? "Now I will send the notes you wanted me to remind."
								: "There are no notes for me to remind."
						}`
					);
					if (notes.length > 0)
						notes.forEach(async (msg, i) => {
							try {
								await standupChat.send(new Discord.MessageEmbed(msg));
							} catch (e) {
								console.error("Error happened while sending standup notes -> ", e);
								logger.error(
									`Error happened while sending standup notes. Msg -> ${JSON.stringify(
										msg
									)} \n\n Error -> ${e}`
								);
								reject(e);
							}
						});

					if (serverIndex === standupServers.length - 1) resolve(null);

					return;
				});
			}).then(
				() => {
					notesDB.remove({}, { multi: true }); // Remove all notes so they are not sent again.
					const timeUntilMonday = getTimeUntilMonday();
					logger.info(
						`Will send StandUp Message in ${(timeUntilMonday / 60 / 1000).toFixed(
							2
						)} minutes. (At ${new Date(new Date().getTime() + timeUntilMonday)})`
					);
					setTimeout(sendMondayStandupNotes, timeUntilMonday);

					logger.info("Note sending job complete.");
				},
				(rejection) => {
					console.error(
						"Error happened while sending standup notes to at least one of the servers. Trying again in 10 minutes. Error -> ",
						rejection
					);
					logger.error(
						`Error happened while sending standup notes to at least one of the servers. Trying again in 10 minutes. Error -> ${rejection}`
					);
					setTimeout(sendMondayStandupNotes, 10 * 60 * 1000);
				}
			);
		});
}

const bot = new Discord.Client();

bot.on("ready", async () => {
	console.log("Bot has successfully logged in.");
	logger.info("Bot has successfully logged in.");
	const timeUntilMonday = getTimeUntilMonday();
	logger.info(
		`Will send StandUp Message in ${(timeUntilMonday / 60 / 1000).toFixed(2)} minutes. (At ${new Date(
			new Date().getTime() + timeUntilMonday
		)})`
	);
	setTimeout(sendMondayStandupNotes, timeUntilMonday);
});

bot.on("reconnecting", async () => {
	logger.error("Bot is currently unavailable, trying to reconnect.");
});

bot.on("disconnect", async () => {
	logger.error("Bot coulnd't reconnect, bot is not totally disconnected.");
});

bot.on("error", async (error) => {
	logger.error(error);
});

bot.on(
	"message",
	async (message): Promise<void> => {
		if (message.author.bot) return;

		if (message.content.startsWith(`${prefix}eval`) && message.author.id === CONFIG.developerUserId) {
			// Dev tool to let developer run commands live.
			try {
				const response = eval(message.content.slice(`${prefix}eval`.length));
				await message.channel.send(`\`\`\`js\n${response}\n\`\`\``);
				return;
			} catch (err) {
				message.channel.send(`There has been an error. Error: \`\`\`js\n${err.message}\n\`\`\``);
				return;
			}
		}

		if (message.channel.type === "dm") return handleDMmessage(message);
		// No need to handle other cases since this bot only checks DM messages and then sends message by itself.
	}
);

bot.login(CONFIG.DISCORD_TOKEN);

// Add graceful exit so bot client doesn't look like it's online when the process is closed.

const gracefulShutdown = (exitType: exitTypes): void => {
	bot.destroy();
	logger.info(`Gracefully shutting down the bot with reason '${exitType}'.`);
	process.exit();
};

Object.keys(exitTypes).forEach((exitType) => {
	process.on(exitType, () => {
		gracefulShutdown(exitType as exitTypes);
	});
	logger.info(`Initialized exit listener for ${exitType}`);
});
