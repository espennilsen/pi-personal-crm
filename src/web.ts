/**
 * CRM Web UI — self-contained HTTP server for the contacts page.
 *
 * Starts on demand via /crm-web command. Serves the HTML page and REST API.
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { crmApi } from "./db.ts";

let server: http.Server | null = null;
let serverPort: number | null = null;

/**
 * Start the CRM web server. Returns the URL.
 */
export function startCrmServer(port: number = 4100): string {
	if (server) stopCrmServer();

	const CRM_HTML = fs.readFileSync(
		path.resolve(import.meta.dirname, "../crm.html"),
		"utf-8",
	);

	server = http.createServer(async (req, res) => {
		const url = new URL(req.url ?? "/", `http://localhost:${port}`);
		const method = req.method ?? "GET";

		try {
			// ── Main Page ───────────────────────────────────────
			if (method === "GET" && url.pathname === "/") {
				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				res.end(CRM_HTML);
				return;
			}

			// ── Contacts ────────────────────────────────────────
			if (method === "GET" && url.pathname === "/api/crm/contacts") {
				const search = url.searchParams.get("q") ?? undefined;
				const limit = parseInt(url.searchParams.get("limit") ?? "1000");
				json(res, 200, crmApi.getContacts(search, limit));
				return;
			}

			if (method === "GET" && url.pathname === "/api/crm/contacts/export.csv") {
				const csv = crmApi.exportContactsCsv();
				res.writeHead(200, {
					"Content-Type": "text/csv; charset=utf-8",
					"Content-Disposition": 'attachment; filename="crm-contacts.csv"',
				});
				res.end(csv);
				return;
			}

			if (method === "POST" && url.pathname === "/api/crm/contacts/import") {
				const csv = await readBody(req);
				if (!csv.trim()) { json(res, 400, { error: "Empty CSV body" }); return; }
				json(res, 200, crmApi.importContactsCsv(csv));
				return;
			}

			if (method === "POST" && url.pathname === "/api/crm/contacts/check-duplicates") {
				const body = JSON.parse(await readBody(req));
				if (!body.first_name) { json(res, 400, { error: "first_name is required" }); return; }
				json(res, 200, { duplicates: crmApi.findDuplicates(body) });
				return;
			}

			const contactMatch = url.pathname.match(/^\/api\/crm\/contacts\/(\d+)$/);
			if (contactMatch) {
				const id = parseInt(contactMatch[1]);

				if (method === "GET") {
					const contact = crmApi.getContact(id);
					if (!contact) { json(res, 404, { error: "Not found" }); return; }
					json(res, 200, {
						contact,
						interactions: crmApi.getInteractions(id),
						reminders: crmApi.getReminders(id),
						relationships: crmApi.getRelationships(id),
						groups: crmApi.getContactGroups(id),
					});
					return;
				}

				if (method === "PATCH") {
					const body = JSON.parse(await readBody(req));
					let company_id = body.company_id;
					if (body.company_name && company_id === undefined) {
						const companies = crmApi.getCompanies(body.company_name);
						if (companies.length > 0) { company_id = companies[0].id; }
						else if (body.company_name) { company_id = crmApi.createCompany({ name: body.company_name }).id; }
					}
					const contact = crmApi.updateContact(id, { ...body, company_id });
					if (!contact) { json(res, 404, { error: "Not found" }); return; }
					json(res, 200, contact);
					return;
				}

				if (method === "DELETE") {
					json(res, 200, { ok: crmApi.deleteContact(id) });
					return;
				}
			}

			if (method === "POST" && url.pathname === "/api/crm/contacts") {
				const body = JSON.parse(await readBody(req));
				if (!body.first_name) { json(res, 400, { error: "first_name is required" }); return; }
				let company_id = body.company_id;
				if (body.company_name && !company_id) {
					const companies = crmApi.getCompanies(body.company_name);
					if (companies.length > 0) { company_id = companies[0].id; }
					else { company_id = crmApi.createCompany({ name: body.company_name }).id; }
				}
				json(res, 201, crmApi.createContact({ ...body, company_id }));
				return;
			}

			// ── Companies ───────────────────────────────────────
			if (method === "GET" && url.pathname === "/api/crm/companies") {
				const search = url.searchParams.get("q") ?? undefined;
				json(res, 200, crmApi.getCompanies(search));
				return;
			}

			const companyMatch = url.pathname.match(/^\/api\/crm\/companies\/(\d+)$/);
			if (companyMatch) {
				const id = parseInt(companyMatch[1]);
				if (method === "PATCH") {
					const body = JSON.parse(await readBody(req));
					const co = crmApi.updateCompany(id, body);
					if (!co) { json(res, 404, { error: "Not found" }); return; }
					json(res, 200, co);
					return;
				}
				if (method === "DELETE") { json(res, 200, { ok: crmApi.deleteCompany(id) }); return; }
			}

			if (method === "POST" && url.pathname === "/api/crm/companies") {
				const body = JSON.parse(await readBody(req));
				if (!body.name) { json(res, 400, { error: "name is required" }); return; }
				json(res, 201, crmApi.createCompany(body));
				return;
			}

			// ── Interactions ────────────────────────────────────
			if (method === "POST" && url.pathname === "/api/crm/interactions") {
				const body = JSON.parse(await readBody(req));
				if (!body.contact_id || !body.interaction_type || !body.summary) {
					json(res, 400, { error: "contact_id, interaction_type, and summary are required" }); return;
				}
				json(res, 201, crmApi.createInteraction(body));
				return;
			}

			const interactionMatch = url.pathname.match(/^\/api\/crm\/interactions\/(\d+)$/);
			if (interactionMatch && method === "DELETE") {
				json(res, 200, { ok: crmApi.deleteInteraction(parseInt(interactionMatch[1])) });
				return;
			}

			// ── Reminders ───────────────────────────────────────
			if (method === "GET" && url.pathname === "/api/crm/reminders") {
				const contactId = url.searchParams.get("contact_id");
				json(res, 200, contactId ? crmApi.getReminders(parseInt(contactId)) : crmApi.getReminders());
				return;
			}

			if (method === "POST" && url.pathname === "/api/crm/reminders") {
				const body = JSON.parse(await readBody(req));
				if (!body.contact_id || !body.reminder_type || !body.reminder_date) {
					json(res, 400, { error: "contact_id, reminder_type, and reminder_date are required" }); return;
				}
				json(res, 201, crmApi.createReminder(body));
				return;
			}

			const reminderMatch = url.pathname.match(/^\/api\/crm\/reminders\/(\d+)$/);
			if (reminderMatch && method === "DELETE") {
				json(res, 200, { ok: crmApi.deleteReminder(parseInt(reminderMatch[1])) });
				return;
			}

			// ── Relationships ───────────────────────────────────
			if (method === "GET" && url.pathname === "/api/crm/relationships") {
				const contactId = url.searchParams.get("contact_id");
				if (!contactId) { json(res, 400, { error: "contact_id is required" }); return; }
				json(res, 200, crmApi.getRelationships(parseInt(contactId)));
				return;
			}

			if (method === "POST" && url.pathname === "/api/crm/relationships") {
				const body = JSON.parse(await readBody(req));
				if (!body.contact_id || !body.related_contact_id || !body.relationship_type) {
					json(res, 400, { error: "contact_id, related_contact_id, and relationship_type are required" }); return;
				}
				json(res, 201, crmApi.createRelationship(body));
				return;
			}

			const relMatch = url.pathname.match(/^\/api\/crm\/relationships\/(\d+)$/);
			if (relMatch && method === "DELETE") {
				json(res, 200, { ok: crmApi.deleteRelationship(parseInt(relMatch[1])) });
				return;
			}

			// ── Groups ──────────────────────────────────────────
			if (method === "GET" && url.pathname === "/api/crm/groups") {
				json(res, 200, crmApi.getGroups());
				return;
			}

			if (method === "POST" && url.pathname === "/api/crm/groups") {
				const body = JSON.parse(await readBody(req));
				if (!body.name) { json(res, 400, { error: "name is required" }); return; }
				json(res, 201, crmApi.createGroup(body));
				return;
			}

			const groupMembersMatch = url.pathname.match(/^\/api\/crm\/groups\/(\d+)\/members$/);
			if (groupMembersMatch) {
				const groupId = parseInt(groupMembersMatch[1]);
				if (method === "GET") { json(res, 200, crmApi.getGroupMembers(groupId)); return; }
				if (method === "POST") {
					const body = JSON.parse(await readBody(req));
					if (!body.contact_id) { json(res, 400, { error: "contact_id is required" }); return; }
					const ok = crmApi.addGroupMember(groupId, body.contact_id);
					json(res, ok ? 201 : 200, { ok });
					return;
				}
			}

			const groupMemberMatch = url.pathname.match(/^\/api\/crm\/groups\/(\d+)\/members\/(\d+)$/);
			if (groupMemberMatch && method === "DELETE") {
				json(res, 200, { ok: crmApi.removeGroupMember(parseInt(groupMemberMatch[1]), parseInt(groupMemberMatch[2])) });
				return;
			}

			const groupMatch = url.pathname.match(/^\/api\/crm\/groups\/(\d+)$/);
			if (groupMatch && method === "DELETE") {
				json(res, 200, { ok: crmApi.deleteGroup(parseInt(groupMatch[1])) });
				return;
			}

			// 404
			json(res, 404, { error: "Not found" });
		} catch (err: any) {
			json(res, 500, { error: err.message });
		}
	});

	server.listen(port);
	serverPort = port;
	return `http://localhost:${port}`;
}

/**
 * Stop the CRM web server. Returns true if a server was running.
 */
export function stopCrmServer(): boolean {
	if (!server) return false;
	server.closeAllConnections();
	server.close();
	server = null;
	serverPort = null;
	return true;
}

// ── Helpers ─────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
		req.on("error", reject);
	});
}

function json(res: http.ServerResponse, status: number, data: unknown): void {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(data));
}
