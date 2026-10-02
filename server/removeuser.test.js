import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientScript = readFileSync(
	path.resolve(__dirname, "..", "client", "src", "script.js"),
	"utf8",
);
const serverScript = readFileSync(path.join(__dirname, "server.js"), "utf8");

test("moderation menu replaces Kitty Cat Dance with the Cannot post error action", () => {
	assert.match(
		clientScript,
		/"removeuser": \{\s*name: "Cannot post \/ error",\s*callback: \(\) => \{\s*cmd\(`removeuser \$\{this\.id\}`\);\s*\}/,
	);
});

test("/removeuser displays a Cannot post message and disconnects the target", () => {
	const handler = serverScript.match(
		/"removeuser": function\(id\) \{([\s\S]*?)\n\t\},\n\t"redirect"/,
	)?.[1];
	assert.ok(handler, "removeuser handler should exist");
	assert.match(
		handler,
		/user\.socket\.emit\("kick2", \{\s*reason: "Cannot post: a moderator disconnected you\.",\s*\}\)/,
	);
	assert.match(handler, /user\.socket\.disconnect\(\)/);
	assert.doesNotMatch(handler, /removede|kittycat\.mp4/i);
});

test("/massremove immediately applies the Cannot post disconnect to matching targets", () => {
	const handler = serverScript.match(
		/"massremove": function \(input\) \{([\s\S]*?)\n\s*\},\s*"promotehighking"/,
	)?.[1];
	assert.ok(handler, "massremove handler should exist");
	assert.doesNotMatch(handler, /massRemoveConfirmations|confirmation\.status|--confirm/);
	assert.match(handler, /const reason = "Cannot post: a moderator disconnected you\."/);
	assert.match(handler, /for \(const user of targets\)/);
	assert.match(handler, /user\.socket\.emit\("kick2", \{ reason \}\)/);
	assert.match(handler, /setTimeout\(\(\) => user\.socket\.disconnect\(\), 0\)/);
});