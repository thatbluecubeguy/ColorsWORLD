import assert from "node:assert/strict";
import test from "node:test";
import { getSafetyPageTarget } from "./safetyPageRouting.js";

test("inactive safety modes do not select a holding page", () => {
	assert.equal(getSafetyPageTarget({}), null);
});

test("maintenance mode selects the maintenance warning page", () => {
	assert.equal(getSafetyPageTarget({ maintenance: true }), "/maintenance.html");
});

test("emergency lockdown selects the lockdown warning page", () => {
	assert.equal(getSafetyPageTarget({ emergencyLockdown: true }), "/lockdown.html");
});

test("emergency lockdown takes priority when both modes are enabled", () => {
	assert.equal(
		getSafetyPageTarget({ maintenance: true, emergencyLockdown: true }),
		"/lockdown.html",
	);
});