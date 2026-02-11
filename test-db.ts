/**
 * Simple smoke test for CRM DB operations.
 * Run with: node --import tsx/esm test-db.ts
 */

import Database from "better-sqlite3";
import { crmDbModule, crmApi } from "./src/db.ts";
import * as fs from "node:fs";

const DB_PATH = "./test-crm.db";

// Clean up old test DB
if (fs.existsSync(DB_PATH)) {
	fs.unlinkSync(DB_PATH);
}

console.log("📊 Testing CRM DB operations...\n");

// Initialize DB
const db = Database(DB_PATH);

// Run migrations
console.log("🔧 Running migrations...");
db.exec(`CREATE TABLE IF NOT EXISTS module_versions (
	module TEXT PRIMARY KEY,
	version INTEGER NOT NULL DEFAULT 0
)`);

const versionRow = db.prepare("SELECT version FROM module_versions WHERE module = ?").get(crmDbModule.name) as { version: number } | undefined;
const currentVersion = versionRow?.version ?? 0;

for (let i = currentVersion; i < crmDbModule.migrations.length; i++) {
	console.log(`  Migration ${i + 1}/${crmDbModule.migrations.length}`);
	db.exec(crmDbModule.migrations[i]);
	db.prepare("INSERT OR REPLACE INTO module_versions (module, version) VALUES (?, ?)").run(crmDbModule.name, i + 1);
}

// Initialize prepared statements
crmDbModule.init?.(db);

console.log("✅ Migrations complete\n");

// Test operations
try {
	// Create a company
	console.log("🏢 Creating company...");
	const company = crmApi.createCompany({
		name: "Acme Corp",
		website: "https://acme.example",
		industry: "Technology",
	});
	console.log(`  Created: ${company.name} (ID: ${company.id})`);

	// Create a contact
	console.log("\n👤 Creating contact...");
	const contact = crmApi.createContact({
		first_name: "John",
		last_name: "Doe",
		email: "john@acme.example",
		phone: "+1234567890",
		company_id: company.id,
		birthday: "1990-05-15",
		tags: "vip,client",
		notes: "Important customer",
	});
	console.log(`  Created: ${contact.first_name} ${contact.last_name} (ID: ${contact.id})`);
	console.log(`  Company: ${contact.company_name}`);

	// Log an interaction
	console.log("\n💬 Logging interaction...");
	const interaction = crmApi.createInteraction({
		contact_id: contact.id,
		interaction_type: "call",
		summary: "Discussed Q4 roadmap",
		notes: "Follow up in 2 weeks",
	});
	console.log(`  Logged: ${interaction.interaction_type} - ${interaction.summary}`);

	// Create a reminder
	console.log("\n🔔 Creating reminder...");
	const reminder = crmApi.createReminder({
		contact_id: contact.id,
		reminder_type: "birthday",
		reminder_date: "2026-05-15",
		message: "Wish John a happy birthday!",
	});
	console.log(`  Created: ${reminder.reminder_type} on ${reminder.reminder_date}`);

	// Search contacts
	console.log("\n🔍 Searching contacts...");
	const results = crmApi.searchContacts("john");
	console.log(`  Found ${results.length} contact(s)`);

	// Get interactions
	console.log("\n📋 Getting interactions...");
	const interactions = crmApi.getInteractions(contact.id);
	console.log(`  Found ${interactions.length} interaction(s)`);

	// Update contact
	console.log("\n✏️  Updating contact...");
	const updated = crmApi.updateContact(contact.id, {
		notes: "Updated notes",
		tags: "vip,client,enterprise",
	});
	console.log(`  Updated tags: ${updated?.tags}`);

	// Create a second contact for relationships
	console.log("\n👤 Creating second contact...");
	const contact2 = crmApi.createContact({
		first_name: "Jane",
		last_name: "Doe",
		email: "jane@acme.example",
		company_id: company.id,
	});
	console.log(`  Created: ${contact2.first_name} ${contact2.last_name} (ID: ${contact2.id})`);

	// Create relationship
	console.log("\n🤝 Creating relationship...");
	const relationship = crmApi.createRelationship({
		contact_id: contact.id,
		related_contact_id: contact2.id,
		relationship_type: "spouse",
	});
	console.log(`  Created: ${relationship.relationship_type} (ID: ${relationship.id})`);

	// Get relationships (tests JOIN with first_name/last_name)
	console.log("\n🤝 Getting relationships...");
	const relationships = crmApi.getRelationships(contact.id);
	console.log(`  Found ${relationships.length} relationship(s)`);
	for (const r of relationships) {
		console.log(`  - ${r.relationship_type}: ${r.first_name} ${r.last_name}`);
	}
	if (!relationships[0].first_name) {
		throw new Error("Relationship missing first_name from JOIN");
	}

	// Get upcoming reminders (tests JOIN with first_name/last_name)
	console.log("\n📅 Getting upcoming reminders...");
	const upcoming = crmApi.getUpcomingReminders(365);
	console.log(`  Found ${upcoming.length} upcoming reminder(s)`);
	for (const r of upcoming) {
		console.log(`  - ${r.reminder_date}: ${r.reminder_type} — ${r.first_name} ${r.last_name}`);
	}
	if (upcoming.length > 0 && !upcoming[0].first_name) {
		throw new Error("Upcoming reminder missing first_name from JOIN");
	}

	// Groups
	console.log("\n📂 Creating group...");
	const group = crmApi.createGroup({ name: "VIP Clients", description: "High-value clients" });
	console.log(`  Created: ${group.name} (ID: ${group.id})`);
	const groups = crmApi.getGroups();
	console.log(`  Total groups: ${groups.length}`);

	// Group membership
	console.log("\n📂 Testing group membership...");
	const added = crmApi.addGroupMember(group.id, contact.id);
	console.log(`  Add John to VIP Clients: ${added}`);
	crmApi.addGroupMember(group.id, contact2.id);
	console.log(`  Add Jane to VIP Clients: true`);

	const members = crmApi.getGroupMembers(group.id);
	console.log(`  Group members: ${members.length}`);
	for (const m of members) {
		console.log(`  - ${m.first_name} ${m.last_name}`);
	}
	if (members.length !== 2) {
		throw new Error(`Expected 2 group members, got ${members.length}`);
	}

	const contactGroups = crmApi.getContactGroups(contact.id);
	console.log(`  John's groups: ${contactGroups.length}`);
	if (contactGroups.length !== 1 || contactGroups[0].name !== "VIP Clients") {
		throw new Error(`Expected 1 group "VIP Clients", got ${JSON.stringify(contactGroups)}`);
	}

	const removed = crmApi.removeGroupMember(group.id, contact2.id);
	console.log(`  Remove Jane from VIP Clients: ${removed}`);
	const membersAfter = crmApi.getGroupMembers(group.id);
	if (membersAfter.length !== 1) {
		throw new Error(`Expected 1 member after removal, got ${membersAfter.length}`);
	}

	// Delete operations
	console.log("\n🗑️  Testing deletions...");
	console.log(`  Delete relationship: ${crmApi.deleteRelationship(relationship.id)}`);
	console.log(`  Delete reminder: ${crmApi.deleteReminder(reminder.id)}`);
	console.log(`  Delete interaction: ${crmApi.deleteInteraction(interaction.id)}`);
	console.log(`  Delete group: ${crmApi.deleteGroup(group.id)}`);
	console.log(`  Delete contact2: ${crmApi.deleteContact(contact2.id)}`);
	console.log(`  Delete contact: ${crmApi.deleteContact(contact.id)}`);
	console.log(`  Delete company: ${crmApi.deleteCompany(company.id)}`);

	// Verify deletions
	const remaining = crmApi.getContacts();
	if (remaining.length !== 0) {
		throw new Error(`Expected 0 contacts after deletion, got ${remaining.length}`);
	}

	// List all contacts
	console.log("\n📊 All contacts:");
	const allContacts = crmApi.getContacts();
	console.log(`  Total: ${allContacts.length}`);

	console.log("\n✅ All tests passed!");
} catch (error) {
	console.error("\n❌ Test failed:", error);
	process.exit(1);
} finally {
	db.close();
}

// Clean up
fs.unlinkSync(DB_PATH);
console.log("\n🧹 Cleaned up test database");
