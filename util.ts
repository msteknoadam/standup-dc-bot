/** Returns time until next monday in ms
 * @param mockMonday If set to true, the function will return 120 seconds instead of time until next monday. Useful while testing on local.
 */
export function getTimeUntilMonday(mockMonday = false): number {
	const monday = new Date();
	monday.setUTCDate(monday.getUTCDate() + ((1 + 7 - monday.getUTCDay()) % 7)); // Set date to monday
	monday.setUTCHours(10); // Set hour to exactly 10AM UTC
	monday.setUTCMinutes(0);
	monday.setUTCSeconds(0);
	monday.setUTCMilliseconds(0);
	return mockMonday ? 120 : monday.getTime() - new Date().getTime();
}
