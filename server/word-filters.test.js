import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createWordFilterStore } from "./wordFilters.js";

const fixtureDefaults = {
	filters: { hello: "hi", remove: "gone" },
	namefilters: { guest: "visitor" },
	antigodwordleak: { "leak\\s?word": "protected" },
};

function createTemporaryStore(t) {
	const directory = mkdtempSync(path.join(os.tmpdir(), "bonzi-word-filters-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const filePath = path.join(directory, "managed-word-filters.json");
	return {
		filePath,
		create: (defaults = fixtureDefaults) => createWordFilterStore({ defaults, filePath }),
	};
}

test("compiled filters preserve shipped defaults and load saved overrides", (t) => {
	const { filePath, create } = createTemporaryStore(t);
	const saved = {
		version: 1,
		overrides: {
			filters: { hello: "greetings", remove: null, world: "Earth" },
			namefilters: { guest: null, "new\\s?guest": "member" },
			antigodwordleak: { "leak\\s?word": "masked" },
		},
	};
	writeFileSync(filePath, JSON.stringify(saved));

	const updatedDefaults = {
		filters: { hello: "hi", remove: "gone", shipped: "new default" },
		namefilters: { guest: "visitor", member: "account" },
		antigodwordleak: {
			"leak\\s?word": "protected",
			"another leak": "guarded",
		},
	};
	const store = create(updatedDefaults);
	const compiled = store.getCompiled();

	const findRule = (rules, source) => rules.find((rule) => rule.regex.source === source);
	assert.equal(findRule(compiled.messages, "hello")?.replacement, "greetings");
	assert.equal(findRule(compiled.messages, "world")?.replacement, "Earth");
	assert.equal(findRule(compiled.messages, "shipped")?.replacement, "new default");
	assert.equal(findRule(compiled.messages, "remove"), undefined);
	assert.equal(findRule(compiled.usernames, "guest"), undefined);
	assert.equal(findRule(compiled.usernames, "new\\s?guest")?.replacement, "member");
	const godwordOverride = compiled.godword.find((rule) => rule.replacement === "masked");
	assert.ok(godwordOverride);
	assert.equal("leak word".replace(godwordOverride.regex, godwordOverride.replacement), "masked");
	assert.equal(findRule(compiled.godword, "another leak")?.replacement, "guarded");
	assert.equal("mutate" in store, true);
	assert.equal("getCategory" in store, true);
	assert.deepEqual(JSON.parse(readFileSync(filePath, "utf8")), saved);

	const helloFilter = findRule(compiled.messages, "hello");
	const worldFilter = findRule(compiled.messages, "world");
	assert.equal(
		"hello world".replace(helloFilter.regex, helloFilter.replacement)
			.replace(worldFilter.regex, worldFilter.replacement),
		"greetings Earth",
	);
});

test("word-filter manager mutations persist only overrides and apply over updated defaults", (t) => {
	const { filePath, create } = createTemporaryStore(t);
	const store = create();

	assert.deepEqual(store.mutate({
		operation: "add",
		category: "messages",
		pattern: "world",
		replacement: "Earth",
	}), {
		category: "messages",
		operation: "add",
		pattern: "world",
	});
	store.mutate({
		operation: "update",
		category: "usernames",
		originalPattern: "guest",
		pattern: "new\\s?guest",
		replacement: "member",
	});
	store.mutate({
		operation: "delete",
		category: "godword",
		originalPattern: "leak\\s?word",
	});

	assert.equal(store.getCategory("messages").rules.some((rule) => rule.pattern === "world"), true);
	assert.equal(store.getCategory("usernames").rules.some((rule) => rule.pattern === "guest"), false);
	assert.equal(store.getCategory("godword").total, 0);
	assert.deepEqual(JSON.parse(readFileSync(filePath, "utf8")), {
		version: 1,
		overrides: {
			filters: { world: "Earth" },
			namefilters: { guest: null, "new\\s?guest": "member" },
			antigodwordleak: { "leak\\s?word": null },
		},
	});

	const updatedDefaults = {
		filters: { hello: "hi", remove: "gone", shipped: "new default" },
		namefilters: { guest: "visitor", member: "account" },
		antigodwordleak: {
			"leak\\s?word": "protected",
			"another leak": "guarded",
		},
	};
	const restartedStore = create(updatedDefaults);
	assert.equal(restartedStore.getCategory("messages").rules.some((rule) => rule.pattern === "shipped"), true);
	assert.equal(restartedStore.getCategory("messages").rules.some((rule) => rule.pattern === "world"), true);
	assert.equal(restartedStore.getCategory("usernames").rules.some((rule) => rule.pattern === "guest"), false);
	assert.equal(restartedStore.getCategory("usernames").rules.some((rule) => rule.pattern === "new\\s?guest"), true);
	assert.equal(restartedStore.getCategory("godword").rules.some((rule) => rule.pattern === "another leak"), true);
	assert.equal(restartedStore.getCategory("godword").rules.some((rule) => rule.pattern === "leak\\s?word"), false);
});

test("word-filter manager rejects stale edits, duplicate patterns, and invalid requests", (t) => {
	const store = createTemporaryStore(t).create();

	assert.throws(() => store.mutate({
		operation: "update",
		category: "messages",
		originalPattern: "missing",
		pattern: "new",
		replacement: "value",
	}), /no longer exists/);
	assert.throws(() => store.mutate({
		operation: "add",
		category: "messages",
		pattern: "hello",
		replacement: "duplicate",
	}), /already exists/);
	assert.throws(() => store.mutate({
		operation: "add",
		category: "messages",
		pattern: "[",
		replacement: "invalid",
	}), /valid regular expression/);
	assert.throws(() => store.getCategory("not-a-category"), /valid word-filter category/);
});

test("invalid saved patterns are skipped and reported without blocking defaults", (t) => {
	const { filePath } = createTemporaryStore(t);
	writeFileSync(filePath, JSON.stringify({
		version: 1,
		overrides: {
			filters: { "[": "invalid" },
			namefilters: {},
			antigodwordleak: {},
		},
	}));
	const invalidPatterns = [];
	const store = createWordFilterStore({
		defaults: fixtureDefaults,
		filePath,
		onInvalidPattern: (invalid) => invalidPatterns.push(invalid),
	});

	const compiled = store.getCompiled();
	assert.equal(compiled.messages.some((rule) => rule.regex.source === "hello"), true);
	assert.equal(compiled.messages.some((rule) => rule.regex.source === "["), false);
	assert.equal(invalidPatterns.length, 1);
	assert.equal(invalidPatterns[0].category, "messages");
	assert.equal(invalidPatterns[0].pattern, "[");
});