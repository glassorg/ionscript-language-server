
const fs = require("fs");

var root = null;
exports.getGlobalModuleRoot = function getGlobalModuleRoot() {
	if (root == null) {
		let possibleRoots = [
			"/usr/local/lib/node_modules/", // mac, linux
			"/usr/lib/node_modules/", // linux (some installations)
			`${process.env.APPDATA}\\npm\\node_modules\\` // windows
		]
		for (let check of possibleRoots) {
			if (fs.existsSync(check)) {
				root = check;
				break;
			}
		}
	}
	return root || "";
}