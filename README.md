# pi-crm-personal

Personal CRM extension for Pi coding agents with extensible plugin architecture.

## Features

**Core CRM:**
- 👤 Contacts with custom fields
- 🏢 Companies and relationships
- 💬 Interaction timeline (calls, meetings, notes, emails)
- 🏷️ Groups and tags
- 🔔 Reminders (birthdays, anniversaries, custom dates)
- 🔍 Full-text search
- 🌐 Web UI with list/detail/timeline views
- 🤖 Pi tool for contact lookup and logging

**Plugin Architecture:**
Other extensions can register:
- Custom entity types (Deals, Tickets, Invoices)
- Custom field types (currency, date-range, multi-select)
- Interaction types (SMS, LinkedIn message, support ticket)
- Dashboard widgets
- Contact card sections
- Pipeline stages
- Search providers
- Event hooks (on contact create/update/delete, on interaction logged)
- Web sub-pages and API routes

## Installation

```bash
npm install pi-crm-personal
```

## Usage

```typescript
import { crmDbModule, registerCrmExtension } from "pi-crm-personal";

// 1. Register DB module (in openDb call)
const db = openDb(dbPath, [crmDbModule, ...otherModules]);

// 2. Register web routes and tool
registerCrmExtension(server);
```

## Extension API

Build on top of the CRM:

```typescript
import { crmRegistry } from "pi-crm-personal/registry";

// Register a custom entity type
crmRegistry.registerEntityType({
  name: "deal",
  label: "Deals",
  icon: "💰",
  fields: [...],
  dbModule: dealDbModule,
  contactRelation: "many-to-many"
});

// Listen to events
crmRegistry.on("contact.created", async (contact) => {
  // Your custom logic
});
```

## Architecture

- **Host-agnostic:** Works with any Pi agent that provides DbModule and server registration API
- **Self-contained:** Owns its DB schema, migrations, and CRUD operations
- **Extensible:** Plugin registry for building business CRM features on top

## License

MIT
