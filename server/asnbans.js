import NodeCache from "node-cache";
import * as db from "./database.js";

export function normalizeAsn(value) {
	const candidate = String(value ?? "").trim().toUpperCase();
	const match = /^(?:AS)?(\d+)$/.exec(candidate);
	if (!match) return null;

	const number = Number(match[1]);
	if (!Number.isSafeInteger(number) || number < 1 || number > 4_294_967_295) {
		return null;
	}
	return `AS${number}`;
}

export function createAsnBanManager(database, asnCache = new NodeCache({
	stdTTL: 86400,
	checkperiod: 3600,
})) {
	const bans = new Map();
	let loading;

	async function init() {
		if (!loading) {
			loading = (async () => {
				const active = await database.getActiveAsnBans();
				bans.clear();
				for (const row of active) {
					const asn = normalizeAsn(row.asn);
					if (asn) bans.set(asn, row.reason || "ASN banned");
				}
			})().catch((error) => {
				loading = null;
				throw error;
			});
		}
		await loading;
	}

	async function getAsn(ip) {
		const cachedAsn = asnCache.get(ip);
		if (cachedAsn) return cachedAsn;

		const asn = normalizeAsn(await database.getAsnFromIp(ip));
		if (asn) asnCache.set(ip, asn);
		return asn;
	}

	async function getAsnBanForIp(ip) {
		await init();
		if (bans.size === 0) return null;

		const asn = await getAsn(ip);
		if (!asn || !bans.has(asn)) return null;
		return { asn, reason: bans.get(asn) };
	}

	async function addAsnBan(value, reason) {
		const asn = normalizeAsn(value);
		if (!asn) throw new TypeError("A valid ASN is required.");
		await init();
		await database.saveAsnBan(asn, reason || "ASN banned");
		bans.set(asn, reason || "ASN banned");
		return asn;
	}

	async function removeAsnBan(value) {
		const asn = normalizeAsn(value);
		if (!asn) throw new TypeError("A valid ASN is required.");
		await init();
		await database.removeAsnBan(asn);
		return bans.delete(asn);
	}

	async function listAsnBans() {
		await init();
		return [...bans.entries()]
			.map(([asn, reason]) => ({ asn, reason }))
			.sort((a, b) => a.asn.localeCompare(b.asn));
	}

	return { init, getAsnBanForIp, addAsnBan, removeAsnBan, listAsnBans };
}

const manager = createAsnBanManager(db);

export const initAsnBans = manager.init;
export const getAsnBanForIp = manager.getAsnBanForIp;
export const addAsnBan = manager.addAsnBan;
export const removeAsnBan = manager.removeAsnBan;
export const listAsnBans = manager.listAsnBans;