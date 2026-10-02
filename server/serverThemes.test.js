import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { SERVER_THEME_NAMES, toggleServerTheme } from "./serverThemes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverSource = readFileSync(path.join(__dirname, "server.js"), "utf8");
const clientSource = readFileSync(path.resolve(__dirname, "../client/src/script.js"), "utf8");
const indexSource = readFileSync(path.resolve(__dirname, "../client/src/index.html"), "utf8");
const settings = JSON.parse(readFileSync(path.join(__dirname, "settings.json"), "utf8"));
const serverCommands = ["svaporwave", "sacid", "sfrutiger", "sterminal"];

test("server themes toggle independently and remain ordered", () => {
	let themes = toggleServerTheme([], "vaporwave");
	assert.deepEqual(themes, ["vaporwave"]);
	themes = toggleServerTheme(themes, "acid");
	assert.deepEqual(themes, ["vaporwave", "acid"]);
	themes = toggleServerTheme(themes, "vaporwave");
	assert.deepEqual(themes, ["acid"]);
	themes = toggleServerTheme(themes, "acid");
	assert.deepEqual(themes, []);
});

test("server theme state rejects unrecognized names", () => {
	assert.throws(() => toggleServerTheme([], "eval"), RangeError);
	assert.deepEqual(
		toggleServerTheme(["unrecognized", "terminal"], "acid"),
		["acid", "terminal"],
	);
	assert.deepEqual(SERVER_THEME_NAMES, ["vaporwave", "acid", "frutiger", "terminal"]);
});

test("all server-wide theme commands require Pope rank on the server", () => {
	for (const command of serverCommands) {
		assert.equal(settings.runlevel[command], 4, `/${command} must require Pope runlevel 4`);
		assert.match(serverSource, new RegExp(`"${command}"\\s*:\\s*function`));
	}
	assert.match(serverSource, /this\.runlevel >= commandLevel/);
});

test("acid and terminal commands are local while server themes reach current and new users", () => {
	for (const command of ["acid", "unacid", "terminal", "unterminal"]) {
		assert.match(clientSource, new RegExp(`command === "${command}"`));
		assert.equal(settings.runlevel[command], undefined);
		assert.doesNotMatch(serverSource, new RegExp(`"${command}"\\s*:\\s*function`));
	}
	assert.match(serverSource, /io\.emit\("serverThemes", \{ themes: \[\.\.\.serverThemes\] \}\)/);
	assert.match(serverSource, /serverThemes:\s*\[\.\.\.serverThemes\]/);
	assert.match(clientSource, /socket\.on\("serverThemes", \(data\) => \{ setServerThemes\(data\?\.themes\); \}\)/);
	assert.match(clientSource, /socket\.on\("enablevaporwave", \(data\) => \{\s*forcedVaporwave = true;\s*renderThemeEffects\(\);/);
	assert.match(clientSource, /socket\.on\("disablevaporwave", \(data\) => \{\s*forcedVaporwave = false;\s*renderThemeEffects\(\);/);
});

test("local themes are listed for everyone and server commands are only added for Pope+", () => {
	assert.match(indexSource, /script\.js\?v=1\.38/);
	for (const command of ["acid", "unacid", "terminal", "unterminal"]) {
		assert.match(indexSource, new RegExp(`value="/${command}"`));
	}
	for (const command of serverCommands) {
		assert.ok(clientSource.includes(`["${command}"`), `Pope+ command menu should include /${command}`);
	}
	assert.match(clientSource, /if \(pope\) \{[\s\S]*serverThemeCommands/);
});