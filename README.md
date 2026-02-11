# pi-personal-crm

Personal CRM extension for [pi](https://github.com/badlogic/pi-mono) coding agents.

## Features

- 👤 Contacts with custom fields, companies, relationships
- 💬 Interaction timeline (calls, meetings, notes, emails, gifts, messages)
- 🏢 Companies with member contacts
- 🏷️ Groups with membership management
- 🔔 Reminders (birthdays, anniversaries, custom)
- 📅 Upcoming page — birthdays, anniversaries, and reminders at a glance
- 🔍 Fuzzy search with typo tolerance across contacts and companies
- 📊 CSV import/export with duplicate detection
- 🔌 Extension fields — third-party extensions can attach read-only data to contacts
- 🌐 Web UI with 6 pages: Contacts, Companies, Groups, Interactions, Reminders, Upcoming
- 🤖 16 tool actions for the agent

## Installation

```bash
pi install git@github.com:espennilsen/pi-personal-crm.git
```

Data is stored in `~/.pi/agent/crm/crm.db`.

## Usage

The CRM tool is automatically available after installation. The agent can:

- Search contacts and companies
- Add, update, and delete contacts
- Log interactions (calls, meetings, emails, notes, gifts, messages)
- Set reminders (birthdays, anniversaries, custom)
- Manage relationships between contacts
- Organize contacts into groups
- Import/export contacts as CSV

### Commands

| Command | Description |
|---|---|
| `/crm-web [port]` | Start standalone web UI (default port 4100) |
| `/crm-web stop` | Stop the standalone web server |
| `/crm-web status` | Show whether the CRM is running standalone and/or via pi-webserver |
| `/crm-export` | Export all contacts to `crm-contacts.csv` |
| `/crm-import path/to/file.csv` | Import contacts from a CSV file |

### pi-webserver integration

If [pi-webserver](https://github.com/espennilsen/pi-webserver) is installed, the CRM auto-mounts at `/crm` on the shared web server — no extra setup needed. Use `/web` to start the shared server, then visit `http://localhost:4100/crm/`. The standalone `/crm-web` command still works independently.

### Tool Actions

The `crm` tool supports 16 actions:

`search`, `contact`, `add_contact`, `update_contact`, `delete_contact`, `log_interaction`, `add_reminder`, `upcoming`, `add_relationship`, `list_companies`, `add_company`, `list_groups`, `add_to_group`, `remove_from_group`, `export_csv`, `import_csv`

See [TOOL_EXAMPLES.md](./TOOL_EXAMPLES.md) for detailed examples.

### Web UI Pages

| Page | Description |
|---|---|
| **Contacts** | List/detail split view, edit contacts, log interactions, manage groups |
| **Companies** | Browse companies, see member contacts, add/edit/delete |
| **Groups** | Create groups, manage membership |
| **Interactions** | Full interaction timeline across all contacts, filterable by type |
| **Reminders** | All reminders with upcoming/overdue indicators |
| **Upcoming** | Birthdays, anniversaries, and reminders grouped by urgency (Today, This Week, Later) |

## Extension Fields

Third-party extensions (e.g. a LinkedIn scraper) can attach read-only fields to contacts. These are displayed in the web UI but not editable there.

```typescript
import { crmApi } from "pi-personal-crm/src/db.ts";

// Upsert a field (idempotent, safe to call repeatedly)
crmApi.setExtensionField({
  contact_id: 42,
  source: "linkedin",          // your extension name
  field_name: "headline",
  field_value: "Senior Engineer at Acme",
  label: "Headline",           // optional display label
  field_type: "text",          // "text" | "url" | "date" | "number" | "json"
});

// Read fields
const fields = crmApi.getExtensionFields(42);
const linkedinFields = crmApi.getExtensionFieldsBySource(42, "linkedin");

// Remove all fields from a source
crmApi.deleteExtensionFields(42, "linkedin");
```

REST API:
- `GET    /api/crm/contacts/:id/extension-fields[?source=...]`
- `PUT    /api/crm/contacts/:id/extension-fields` — upsert (`{ source, field_name, field_value, label?, field_type? }`)
- `DELETE /api/crm/contacts/:id/extension-fields?source=...`

## Extending the CRM

Other pi extensions can import from this package:

```typescript
import { crmApi } from "pi-personal-crm/src/db.ts";
import { crmRegistry } from "pi-personal-crm/src/registry.ts";

const contacts = crmApi.getContacts();

crmRegistry.on("contact.created", async (contact) => {
  // Custom logic
});
```

## Development

```bash
npm install
npm test          # Run DB smoke tests
npm run typecheck # TypeScript type checking
```

Test locally with pi:

```bash
pi -e ./
```

## License

[MIT](./LICENSE)
