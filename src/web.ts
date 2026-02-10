/**
 * CRM Web UI — contacts page with list, detail, and interaction timeline.
 *
 * Registers routes on the host server via HostServer interface.
 * To be implemented in td-6db651.
 */

import type { HostServer } from "./host.ts";
import { crmApi } from "./db.ts";
import { readBody, jsonResponse } from "./host.ts";

/**
 * Register CRM web routes.
 * Call this from the host app (Hannah) after server is initialized.
 */
export function registerCrmWeb(getServer: () => HostServer | null): void {
	const tryRegister = () => {
		const server = getServer();
		if (!server) return false;
		doRegister(server);
		return true;
	};

	if (!tryRegister()) {
		const timer = setInterval(() => {
			if (tryRegister()) clearInterval(timer);
		}, 100);
		setTimeout(() => clearInterval(timer), 10_000);
	}
}

function doRegister(server: HostServer): void {
	// Register the CRM extension so other modules can access it
	server.registerExtension("crm", crmApi);

	// TODO: Implement routes in td-6db651
	// GET /crm — main contacts page (HTML)
	// GET /api/crm/contacts — list contacts
	// GET /api/crm/contacts/:id — get contact
	// POST /api/crm/contacts — create contact
	// PATCH /api/crm/contacts/:id — update contact
	// DELETE /api/crm/contacts/:id — delete contact
	// GET /api/crm/contacts/:id/interactions — list interactions
	// POST /api/crm/contacts/:id/interactions — log interaction
	// Similar for companies, reminders, relationships, groups
}
