import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	applyMassAppearanceEdit,
	MASS_APPEARANCE_EDIT_COMMANDS,
	parseMassAppearanceEditRequest,
} from "./massAppearanceEdits.js";

const settings = JSON.parse(
	readFileSync(new URL("./settings.json", import.meta.url), "utf8"),
);
const serverSource = readFileSync(new URL("./server.js", import.meta.url), "utf8");

test("mass appearance edits are registered for Contributors and higher", () => {
	assert.deepEqual(MASS_APPEARANCE_EDIT_COMMANDS, [
		"massnameedit",
		"masshatedit",
		"masscoloredit",
	]);
	for (const command of MASS_APPEARANCE_EDIT_COMMANDS) {
		assert.equal(settings.runlevel[command], 5);
		assert.match(serverSource, new RegExp(`"${command}": function`));
	}
});

test("mass appearance edit arguments are required, bounded, and reject control characters", () => {
	assert.match(parseMassAppearanceEditRequest("massnameedit", "").error, /Usage:/);
	assert.equal(
		parseMassAppearanceEditRequest("massnameedit", "A Very Good Name").value,
		"A Very Good Name",
	);
	assert.match(
		parseMassAppearanceEditRequest("massnameedit", "n".repeat(101)).error,
		/100 characters/,
	);
	assert.match(
		parseMassAppearanceEditRequest("masscoloredit", "purple\nmalicious").error,
		/control characters/,
	);
	assert.match(
		parseMassAppearanceEditRequest("massunknownedit", "value").error,
		/Unknown/,
	);
});

test("mass appearance handler targets only this room and applies staff target protections", () => {
	assert.match(serverSource, /actor\.room\.users/);
	assert.match(serverSource, /staffTargetWarning\(actor, user, command\)/);
	assert.match(serverSource, /user\.room === actor\.room/);
	assert.doesNotMatch(serverSource, /runMassAppearanceEdit[\s\S]{0,1200}listUsers\(\)/);
});

test("mass name, color, and hat edits change only the requested appearance field", () => {
	const user = { public: { name: "Original", color: "blue oldhat" } };

	assert.equal(applyMassAppearanceEdit(user, "massnameedit", "New Name 192.0.2.1"), true);
	assert.equal(user.public.name.includes("192.0.2.1"), false);
	assert.equal(user.public.color, "blue oldhat");

	assert.equal(applyMassAppearanceEdit(user, "masscoloredit", "red"), true);
	assert.equal(user.public.color, "red");
	assert.equal(user.public.name.includes("192.0.2.1"), false);

	assert.equal(applyMassAppearanceEdit(user, "masshatedit", "crown scarf"), true);
	assert.equal(user.public.color, "red crown scarf");
	assert.equal(applyMassAppearanceEdit(user, "masshatedit", "none"), true);
	assert.equal(user.public.color, "red");
	assert.equal(applyMassAppearanceEdit(user, "massunknownedit", "value"), false);
});