# Integration Guide

How to integrate pi-crm-personal into a Pi agent (like Hannah).

## Installation

```bash
# Add to package.json
{
  "dependencies": {
    "pi-crm-personal": "file:../pi-crm-personal"
  }
}

# Install
npm install
```

## Server Integration

```typescript
// src/server.ts
import { crmDbModule, registerCrmWeb } from "pi-crm-personal";
import type { DbModule } from "./db.ts";

// 1. Add CRM DB module to the list
const dbModules: DbModule[] = [
  jobsDbModule,
  calendarDbModule,
  crmDbModule, // <-- Add this
  // ... other modules
];

const db = openDb(DB_PATH, dbModules);

// 2. Register CRM web routes after server initialization
registerCrmWeb(() => hannahServer);
```

## Using the CRM API

```typescript
import type { CrmApi } from "pi-crm-personal";

// Get the CRM extension
const crm = server.getExtension<CrmApi>("crm");

// Create a contact
const contact = crm.createContact({
  first_name: "John",
  last_name: "Doe",
  email: "john@example.com",
  phone: "+1234567890",
  tags: "client,vip",
});

// Log an interaction
crm.createInteraction({
  contact_id: contact.id,
  interaction_type: "call",
  summary: "Discussed Q4 roadmap",
  notes: "Follow up in 2 weeks",
});

// Search
const results = crm.searchContacts("john");
```

## Extending the CRM (Plugin API)

```typescript
import { crmRegistry } from "pi-crm-personal/registry";
import type { CrmEntityType } from "pi-crm-personal";

// Register a custom entity type (e.g. Deals)
crmRegistry.registerEntityType({
  name: "deal",
  label: "Deals",
  icon: "💰",
  fields: [
    { name: "value", label: "Deal Value", type: "number" },
    { name: "stage", label: "Stage", type: "select", options: ["Lead", "Qualified", "Closed"] },
  ],
  dbModule: dealDbModule, // Your own DbModule
  contactRelation: "many-to-many",
});

// Listen to CRM events
crmRegistry.on("contact.created", async (contact) => {
  console.log("New contact created:", contact);
  // Send welcome email, create onboarding task, etc.
});

// Add a dashboard widget
crmRegistry.registerWidget({
  name: "recent-deals",
  label: "Recent Deals",
  position: "main",
  priority: 10,
  async getData() {
    return { deals: await getRecentDeals() };
  },
  render: "<div>...</div>", // HTML template
});
```

## Type Safety

The package exports all types:

```typescript
import type {
  Contact,
  Company,
  Interaction,
  CreateContactData,
  CrmApi,
  CrmRegistry,
  CrmEntityType,
  CrmWidget,
} from "pi-crm-personal";
```

## Host Requirements

Your Pi agent must provide:

1. **DbModule system** — `openDb(path, modules)` that runs migrations
2. **HostServer interface:**
   - `addWebRoute(method, path, handler)` — register HTTP routes
   - `registerExtension(name, api)` — register extension API
   - `getExtension<T>(name)` — retrieve extension API

See `src/host.ts` for the minimal interface definition.
