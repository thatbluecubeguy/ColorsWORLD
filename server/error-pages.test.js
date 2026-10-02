import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDirectory = path.resolve(__dirname, "..", "client", "src");
const serverEntry = readFileSync(path.join(__dirname, "index.js"), "utf8");
const clientScript = readFileSync(path.join(clientDirectory, "script.js"), "utf8");
const statusCodes = [400, 403, 404, 500, 502, 503];
const safetyServerDestinations = [
	"https://bonziworld.kr/",
	"https://bwiworld-production-up.railway.app/",
	"https://bonziworld-se-production-up.railway.app/",
	"https://bonzi.app/",
	"https://e713c0ba-ae15-4016-b10f-8a338e6ffaad-00-20bd7f0vwpuym.kira.replit.dev/",
];

test("every supported HTTP error has a standalone styled page", () => {
	for (const statusCode of statusCodes) {
		const page = readFileSync(path.join(clientDirectory, `${statusCode}.html`), "utf8");
		assert.match(page, new RegExp(`<title>${statusCode} `));
		assert.match(page, /<main class="error-shell">/);
		assert.match(page, /href="\.\/error\.css"/);
		assert.match(page, new RegExp(`class="error-code">${statusCode}<`));
	}
});

test("custom ASN-ban error 1005 is a hardcoded static page, not an HTTP status route", () => {
	const page = readFileSync(path.join(clientDirectory, "1005.html"), "utf8");
	assert.match(page, /<title>1005 ASN Banned \| BonziWORLD<\/title>/);
	assert.match(page, /<main class="error-shell">/);
	assert.match(page, /href="\.\/error\.css"/);
	assert.match(page, /class="error-code">1005</);
	assert.match(page, /Your ASN has been banned\./);
	assert.doesNotMatch(serverEntry, /const errorPageCodes = \[[^\]]*\b1005\b/);
	assert.doesNotMatch(serverEntry, /res\.status\(1005\)/);
});

test("error routes cover extensionless and .html URLs", () => {
	assert.match(serverEntry, /const errorPageCodes = \[400, 403, 404, 500, 502, 503\]/);
	assert.match(serverEntry, /app\.get\(\[`\/\$\{statusCode\}`, `\/\$\{statusCode\}\.html`\]/);
	assert.match(serverEntry, /req\.accepts\("html"\)/);
	assert.match(serverEntry, /sendErrorPage\(res, 404\)/);
});

test("shutdown page explains the closure and links every requested destination", () => {
	const page = readFileSync(path.join(clientDirectory, "shutdown.html"), "utf8");
	assert.match(page, /<title>BonziWORLD is shut down<\/title>/);
	assert.match(page, /This instance has been shut down/);
	for (const destination of safetyServerDestinations) {
		assert.ok(page.includes(`href="${destination}"`), `shutdown page should link to ${destination}`);
	}
});

test("maintenance and lockdown pages warn visitors and link to the same five servers", () => {
	const pages = [
		{ file: "maintenance.html", heading: /This instance is under maintenance/ },
		{ file: "lockdown.html", heading: /This instance is in emergency lockdown/ },
	];

	for (const { file, heading } of pages) {
		const page = readFileSync(path.join(clientDirectory, file), "utf8");
		assert.match(page, heading);
		assert.match(page, /class="warning" role="alert"/);
		assert.match(page, /In the meantime:/);
		for (const destination of safetyServerDestinations) {
			assert.ok(page.includes(`href="${destination}"`), `${file} should link to ${destination}`);
		}
	}
});

test("only persistent Runlevel 9 bypasses active maintenance and lockdown pages", () => {
	assert.match(serverEntry, /getSafetyModeState\(\)/);
	assert.match(serverEntry, /getSafetyPageTarget\(safetyState\)/);
	assert.match(serverEntry, /req\.path === pageTarget/);
	assert.match(serverEntry, /res\.redirect\(302, pageTarget\)/);
	assert.match(serverEntry, /hasPersistentRunlevel9Cookie\(req\.cookie\?\.token\)/);
	assert.match(clientScript, /socket\.on\("maintenanceMode", \(\) => \{[\s\S]*?window\.location\.replace\("\/maintenance\.html"\)/);
	assert.match(clientScript, /socket\.on\("lockdownMode", \(\) => \{[\s\S]*?window\.location\.replace\("\/lockdown\.html"\)/);
});