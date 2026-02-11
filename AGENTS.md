# Agent Integration Guide

How to integrate pi-crm-personal into a Pi agent.

This guide uses generic examples. Adapt the import paths and server variable names to your own agent's codebase.

## 1. Install the package

```bash
npm install pi-crm-personal
# or link locally:
# "pi-crm-personal": "file:../pi-crm-personal"
```

## 2. Import the CRM module

In your agent's main server/entry file:

```typescript
// CRM extension
import { crmDbModule, registerCrmWeb, registerCrmTool } from "pi-crm-personal";
import type { CrmApi } from "pi-crm-personal";
```

## 3. Register the DB module

Add `crmDbModule` to your agent's DB module list. The CRM manages its own schema migrations.

```typescript
const dbModules: DbModule[] = [
  // ... your existing modules ...
  crmDbModule,
];
const db = openDb(DB_PATH, dbModules);
```

## 4. Register web routes

Call `registerCrmWeb` with a getter that returns your `HostServer` instance. This registers the `/crm` page and all `/api/crm/*` REST endpoints.

```typescript
registerCrmWeb(() => myServer);
```

## 5. Register the CRM tool

After your Pi session is created, register the tool so the agent can look up contacts, log interactions, etc.

```typescript
registerCrmTool(pi, () => myServer.getExtension<CrmApi>("crm"));
```

## 6. Done!

The CRM is now available:

| Endpoint | Description |
|---|---|
| `/crm` | Web UI — contact list, detail, and timeline |
| `/api/crm/contacts` | REST API for contacts |
| `/api/crm/companies` | REST API for companies |
| `/api/crm/interactions` | REST API for interactions |
| `/api/crm/reminders` | REST API for reminders |
| `/api/crm/groups` | REST API for groups |
| `crm` tool | Pi agent tool with 9 actions |
| `server.getExtension<CrmApi>("crm")` | Programmatic access from other extensions |

## Optional: Add a navigation link

```html
<nav>
  <!-- ... your existing links ... -->
  <a href="/crm">CRM</a>
</nav>
```

## Using CRM types in your agent code

```typescript
import type { CrmApi, Contact, Company, Interaction } from "pi-crm-personal";

const crm = server.getExtension<CrmApi>("crm");
const contacts = crm.getContacts();
```

## Host requirements

Your agent must implement the `HostServer` interface (see `src/host.ts`):

- `addWebRoute(method, path, handler)` — register HTTP routes
- `registerExtension(name, api)` — register named extension APIs
- `getExtension<T>(name)` — retrieve extension APIs

And a `DbModule` system:

- `name` — unique module identifier
- `migrations` — ordered SQL strings, tracked by index
- `init(db)` — called after migrations; set up prepared statements
