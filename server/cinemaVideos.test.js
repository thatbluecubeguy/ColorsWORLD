import assert from "node:assert/strict";
import test from "node:test";
import settings from "./settings.json" with { type: "json" };
import {
	DEFAULT_CINEMA_VIDEO_IDS,
	MAX_CINEMA_VIDEO_COUNT,
	normalizeCinemaVideoIds,
} from "./cinemaVideos.js";

test("cinema video rotation defaults to the original three videos", () => {
	assert.deepEqual(DEFAULT_CINEMA_VIDEO_IDS, [
		"K1rw6iApeBE",
		"pD_imYhNoQ4",
		"XhTcL36-Z78",
	]);
});

test("cinema video rotation accepts empty and unique YouTube ID lists", () => {
	assert.deepEqual(normalizeCinemaVideoIds([]), []);
	assert.deepEqual(
		normalizeCinemaVideoIds(["dQw4w9WgXcQ", "K1rw6iApeBE"]),
		["dQw4w9WgXcQ", "K1rw6iApeBE"],
	);
});

test("cinema video rotation rejects malformed, duplicate, and oversized lists", () => {
	assert.equal(normalizeCinemaVideoIds("dQw4w9WgXcQ"), null);
	assert.equal(normalizeCinemaVideoIds(["bad-id"]), null);
	assert.equal(normalizeCinemaVideoIds(["dQw4w9WgXcQ", "dQw4w9WgXcQ"]), null);
	assert.equal(
		normalizeCinemaVideoIds(Array.from({ length: MAX_CINEMA_VIDEO_COUNT + 1 }, (_, i) =>
			i.toString().padStart(11, "0"),
		)),
		null,
	);
});

test("cinema video management is configured for Big Owners only", () => {
	assert.equal(settings.runlevel.managecinemavideos, 8);
});