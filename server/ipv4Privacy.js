const BLACKLISTED_IPV4 = "[ BLACKLISTED IPv4 ]";
const IPV4_CANDIDATE_RE = /(^|[^0-9.])((?:\d{1,4}\.){3}\d{1,4})(?!\d|\.\d)/g;

export function replaceIPv4Addresses(value) {
	if (typeof value !== "string") return value;

	return value.replace(IPV4_CANDIDATE_RE, (match, prefix, candidate) => {
		const octets = candidate.split(".");
		const values = octets.map((octet) => (
			octet.length > 1 && /^0[0-7]+$/.test(octet)
				? Number.parseInt(octet, 8)
				: Number(octet)
		));
		if (values.some((octet) => octet > 255)) return match;
		return `${prefix}${BLACKLISTED_IPV4}`;
	});
}