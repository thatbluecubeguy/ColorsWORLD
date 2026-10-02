function normalizeHostname(value) {
	if (typeof value !== "string" || !value.trim()) return "";
	const firstValue = value.split(",")[0].trim();
	if (!firstValue) return "";

	try {
		const url = firstValue.includes("://")
			? new URL(firstValue)
			: new URL(`http://${firstValue}`);
		return url.hostname.toLowerCase().replace(/\.$/, "");
	} catch {
		return firstValue.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
	}
}

export function getBonziNewsViewerHost({
	origin,
	forwardedHost,
	host,
	hostname,
} = {}) {
	if (typeof origin === "string" && origin.trim()) {
		return normalizeHostname(origin);
	}
	return normalizeHostname(forwardedHost || host || hostname);
}

export function filterBonziNewsForHost(items, viewerHost) {
	if (!Array.isArray(items)) return [];
	const normalizedViewerHost = normalizeHostname(viewerHost);

	return items.filter((item) => {
		if (!item || !Object.prototype.hasOwnProperty.call(item, "onlyOnHosts")) return true;
		if (!Array.isArray(item.onlyOnHosts) || !normalizedViewerHost) return false;
		return item.onlyOnHosts.some((host) =>
			typeof host === "string" && normalizeHostname(host) === normalizedViewerHost
		);
	});
}