import * as fs from "fs";
import * as path from "path";

const CONFIG = {
	DISCORD_TOKEN: "PUT_YOUR_TOKEN_HERE_OR_CREATE_'config.local.ts'_AND_EDIT_IT_THERE",
	commandPrefix: "!",
	reportServerId:
		"YOU_CAN_GET_THIS_BY_RIGHT_CLICKING_TO_SERVER_YOU_WANT_TO_USE_AFTER_ENABLING_DEVELOPER_MODE_ON_DISCORD",
	reportChannelId:
		"YOU_CAN_GET_THIS_BY_RIGHT_CLICKING_TO_CHAT_YOU_WANT_TO_USE_AFTER_ENABLING_DEVELOPER_MODE_ON_DISCORD",
	developerUserId: "YOU_CAN_GET_THIS_BY_RIGHT_CLICKING_TO_YOURSELF_AFTER_ENABLING_DEVELOPER_MODE_ON_DISCORD"
};

const localConfigPath = path.join(__dirname, "config.local.ts");
if (fs.existsSync(localConfigPath)) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	Object.assign(CONFIG, require(localConfigPath).default);
}

export default CONFIG;
