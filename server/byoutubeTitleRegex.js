import { Worker } from "node:worker_threads";

export const MAX_BYOUTUBE_TITLE_REGEX_LENGTH = 200;
export const BYOUTUBE_TITLE_REGEX_TIMEOUT_MS = 250;

export function normalizeByoutubeTitleRegex(pattern) {
	if (typeof pattern !== "string") {
		throw new TypeError("The title regex must be text.");
	}

	const normalized = pattern.trim();
	if (!normalized) {
		throw new TypeError("Enter a title regex.");
	}
	if (normalized.length > MAX_BYOUTUBE_TITLE_REGEX_LENGTH) {
		throw new TypeError(`Title regexes must be ${MAX_BYOUTUBE_TITLE_REGEX_LENGTH} characters or fewer.`);
	}
	try {
		new RegExp(normalized, "i");
	} catch {
		throw new TypeError("That is not a valid regular expression.");
	}
	return normalized;
}

const matcherWorkerSource = `
	const { parentPort, workerData } = require("node:worker_threads");
	try {
		const { title, patterns } = workerData;
		const match = patterns.find((pattern) => new RegExp(pattern, "i").test(title));
		parentPort.postMessage({ match: match ?? null });
	} catch (error) {
		parentPort.postMessage({ error: error.message });
	}
`;

export function matchByoutubeTitleRegex(title, patterns) {
	if (typeof title !== "string") {
		return Promise.reject(new TypeError("The YouTube title must be text."));
	}
	if (!Array.isArray(patterns) || patterns.length > 256) {
		return Promise.reject(new Error("The YouTube title regex list is too large to check safely."));
	}
	const normalizedPatterns = patterns.map(normalizeByoutubeTitleRegex);
	if (!normalizedPatterns.length) return Promise.resolve(null);

	return new Promise((resolve, reject) => {
		const worker = new Worker(matcherWorkerSource, {
			eval: true,
			workerData: { title: title.slice(0, 2048), patterns: normalizedPatterns },
		});
		let settled = false;
		const finish = (callback, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			void worker.terminate();
			callback(value);
		};
		const timeout = setTimeout(() => {
			finish(reject, new Error("YouTube title regex matching timed out."));
		}, BYOUTUBE_TITLE_REGEX_TIMEOUT_MS);
		timeout.unref?.();

		worker.once("message", (result) => {
			if (result?.error) {
				finish(reject, new Error("Unable to evaluate a YouTube title regex."));
				return;
			}
			finish(resolve, result?.match ?? null);
		});
		worker.once("error", (error) => {
			finish(reject, error);
		});
		worker.once("exit", (code) => {
			if (code !== 0) finish(reject, new Error("YouTube title regex worker exited unexpectedly."));
		});
	});
}

export async function fetchYouTubeVideoTitle(videoId, fetchImpl = fetch) {
	if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
		throw new TypeError("YouTube video ID must be an 11-character ID.");
	}

	const videoUrl = new URL("https://www.youtube.com/watch");
	videoUrl.searchParams.set("v", videoId);
	const oembedUrl = new URL("https://www.youtube.com/oembed");
	oembedUrl.searchParams.set("url", videoUrl.href);
	oembedUrl.searchParams.set("format", "json");

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);
	timeout.unref?.();
	try {
		const response = await fetchImpl(oembedUrl, {
			signal: controller.signal,
			headers: { accept: "application/json" },
		});
		if (!response.ok) {
			throw new Error(`YouTube title lookup failed with status ${response.status}.`);
		}
		const metadata = await response.json();
		if (typeof metadata?.title !== "string" || !metadata.title.trim()) {
			throw new Error("YouTube did not return a video title.");
		}
		return metadata.title.slice(0, 2048);
	} finally {
		clearTimeout(timeout);
	}
}