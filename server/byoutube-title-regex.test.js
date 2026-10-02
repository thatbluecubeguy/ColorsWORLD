import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	fetchYouTubeVideoTitle,
	matchByoutubeTitleRegex,
	normalizeByoutubeTitleRegex,
} from "./byoutubeTitleRegex.js";
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

test("title regex commands require runlevel 7 and are documented", () => {
	for (const command of ["blockbyoutuberegex", "unblockbyoutuberegex"]) {
		assert.equal(settings.runlevel[command], 7);
		assert.match(commandHandler(command), /if \(this\.runlevel < 7\) return;/);
		assert.ok(clientIndex.includes(`value="/${command}"`));
		assert.match(readme, new RegExp(`/${command} \\[NAME\\].*Owner\\+`));
	}
	assert.match(commandHandler("blockbyoutuberegex"), /db\.blockByoutubeTitleRegex\(pattern\)/);
	assert.match(commandHandler("unblockbyoutuberegex"), /db\.unblockByoutubeTitleRegex\(pattern\)/);
});

test("title regex matching is case-insensitive and invalid expressions are rejected", async () => {
	assert.equal(normalizeByoutubeTitleRegex("  prank|scary  "), "prank|scary");
	assert.equal(await matchByoutubeTitleRegex("A Scary Prank Video", ["prank|scary"]), "prank|scary");
	assert.equal(await matchByoutubeTitleRegex("Relaxing music", ["prank|scary"]), null);
	assert.throws(() => normalizeByoutubeTitleRegex("("), /valid regular expression/);
	assert.throws(() => normalizeByoutubeTitleRegex("x".repeat(201)), /200 characters/);
});

test("pathological title regexes are stopped in a worker instead of blocking the server", async () => {
	await assert.rejects(
		matchByoutubeTitleRegex(`${"a".repeat(40)}!`, ["^(a+)+$"]),
		/matching timed out/,
	);
});

test("YouTube title lookup uses oEmbed and rejects failed lookups", async () => {
	let requestedUrl;
	const title = await fetchYouTubeVideoTitle("abcdefghijk", async (url) => {
		requestedUrl = new URL(url);
		return { ok: true, json: async () => ({ title: "A Sample Video" }) };
	});
	assert.equal(title, "A Sample Video");
	assert.equal(requestedUrl.origin, "https://www.youtube.com");
	assert.equal(requestedUrl.pathname, "/oembed");
	assert.match(requestedUrl.searchParams.get("url"), /v=abcdefghijk/);
	await assert.rejects(
		fetchYouTubeVideoTitle("abcdefghijk", async () => ({ ok: false, status: 404 })),
		/status 404/,
	);
});

test("active title rules deny unchecked playlists and titles matching a rule use the replacement", () => {
	const start = serverSource.indexOf('"byoutube": async function (args) {');
	const end = serverSource.indexOf('"blockbyoutube": async function (args) {', start);
	const handler = serverSource.slice(start, end);

	assert.match(handler, /titleRegexes\.length && list/);
	assert.match(handler, /await fetchYouTubeVideoTitle\(vid\)/);
	assert.match(handler, /await matchByoutubeTitleRegex\(title, titleRegexes\)/);
	assert.match(handler, /vid = BYOUTUBE_BLOCKED_REPLACEMENT_ID;/);
	assert.match(handler, /Playback was denied/);
});

test("title regex rules are persistent, idempotent, and removable", async () => {
	const pattern = `test-title-${Date.now()}`;

	try {
		assert.equal(await db.unblockByoutubeTitleRegex(pattern), false);
		assert.equal(await db.blockByoutubeTitleRegex(pattern), true);
		assert.equal((await db.listByoutubeTitleRegexes()).includes(pattern), true);
		assert.equal(await db.blockByoutubeTitleRegex(pattern), false);
		assert.equal(await db.unblockByoutubeTitleRegex(pattern), true);
		assert.equal((await db.listByoutubeTitleRegexes()).includes(pattern), false);
		assert.equal(await db.unblockByoutubeTitleRegex(pattern), false);
	} finally {
		await db.unblockByoutubeTitleRegex(pattern);
	}
});

test("title regex persistence rejects empty and malformed expressions", async () => {
	await assert.rejects(db.blockByoutubeTitleRegex(""), /Enter a title regex/);
	await assert.rejects(db.unblockByoutubeTitleRegex("("), /valid regular expression/);
});