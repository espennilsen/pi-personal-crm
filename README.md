# pi-crm-personal

Personal CRM extension for [pi](https://github.com/badlogic/pi-mono) coding agents.

## Features

- 👤 Contacts with custom fields, companies, relationships
- 💬 Interaction timeline (calls, meetings, notes, emails, gifts, messages)
- 🏷️ Groups with membership management
- 🔔 Reminders (birthdays, anniversaries, custom)
- 🔍 Full-text search across contacts and companies
- 📊 CSV import/export with duplicate detection
- 🌐 Web UI with list/detail/timeline views (`/crm-web`)
- 🤖 16 tool actions for the agent

## Installation

```bash
pi install git@github.com:espennilsen/pi-crm-personal.git
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
| `/crm-web [port]` | Start/stop the web UI (default port 4100) |
| `/crm-export` | Export all contacts to `crm-contacts.csv` |
| `/crm-import path/to/file.csv` | Import contacts from a CSV file |

### Tool Actions

The `crm` tool supports 16 actions:

`search`, `contact`, `add_contact`, `update_contact`, `delete_contact`, `log_interaction`, `add_reminder`, `upcoming`, `add_relationship`, `list_companies`, `add_company`, `list_groups`, `add_to_group`, `remove_from_group`, `export_csv`, `import_csv`

See [TOOL_EXAMPLES.md](./TOOL_EXAMPLES.md) for detailed examples.

## Development

```bash
npm install
npm test          # Run DB smoke tests
npm run typecheck # TypeScript type checking
```

Test locally with pi:

```bash
pi -e ./src/index.ts
```

## License

MIT
