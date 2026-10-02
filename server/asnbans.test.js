import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import settings from "./settings.json" with { type: "json" };
import {
	createAsnBanManager,
	normalizeAsn,
} from "./asnbans.js";
import {
	canRunServerManagementCommand,
	SERVER_MANAGEMENT_COMMANDS,
} from "./ownerSafety.js";

const commandNames = ["asnban", "asnunban", "asnbanlist"];

test("ASN values are normalized and invalid values are rejected", () => {
	assert.equal(normalizeAsn("as00064500"), "AS64500");
	assert.equal(normalizeAsn(" 64500 "), "AS64500");
	for (const value of ["", "AS", "AS12x", "AS0", "AS4294967296", "AS-64500"]) {
		assert.equal(normalizeAsn(value), null, `${value} should not be accepted`);
	}
});

test("ASN bans persist, match connections, list, and unban", async () => {
	const savedBans = new Map();
	const lookups = new Map();
	const cacheValues = new Map();
	const cache = {
		get: (key) => cacheValues.get(key),
		set: (key, value) => cacheValues.set(key, value),
	};
	const database = {
		async getActiveAsnBans() {
			return [...savedBans].map(([asn, reason]) => ({ asn, reason }));
		},
		async getAsnFromIp(ip) {
			lookups.set(ip, (lookups.get(ip) || 0) + 1);
			return "AS64500";
		},
		async saveAsnBan(asn, reason) {
			savedBans.set(asn, reason);
		},
		async removeAsnBan(asn) {
			savedBans.delete(asn);
		},
	};
	const manager = createAsnBanManager(database, cache);

	assert.equal(await manager.getAsnBanForIp("203.0.113.8"), null);
	assert.equal(lookups.size, 0, "should not make ASN lookups if no bans exist");

	assert.equal(await manager.addAsnBan("as64500", "Abuse reports"), "AS64500");
	assert.deepEqual(await manager.getAsnBanForIp("203.0.113.8"), {
		asn: "AS64500",
		reason: "Abuse reports",
	});
	assert.deepEqual(await manager.listAsnBans(), [
		{ asn: "AS64500", reason: "Abuse reports" },
	]);
	assert.equal(lookups.get("203.0.113.8"), 1);

	const restartedManager = createAsnBanManager(database, cache);
	assert.deepEqual(await restartedManager.getAsnBanForIp("203.0.113.9"), {
		asn: "AS64500",
		reason: "Abuse reports",
	});

	assert.equal(await manager.removeAsnBan("AS64500"), true);
	assert.deepEqual(await manager.listAsnBans(), []);
	assert.equal(await manager.removeAsnBan("AS64500"), false);
});

test("failed ASN-ban persistence does not enable an in-memory ban", async () => {
	const manager = createAsnBanManager({
		async getActiveAsnBans() { return []; },
		async getAsnFromIp() { return "AS64500"; },
		async saveAsnBan() { throw new Error("database unavailable"); },
		async removeAsnBan() {},
	}, { get() {}, set() {} });

	await assert.rejects(manager.addAsnBan("AS64500", "test"), /database unavailable/);
	assert.deepEqual(await manager.listAsnBans(), []);
	assert.equal(await manager.getAsnBanForIp("203.0.113.10"), null);
});

test("ASN-ban commands are enforced at runlevel 8", () => {
	for (const command of commandNames) {
		assert.equal(settings.runlevel[command], 8);
		assert.equal(SERVER_MANAGEMENT_COMMANDS.has(command), true);
		assert.equal(canRunServerManagementCommand(7, command), false);
		assert.equal(canRunServerManagementCommand(8, command), true);
	}

	const serverSource = readFileSync(new URL("./server.js", import.meta.url), "utf8");
	for (const command of commandNames) {
		assert.match(serverSource, new RegExp(`"${command}": async function`));
	}
	assert.match(serverSource, /getAsnBanForIp\(ip\)/);
	assert.match(serverSource, /escapeHtml\(ban\.reason\)/);

	const clientSource = readFileSync(new URL("../client/src/script.js", import.meta.url), "utf8");
	assert.match(clientSource, /data\.errorPage === "1005"/);
	assert.match(clientSource, /new URL\("1005\.html", window\.location\.href\)/);
});