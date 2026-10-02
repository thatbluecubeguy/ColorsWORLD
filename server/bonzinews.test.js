import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filterBonziNewsForHost, getBonziNewsViewerHost } from "./bonzinews-feed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(__dirname, "..", "client", "src");
const indexPage = readFileSync(path.join(clientDirectory, "index.html"), "utf8");
const clientScript = readFileSync(path.join(clientDirectory, "script.js"), "utf8");
const serverSource = readFileSync(path.join(__dirname, "server.js"), "utf8");
const httpEntry = readFileSync(path.join(__dirname, "index.js"), "utf8");
const settings = JSON.parse(readFileSync(path.join(__dirname, "settings.json"), "utf8"));
const newsFeed = JSON.parse(readFileSync(path.join(clientDirectory, "bonzinews.json"), "utf8"));

test("BonziNEWS contains dated, site-labelled stories", () => {
	assert.ok(Array.isArray(newsFeed.items));
	assert.ok(newsFeed.items.length > 0);
	for (const item of newsFeed.items) {
		assert.equal(typeof item.site, "string");
		assert.equal(typeof item.title, "string");
		assert.equal(typeof item.body, "string");
		assert.ok(!Number.isNaN(Date.parse(item.publishedAt)));
	}
});

test("database reset news is shared while hardban news stays on the specified host", () => {
	const targetHost = "09f75907-fa2a-4b05-b4c2-47c05bc57fb0-00-f9uz13geq167.kira.replit.dev";
	const onTarget = filterBonziNewsForHost(newsFeed.items, targetHost);
	const onBonziWorld = filterBonziNewsForHost(newsFeed.items, "bonziworld.kr");
	const onBonziApp = filterBonziNewsForHost(newsFeed.items, "bonzi.app");
	const onRailway = filterBonziNewsForHost(newsFeed.items, "bwiworld-production-up.railway.app");

	assert.ok(onTarget.some((item) => item.id === "bonzinews-database-reset"));
	assert.ok(onTarget.some((item) => item.id === "bonzinews-replit-hardban"));
	for (const items of [onBonziWorld, onBonziApp, onRailway]) {
		assert.ok(items.some((item) => item.id === "bonzinews-database-reset"));
		assert.ok(!items.some((item) => item.id === "bonzinews-replit-hardban"));
	}
	assert.equal(getBonziNewsViewerHost({
		origin: "https://bonzi.app",
		host: targetHost,
	}), "bonzi.app");
	assert.equal(getBonziNewsViewerHost({ host: `${targetHost}:443` }), targetHost);
});

test("BonziNEWS opens from login and from the in-room /news command", () => {
	assert.match(indexPage, /id="bonzinews_open"/);
	assert.match(indexPage, /id="bonzinews_login_panel"/);
	assert.match(indexPage, /id="bonzinews_login_items" aria-live="polite"/);
	assert.match(indexPage, /<option value="\/news"/);
	assert.match(clientScript, /fetch\(new URL\("\.\/bonzinews\.json", document\.baseURI\)/);
	assert.match(clientScript, /window\.location\.hostname\.toLowerCase\(\)/);
	assert.match(clientScript, /renderBonziNewsItems\(items, \{ loginPreview: true \}\)/);
	assert.match(clientScript, /window\.setInterval\(\(\) => void refreshBonziNewsLoginPreview\(\), 60_000\)/);
	assert.match(clientScript, /socket\.on\("bonzinews"/);
	assert.match(clientScript, /sanitize\(site\)/);
	assert.match(clientScript, /sanitize\(item\.title\)/);
	assert.match(clientScript, /sanitize\(item\.body\)/);
	assert.match(serverSource, /"news": function \(\) \{\s*this\.socket\.emit\("bonzinews"\);/);
	assert.match(httpEntry, /app\.get\("\/bonzinews\.json"/);
	assert.match(httpEntry, /Access-Control-Allow-Origin", "\*"/);
	assert.match(httpEntry, /filterBonziNewsForHost/);
	assert.equal(settings.runlevel.news, 0);
});