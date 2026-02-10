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

	// List all contacts
	console.log("\n📊 All contacts:");
	const allContacts = crmApi.getContacts();
	for (const c of allContacts) {
		console.log(`  - ${c.first_name} ${c.last_name} (${c.email}) @ ${c.company_name ?? "No company"}`);
	}

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
