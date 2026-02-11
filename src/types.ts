/**
 * pi-crm-personal — Core types and interfaces.
 */

// ── Contact ─────────────────────────────────────────────────────

export interface Contact {
	id: number;
	first_name: string;
	last_name?: string;
	nickname?: string;
	email?: string;
	phone?: string;
	company_id?: number;
	company_name?: string; // Denormalized for display
	birthday?: string; // YYYY-MM-DD
	anniversary?: string; // YYYY-MM-DD
	notes?: string;
	avatar_url?: string;
	tags?: string; // Comma-separated
	custom_fields?: string; // JSON
	created_at: string; // ISO timestamp
	updated_at: string; // ISO timestamp
}

export interface CreateContactData {
	first_name: string;
	last_name?: string;
	nickname?: string;
	email?: string;
	phone?: string;
	company_id?: number;
	birthday?: string;
	anniversary?: string;
	notes?: string;
	avatar_url?: string;
	tags?: string;
	custom_fields?: string;
}

export interface UpdateContactData extends Partial<CreateContactData> {
	id?: never; // ID is passed separately, not in the data object
}

// ── Company ─────────────────────────────────────────────────────

export interface Company {
	id: number;
	name: string;
	website?: string;
	industry?: string;
	notes?: string;
	created_at: string;
	updated_at: string;
}

export interface CreateCompanyData {
	name: string;
	website?: string;
	industry?: string;
	notes?: string;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {}

// ── Interaction ─────────────────────────────────────────────────

export type InteractionType = "call" | "meeting" | "note" | "email" | "message" | string;

export interface Interaction {
	id: number;
	contact_id: number;
	interaction_type: InteractionType;
	summary: string;
	notes?: string;
	happened_at: string; // ISO timestamp
	created_at: string;
}

export interface CreateInteractionData {
	contact_id: number;
	interaction_type: InteractionType;
	summary: string;
	notes?: string;
	happened_at?: string; // Defaults to now if omitted
}

// ── Reminder ────────────────────────────────────────────────────

export interface Reminder {
	id: number;
	contact_id: number;
	reminder_type: "birthday" | "anniversary" | "custom";
	reminder_date: string; // YYYY-MM-DD
	message?: string;
	created_at: string;
	// Joined from crm_contacts (present when fetched via getUpcomingReminders)
	first_name?: string;
	last_name?: string;
}

export interface CreateReminderData {
	contact_id: number;
	reminder_type: "birthday" | "anniversary" | "custom";
	reminder_date: string;
	message?: string;
}

// ── Relationship ────────────────────────────────────────────────

export interface Relationship {
	id: number;
	contact_id: number;
	related_contact_id: number;
	relationship_type: string; // "spouse", "child", "parent", "colleague", etc.
	notes?: string;
	created_at: string;
	// Joined from crm_contacts (present when fetched via getRelationships)
	first_name?: string;
	last_name?: string;
}

export interface CreateRelationshipData {
	contact_id: number;
	related_contact_id: number;
	relationship_type: string;
	notes?: string;
}

// ── Group/Tag ───────────────────────────────────────────────────

export interface Group {
	id: number;
	name: string;
	description?: string;
	created_at: string;
}

export interface CreateGroupData {
	name: string;
	description?: string;
}

// ── Custom Field Definition ─────────────────────────────────────

export interface CustomFieldDef {
	name: string; // Unique key
	label: string; // Display name
	type: "text" | "number" | "date" | "boolean" | "select" | string;
	options?: string[]; // For select type
	required?: boolean;
}

// ── CRM API ─────────────────────────────────────────────────────

/**
 * Main CRM API that other modules can access via server.getExtension<CrmApi>("crm")
 */
export interface CrmApi {
	// Contacts
	getContacts(search?: string, limit?: number): Contact[];
	getContact(id: number): Contact | null;
	createContact(data: CreateContactData): Contact;
	updateContact(id: number, data: UpdateContactData): Contact | null;
	deleteContact(id: number): boolean;

	// Companies
	getCompanies(search?: string): Company[];
	getCompany(id: number): Company | null;
	createCompany(data: CreateCompanyData): Company;
	updateCompany(id: number, data: UpdateCompanyData): Company | null;
	deleteCompany(id: number): boolean;

	// Interactions
	getInteractions(contactId: number): Interaction[];
	createInteraction(data: CreateInteractionData): Interaction;
	deleteInteraction(id: number): boolean;

	// Reminders
	getReminders(contactId?: number): Reminder[];
	getUpcomingReminders(days?: number): Reminder[];
	createReminder(data: CreateReminderData): Reminder;
	deleteReminder(id: number): boolean;

	// Relationships
	getRelationships(contactId: number): Relationship[];
	createRelationship(data: CreateRelationshipData): Relationship;
	deleteRelationship(id: number): boolean;

	// Groups
	getGroups(): Group[];
	createGroup(data: CreateGroupData): Group;
	deleteGroup(id: number): boolean;

	// Search
	searchContacts(query: string, limit?: number): Contact[];
	searchCompanies(query: string, limit?: number): Company[];
}
