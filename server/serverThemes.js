export const SERVER_THEME_NAMES = Object.freeze([
	"vaporwave",
	"acid",
	"frutiger",
	"terminal",
]);

export function toggleServerTheme(themes, theme) {
	if (!SERVER_THEME_NAMES.includes(theme)) {
		throw new RangeError(`Unknown server theme: ${theme}`);
	}

	const active = new Set(
		Array.isArray(themes)
			? themes.filter(name => SERVER_THEME_NAMES.includes(name))
			: [],
	);
	if (active.has(theme)) active.delete(theme);
	else active.add(theme);

	return SERVER_THEME_NAMES.filter(name => active.has(name));
}