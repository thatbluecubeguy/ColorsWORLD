import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serverSource = readFileSync(new URL("./server.js", import.meta.url), "utf8");
const clientIndex = readFileSync(new URL("../client/src/index.html", import.meta.url), "utf8");
const settings = JSON.parse(readFileSync(new URL("./settings.json", import.meta.url), "utf8"));

function commandHandler(command) {
	return serverSource.match(new RegExp(`"${command}": function \\(\\) \\{[\\s\\S]*?\\n\\t\\},`))?.[0] || "";
}

test("banish control commands allow runlevel 7 and higher", () => {
	for (const command of ["disablebanish", "enablebanish"]) {
		assert.equal(settings.runlevel[command], 7);
		assert.match(commandHandler(command), /!\(this\.runlevel >= 7\)/);
	}
	assert.match(serverSource, /let banishEnabled = true;/);
	assert.match(serverSource, /if \(!banishEnabled\)\s*\{\s*this\.notify\("\/banish has been disabled by an Owner\."\)/);

	const toggle = serverSource.match(/function setBanishEnabled\(actor, enabled\) \{[\s\S]*?\n\}/)?.[0] || "";
	assert.match(toggle, /banishEnabled = enabled/);
	assert.match(toggle, /for \(const room of rooms\.values\(\)\)/);
	assert.match(commandHandler("disablebanish"), /setBanishEnabled\(this, false\)/);
	assert.match(commandHandler("enablebanish"), /setBanishEnabled\(this, true\)/);
});

test("bimage locks are room-scoped and allow runlevel 3 and higher", () => {
	for (const command of ["lockbimage", "unlockbimage"]) {
		assert.equal(settings.runlevel[command], 3);
		assert.match(commandHandler(command), /!\(this\.runlevel >= 3\)/);
	}

	const roomConstructor = serverSource.match(/class Room \{\s*constructor\(roomId\) \{[\s\S]*?\n\t\}/)?.[0] || "";
	assert.match(roomConstructor, /this\.bimageLocked = false/);

	const bimageHandler = serverSource.slice(
		serverSource.indexOf('"bimage": async function'),
		serverSource.search(/"byoutube": (?:async )?function/),
	);
	assert.match(bimageHandler, /if \(this\.room\.bimageLocked\)/);
	assert.match(commandHandler("lockbimage"), /this\.room\.bimageLocked = true/);
	assert.match(commandHandler("unlockbimage"), /this\.room\.bimageLocked = false/);
});

test("chat command suggestions describe the new controls", () => {
	for (const command of ["disablebanish", "enablebanish", "lockbimage", "unlockbimage", "blockbyoutube", "unblockbyoutube"]) {
		assert.ok(clientIndex.includes(`value="/${command}"`), `/${command} should be discoverable`);
	}
});