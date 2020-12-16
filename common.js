
const fs = require("fs");

var root = null;
exports.getGlobalModuleRoot = function getGlobalModuleRoot() {
	if (root == null) {
		for (let check of ["/usr/local/lib/node_modules/"]) {
			if (fs.existsSync(check)) {
				root = check;
				break;
			}
		}
	}
	return root || "";
}