# CRM Tool Examples

Examples of using the CRM tool in Pi agent prompts.

## Search Contacts

```
Search for John in CRM
```

Tool call:
```json
{
  "tool": "crm",
  "action": "search",
  "query": "John"
}
```

Returns:
```
🔍 Search results for "John":

**Contacts (1):**
- John Doe @ Acme Corp <john@acme.example> (ID: 1)
```

## Get Contact Details

```
Tell me about John Doe
```

Tool call:
```json
{
  "tool": "crm",
  "action": "contact",
  "name": "John Doe"
}
```

Returns:
```
👤 **John Doe**

📧 john@acme.example
📞 +1234567890
🏢 Acme Corp
🎂 Birthday: 1990-05-15
🏷️  Tags: vip,client

**Recent Interactions (1):**
- call (2/10/2026): Discussed Q4 roadmap
  Follow up in 2 weeks

**Reminders:**
- birthday: 2026-05-15 — Wish John a happy birthday!

_Contact ID: 1_
```

## Add a Contact

```
Add Sarah Johnson to CRM:
- Email: sarah@techstartup.io
- Phone: +44 20 1234 5678
- Company: TechStartup (create if needed)
- Tags: prospect, developer
- Birthday: 1992-08-20
```

Tool call:
```json
{
  "tool": "crm",
  "action": "add_contact",
  "first_name": "Sarah",
  "last_name": "Johnson",
  "email": "sarah@techstartup.io",
  "phone": "+44 20 1234 5678",
  "company_name": "TechStartup",
  "tags": "prospect,developer",
  "birthday": "1992-08-20"
}
```

Returns:
```
✅ Created contact: Sarah Johnson (ID: 2)
```

## Log an Interaction

```
Log a call with John (ID 1): Discussed renewal, closing Q1 2026
```

Tool call:
```json
{
  "tool": "crm",
  "action": "log_interaction",
  "contact_id": 1,
  "interaction_type": "call",
  "summary": "Discussed renewal, closing Q1 2026"
}
```

Returns:
```
✅ Logged call with John Doe: Discussed renewal, closing Q1 2026
```

## Add a Reminder

```
Set a reminder for Sarah's birthday on 2026-08-20
```

Tool call:
```json
{
  "tool": "crm",
  "action": "add_reminder",
  "contact_id": 2,
  "reminder_type": "birthday",
  "reminder_date": "2026-08-20",
  "reminder_message": "Wish Sarah a happy birthday!"
}
```

Returns:
```
✅ Added birthday reminder for Sarah Johnson on 2026-08-20
```

## View Upcoming Reminders

```
What's coming up in the next week?
```

Tool call:
```json
{
  "tool": "crm",
  "action": "upcoming",
  "days": 7
}
```

Returns:
```
📅 Upcoming reminders (next 7 days):

- 2026-05-15: birthday — John Doe (Wish John a happy birthday!)
```

## Update a Contact

```
Update John's tags to include "enterprise" and change notes to "Key account - high value"
```

Tool call:
```json
{
  "tool": "crm",
  "action": "update_contact",
  "contact_id": 1,
  "tags": "vip,client,enterprise",
  "notes": "Key account - high value"
}
```

Returns:
```
✅ Updated contact: John Doe
```

## List Companies

```
Show all companies in CRM
```

Tool call:
```json
{
  "tool": "crm",
  "action": "list_companies"
}
```

Returns:
```
🏢 Companies (2):

- Acme Corp [Technology] — https://acme.example (ID: 1)
- TechStartup — (ID: 2)
```

## Natural Language Examples

The CRM tool works naturally in conversation:

- "Who do I know at Acme?"
- "What did I last talk to John about?"
- "Add Alice Brown as a new contact, she works at Microsoft"
- "Log a meeting with Sarah: discussed product demo, very interested"
- "Who has a birthday coming up soon?"
- "Tag John as an enterprise customer"
- "Show me all companies in the tech industry"

The agent will map these to the appropriate CRM tool actions.
