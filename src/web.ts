/**
 * CRM Web UI — contacts page with list, detail, and interaction timeline.
 *
 * Registers routes on the host server via HostServer interface.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { HostServer } from "./host.ts";
import { crmApi } from "./db.ts";
import { readBody, jsonResponse } from "./host.ts";

// Load the HTML page once at module init
const CRM_HTML = fs.readFileSync(
	path.resolve(import.meta.dirname, "../crm.html"),
	"utf-8",
);

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

	// ── Main Page ───────────────────────────────────────────────

	server.addWebRoute("GET", "/crm", (_req, res) => {
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(CRM_HTML);
	});

	// ── Contacts ────────────────────────────────────────────────

	// GET /api/crm/contacts — list contacts
	server.addWebRoute("GET", "/api/crm/contacts", (_req, res, url) => {
		const search = url.searchParams.get("q") ?? undefined;
		const limit = parseInt(url.searchParams.get("limit") ?? "1000");
		const contacts = crmApi.getContacts(search, limit);
		jsonResponse(res, 200, contacts);
	});

	// GET /api/crm/contacts/:id — get contact detail with interactions, reminders, relationships
	server.addWebRoute("GET", "/api/crm/contacts/:id", (_req, res, url) => {
		const match = url.pathname.match(/\/api\/crm\/contacts\/(\d+)$/);
		if (!match) {
			jsonResponse(res, 400, { error: "Invalid contact ID" });
			return;
		}

		const id = parseInt(match[1]);
		const contact = crmApi.getContact(id);
		
		if (!contact) {
			jsonResponse(res, 404, { error: "Contact not found" });
			return;
		}

		const interactions = crmApi.getInteractions(id);
		const reminders = crmApi.getReminders(id);
		const relationships = crmApi.getRelationships(id);
		const groups = crmApi.getContactGroups(id);

		jsonResponse(res, 200, {
			contact,
			interactions,
			reminders,
			relationships,
			groups,
		});
	});

	// POST /api/crm/contacts — create contact
	server.addWebRoute("POST", "/api/crm/contacts", async (req, res) => {
		try {
			const body = JSON.parse(await readBody(req));

			if (!body.first_name) {
				jsonResponse(res, 400, { error: "first_name is required" });
				return;
			}

			// Handle company by name
			let company_id = body.company_id;
			if (body.company_name && !company_id) {
				const companies = crmApi.getCompanies(body.company_name);
				if (companies.length > 0) {
					company_id = companies[0].id;
				} else {
					// Create company
					const newCompany = crmApi.createCompany({ name: body.company_name });
					company_id = newCompany.id;
				}
			}

			const contact = crmApi.createContact({
				first_name: body.first_name,
				last_name: body.last_name,
				email: body.email,
				phone: body.phone,
				company_id,
				birthday: body.birthday,
				anniversary: body.anniversary,
				tags: body.tags,
				notes: body.notes,
			});

			jsonResponse(res, 201, contact);
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// PATCH /api/crm/contacts/:id — update contact
	server.addWebRoute("PATCH", "/api/crm/contacts/:id", async (req, res, url) => {
		try {
			const match = url.pathname.match(/\/api\/crm\/contacts\/(\d+)$/);
			if (!match) {
				jsonResponse(res, 400, { error: "Invalid contact ID" });
				return;
			}

			const id = parseInt(match[1]);
			const body = JSON.parse(await readBody(req));

			// Handle company by name
			let company_id = body.company_id;
			if (body.company_name && body.company_id === undefined) {
				const companies = crmApi.getCompanies(body.company_name);
				if (companies.length > 0) {
					company_id = companies[0].id;
				} else if (body.company_name) {
					const newCompany = crmApi.createCompany({ name: body.company_name });
					company_id = newCompany.id;
				}
			}

			const contact = crmApi.updateContact(id, {
				first_name: body.first_name,
				last_name: body.last_name,
				email: body.email,
				phone: body.phone,
				company_id,
				birthday: body.birthday,
				anniversary: body.anniversary,
				tags: body.tags,
				notes: body.notes,
			});

			if (!contact) {
				jsonResponse(res, 404, { error: "Contact not found" });
				return;
			}

			jsonResponse(res, 200, contact);
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// DELETE /api/crm/contacts/:id — delete contact
	server.addWebRoute("DELETE", "/api/crm/contacts/:id", (_req, res, url) => {
		const match = url.pathname.match(/\/api\/crm\/contacts\/(\d+)$/);
		if (!match) {
			jsonResponse(res, 400, { error: "Invalid contact ID" });
			return;
		}

		const id = parseInt(match[1]);
		const ok = crmApi.deleteContact(id);

		jsonResponse(res, 200, { ok });
	});

	// ── Import/Export ───────────────────────────────────────────

	// GET /api/crm/contacts/export.csv — export all contacts as CSV
	server.addWebRoute("GET", "/api/crm/contacts/export.csv", (_req, res) => {
		const csv = crmApi.exportContactsCsv();
		res.writeHead(200, {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": 'attachment; filename="crm-contacts.csv"',
		});
		res.end(csv);
	});

	// POST /api/crm/contacts/import — import contacts from CSV
	server.addWebRoute("POST", "/api/crm/contacts/import", async (req, res) => {
		try {
			const csv = await readBody(req);
			if (!csv.trim()) {
				jsonResponse(res, 400, { error: "Empty CSV body" });
				return;
			}
			const result = crmApi.importContactsCsv(csv);
			jsonResponse(res, 200, result);
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// POST /api/crm/contacts/check-duplicates — check for duplicates before creating
	server.addWebRoute("POST", "/api/crm/contacts/check-duplicates", async (req, res) => {
		try {
			const body = JSON.parse(await readBody(req));
			if (!body.first_name) {
				jsonResponse(res, 400, { error: "first_name is required" });
				return;
			}
			const duplicates = crmApi.findDuplicates({
				email: body.email,
				first_name: body.first_name,
				last_name: body.last_name,
			});
			jsonResponse(res, 200, { duplicates });
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// ── Companies ───────────────────────────────────────────────

	// GET /api/crm/companies — list companies
	server.addWebRoute("GET", "/api/crm/companies", (_req, res, url) => {
		const search = url.searchParams.get("q") ?? undefined;
		const companies = crmApi.getCompanies(search);
		jsonResponse(res, 200, companies);
	});

	// DELETE /api/crm/companies/:id — delete company
	server.addWebRoute("DELETE", "/api/crm/companies/:id", (_req, res, url) => {
		const match = url.pathname.match(/\/api\/crm\/companies\/(\d+)$/);
		if (!match) {
			jsonResponse(res, 400, { error: "Invalid company ID" });
			return;
		}

		const id = parseInt(match[1]);
		const ok = crmApi.deleteCompany(id);
		jsonResponse(res, 200, { ok });
	});

	// PATCH /api/crm/companies/:id — update company
	server.addWebRoute("PATCH", "/api/crm/companies/:id", async (req, res, url) => {
		try {
			const match = url.pathname.match(/\/api\/crm\/companies\/(\d+)$/);
			if (!match) {
				jsonResponse(res, 400, { error: "Invalid company ID" });
				return;
			}

			const id = parseInt(match[1]);
			const body = JSON.parse(await readBody(req));

			const company = crmApi.updateCompany(id, {
				name: body.name,
				website: body.website,
				industry: body.industry,
				notes: body.notes,
			});

			if (!company) {
				jsonResponse(res, 404, { error: "Company not found" });
				return;
			}

			jsonResponse(res, 200, company);
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// POST /api/crm/companies — create company
	server.addWebRoute("POST", "/api/crm/companies", async (req, res) => {
		try {
			const body = JSON.parse(await readBody(req));

			if (!body.name) {
				jsonResponse(res, 400, { error: "name is required" });
				return;
			}

			const company = crmApi.createCompany({
				name: body.name,
				website: body.website,
				industry: body.industry,
				notes: body.notes,
			});

			jsonResponse(res, 201, company);
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// ── Interactions ────────────────────────────────────────────

	// POST /api/crm/interactions — log interaction
	server.addWebRoute("POST", "/api/crm/interactions", async (req, res) => {
		try {
			const body = JSON.parse(await readBody(req));

			if (!body.contact_id || !body.interaction_type || !body.summary) {
				jsonResponse(res, 400, { error: "contact_id, interaction_type, and summary are required" });
				return;
			}

			const interaction = crmApi.createInteraction({
				contact_id: body.contact_id,
				interaction_type: body.interaction_type,
				summary: body.summary,
				notes: body.notes,
				happened_at: body.happened_at,
			});

			jsonResponse(res, 201, interaction);
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// DELETE /api/crm/interactions/:id — delete interaction
	server.addWebRoute("DELETE", "/api/crm/interactions/:id", (_req, res, url) => {
		const match = url.pathname.match(/\/api\/crm\/interactions\/(\d+)$/);
		if (!match) {
			jsonResponse(res, 400, { error: "Invalid interaction ID" });
			return;
		}

		const id = parseInt(match[1]);
		const ok = crmApi.deleteInteraction(id);
		jsonResponse(res, 200, { ok });
	});

	// ── Reminders ───────────────────────────────────────────────

	// GET /api/crm/reminders — list reminders
	server.addWebRoute("GET", "/api/crm/reminders", (_req, res, url) => {
		const contactId = url.searchParams.get("contact_id");
		const reminders = contactId
			? crmApi.getReminders(parseInt(contactId))
			: crmApi.getReminders();
		jsonResponse(res, 200, reminders);
	});

	// POST /api/crm/reminders — create reminder
	server.addWebRoute("POST", "/api/crm/reminders", async (req, res) => {
		try {
			const body = JSON.parse(await readBody(req));

			if (!body.contact_id || !body.reminder_type || !body.reminder_date) {
				jsonResponse(res, 400, { error: "contact_id, reminder_type, and reminder_date are required" });
				return;
			}

			const reminder = crmApi.createReminder({
				contact_id: body.contact_id,
				reminder_type: body.reminder_type,
				reminder_date: body.reminder_date,
				message: body.message,
			});

			jsonResponse(res, 201, reminder);
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// DELETE /api/crm/reminders/:id — delete reminder
	server.addWebRoute("DELETE", "/api/crm/reminders/:id", (_req, res, url) => {
		const match = url.pathname.match(/\/api\/crm\/reminders\/(\d+)$/);
		if (!match) {
			jsonResponse(res, 400, { error: "Invalid reminder ID" });
			return;
		}

		const id = parseInt(match[1]);
		const ok = crmApi.deleteReminder(id);
		jsonResponse(res, 200, { ok });
	});

	// ── Relationships ───────────────────────────────────────────

	// GET /api/crm/relationships?contact_id=N — list relationships for a contact
	server.addWebRoute("GET", "/api/crm/relationships", (_req, res, url) => {
		const contactId = url.searchParams.get("contact_id");
		if (!contactId) {
			jsonResponse(res, 400, { error: "contact_id is required" });
			return;
		}
		const relationships = crmApi.getRelationships(parseInt(contactId));
		jsonResponse(res, 200, relationships);
	});

	// POST /api/crm/relationships — create relationship
	server.addWebRoute("POST", "/api/crm/relationships", async (req, res) => {
		try {
			const body = JSON.parse(await readBody(req));

			if (!body.contact_id || !body.related_contact_id || !body.relationship_type) {
				jsonResponse(res, 400, { error: "contact_id, related_contact_id, and relationship_type are required" });
				return;
			}

			const relationship = crmApi.createRelationship({
				contact_id: body.contact_id,
				related_contact_id: body.related_contact_id,
				relationship_type: body.relationship_type,
				notes: body.notes,
			});

			jsonResponse(res, 201, relationship);
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// DELETE /api/crm/relationships/:id — delete relationship
	server.addWebRoute("DELETE", "/api/crm/relationships/:id", (_req, res, url) => {
		const match = url.pathname.match(/\/api\/crm\/relationships\/(\d+)$/);
		if (!match) {
			jsonResponse(res, 400, { error: "Invalid relationship ID" });
			return;
		}

		const id = parseInt(match[1]);
		const ok = crmApi.deleteRelationship(id);
		jsonResponse(res, 200, { ok });
	});

	// ── Groups ──────────────────────────────────────────────────

	// GET /api/crm/groups — list groups
	server.addWebRoute("GET", "/api/crm/groups", (_req, res) => {
		const groups = crmApi.getGroups();
		jsonResponse(res, 200, groups);
	});

	// POST /api/crm/groups — create group
	server.addWebRoute("POST", "/api/crm/groups", async (req, res) => {
		try {
			const body = JSON.parse(await readBody(req));

			if (!body.name) {
				jsonResponse(res, 400, { error: "name is required" });
				return;
			}

			const group = crmApi.createGroup({
				name: body.name,
				description: body.description,
			});

			jsonResponse(res, 201, group);
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// GET /api/crm/groups/:id/members — list group members
	server.addWebRoute("GET", "/api/crm/groups/:id/members", (_req, res, url) => {
		const match = url.pathname.match(/\/api\/crm\/groups\/(\d+)\/members$/);
		if (!match) {
			jsonResponse(res, 400, { error: "Invalid group ID" });
			return;
		}

		const groupId = parseInt(match[1]);
		const members = crmApi.getGroupMembers(groupId);
		jsonResponse(res, 200, members);
	});

	// POST /api/crm/groups/:id/members — add contact to group
	server.addWebRoute("POST", "/api/crm/groups/:id/members", async (req, res, url) => {
		try {
			const match = url.pathname.match(/\/api\/crm\/groups\/(\d+)\/members$/);
			if (!match) {
				jsonResponse(res, 400, { error: "Invalid group ID" });
				return;
			}

			const groupId = parseInt(match[1]);
			const body = JSON.parse(await readBody(req));

			if (!body.contact_id) {
				jsonResponse(res, 400, { error: "contact_id is required" });
				return;
			}

			const ok = crmApi.addGroupMember(groupId, body.contact_id);
			jsonResponse(res, ok ? 201 : 200, { ok });
		} catch (err: any) {
			jsonResponse(res, 400, { error: err.message });
		}
	});

	// DELETE /api/crm/groups/:id/members/:contactId — remove contact from group
	server.addWebRoute("DELETE", "/api/crm/groups/:id/members/:contactId", (_req, res, url) => {
		const match = url.pathname.match(/\/api\/crm\/groups\/(\d+)\/members\/(\d+)$/);
		if (!match) {
			jsonResponse(res, 400, { error: "Invalid group or contact ID" });
			return;
		}

		const groupId = parseInt(match[1]);
		const contactId = parseInt(match[2]);
		const ok = crmApi.removeGroupMember(groupId, contactId);
		jsonResponse(res, 200, { ok });
	});

	// DELETE /api/crm/groups/:id — delete group
	server.addWebRoute("DELETE", "/api/crm/groups/:id", (_req, res, url) => {
		const match = url.pathname.match(/\/api\/crm\/groups\/(\d+)$/);
		if (!match) {
			jsonResponse(res, 400, { error: "Invalid group ID" });
			return;
		}

		const id = parseInt(match[1]);
		const ok = crmApi.deleteGroup(id);
		jsonResponse(res, 200, { ok });
	});
}
