import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serverSource = readFileSync(new URL("./server.js", import.meta.url), "utf8");

function commandHandler(command, nextCommand) {
	const start = serverSource.indexOf(`"${command}":`);
	const end = serverSource.indexOf(`"${nextCommand}":`, start);
	assert.notEqual(start, -1, `${command} handler should exist`);
	assert.notEqual(end, -1, `${nextCommand} handler should follow ${command}`);
	return serverSource.slice(start, end);
}

test("mass demote, mass ban, and mass remove execute without confirmation tokens", () => {
	for (const [command, nextCommand, parser, selector] of [
		["massdemote", "massban", "parseMassDemoteRequest", "selectMassDemoteTargets"],
		["massban", "massremove", "parseMassBanRequest", "selectMassBanTargets"],
		["massremove", "promotehighking", "parseMassRemoveRequest", "selectMassRemoveTargets"],
	]) {
		const handler = commandHandler(command, nextCommand);
		assert.match(handler, new RegExp(parser));
		assert.match(handler, new RegExp(selector));
		assert.doesNotMatch(handler, /requestOrConfirm|confirmation\.status|targetFingerprint|--confirm/);
	}
});