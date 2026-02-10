/**
 * CRM Pi Tool — contact lookup, interaction logging, search.
 *
 * Conversational CRM operations accessible from Pi agent prompts.
 */

import type { CrmApi } from "./types.ts";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";

// Note: ExtensionAPI is from @mariozechner/pi-coding-agent
// We define minimal interface here to avoid hard dependency
interface ExtensionAPI {
	registerTool(tool: any): void;
	on(event: string, handler: (...args: any[]) => any): void;
}

/**
 * Register the CRM tool with Pi.
 * @param pi ExtensionAPI from Pi coding agent
 * @param getCrm Function that returns the CrmApi instance
 */
export function registerCrmTool(pi: ExtensionAPI, getCrm: () => CrmApi | null): void {
	// ── System prompt injection ───────────────────────────────

	pi.on("before_agent_start", async (event: any) => {
		return {
			systemPrompt:
				event.systemPrompt +
				"\n\n---\n\n" +
				"## CRM Tool\n\n" +
				"You have access to a personal CRM system via the `crm` tool.\n\n" +
				"**Common workflows:**\n" +
				"- \"Tell me about John Doe\" → crm.contact with name=\"John Doe\"\n" +
				"- \"Who works at Acme?\" → crm.search with query=\"Acme\"\n" +
				"- \"Log a call with John\" → crm.log_interaction\n" +
				"- \"What's coming up this week?\" → crm.upcoming\n" +
				"- \"Add Sarah's birthday\" → crm.add_reminder\n\n" +
				"**Actions:**\n" +
				"- search — Full-text search across contacts and companies\n" +
				"- contact — Get full contact details with interactions, relationships, reminders\n" +
				"- add_contact — Create a new contact\n" +
				"- update_contact — Update contact fields\n" +
				"- log_interaction — Log a call, meeting, email, note, or gift\n" +
				"- add_reminder — Set a birthday, anniversary, or custom reminder\n" +
				"- upcoming — Show upcoming birthdays and reminders\n" +
				"- list_companies — List all companies\n" +
				"- add_company — Create a new company\n\n" +
				"**Interaction types:** call, meeting, email, note, gift, message\n\n" +
				"When creating/updating contacts, capture: name, email, phone, company, birthday, tags, notes.",
		};
	});

	// Helper to return text response
	const text = (s: string) => ({ content: [{ type: "text" as const, text: s }], details: {} });

	// ── search ──────────────────────────────────────────────────

	pi.registerTool({
		name: "crm",
		label: "CRM",
		description: "Search and manage contacts, companies, and interactions in the personal CRM.",
		parameters: Type.Object({
			action: StringEnum(
				["search", "contact", "add_contact", "update_contact", "log_interaction", "add_reminder", "upcoming", "list_companies", "add_company"] as const,
				{ description: "CRM action to perform" },
			),

			// Search
			query: Type.Optional(Type.String({ description: "Search query (for search action)" })),

			// Contact lookup
			contact_id: Type.Optional(Type.Number({ description: "Contact ID (for contact, update_contact, log_interaction, add_reminder)" })),
			name: Type.Optional(Type.String({ description: "Contact name to search (for contact action as alternative to ID)" })),

			// Add/update contact
			first_name: Type.Optional(Type.String({ description: "First name (required for add_contact)" })),
			last_name: Type.Optional(Type.String({ description: "Last name" })),
			email: Type.Optional(Type.String({ description: "Email address" })),
			phone: Type.Optional(Type.String({ description: "Phone number" })),
			company_id: Type.Optional(Type.Number({ description: "Company ID" })),
			company_name: Type.Optional(Type.String({ description: "Company name (will create if doesn't exist)" })),
			birthday: Type.Optional(Type.String({ description: "Birthday in YYYY-MM-DD format" })),
			anniversary: Type.Optional(Type.String({ description: "Anniversary in YYYY-MM-DD format" })),
			tags: Type.Optional(Type.String({ description: "Comma-separated tags" })),
			notes: Type.Optional(Type.String({ description: "Notes about the contact" })),

			// Log interaction
			interaction_type: Type.Optional(
				StringEnum(["call", "meeting", "email", "note", "gift", "message"] as const, {
					description: "Type of interaction",
				}),
			),
			summary: Type.Optional(Type.String({ description: "Interaction summary (required for log_interaction)" })),
			interaction_notes: Type.Optional(Type.String({ description: "Detailed notes about the interaction" })),
			happened_at: Type.Optional(Type.String({ description: "When it happened (ISO timestamp, defaults to now)" })),

			// Add reminder
			reminder_type: Type.Optional(
				StringEnum(["birthday", "anniversary", "custom"] as const, {
					description: "Type of reminder",
				}),
			),
			reminder_date: Type.Optional(Type.String({ description: "Reminder date in YYYY-MM-DD format" })),
			reminder_message: Type.Optional(Type.String({ description: "Custom reminder message" })),

			// Upcoming
			days: Type.Optional(Type.Number({ description: "Number of days ahead to look (default: 7)" })),

			// Company
			industry: Type.Optional(Type.String({ description: "Company industry" })),
			website: Type.Optional(Type.String({ description: "Company website URL" })),
		}),

		async execute(_toolCallId: string, params: any, _signal: any, _onUpdate: any, _ctx: any) {
			const crm = getCrm();
			if (!crm) {
				return text("❌ CRM not available (extension not loaded)");
			}

			try {
				// ── search ──────────────────────────────────────────

				if (params.action === "search") {
					if (!params.query) {
						return text("❌ query is required for search");
					}

					const contacts = crm.searchContacts(params.query, 20);
					const companies = crm.searchCompanies(params.query, 10);

					if (contacts.length === 0 && companies.length === 0) {
						return text(`🔍 No results found for "${params.query}"`);
					}

					let result = `🔍 Search results for "${params.query}":\n\n`;

					if (contacts.length > 0) {
						result += `**Contacts (${contacts.length}):**\n`;
						for (const c of contacts) {
							const company = c.company_name ? ` @ ${c.company_name}` : "";
							const email = c.email ? ` <${c.email}>` : "";
							result += `- ${c.first_name} ${c.last_name || ""}${company}${email} (ID: ${c.id})\n`;
						}
					}

					if (companies.length > 0) {
						result += `\n**Companies (${companies.length}):**\n`;
						for (const co of companies) {
							const website = co.website ? ` — ${co.website}` : "";
							result += `- ${co.name}${website} (ID: ${co.id})\n`;
						}
					}

					return text(result.trim());
				}

				// ── contact ─────────────────────────────────────────

				if (params.action === "contact") {
					let contact = null;

					if (params.contact_id) {
						contact = crm.getContact(params.contact_id);
					} else if (params.name) {
						// Search by name
						const results = crm.searchContacts(params.name, 5);
						if (results.length === 0) {
							return text(`❌ No contact found matching "${params.name}"`);
						}
						if (results.length > 1) {
							let list = `🔍 Multiple contacts found for "${params.name}":\n\n`;
							for (const c of results) {
								list += `- ${c.first_name} ${c.last_name || ""} (${c.email || "no email"}) — ID: ${c.id}\n`;
							}
							list += `\nPlease specify contact_id.`;
							return text(list);
						}
						contact = results[0];
					} else {
						return text("❌ Either contact_id or name is required");
					}

					if (!contact) {
						return text(`❌ Contact not found`);
					}

					// Build contact card
					let card = `👤 **${contact.first_name} ${contact.last_name || ""}**\n\n`;

					if (contact.email) card += `📧 ${contact.email}\n`;
					if (contact.phone) card += `📞 ${contact.phone}\n`;
					if (contact.company_name) card += `🏢 ${contact.company_name}\n`;
					if (contact.birthday) card += `🎂 Birthday: ${contact.birthday}\n`;
					if (contact.anniversary) card += `💍 Anniversary: ${contact.anniversary}\n`;
					if (contact.tags) card += `🏷️  Tags: ${contact.tags}\n`;
					if (contact.notes) card += `\n📝 **Notes:**\n${contact.notes}\n`;

					// Recent interactions
					const interactions = crm.getInteractions(contact.id);
					if (interactions.length > 0) {
						card += `\n**Recent Interactions (${interactions.length}):**\n`;
						const recent = interactions.slice(0, 5);
						for (const i of recent) {
							const date = new Date(i.happened_at).toLocaleDateString();
							card += `- ${i.interaction_type} (${date}): ${i.summary}\n`;
							if (i.notes) card += `  ${i.notes}\n`;
						}
					}

					// Relationships
					const relationships = crm.getRelationships(contact.id);
					if (relationships.length > 0) {
						card += `\n**Relationships:**\n`;
						for (const r of relationships) {
							card += `- ${r.relationship_type}: ${r.first_name} ${r.last_name}\n`;
						}
					}

					// Reminders
					const reminders = crm.getReminders(contact.id);
					if (reminders.length > 0) {
						card += `\n**Reminders:**\n`;
						for (const r of reminders) {
							card += `- ${r.reminder_type}: ${r.reminder_date}`;
							if (r.message) card += ` — ${r.message}`;
							card += `\n`;
						}
					}

					card += `\n_Contact ID: ${contact.id}_`;

					return text(card.trim());
				}

				// ── add_contact ─────────────────────────────────────

				if (params.action === "add_contact") {
					if (!params.first_name) {
						return text("❌ first_name is required");
					}

					// Handle company by name
					let company_id = params.company_id;
					if (params.company_name && !company_id) {
						const companies = crm.searchCompanies(params.company_name, 1);
						if (companies.length > 0) {
							company_id = companies[0].id;
						} else {
							// Create company
							const newCompany = crm.createCompany({ name: params.company_name });
							company_id = newCompany.id;
						}
					}

					const contact = crm.createContact({
						first_name: params.first_name,
						last_name: params.last_name,
						email: params.email,
						phone: params.phone,
						company_id,
						birthday: params.birthday,
						anniversary: params.anniversary,
						tags: params.tags,
						notes: params.notes,
					});

					return text(
						`✅ Created contact: ${contact.first_name} ${contact.last_name || ""} (ID: ${contact.id})`,
					);
				}

				// ── update_contact ──────────────────────────────────

				if (params.action === "update_contact") {
					if (!params.contact_id) {
						return text("❌ contact_id is required");
					}

					const updated = crm.updateContact(params.contact_id, {
						first_name: params.first_name,
						last_name: params.last_name,
						email: params.email,
						phone: params.phone,
						company_id: params.company_id,
						birthday: params.birthday,
						anniversary: params.anniversary,
						tags: params.tags,
						notes: params.notes,
					});

					if (!updated) {
						return text(`❌ Contact ${params.contact_id} not found`);
					}

					return text(`✅ Updated contact: ${updated.first_name} ${updated.last_name || ""}`);
				}

				// ── log_interaction ─────────────────────────────────

				if (params.action === "log_interaction") {
					if (!params.contact_id) {
						return text("❌ contact_id is required");
					}
					if (!params.summary) {
						return text("❌ summary is required");
					}
					if (!params.interaction_type) {
						return text("❌ interaction_type is required (call, meeting, email, note, gift, message)");
					}

					const interaction = crm.createInteraction({
						contact_id: params.contact_id,
						interaction_type: params.interaction_type,
						summary: params.summary,
						notes: params.interaction_notes,
						happened_at: params.happened_at,
					});

					const contact = crm.getContact(params.contact_id);
					const contactName = contact ? `${contact.first_name} ${contact.last_name || ""}` : `ID ${params.contact_id}`;

					return text(
						`✅ Logged ${params.interaction_type} with ${contactName}: ${params.summary}`,
					);
				}

				// ── add_reminder ────────────────────────────────────

				if (params.action === "add_reminder") {
					if (!params.contact_id) {
						return text("❌ contact_id is required");
					}
					if (!params.reminder_type) {
						return text("❌ reminder_type is required (birthday, anniversary, custom)");
					}
					if (!params.reminder_date) {
						return text("❌ reminder_date is required (YYYY-MM-DD)");
					}

					const reminder = crm.createReminder({
						contact_id: params.contact_id,
						reminder_type: params.reminder_type,
						reminder_date: params.reminder_date,
						message: params.reminder_message,
					});

					const contact = crm.getContact(params.contact_id);
					const contactName = contact ? `${contact.first_name} ${contact.last_name || ""}` : `ID ${params.contact_id}`;

					return text(
						`✅ Added ${params.reminder_type} reminder for ${contactName} on ${params.reminder_date}`,
					);
				}

				// ── upcoming ────────────────────────────────────────

				if (params.action === "upcoming") {
					const days = params.days ?? 7;
					const reminders = crm.getUpcomingReminders(days);

					if (reminders.length === 0) {
						return text(`📅 No upcoming reminders in the next ${days} days`);
					}

					let result = `📅 Upcoming reminders (next ${days} days):\n\n`;
					for (const r of reminders) {
						const name = `${r.first_name} ${r.last_name || ""}`;
						result += `- ${r.reminder_date}: ${r.reminder_type} — ${name}`;
						if (r.message) result += ` (${r.message})`;
						result += `\n`;
					}

					return text(result.trim());
				}

				// ── list_companies ──────────────────────────────────

				if (params.action === "list_companies") {
					const companies = crm.getCompanies();

					if (companies.length === 0) {
						return text("🏢 No companies in CRM");
					}

					let result = `🏢 Companies (${companies.length}):\n\n`;
					for (const co of companies) {
						const website = co.website ? ` — ${co.website}` : "";
						const industry = co.industry ? ` [${co.industry}]` : "";
						result += `- ${co.name}${industry}${website} (ID: ${co.id})\n`;
					}

					return text(result.trim());
				}

				// ── add_company ─────────────────────────────────────

				if (params.action === "add_company") {
					if (!params.company_name) {
						return text("❌ company_name is required");
					}

					const company = crm.createCompany({
						name: params.company_name,
						website: params.website,
						industry: params.industry,
						notes: params.notes,
					});

					return text(`✅ Created company: ${company.name} (ID: ${company.id})`);
				}

				return text(`❌ Unknown action: ${params.action}`);
			} catch (error: any) {
				return text(`❌ CRM error: ${error.message}`);
			}
		},
	});
}
