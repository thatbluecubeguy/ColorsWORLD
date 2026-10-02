export function getSafetyPageTarget({ maintenance = false, emergencyLockdown = false } = {}) {
	if (emergencyLockdown) return "/lockdown.html";
	if (maintenance) return "/maintenance.html";
	return null;
}