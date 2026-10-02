import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import * as db from "./database.js";

const serverSource = readFileSync(new URL("./server.js", import.meta.url), "utf8");
const clientIndex = readFileSync(new URL("../client/src/index.html", import.meta.url), "utf8");
const readme = readFileSync(new URL("../client/src/readme.html", import.meta.url), "utf8");
const settings = JSON.parse(readFileSync(new URL("./settings.json", import.meta.url), "utf8"));

function commandHandler(command) {
	return serverSource.match(
		new RegExp(`"${command}": async function \\(args\\) \\{[\\s\\S]*?\\n\\s*\\},`),
	)?.[0] || "";
}

test("Pope and higher can manage the byoutube blocklist", () => {
	assert.equal(settings.runlevel.pope, 4);
	for (const command of ["blockbyoutube", "unblockbyoutube"]) {
		assert.equal(settings.runlevel[command], 4);
		assert.match(commandHandler(command), /if \(this\.runlevel < 4\) return;/);
		assert.ok(clientIndex.includes(`value="/${command}"`));
	}
	assert.match(commandHandler("blockbyoutube"), /db\.blockByoutubeVideo\(videoId\)/);
	assert.match(commandHandler("unblockbyoutube"), /db\.unblockByoutubeVideo\(videoId\)/);
	assert.match(readme, /\/blockbyoutube \[video ID\].*Pope\+/);
	assert.match(readme, /\/unblockbyoutube \[video ID\].*Pope\+/);
});

test("blocked byoutube IDs play the configured replacement without continuing a playlist", () => {
	const start = serverSource.indexOf('"byoutube": async function (args) {');
	const end = serverSource.indexOf('"blockbyoutube": async function (args) {', start);
	const handler = serverSource.slice(start, end);

	assert.ok(start >= 0 && end > start);
	assert.match(handler, /await db\.isByoutubeVideoBlocked\(blockedVideoId\)/);
assert.match(handler, /Playback was stopped/);
	assert.match(handler, /LEGACY_BLOCKED_BYOUTUBE_IDS\.has\(blockedVideoId\)/);
	assert.match(handler, /vid = BYOUTUBE_BLOCKED_REPLACEMENT_ID;/);
	assert.match(handler, /list = "";/);
	assert.match(serverSource, /BYOUTUBE_BLOCKED_REPLACEMENT_ID = "rDKSQC2lw5o"/);
});

test("byoutube block entries are persistent, idempotent, and removable", async () => {
	const videoId = `T${randomBytes(5).toString("hex")}`;

	try {
		assert.equal(await db.isByoutubeVideoBlocked(videoId), false);
		assert.equal(await db.blockByoutubeVideo(videoId), true);
		assert.equal(await db.isByoutubeVideoBlocked(videoId), true);
		assert.equal(await db.blockByoutubeVideo(videoId), false);
		assert.equal(await db.unblockByoutubeVideo(videoId), true);
		assert.equal(await db.isByoutubeVideoBlocked(videoId), false);
		assert.equal(await db.unblockByoutubeVideo(videoId), false);
	} finally {
		await db.unblockByoutubeVideo(videoId);
	}
});

test("byoutube blocklist rejects malformed video IDs", async () => {
	await assert.rejects(db.blockByoutubeVideo("not-a-video-id"), /11-character ID/);
	await assert.rejects(db.unblockByoutubeVideo(""), /11-character ID/);
});