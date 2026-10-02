import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientScript = readFileSync(path.resolve(__dirname, "..", "client", "src", "script.js"), "utf8");
const clientStyle = readFileSync(path.resolve(__dirname, "..", "client", "src", "style.css"), "utf8");

test("Applets menu launches Notepad, Jukebox, Cinema, and BonziRESTAURANT", () => {
	const appletMenu = clientScript.match(/function openApplets\(\) \{[\s\S]*?\n\}\n\nconst appletsButton/)?.[0] || "";
	assert.ok(appletMenu, "Applets menu should have a launch handler");
	for (const applet of ["notepad", "jukebox", "cinema", "restaurant"]) {
		assert.ok(appletMenu.includes(`data-applet="${applet}"`), `${applet} should be listed`);
		assert.ok(appletMenu.includes(`${applet}: open`), `${applet} should have a launch action`);
	}
});

test("Jukebox accepts local audio files and direct HTTP(S) audio URLs", () => {
	assert.match(clientScript, /accept="audio\/\*" multiple/);
	assert.match(clientScript, /URL\.createObjectURL\(file\)/);
	assert.match(clientScript, /URL\.revokeObjectURL\(track\.objectUrl\)/);
	assert.match(clientScript, /Audio URLs must use HTTP or HTTPS/);
	assert.match(clientScript, /Files stay in this browser/);
	assert.match(clientStyle, /\.jukebox_audio\s*\{[^}]*width:\s*100%/);
});

test("Cinema accepts only supported YouTube video IDs and URL hosts", () => {
	const parserSource = clientScript.match(/function parseYouTubeVideoId\(input\) \{[\s\S]*?\n\}/)?.[0] || "";
	assert.ok(parserSource, "Cinema should validate YouTube URLs before embedding them");
	const parseYouTubeVideoId = new Function(`${parserSource}; return parseYouTubeVideoId;`)();

	assert.equal(parseYouTubeVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
	assert.equal(parseYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
	assert.equal(parseYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=3"), "dQw4w9WgXcQ");
	assert.equal(parseYouTubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
	assert.equal(parseYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
	assert.equal(parseYouTubeVideoId("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"), null);
	assert.equal(parseYouTubeVideoId("javascript:alert(1)"), null);
	assert.equal(parseYouTubeVideoId("not-a-video-id"), null);

	const cinemaApplet = clientScript.match(/function openCinemaApplet\(\) \{[\s\S]*?\n\}\n\nconst RESTAURANT_MENU/)?.[0] || "";
	assert.match(cinemaApplet, /www\.youtube-nocookie\.com\/embed\/\$\{video\.id\}/);
	assert.match(cinemaApplet, /iframe\.title = video\.title/);
	assert.match(clientStyle, /\.cinema_player iframe\s*\{[^}]*width:\s*100%/);
});

test("BonziRESTAURANT shows the requested menu and builds a local order", () => {
	const menu = clientScript.match(/const RESTAURANT_MENU = \[[\s\S]*?\n\];/)?.[0] || "";
	assert.ok(menu, "BonziRESTAURANT should define a menu");
	for (const item of [
		"Chips",
		"Pepperoni pizza",
		"Cheese pizza",
		"Hamburger",
		"Cheeseburger",
		"Coke",
		"Fanta",
		"Sprite",
		"7up",
		"Pepsi",
	]) {
		assert.ok(menu.includes(`"${item}"`), `${item} should be on the menu`);
	}
	assert.match(clientScript, /order\.set\(item, \(order\.get\(item\) \|\| 0\) \+ 1\)/);
	assert.match(clientScript, /Order placed: \$\{summary\}/);
	assert.match(clientScript, /No prices, payment, or delivery are connected/);
});