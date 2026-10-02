import assert from "node:assert/strict";
import test from "node:test";
import { ConnectionAdmissionGuard } from "./connectionAdmission.js";

test("connection slots are limited per IP and released once", () => {
	const guard = new ConnectionAdmissionGuard({
		maxConnectionsPerIp: 2,
		rateGuard: { check: () => ({ action: "allow" }) },
	});

	const first = guard.admit("203.0.113.10");
	const second = guard.admit("203.0.113.10");
	assert.equal(first.action, "allow");
	assert.equal(second.action, "allow");
	assert.equal(guard.activeCount("203.0.113.10"), 2);
	assert.equal(guard.admit("203.0.113.10").action, "connection_limit");

	first.release();
	first.release();
	assert.equal(guard.activeCount("203.0.113.10"), 1);
	assert.equal(guard.admit("203.0.113.10").action, "allow");
	assert.equal(guard.activeCount("203.0.113.10"), 2);

	second.release();
	assert.equal(guard.activeCount("203.0.113.10"), 1);
});

test("connection slots are isolated between IPs", () => {
	const guard = new ConnectionAdmissionGuard({
		maxConnectionsPerIp: 1,
		rateGuard: { check: () => ({ action: "allow" }) },
	});

	const first = guard.admit("203.0.113.10");
	const second = guard.admit("203.0.113.11");
	assert.equal(first.action, "allow");
	assert.equal(second.action, "allow");
	assert.equal(guard.activeCount("203.0.113.10"), 1);
	assert.equal(guard.activeCount("203.0.113.11"), 1);
});

test("rate-limited and unidentified clients do not consume connection slots", () => {
	let action = "drop";
	const guard = new ConnectionAdmissionGuard({
		rateGuard: { check: () => ({ action }) },
	});

	assert.equal(guard.admit("203.0.113.10").action, "drop");
	assert.equal(guard.admit("").action, "invalid_ip");
	assert.equal(guard.activeCount("203.0.113.10"), 0);

	action = "allow";
	const accepted = guard.admit("203.0.113.10");
	assert.equal(accepted.action, "allow");
	accepted.release();
	assert.equal(guard.activeCount("203.0.113.10"), 0);
});