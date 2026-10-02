export const DEFAULT_CINEMA_VIDEO_IDS = Object.freeze([
	"K1rw6iApeBE",
	"pD_imYhNoQ4",
	"XhTcL36-Z78",
]);

export const MAX_CINEMA_VIDEO_COUNT = 50;

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function normalizeCinemaVideoIds(value) {
	if (!Array.isArray(value) || value.length > MAX_CINEMA_VIDEO_COUNT) return null;

	const ids = [];
	const seen = new Set();
	for (const id of value) {
		if (typeof id !== "string" || !YOUTUBE_VIDEO_ID.test(id) || seen.has(id)) {
			return null;
		}
		seen.add(id);
		ids.push(id);
	}

	return ids;
}