import assert from "node:assert/strict";
import test from "node:test";
import { replaceIPv4Addresses } from "./ipv4Privacy.js";

test("replaces valid IPv4 literals in prose, URLs, ports, and CIDRs", () => {
	assert.equal(
		replaceIPv4Addresses("Try http://192.168.1.20:8080 or 203.0.113.7/24. Server: 198.51.100.9."),
		"Try http://[ BLACKLISTED IPv4 ]:8080 or [ BLACKLISTED IPv4 ]/24. Server: [ BLACKLISTED IPv4 ].",
	);
});

test("replaces multiple literals and IPv4-mapped IPv6 suffixes", () => {
	assert.equal(
		replaceIPv4Addresses("192.0.2.1, ::ffff:198.51.100.9"),
		"[ BLACKLISTED IPv4 ], ::ffff:[ BLACKLISTED IPv4 ]",
	);
});

test("does not partially redact invalid or extended dotted-number sequences", () => {
	const input = "256.0.0.1, 1.2.3.4.5, 192.168.1.999";
	assert.equal(replaceIPv4Addresses(input), input);
});

test("handles leading-zero IPv4 octets and leaves non-strings unchanged", () => {
	assert.equal(replaceIPv4Addresses("0177.0.0.1"), "[ BLACKLISTED IPv4 ]");
	assert.equal(replaceIPv4Addresses(null), null);
});