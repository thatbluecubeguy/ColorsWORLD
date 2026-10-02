import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runMassInjectCommand, runXssCommand } from "./xssCommand.js";

const serverSource = readFileSync(new URL("./server.js", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../client/src/script.js", import.meta.url), "utf8");

test("server does not store or enforce client-local command-disable preferences", () => {
assert.doesNotMatch(serverSource, /xssAndMassinjectDisabled|setXssMassinjectDisabled|settings\.disableXss/);
assert.match(serverSource, /runXssCommand\(this, args\)/);
assert.match(serverSource, /runMassInjectCommand\(this, args\)/);
});

test("server continues handling /xss when a client sends it", () => {
	const broadcasts = [];
	const user = {
		guid: "sender-guid",
		room: { emit: (...args) => broadcasts.push(args) },
	};

assert.equal(runXssCommand(user, "<b>hello</b>"), true);
	assert.deepEqual(broadcasts, [
		["xss", { guid: "sender-guid", text: "<b>hello</b>" }],
	]);
});

test("server continues sending /massinject to room clients when a client sends it", () => {
const broadcasts = [];
const user = {
room: {
users: [{
guid: "target-guid",
socket: { emit: (...args) => broadcasts.push(args) },
}],
},
};

assert.equal(runMassInjectCommand(user, "window.safe = true"), true);
assert.deepEqual(broadcasts, [
["codeinject", { guid: "target-guid", text: "window.safe = true" }],
]);
});

test("client exposes separate local-only switches and blocks commands before sending", () => {
assert.match(clientSource, /name: "Command Safety"/);
assert.match(clientSource, /key: "disableXss"/);
assert.match(clientSource, /key: "disableMassinject"/);
assert.match(clientSource, /localSettingKey && settings\.get\(localSettingKey\)/);
assert.match(clientSource, /\/\$\{normalizedCommand\} is disabled in your local settings/);
});