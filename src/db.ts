/**
 * CRM Database Module.
 *
 * Self-contained: owns migrations, prepared statements, and CRUD operations.
 * To be implemented in td-cc0444.
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

let stmts: Record<string, any> = {};

// ── DB Module Definition ────────────────────────────────────────

/**
 * CRM DB module. Pass to openDb() to register CRM tables.
 */
export const crmDbModule: DbModule = {
	name: "crm",
	migrations: [
		// Migration 1: Core tables
		`
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

		CREATE TABLE IF NOT EXISTS crm_companies (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			website TEXT,
			industry TEXT,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

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

		CREATE TABLE IF NOT EXISTS crm_reminders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			contact_id INTEGER NOT NULL,
			reminder_type TEXT NOT NULL CHECK(reminder_type IN ('birthday', 'anniversary', 'custom')),
			reminder_date TEXT NOT NULL,
			message TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS crm_relationships (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			contact_id INTEGER NOT NULL,
			related_contact_id INTEGER NOT NULL,
			relationship_type TEXT NOT NULL,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
			FOREIGN KEY (related_contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS crm_groups (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			description TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE INDEX IF NOT EXISTS idx_contacts_company ON crm_contacts(company_id);
		CREATE INDEX IF NOT EXISTS idx_contacts_email ON crm_contacts(email);
		CREATE INDEX IF NOT EXISTS idx_interactions_contact ON crm_interactions(contact_id);
		CREATE INDEX IF NOT EXISTS idx_reminders_contact ON crm_reminders(contact_id);
		CREATE INDEX IF NOT EXISTS idx_reminders_date ON crm_reminders(reminder_date);
		`,
	],
	init(db: Database): void {
		// TODO: Initialize prepared statements
		// This will be implemented in td-cc0444
		stmts = {};
	},
};

// ── CRM API Implementation ──────────────────────────────────────

/**
 * Main CRM API singleton.
 * To be fully implemented in td-cc0444.
 */
export const crmApi: CrmApi = {
	// Contacts
	getContacts(search?: string, limit?: number): Contact[] {
		// TODO: Implement
		return [];
	},

	getContact(id: number): Contact | null {
		// TODO: Implement
		return null;
	},

	createContact(data: CreateContactData): Contact {
		// TODO: Implement + emit event
		throw new Error("Not implemented");
	},

	updateContact(id: number, data: UpdateContactData): Contact | null {
		// TODO: Implement + emit event
		return null;
	},

	deleteContact(id: number): boolean {
		// TODO: Implement + emit event
		return false;
	},

	// Companies
	getCompanies(search?: string): Company[] {
		// TODO: Implement
		return [];
	},

	getCompany(id: number): Company | null {
		// TODO: Implement
		return null;
	},

	createCompany(data: CreateCompanyData): Company {
		// TODO: Implement
		throw new Error("Not implemented");
	},

	updateCompany(id: number, data: UpdateCompanyData): Company | null {
		// TODO: Implement
		return null;
	},

	deleteCompany(id: number): boolean {
		// TODO: Implement
		return false;
	},

	// Interactions
	getInteractions(contactId: number): Interaction[] {
		// TODO: Implement
		return [];
	},

	createInteraction(data: CreateInteractionData): Interaction {
		// TODO: Implement + emit event
		throw new Error("Not implemented");
	},

	deleteInteraction(id: number): boolean {
		// TODO: Implement
		return false;
	},

	// Reminders
	getReminders(contactId?: number): Reminder[] {
		// TODO: Implement
		return [];
	},

	getUpcomingReminders(days: number = 7): Reminder[] {
		// TODO: Implement
		return [];
	},

	createReminder(data: CreateReminderData): Reminder {
		// TODO: Implement
		throw new Error("Not implemented");
	},

	deleteReminder(id: number): boolean {
		// TODO: Implement
		return false;
	},

	// Relationships
	getRelationships(contactId: number): Relationship[] {
		// TODO: Implement
		return [];
	},

	createRelationship(data: CreateRelationshipData): Relationship {
		// TODO: Implement
		throw new Error("Not implemented");
	},

	deleteRelationship(id: number): boolean {
		// TODO: Implement
		return false;
	},

	// Groups
	getGroups(): Group[] {
		// TODO: Implement
		return [];
	},

	createGroup(data: CreateGroupData): Group {
		// TODO: Implement
		throw new Error("Not implemented");
	},

	deleteGroup(id: number): boolean {
		// TODO: Implement
		return false;
	},

	// Search
	searchContacts(query: string, limit: number = 20): Contact[] {
		// TODO: Implement
		return [];
	},

	searchCompanies(query: string, limit: number = 20): Company[] {
		// TODO: Implement
		return [];
	},
};
