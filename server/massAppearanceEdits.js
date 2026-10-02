import { replaceIPv4Addresses } from "./ipv4Privacy.js";

export const MASS_APPEARANCE_EDIT_COMMANDS = Object.freeze([
	"massnameedit",
	"masshatedit",
	"masscoloredit",
]);

const EDITS = Object.freeze({
	massnameedit: { label: "name", maxLength: 100 },
	masshatedit: { label: "hat", maxLength: 256 },
	masscoloredit: { label: "color", maxLength: 2048 },
});

export function parseMassAppearanceEditRequest(command, input) {
	const edit = EDITS[command];
	if (!edit) return { error: "Unknown mass appearance edit." };

	const value = String(input ?? "").trim();
	if (!value) return { error: `Usage: /${command} <${edit.label} value>` };
	if (value.length > edit.maxLength) {
		return { error: `The ${edit.label} value must be ${edit.maxLength} characters or fewer.` };
	}
	if (/[\u0000-\u001f\u007f]/u.test(value)) {
		return { error: "The value cannot contain control characters." };
	}
	return { value };
}

export function applyMassAppearanceEdit(user, command, value) {
	if (!user?.public || !EDITS[command] || typeof value !== "string") return false;

	if (command === "massnameedit") {
		user.public.name = replaceIPv4Addresses(value);
		return true;
	}
	if (command === "masscoloredit") {
		user.public.color = value;
		return true;
	}

	const baseColor = String(user.public.color || "purple").trim().split(/\s+/u)[0] || "purple";
	user.public.color = value.toLowerCase() === "none"
		? baseColor
		: `${baseColor} ${value}`;
	return true;
}