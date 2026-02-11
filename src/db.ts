/**
 * CRM Database Module.
 *
 * Self-contained: owns migrations, prepared statements, and CRUD operations.
 * Registers core entity types and interaction types with the registry.
 */

import type { Database } from "better-sqlite3";
import type { DbModule } from "./host.ts";
import type {
	CrmApi,
	Contact,
	CreateContactData,
	UpdateContactData,
	Company,
	CreateCompanyData,
	UpdateCompanyData,
	Interaction,
	CreateInteractionData,
	Reminder,
	CreateReminderData,
	Relationship,
	CreateRelationshipData,
	Group,
	CreateGroupData,
} from "./types.ts";
import { crmRegistry } from "./registry.ts";

// ── Prepared Statements (initialized in init()) ────────────────

let stmts: {
	// Contacts
	getContacts: any;
	getContactById: any;
	searchContacts: any;
	insertContact: any;
	updateContact: any;
	deleteContact: any;

	// Companies
	getCompanies: any;
	getCompanyById: any;
	searchCompanies: any;
	insertCompany: any;
	updateCompany: any;
	deleteCompany: any;

	// Interactions
	getInteractions: any;
	insertInteraction: any;
	deleteInteraction: any;

	// Reminders
	getReminders: any;
	getRemindersByContact: any;
	getUpcomingReminders: any;
	insertReminder: any;
	deleteReminder: any;

	// Relationships
	getRelationships: any;
	insertRelationship: any;
	deleteRelationship: any;

	// Groups
	getGroups: any;
	insertGroup: any;
	deleteGroup: any;

	// Group members
	getGroupMembers: any;
	getContactGroups: any;
	addGroupMember: any;
	removeGroupMember: any;
};

// ── DB Module Definition ────────────────────────────────────────

/**
 * CRM DB module. Pass to openDb() to register CRM tables.
 */
export const crmDbModule: DbModule = {
	name: "crm",
	migrations: [
		// Migration 1: Core tables
		`
		-- Companies (referenced by contacts)
		CREATE TABLE IF NOT EXISTS crm_companies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			website TEXT,
			industry TEXT,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		-- Contacts
		CREATE TABLE IF NOT EXISTS crm_contacts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			first_name TEXT NOT NULL,
			last_name TEXT,
			nickname TEXT,
			email TEXT,
			phone TEXT,
			company_id INTEGER,
			birthday TEXT,
			anniversary TEXT,
			notes TEXT,
			avatar_url TEXT,
			tags TEXT,
			custom_fields TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL
		);

		-- Interactions (timeline)
		CREATE TABLE IF NOT EXISTS crm_interactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			contact_id INTEGER NOT NULL,
			interaction_type TEXT NOT NULL,
			summary TEXT NOT NULL,
			notes TEXT,
			happened_at TEXT NOT NULL DEFAULT (datetime('now')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
		);

		-- Reminders
		CREATE TABLE IF NOT EXISTS crm_reminders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			contact_id INTEGER NOT NULL,
			reminder_type TEXT NOT NULL CHECK(reminder_type IN ('birthday', 'anniversary', 'custom')),
			reminder_date TEXT NOT NULL,
			message TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
		);

		-- Relationships
		CREATE TABLE IF NOT EXISTS crm_relationships (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			contact_id INTEGER NOT NULL,
			related_contact_id INTEGER NOT NULL,
			relationship_type TEXT NOT NULL,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
			FOREIGN KEY (related_contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
			UNIQUE(contact_id, related_contact_id, relationship_type)
		);

		-- Groups
		CREATE TABLE IF NOT EXISTS crm_groups (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			description TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		-- Indexes
		CREATE INDEX IF NOT EXISTS idx_contacts_company ON crm_contacts(company_id);
		CREATE INDEX IF NOT EXISTS idx_contacts_email ON crm_contacts(email);
		CREATE INDEX IF NOT EXISTS idx_contacts_tags ON crm_contacts(tags);
		CREATE INDEX IF NOT EXISTS idx_interactions_contact ON crm_interactions(contact_id);
		CREATE INDEX IF NOT EXISTS idx_interactions_happened ON crm_interactions(happened_at);
		CREATE INDEX IF NOT EXISTS idx_reminders_contact ON crm_reminders(contact_id);
		CREATE INDEX IF NOT EXISTS idx_reminders_date ON crm_reminders(reminder_date);
		CREATE INDEX IF NOT EXISTS idx_relationships_contact ON crm_relationships(contact_id);
		CREATE INDEX IF NOT EXISTS idx_relationships_related ON crm_relationships(related_contact_id);
		`,

		// Migration 2: Group membership join table
		`
		CREATE TABLE IF NOT EXISTS crm_group_members (
			group_id INTEGER NOT NULL,
			contact_id INTEGER NOT NULL,
			added_at TEXT NOT NULL DEFAULT (datetime('now')),
			PRIMARY KEY (group_id, contact_id),
			FOREIGN KEY (group_id) REFERENCES crm_groups(id) ON DELETE CASCADE,
			FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
		);

		CREATE INDEX IF NOT EXISTS idx_group_members_group ON crm_group_members(group_id);
		CREATE INDEX IF NOT EXISTS idx_group_members_contact ON crm_group_members(contact_id);
		`,
	],

	init(db: Database): void {
		// Prepare all statements
		stmts = {
			// Contacts
			getContacts: db.prepare(`
				SELECT 
					c.*,
					co.name as company_name
				FROM crm_contacts c
				LEFT JOIN crm_companies co ON c.company_id = co.id
				ORDER BY c.first_name, c.last_name
				LIMIT ?
			`),

			getContactById: db.prepare(`
				SELECT 
					c.*,
					co.name as company_name
				FROM crm_contacts c
				LEFT JOIN crm_companies co ON c.company_id = co.id
				WHERE c.id = ?
			`),

			searchContacts: db.prepare(`
				SELECT 
					c.*,
					co.name as company_name
				FROM crm_contacts c
				LEFT JOIN crm_companies co ON c.company_id = co.id
				WHERE 
					c.first_name LIKE ? OR 
					c.last_name LIKE ? OR 
					c.nickname LIKE ? OR
					c.email LIKE ? OR
					c.phone LIKE ? OR
					c.tags LIKE ?
				ORDER BY c.first_name, c.last_name
				LIMIT ?
			`),

			insertContact: db.prepare(`
				INSERT INTO crm_contacts (
					first_name, last_name, nickname, email, phone, company_id,
					birthday, anniversary, notes, avatar_url, tags, custom_fields
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`),

			updateContact: db.prepare(`
				UPDATE crm_contacts SET
					first_name = ?,
					last_name = ?,
					nickname = ?,
					email = ?,
					phone = ?,
					company_id = ?,
					birthday = ?,
					anniversary = ?,
					notes = ?,
					avatar_url = ?,
					tags = ?,
					custom_fields = ?,
					updated_at = datetime('now')
				WHERE id = ?
			`),

			deleteContact: db.prepare(`DELETE FROM crm_contacts WHERE id = ?`),

			// Companies
			getCompanies: db.prepare(`
				SELECT * FROM crm_companies
				ORDER BY name
			`),

			getCompanyById: db.prepare(`SELECT * FROM crm_companies WHERE id = ?`),

			searchCompanies: db.prepare(`
				SELECT * FROM crm_companies
				WHERE name LIKE ? OR industry LIKE ? OR website LIKE ?
				ORDER BY name
				LIMIT ?
			`),

			insertCompany: db.prepare(`
				INSERT INTO crm_companies (name, website, industry, notes)
				VALUES (?, ?, ?, ?)
			`),

			updateCompany: db.prepare(`
				UPDATE crm_companies SET
					name = ?,
					website = ?,
					industry = ?,
					notes = ?,
					updated_at = datetime('now')
				WHERE id = ?
			`),

			deleteCompany: db.prepare(`DELETE FROM crm_companies WHERE id = ?`),

			// Interactions
			getInteractions: db.prepare(`
				SELECT * FROM crm_interactions
				WHERE contact_id = ?
				ORDER BY happened_at DESC
			`),

			insertInteraction: db.prepare(`
				INSERT INTO crm_interactions (contact_id, interaction_type, summary, notes, happened_at)
				VALUES (?, ?, ?, ?, ?)
			`),

			deleteInteraction: db.prepare(`DELETE FROM crm_interactions WHERE id = ?`),

			// Reminders
			getReminders: db.prepare(`
				SELECT * FROM crm_reminders
				ORDER BY reminder_date
			`),

			getRemindersByContact: db.prepare(`
				SELECT * FROM crm_reminders
				WHERE contact_id = ?
				ORDER BY reminder_date
			`),

			getUpcomingReminders: db.prepare(`
				SELECT r.*, c.first_name, c.last_name
				FROM crm_reminders r
				JOIN crm_contacts c ON r.contact_id = c.id
				WHERE date(r.reminder_date) <= date('now', '+' || ? || ' days')
				ORDER BY r.reminder_date
			`),

			insertReminder: db.prepare(`
				INSERT INTO crm_reminders (contact_id, reminder_type, reminder_date, message)
				VALUES (?, ?, ?, ?)
			`),

			deleteReminder: db.prepare(`DELETE FROM crm_reminders WHERE id = ?`),

			// Relationships
			getRelationships: db.prepare(`
				SELECT r.*, c.first_name, c.last_name
				FROM crm_relationships r
				JOIN crm_contacts c ON r.related_contact_id = c.id
				WHERE r.contact_id = ?
			`),

			insertRelationship: db.prepare(`
				INSERT INTO crm_relationships (contact_id, related_contact_id, relationship_type, notes)
				VALUES (?, ?, ?, ?)
			`),

			deleteRelationship: db.prepare(`DELETE FROM crm_relationships WHERE id = ?`),

			// Groups
			getGroups: db.prepare(`SELECT * FROM crm_groups ORDER BY name`),

			insertGroup: db.prepare(`
				INSERT INTO crm_groups (name, description)
				VALUES (?, ?)
			`),

			deleteGroup: db.prepare(`DELETE FROM crm_groups WHERE id = ?`),

			// Group members
			getGroupMembers: db.prepare(`
				SELECT c.*, co.name as company_name
				FROM crm_group_members gm
				JOIN crm_contacts c ON gm.contact_id = c.id
				LEFT JOIN crm_companies co ON c.company_id = co.id
				WHERE gm.group_id = ?
				ORDER BY c.first_name, c.last_name
			`),

			getContactGroups: db.prepare(`
				SELECT g.*
				FROM crm_group_members gm
				JOIN crm_groups g ON gm.group_id = g.id
				WHERE gm.contact_id = ?
				ORDER BY g.name
			`),

			addGroupMember: db.prepare(`
				INSERT OR IGNORE INTO crm_group_members (group_id, contact_id)
				VALUES (?, ?)
			`),

			removeGroupMember: db.prepare(`
				DELETE FROM crm_group_members
				WHERE group_id = ? AND contact_id = ?
			`),
		};

		// Register core entity types and interaction types
		registerCoreTypes();
	},
};

// ── Registry Integration ────────────────────────────────────────

function registerCoreTypes(): void {
	// Core interaction types
	const coreInteractionTypes = [
		{ name: "call", label: "Phone Call", icon: "📞" },
		{ name: "meeting", label: "Meeting", icon: "🤝" },
		{ name: "email", label: "Email", icon: "📧" },
		{ name: "note", label: "Note", icon: "📝" },
		{ name: "gift", label: "Gift", icon: "🎁" },
		{ name: "message", label: "Message", icon: "💬" },
	];

	for (const type of coreInteractionTypes) {
		crmRegistry.registerInteractionType(type);
	}
}

// ── CRM API Implementation ──────────────────────────────────────

/**
 * Main CRM API singleton.
 */
export const crmApi: CrmApi = {
	// ── Contacts ────────────────────────────────────────────────

	getContacts(search?: string, limit: number = 100): Contact[] {
		if (search) {
			const pattern = `%${search}%`;
			return stmts.searchContacts.all(pattern, pattern, pattern, pattern, pattern, pattern, limit);
		}
		return stmts.getContacts.all(limit);
	},

	getContact(id: number): Contact | null {
		return stmts.getContactById.get(id) ?? null;
	},

	createContact(data: CreateContactData): Contact {
		const result = stmts.insertContact.run(
			data.first_name,
			data.last_name ?? null,
			data.nickname ?? null,
			data.email ?? null,
			data.phone ?? null,
			data.company_id ?? null,
			data.birthday ?? null,
			data.anniversary ?? null,
			data.notes ?? null,
			data.avatar_url ?? null,
			data.tags ?? null,
			data.custom_fields ?? null,
		);

		const contact = this.getContact(result.lastInsertRowid as number)!;

		// Emit event
		crmRegistry.emit("contact.created", contact).catch((err) => {
			console.error("Failed to emit contact.created event:", err);
		});

		return contact;
	},

	updateContact(id: number, data: UpdateContactData): Contact | null {
		const existing = this.getContact(id);
		if (!existing) return null;

		stmts.updateContact.run(
			data.first_name ?? existing.first_name,
			data.last_name ?? existing.last_name,
			data.nickname ?? existing.nickname,
			data.email ?? existing.email,
			data.phone ?? existing.phone,
			data.company_id !== undefined ? data.company_id : existing.company_id,
			data.birthday !== undefined ? data.birthday : existing.birthday,
			data.anniversary !== undefined ? data.anniversary : existing.anniversary,
			data.notes !== undefined ? data.notes : existing.notes,
			data.avatar_url !== undefined ? data.avatar_url : existing.avatar_url,
			data.tags !== undefined ? data.tags : existing.tags,
			data.custom_fields !== undefined ? data.custom_fields : existing.custom_fields,
			id,
		);

		const updated = this.getContact(id)!;

		// Emit event
		crmRegistry.emit("contact.updated", updated).catch((err) => {
			console.error("Failed to emit contact.updated event:", err);
		});

		return updated;
	},

	deleteContact(id: number): boolean {
		const contact = this.getContact(id);
		if (!contact) return false;

		stmts.deleteContact.run(id);

		// Emit event
		crmRegistry.emit("contact.deleted", { id, contact }).catch((err) => {
			console.error("Failed to emit contact.deleted event:", err);
		});

		return true;
	},

	// ── Companies ───────────────────────────────────────────────

	getCompanies(search?: string): Company[] {
		if (search) {
			const pattern = `%${search}%`;
			return stmts.searchCompanies.all(pattern, pattern, pattern, 100);
		}
		return stmts.getCompanies.all();
	},

	getCompany(id: number): Company | null {
		return stmts.getCompanyById.get(id) ?? null;
	},

	createCompany(data: CreateCompanyData): Company {
		const result = stmts.insertCompany.run(
			data.name,
			data.website ?? null,
			data.industry ?? null,
			data.notes ?? null,
		);
		return this.getCompany(result.lastInsertRowid as number)!;
	},

	updateCompany(id: number, data: UpdateCompanyData): Company | null {
		const existing = this.getCompany(id);
		if (!existing) return null;

		stmts.updateCompany.run(
			data.name ?? existing.name,
			data.website !== undefined ? data.website : existing.website,
			data.industry !== undefined ? data.industry : existing.industry,
			data.notes !== undefined ? data.notes : existing.notes,
			id,
		);

		return this.getCompany(id);
	},

	deleteCompany(id: number): boolean {
		const result = stmts.deleteCompany.run(id);
		return result.changes > 0;
	},

	// ── Interactions ────────────────────────────────────────────

	getInteractions(contactId: number): Interaction[] {
		return stmts.getInteractions.all(contactId);
	},

	createInteraction(data: CreateInteractionData): Interaction {
		const happened_at = data.happened_at ?? new Date().toISOString();

		const result = stmts.insertInteraction.run(
			data.contact_id,
			data.interaction_type,
			data.summary,
			data.notes ?? null,
			happened_at,
		);

		const interaction = stmts.getInteractions
			.all(data.contact_id)
			.find((i: Interaction) => i.id === result.lastInsertRowid);

		// Emit event
		crmRegistry.emit("interaction.logged", interaction).catch((err) => {
			console.error("Failed to emit interaction.logged event:", err);
		});

		return interaction;
	},

	deleteInteraction(id: number): boolean {
		const result = stmts.deleteInteraction.run(id);
		return result.changes > 0;
	},

	// ── Reminders ───────────────────────────────────────────────

	getReminders(contactId?: number): Reminder[] {
		if (contactId) {
			return stmts.getRemindersByContact.all(contactId);
		}
		return stmts.getReminders.all();
	},

	getUpcomingReminders(days: number = 7): Reminder[] {
		return stmts.getUpcomingReminders.all(days);
	},

	createReminder(data: CreateReminderData): Reminder {
		const result = stmts.insertReminder.run(
			data.contact_id,
			data.reminder_type,
			data.reminder_date,
			data.message ?? null,
		);

		return stmts.getRemindersByContact
			.all(data.contact_id)
			.find((r: Reminder) => r.id === result.lastInsertRowid);
	},

	deleteReminder(id: number): boolean {
		const result = stmts.deleteReminder.run(id);
		return result.changes > 0;
	},

	// ── Relationships ───────────────────────────────────────────

	getRelationships(contactId: number): Relationship[] {
		return stmts.getRelationships.all(contactId);
	},

	createRelationship(data: CreateRelationshipData): Relationship {
		const result = stmts.insertRelationship.run(
			data.contact_id,
			data.related_contact_id,
			data.relationship_type,
			data.notes ?? null,
		);

		return stmts.getRelationships
			.all(data.contact_id)
			.find((r: Relationship) => r.id === result.lastInsertRowid);
	},

	deleteRelationship(id: number): boolean {
		const result = stmts.deleteRelationship.run(id);
		return result.changes > 0;
	},

	// ── Groups ──────────────────────────────────────────────────

	getGroups(): Group[] {
		return stmts.getGroups.all();
	},

	createGroup(data: CreateGroupData): Group {
		const result = stmts.insertGroup.run(data.name, data.description ?? null);
		return stmts.getGroups.all().find((g: Group) => g.id === result.lastInsertRowid)!;
	},

	deleteGroup(id: number): boolean {
		const result = stmts.deleteGroup.run(id);
		return result.changes > 0;
	},

	// ── Group Membership ────────────────────────────────────────

	getGroupMembers(groupId: number): Contact[] {
		return stmts.getGroupMembers.all(groupId);
	},

	getContactGroups(contactId: number): Group[] {
		return stmts.getContactGroups.all(contactId);
	},

	addGroupMember(groupId: number, contactId: number): boolean {
		const result = stmts.addGroupMember.run(groupId, contactId);
		return result.changes > 0;
	},

	removeGroupMember(groupId: number, contactId: number): boolean {
		const result = stmts.removeGroupMember.run(groupId, contactId);
		return result.changes > 0;
	},

	// ── Search ──────────────────────────────────────────────────

	searchContacts(query: string, limit: number = 20): Contact[] {
		return this.getContacts(query, limit);
	},

	searchCompanies(query: string, limit: number = 20): Company[] {
		return this.getCompanies(query).slice(0, limit);
	},
};
