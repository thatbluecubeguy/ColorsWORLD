export class ConnectionAdmissionGuard {
	constructor({ rateGuard, maxConnectionsPerIp = 4 } = {}) {
		if (!rateGuard || typeof rateGuard.check !== "function") {
			throw new TypeError("ConnectionAdmissionGuard requires a rate guard");
		}
		this.rateGuard = rateGuard;
		this.maxConnectionsPerIp = Math.max(1, Math.floor(Number(maxConnectionsPerIp) || 4));
		this.liveSockets = new Map();
	}

	admit(ip, now = Date.now()) {
		const key = String(ip || "").trim();
		if (!key) return { action: "invalid_ip" };

		const rate = this.rateGuard.check(key, 1, now);
		if (rate?.action !== "allow") return rate;

		const live = this.liveSockets.get(key) || 0;
		if (live >= this.maxConnectionsPerIp) {
			return {
				action: "connection_limit",
				maxConnectionsPerIp: this.maxConnectionsPerIp,
			};
		}

		this.liveSockets.set(key, live + 1);
		let released = false;
		return {
			action: "allow",
			release: () => {
				if (released) return;
				released = true;
				const current = this.liveSockets.get(key) || 0;
				if (current <= 1) this.liveSockets.delete(key);
				else this.liveSockets.set(key, current - 1);
			},
		};
	}

	activeCount(ip) {
		return this.liveSockets.get(String(ip || "").trim()) || 0;
	}
}