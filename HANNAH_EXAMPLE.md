# Hannah Integration Example

Actual code changes needed in Hannah to enable pi-crm-personal.

## 1. Import the CRM module (src/server.ts)

Add to the imports section:

```typescript
// Extensions (composite modules — web UI, DB, orchestration)
import { registerCronTool } from "./extensions/cron/cron.ts";
// ... existing imports ...

// CRM extension
import { crmDbModule, registerCrmWeb } from "pi-crm-personal";
```

## 2. Register DB module (src/server.ts)

Find the `dbModules` array and add `crmDbModule`:

```typescript
const dbModules: DbModule[] = [
  jobsDbModule,
  calendarDbModule,
  projectsDbModule,
  cronDbModule,
  crmDbModule, // <-- Add this
];
db = openDb(DB_PATH, dbModules);
```

## 3. Register web routes (src/server.ts)

Find where other web extensions are registered and add:

```typescript
registerCalendarWeb(() => hannahServer);
registerProjectsWeb(() => hannahServer);
registerVaultHealthWeb(() => hannahServer, fileConfig);
registerCrmWeb(() => hannahServer); // <-- Add this
```

## 4. That's it!

The CRM is now integrated:
- `/crm` — contacts page (once implemented in td-6db651)
- `/api/crm/*` — REST API for contacts, companies, interactions
- `crm` tool — available in Pi tool calls (once implemented in td-fb25b2)
- `server.getExtension<CrmApi>("crm")` — accessible to other extensions

## Optional: Add navigation link

If you want a nav link in the web UI, update your HTML chrome:

```html
<!-- src/adapters/*.html -->
<nav>
  <a href="/dashboard">Dashboard</a>
  <a href="/tasks">Tasks</a>
  <a href="/calendar">Calendar</a>
  <a href="/projects">Projects</a>
  <a href="/vault">Vault</a>
  <a href="/crm">CRM</a> <!-- Add this -->
</nav>
```

## Type imports for Hannah code

If Hannah code needs to use CRM types:

```typescript
import type { CrmApi, Contact, Company } from "pi-crm-personal";

const crm = server.getExtension<CrmApi>("crm");
const contacts = crm.getContacts();
```
