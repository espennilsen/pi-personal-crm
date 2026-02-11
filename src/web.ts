/**
 * CRM Web UI — serves HTML + REST API for contacts management.
 *
 * Can run standalone (/crm-web) or mount on pi-webserver (automatic if available).
 * When pi-webserver is installed, the CRM auto-mounts at /crm on session start.
 */

import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { crmApi } from "./db.ts";

// ── State ───────────────────────────────────────────────────────

let standaloneServer: http.Server | null = null;
let standalonePort: number | null = null;
let webServerMounted = false;

// ── HTML Loader ─────────────────────────────────────────────────

function loadCrmHtml(): string {
	const shellHtml = fs.readFileSync(
		path.resolve(import.meta.dirname, "../crm.html"),
		"utf-8",
	);
	const pageDir = path.resolve(import.meta.dirname, "../pages");
	const pageNames = ["contacts", "companies", "groups", "interactions", "reminders", "upcoming"];
	const pagesHtml = pageNames
		.map((name) =>
			fs.readFileSync(path.join(pageDir, `${name}.html`), "utf-8"),
		)
		.join("\n\n");
	return shellHtml.replace("<!-- PAGES -->", pagesHtml);
}

// ── Core Request Handler ────────────────────────────────────────

/**
 * Core CRM request handler. Works both as a pi-webserver mount handler
 * and as the handler for the standalone server.
 *
 * @param req    HTTP request
 * @param res    HTTP response
 * @param urlPath  Request path with mount prefix stripped (e.g. "/api/crm/contacts")
 */
export async function handleCrmRequest(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	urlPath: string,
): Promise<void> {
	// Parse query params from the full request URL
	const url = new URL(req.url ?? "/", "http://localhost");
	const method = req.method ?? "GET";

	try {
		// ── Trailing-slash redirect (needed when mounted at a prefix) ──
		if (urlPath === "/" && method === "GET") {
			const rawUrl = req.url ?? "/";
			const qIdx = rawUrl.indexOf("?");
			const rawPath = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl;
			if (rawPath.length > 1 && !rawPath.endsWith("/")) {
				const qs = qIdx >= 0 ? rawUrl.slice(qIdx) : "";
				res.writeHead(301, { Location: rawPath + "/" + qs });
				res.end();
				return;
			}
		}

		// ── Main Page ───────────────────────────────────────
		if (method === "GET" && urlPath === "/") {
			const CRM_HTML = loadCrmHtml();
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end(CRM_HTML);
			return;
		}

		// ── Contacts ────────────────────────────────────────
		if (method === "GET" && urlPath === "/api/crm/contacts") {
			const companyId = url.searchParams.get("company_id");
			if (companyId) {
				json(res, 200, crmApi.getContactsByCompany(parseInt(companyId)));
				return;
			}
			const search = url.searchParams.get("q") ?? undefined;
			const limit = parseInt(url.searchParams.get("limit") ?? "1000");
			json(res, 200, crmApi.getContacts(search, limit));
			return;
		}

		if (method === "GET" && urlPath === "/api/crm/contacts/export.csv") {
			const csv = crmApi.exportContactsCsv();
			res.writeHead(200, {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": 'attachment; filename="crm-contacts.csv"',
			});
			res.end(csv);
			return;
		}

		if (method === "POST" && urlPath === "/api/crm/contacts/import") {
			const csv = await readBody(req);
			if (!csv.trim()) { json(res, 400, { error: "Empty CSV body" }); return; }
			json(res, 200, crmApi.importContactsCsv(csv));
			return;
		}

		if (method === "POST" && urlPath === "/api/crm/contacts/check-duplicates") {
			const body = JSON.parse(await readBody(req));
			if (!body.first_name) { json(res, 400, { error: "first_name is required" }); return; }
			json(res, 200, { duplicates: crmApi.findDuplicates(body) });
			return;
		}

		const contactMatch = urlPath.match(/^\/api\/crm\/contacts\/(\d+)$/);
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

		if (method === "POST" && urlPath === "/api/crm/contacts") {
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
		if (method === "GET" && urlPath === "/api/crm/companies") {
			const search = url.searchParams.get("q") ?? undefined;
			json(res, 200, crmApi.getCompanies(search));
			return;
		}

		const companyMatch = urlPath.match(/^\/api\/crm\/companies\/(\d+)$/);
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

		if (method === "POST" && urlPath === "/api/crm/companies") {
			const body = JSON.parse(await readBody(req));
			if (!body.name) { json(res, 400, { error: "name is required" }); return; }
			json(res, 201, crmApi.createCompany(body));
			return;
		}

		// ── Interactions ────────────────────────────────────
		if (method === "GET" && urlPath === "/api/crm/interactions") {
			const contactId = url.searchParams.get("contact_id");
			if (contactId) {
				json(res, 200, crmApi.getInteractions(parseInt(contactId)));
			} else {
				json(res, 200, crmApi.getAllInteractions());
			}
			return;
		}

		if (method === "POST" && urlPath === "/api/crm/interactions") {
			const body = JSON.parse(await readBody(req));
			if (!body.contact_id || !body.interaction_type || !body.summary) {
				json(res, 400, { error: "contact_id, interaction_type, and summary are required" }); return;
			}
			json(res, 201, crmApi.createInteraction(body));
			return;
		}

		const interactionMatch = urlPath.match(/^\/api\/crm\/interactions\/(\d+)$/);
		if (interactionMatch && method === "DELETE") {
			json(res, 200, { ok: crmApi.deleteInteraction(parseInt(interactionMatch[1])) });
			return;
		}

		// ── Reminders ───────────────────────────────────────
		if (method === "GET" && urlPath === "/api/crm/reminders/upcoming") {
			const days = parseInt(url.searchParams.get("days") ?? "30");
			json(res, 200, crmApi.getUpcomingReminders(days));
			return;
		}

		if (method === "GET" && urlPath === "/api/crm/reminders") {
			const contactId = url.searchParams.get("contact_id");
			json(res, 200, contactId ? crmApi.getReminders(parseInt(contactId)) : crmApi.getAllReminders());
			return;
		}

		if (method === "POST" && urlPath === "/api/crm/reminders") {
			const body = JSON.parse(await readBody(req));
			if (!body.contact_id || !body.reminder_type || !body.reminder_date) {
				json(res, 400, { error: "contact_id, reminder_type, and reminder_date are required" }); return;
			}
			json(res, 201, crmApi.createReminder(body));
			return;
		}

		const reminderMatch = urlPath.match(/^\/api\/crm\/reminders\/(\d+)$/);
		if (reminderMatch && method === "DELETE") {
			json(res, 200, { ok: crmApi.deleteReminder(parseInt(reminderMatch[1])) });
			return;
		}

		// ── Relationships ───────────────────────────────────
		if (method === "GET" && urlPath === "/api/crm/relationships") {
			const contactId = url.searchParams.get("contact_id");
			if (!contactId) { json(res, 400, { error: "contact_id is required" }); return; }
			json(res, 200, crmApi.getRelationships(parseInt(contactId)));
			return;
		}

		if (method === "POST" && urlPath === "/api/crm/relationships") {
			const body = JSON.parse(await readBody(req));
			if (!body.contact_id || !body.related_contact_id || !body.relationship_type) {
				json(res, 400, { error: "contact_id, related_contact_id, and relationship_type are required" }); return;
			}
			json(res, 201, crmApi.createRelationship(body));
			return;
		}

		const relMatch = urlPath.match(/^\/api\/crm\/relationships\/(\d+)$/);
		if (relMatch && method === "DELETE") {
			json(res, 200, { ok: crmApi.deleteRelationship(parseInt(relMatch[1])) });
			return;
		}

		// ── Groups ──────────────────────────────────────────
		if (method === "GET" && urlPath === "/api/crm/groups") {
			json(res, 200, crmApi.getGroups());
			return;
		}

		if (method === "POST" && urlPath === "/api/crm/groups") {
			const body = JSON.parse(await readBody(req));
			if (!body.name) { json(res, 400, { error: "name is required" }); return; }
			json(res, 201, crmApi.createGroup(body));
			return;
		}

		const groupMembersMatch = urlPath.match(/^\/api\/crm\/groups\/(\d+)\/members$/);
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

		const groupMemberMatch = urlPath.match(/^\/api\/crm\/groups\/(\d+)\/members\/(\d+)$/);
		if (groupMemberMatch && method === "DELETE") {
			json(res, 200, { ok: crmApi.removeGroupMember(parseInt(groupMemberMatch[1]), parseInt(groupMemberMatch[2])) });
			return;
		}

		const groupMatch = urlPath.match(/^\/api\/crm\/groups\/(\d+)$/);
		if (groupMatch && method === "DELETE") {
			json(res, 200, { ok: crmApi.deleteGroup(parseInt(groupMatch[1])) });
			return;
		}

		// 404
		json(res, 404, { error: "Not found" });
	} catch (err: any) {
		json(res, 500, { error: err.message });
	}
}

// ── Standalone Server ───────────────────────────────────────────

/**
 * Start a standalone CRM web server. Returns the URL.
 */
export function startStandaloneServer(port: number = 4100): string {
	if (standaloneServer) stopStandaloneServer();

	standaloneServer = http.createServer(async (req, res) => {
		const url = new URL(req.url ?? "/", `http://localhost:${port}`);
		await handleCrmRequest(req, res, url.pathname);
	});

	standaloneServer.listen(port);
	standalonePort = port;
	return `http://localhost:${port}`;
}

/**
 * Stop the standalone CRM web server. Returns true if a server was running.
 */
export function stopStandaloneServer(): boolean {
	if (!standaloneServer) return false;
	standaloneServer.closeAllConnections();
	standaloneServer.close();
	standaloneServer = null;
	standalonePort = null;
	return true;
}

// ── pi-webserver Integration ────────────────────────────────────

/**
 * Mount CRM routes on the shared pi-webserver via the event bus.
 * The CRM will be available at /crm on the shared server.
 */
export function mountOnWebServer(events: { emit: (event: string, data: unknown) => void }): void {
	events.emit("web:mount", {
		name: "crm",
		label: "Personal CRM",
		description: "Contact management, interactions, and reminders",
		prefix: "/crm",
		handler: handleCrmRequest,
	});
	webServerMounted = true;
}

/**
 * Unmount CRM routes from the shared pi-webserver.
 */
export function unmountFromWebServer(events: { emit: (event: string, data: unknown) => void }): void {
	events.emit("web:unmount", { name: "crm" });
	webServerMounted = false;
}

/**
 * Check if the CRM is currently mounted on pi-webserver.
 */
export function isMountedOnWebServer(): boolean {
	return webServerMounted;
}

// ── Backward Compatibility ──────────────────────────────────────

/** @deprecated Use startStandaloneServer instead */
export function startCrmServer(port?: number): string {
	return startStandaloneServer(port);
}

/** @deprecated Use stopStandaloneServer instead */
export function stopCrmServer(): boolean {
	return stopStandaloneServer();
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
