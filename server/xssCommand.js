export function runXssCommand(user, text) {
	user.room.emit("xss", {
		guid: user.guid,
		text,
	});
	return true;
}

export function runMassInjectCommand(user, text) {
for (const target of user.room.users) {
target.socket.emit("codeinject", { guid: target.guid, text });
}
return true;
}