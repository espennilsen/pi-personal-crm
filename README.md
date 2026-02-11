# pi-crm-personal

Personal CRM extension for Pi coding agents with extensible plugin architecture.

## Features

**Core CRM:**
- 👤 Contacts with custom fields
- 🏢 Companies and relationships
- 💬 Interaction timeline (calls, meetings, notes, emails, gifts, messages)
- 🏷️ Groups and tags
- 🔔 Reminders (birthdays, anniversaries, custom dates)
- 🔍 Full-text search
- 🌐 Web UI with list/detail/timeline views
- 🤖 Pi tool for contact lookup and logging (9 actions)

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
import { crmDbModule, registerCrmWeb, registerCrmTool } from "pi-crm-personal";
import type { CrmApi } from "pi-crm-personal";

// 1. Register DB module (in your openDb call)
const db = openDb(dbPath, [crmDbModule, ...otherModules]);

// 2. Register web routes (serves /crm page and /api/crm/* endpoints)
registerCrmWeb(() => myServer);

// 3. Register agent tool (contact lookup, interaction logging, etc.)
registerCrmTool(pi, () => myServer.getExtension<CrmApi>("crm"));
```

See [AGENTS.md](./AGENTS.md) for full integration guide.

## Extension API

Build on top of the CRM:

```typescript
import { crmRegistry } from "pi-crm-personal/registry";

// Register a custom entity type
crmRegistry.registerEntityType({
  name: "deal",
  label: "Deals",
  icon: "💰",
  fields: [
    { name: "value", label: "Deal Value", type: "number" },
    { name: "stage", label: "Stage", type: "select", options: ["Lead", "Qualified", "Closed"] },
  ],
  dbModule: dealDbModule,
  contactRelation: "many-to-many",
});

// Listen to events
crmRegistry.on("contact.created", async (contact) => {
  // Your custom logic
});
```

## Architecture

- **Host-agnostic:** Works with any Pi agent that implements `HostServer` and `DbModule` interfaces
- **Self-contained:** Owns its DB schema, migrations, and CRUD operations
- **Extensible:** Plugin registry for building business CRM features on top

## Scripts

```bash
npm test        # Run DB smoke tests
npm run typecheck  # TypeScript type checking
```

## License

MIT
