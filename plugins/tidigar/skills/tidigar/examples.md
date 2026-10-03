# Tidigar examples for AI agents

Each example shows a user's request, the plan an agent writes for it, what `node tidigar-link.mjs plan.json` prints and the answer. The instructions are in [llms.txt](https://tidigar.com/llms.txt).

## Replace a heat pump

The request:

```text
Create a Tidigar roadmap for replacing our heat pump this autumn, starting
12 October 2026: 15 tasks with dependencies, a Team dimension (household,
installer, electrician) and a Phase dimension.
```

The agent assumes durations a typical installation takes, names the dimensions Team and Phase, refers to dependencies by title and opens the link as a timeline grouped by phase and colored by team. It writes `plan.json`:

```json
{
  "$schema": "https://tidigar.com/schema/plan-v1.json",
  "version": 1,
  "name": "Replace the heat pump",
  "description": "From survey to a warm house before winter.",
  "dimensions": {
    "Team": ["Household", "Installer", "Electrician"],
    "Phase": ["Prepare", "Install", "Finish"]
  },
  "activities": [
    { "title": "Survey the current system", "start": "2026-10-12", "end": "2026-10-14", "progress": 100, "values": { "Team": "Household", "Phase": "Prepare" } },
    { "title": "Calculate heat demand", "start": "2026-10-15", "end": "2026-10-19", "values": { "Team": "Installer", "Phase": "Prepare" }, "dependsOn": ["Survey the current system"] },
    { "title": "Request three quotes", "start": "2026-10-15", "end": "2026-10-28", "values": { "Team": "Household", "Phase": "Prepare" }, "dependsOn": ["Survey the current system"] },
    { "title": "Choose the installer", "start": "2026-10-29", "end": "2026-11-02", "values": { "Team": "Household", "Phase": "Prepare" }, "dependsOn": ["Calculate heat demand", "Request three quotes"] },
    { "title": "Check subsidies and permits", "start": "2026-11-03", "end": "2026-11-06", "values": { "Team": "Household", "Phase": "Prepare" }, "dependsOn": ["Choose the installer"] },
    { "title": "Order the heat pump", "start": "2026-11-03", "end": "2026-11-04", "values": { "Team": "Installer", "Phase": "Prepare" }, "dependsOn": ["Choose the installer"] },
    { "title": "Delivery", "start": "2026-11-05", "end": "2026-11-18", "values": { "Team": "Installer", "Phase": "Install" }, "dependsOn": ["Order the heat pump"] },
    { "title": "Upgrade the electrical panel", "start": "2026-11-09", "end": "2026-11-11", "values": { "Team": "Electrician", "Phase": "Install" }, "dependsOn": ["Check subsidies and permits"] },
    { "title": "Pour the outdoor foundation", "start": "2026-11-12", "end": "2026-11-13", "values": { "Team": "Installer", "Phase": "Install" }, "dependsOn": ["Check subsidies and permits"] },
    { "title": "Remove the old heat pump", "start": "2026-11-19", "end": "2026-11-19", "values": { "Team": "Installer", "Phase": "Install" }, "dependsOn": ["Delivery", "Pour the outdoor foundation"] },
    { "title": "Install indoor and outdoor units", "start": "2026-11-20", "end": "2026-11-24", "values": { "Team": "Installer", "Phase": "Install" }, "dependsOn": ["Remove the old heat pump"] },
    { "title": "Connect power", "start": "2026-11-25", "end": "2026-11-25", "values": { "Team": "Electrician", "Phase": "Install" }, "dependsOn": ["Upgrade the electrical panel", "Install indoor and outdoor units"] },
    { "title": "Commission and balance", "start": "2026-11-26", "end": "2026-11-27", "values": { "Team": "Installer", "Phase": "Finish" }, "dependsOn": ["Connect power"] },
    { "title": "Recycle the old unit", "start": "2026-11-30", "end": "2026-12-01", "values": { "Team": "Installer", "Phase": "Finish" }, "dependsOn": ["Remove the old heat pump"] },
    { "title": "Follow-up check", "start": "2026-12-14", "end": "2026-12-14", "values": { "Team": "Household", "Phase": "Finish" }, "dependsOn": ["Commission and balance"] }
  ],
  "milestones": [{ "title": "Heating back on", "date": "2026-11-28", "dependsOn": ["Commission and balance"] }],
  "view": { "type": "timeline", "groupBy": "Phase", "colorBy": "Team" }
}
```

`node tidigar-link.mjs plan.json` prints the link, a summary to check against the request and the link's size:

```text
https://open.tidigar.com/s#s=1.bZRNb9swDIb_iqCzMliym6a5di2604p2OwU5KDYTC5MlVx8JgqL_fZTk5qPozTAfki_50n6nhi7pC4xatkBCD6QHGcgYh5EyeqRLUYk5ox1Cj84OxEe3hyMJlkhykG4gvY0eyAa21gE5KBPA_cDMgS5XK_oH5EAZPjwlqre6w1CzvW23W7pmK_rL-CC1Boev-VzWjcyvHzS0walWSYOB7c0dVBu6XqfQcy895JLPDkbp4NuC1-UelVG-v6q0ZlRlha_TPDh4G50DE4g_-gAoWywaJhiljFcVW3HGs4B7qduoZZgW1cEgTZfgW9YkGFGBKFtVGX-Btwg-YAMHQN6iDeALzesJ5xf4fW-tLz6o827qip-KF5ozMfHQ_kNTNl51CjxBLWQEN6jgU9qcXTepc9Jv14H76nWC-dUABf4JWu3BHROxOIsWKICtbjLyd9w52RXVMFknNRmlAXSi5qKsEbPqnNUUJ20sImwMnbWObG00nQzKmpR0c6HmnPQCg92XTnhMV_qFQPgyY84W64ubwIXmNmlFny2jKYsS9YV5KfeubNcag-OQ0R6yDWJxalEmQRcn3-wwKO9Re66_kVqaFlLK3cUcdXKOT4O0x1afJ0lKEK_rL3gR8mi1todZHEmbDEewuT1J4aWuyFft81U_4V6U2aEOvI68z5qfEEuX73Sv4IDfdFAD-mvSV9RabR1dYtWds3GkSxTyGX4N0gXE089gxqsZF_QcfDDdKSRmvKEfH_8B

Replace the heat pump (2026)
activities[0] Survey the current system: 2026-10-12 – 2026-10-14 · 100% done · Team: Household · Phase: Prepare
activities[1] Calculate heat demand: 2026-10-15 – 2026-10-19 · Team: Installer · Phase: Prepare · after activities[0]
activities[2] Request three quotes: 2026-10-15 – 2026-10-28 · Team: Household · Phase: Prepare · after activities[0]
activities[3] Choose the installer: 2026-10-29 – 2026-11-02 · Team: Household · Phase: Prepare · after activities[1], activities[2]
activities[4] Check subsidies and permits: 2026-11-03 – 2026-11-06 · Team: Household · Phase: Prepare · after activities[3]
activities[5] Order the heat pump: 2026-11-03 – 2026-11-04 · Team: Installer · Phase: Prepare · after activities[3]
activities[6] Delivery: 2026-11-05 – 2026-11-18 · Team: Installer · Phase: Install · after activities[5]
activities[7] Upgrade the electrical panel: 2026-11-09 – 2026-11-11 · Team: Electrician · Phase: Install · after activities[4]
activities[8] Pour the outdoor foundation: 2026-11-12 – 2026-11-13 · Team: Installer · Phase: Install · after activities[4]
activities[9] Remove the old heat pump: 2026-11-19 – 2026-11-19 · Team: Installer · Phase: Install · after activities[6], activities[8]
activities[10] Install indoor and outdoor units: 2026-11-20 – 2026-11-24 · Team: Installer · Phase: Install · after activities[9]
activities[11] Connect power: 2026-11-25 – 2026-11-25 · Team: Electrician · Phase: Install · after activities[7], activities[10]
activities[12] Commission and balance: 2026-11-26 – 2026-11-27 · Team: Installer · Phase: Finish · after activities[11]
activities[13] Recycle the old unit: 2026-11-30 – 2026-12-01 · Team: Installer · Phase: Finish · after activities[9]
activities[14] Follow-up check: 2026-12-14 – 2026-12-14 · Team: Household · Phase: Finish · after activities[12]
milestones[0] Heating back on: 2026-11-28 · after activities[12]

Fragment: 756 of 1900 characters.
```

The summary shows every dependency in order and nothing after mid-December, so the agent answers:

```text
Here is your heat pump plan in Tidigar: [Replace the heat pump](https://open.tidigar.com/s#s=1.bZRNb9swDIb_iqCzMliym6a5di2604p2OwU5KDYTC5MlVx8JgqL_fZTk5qPozTAfki_50n6nhi7pC4xatkBCD6QHGcgYh5EyeqRLUYk5ox1Cj84OxEe3hyMJlkhykG4gvY0eyAa21gE5KBPA_cDMgS5XK_oH5EAZPjwlqre6w1CzvW23W7pmK_rL-CC1Boev-VzWjcyvHzS0walWSYOB7c0dVBu6XqfQcy895JLPDkbp4NuC1-UelVG-v6q0ZlRlha_TPDh4G50DE4g_-gAoWywaJhiljFcVW3HGs4B7qduoZZgW1cEgTZfgW9YkGFGBKFtVGX-Btwg-YAMHQN6iDeALzesJ5xf4fW-tLz6o827qip-KF5ozMfHQ_kNTNl51CjxBLWQEN6jgU9qcXTepc9Jv14H76nWC-dUABf4JWu3BHROxOIsWKICtbjLyd9w52RXVMFknNRmlAXSi5qKsEbPqnNUUJ20sImwMnbWObG00nQzKmpR0c6HmnPQCg92XTnhMV_qFQPgyY84W64ubwIXmNmlFny2jKYsS9YV5KfeubNcag-OQ0R6yDWJxalEmQRcn3-wwKO9Re66_kVqaFlLK3cUcdXKOT4O0x1afJ0lKEK_rL3gR8mi1todZHEmbDEewuT1J4aWuyFft81U_4V6U2aEOvI68z5qfEEuX73Sv4IDfdFAD-mvSV9RabR1dYtWds3GkSxTyGX4N0gXE089gxqsZF_QcfDDdKSRmvKEfH_8B)

I assumed two weeks for delivery and that the old unit is removed the day
before installation. The heating is back on 28 November; open the link to
move anything, and the activities after it follow.
```

## Change a link

The user answers: "The installer can only start a week later." The agent reads the link as a plan, which the module writes to standard output and its summary to standard error, moves the affected dates and builds a new link:

```sh
node tidigar-link.mjs --read "https://open.tidigar.com/s#s=1.bZRNb9swDIb_iqCzMliym6a5di2604p2OwU5KDYTC5MlVx8JgqL_fZTk5qPozTAfki_50n6nhi7pC4xatkBCD6QHGcgYh5EyeqRLUYk5ox1Cj84OxEe3hyMJlkhykG4gvY0eyAa21gE5KBPA_cDMgS5XK_oH5EAZPjwlqre6w1CzvW23W7pmK_rL-CC1Boev-VzWjcyvHzS0walWSYOB7c0dVBu6XqfQcy895JLPDkbp4NuC1-UelVG-v6q0ZlRlha_TPDh4G50DE4g_-gAoWywaJhiljFcVW3HGs4B7qduoZZgW1cEgTZfgW9YkGFGBKFtVGX-Btwg-YAMHQN6iDeALzesJ5xf4fW-tLz6o827qip-KF5ozMfHQ_kNTNl51CjxBLWQEN6jgU9qcXTepc9Jv14H76nWC-dUABf4JWu3BHROxOIsWKICtbjLyd9w52RXVMFknNRmlAXSi5qKsEbPqnNUUJ20sImwMnbWObG00nQzKmpR0c6HmnPQCg92XTnhMV_qFQPgyY84W64ubwIXmNmlFny2jKYsS9YV5KfeubNcag-OQ0R6yDWJxalEmQRcn3-wwKO9Re66_kVqaFlLK3cUcdXKOT4O0x1afJ0lKEK_rL3gR8mi1todZHEmbDEewuT1J4aWuyFft81U_4V6U2aEOvI68z5qfEEuX73Sv4IDfdFAD-mvSV9RabR1dYtWds3GkSxTyGX4N0gXE089gxqsZF_QcfDDdKSRmvKEfH_8B" > plan.json
```

It moves Remove the old heat pump and every activity and milestone after it by seven days in `plan.json`, runs `node tidigar-link.mjs plan.json` again and answers with the new link. The first link keeps opening the first plan.
