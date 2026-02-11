/**
 * pi-crm-personal — Personal CRM extension for pi.
 *
 * Registers the CRM tool, /crm-web command, and injects system prompt context.
 * Data is stored in ~/.pi/agent/crm/crm.db.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { initDb, crmApi } from "./db.ts";
import { registerCrmTool } from "./tool.ts";
import { startCrmServer, stopCrmServer } from "./web.ts";

function getCrmDbPath(): string {
	const dir = path.join(os.homedir(), ".pi", "agent", "crm");
	fs.mkdirSync(dir, { recursive: true });
	return path.join(dir, "crm.db");
}

export default function (pi: ExtensionAPI) {
	// Initialize DB on session start
	pi.on("session_start", async (_event, _ctx) => {
		const dbPath = getCrmDbPath();
		initDb(dbPath);
	});

	// Register the CRM tool
	registerCrmTool(pi, () => crmApi);

	// /crm-web command — start/stop the web UI server
	pi.registerCommand("crm-web", {
		description: "Start CRM web UI (or stop if already running)",
		handler: async (args, ctx) => {
			const port = parseInt(args || "4100") || 4100;
			const running = stopCrmServer();
			if (running && !args) {
				ctx.ui.notify("CRM web server stopped", "info");
				return;
			}
			const url = startCrmServer(port);
			ctx.ui.notify(`CRM web UI: ${url}`, "info");
		},
	});

	// /crm-export command
	pi.registerCommand("crm-export", {
		description: "Export CRM contacts as CSV to stdout",
		handler: async (_args, ctx) => {
			const csv = crmApi.exportContactsCsv();
			const lines = csv.split("\n");
			ctx.ui.notify(`Exported ${lines.length - 1} contacts`, "info");

			// Write to file
			const outPath = path.join(process.cwd(), "crm-contacts.csv");
			fs.writeFileSync(outPath, csv, "utf-8");
			ctx.ui.notify(`Saved to ${outPath}`, "info");
		},
	});

	// /crm-import command
	pi.registerCommand("crm-import", {
		description: "Import contacts from a CSV file: /crm-import path/to/file.csv",
		handler: async (args, ctx) => {
			if (!args) {
				ctx.ui.notify("Usage: /crm-import path/to/file.csv", "error");
				return;
			}

			const filePath = path.resolve(args.trim());
			if (!fs.existsSync(filePath)) {
				ctx.ui.notify(`File not found: ${filePath}`, "error");
				return;
			}

			const csv = fs.readFileSync(filePath, "utf-8");
			const result = crmApi.importContactsCsv(csv);

			let msg = `Created: ${result.created}, Skipped: ${result.skipped}`;
			if (result.duplicates.length > 0) {
				msg += `, Duplicates: ${result.duplicates.length}`;
			}
			if (result.errors.length > 0) {
				msg += `, Errors: ${result.errors.length}`;
			}
			ctx.ui.notify(msg, result.errors.length > 0 ? "warning" : "info");
		},
	});

	// Clean up on shutdown
	pi.on("session_shutdown", async () => {
		stopCrmServer();
	});
}
