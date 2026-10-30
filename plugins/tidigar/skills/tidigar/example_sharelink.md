# Tidigar examples for AI agents

Follow [llms.txt](https://tidigar.com/llms.txt) to write a link directly.
No tool calls or scripts are needed.

## Create a plan directly

The user asks for a heat pump replacement plan starting October 12, 2026,
with fifteen activities, dependencies, a Team dimension and a Phase dimension.
Choose dates, write the dimensions and activities as text records, then add
the milestone, view, counts and final `~!`. The finished link is:

https://open.tidigar.com/s#t=1~n=Replace_the_heat_pump~d=From_survey_to_a_warm_house_before_winter.~y=2026~m1=Team:Household,Installer,Electrician~m2=Phase:Prepare,Install,Finish~a1=Survey_the_current_system/10-12/3/Household,Prepare/100p~a2=Calculate_heat_demand/10-15/5/Installer,Prepare/@a1~a3=Request_three_quotes/10-15/14/Household,Prepare/@a1~a4=Choose_the_installer/10-29/5/Household,Prepare/@a2,a3~a5=Check_subsidies_and_permits/11-03/4/Household,Prepare/@a4~a6=Order_the_heat_pump/11-03/2/Installer,Prepare/@a4~a7=Delivery/11-05/14/Installer,Install/@a6~a8=Upgrade_the_electrical_panel/11-09/3/Electrician,Install/@a5~a9=Pour_the_outdoor_foundation/11-12/2/Installer,Install/@a5~a10=Remove_the_old_heat_pump/11-19/1/Installer,Install/@a7,a9~a11=Install_indoor_and_outdoor_units/11-20/5/Installer,Install/@a10~a12=Connect_power/11-25/1/Electrician,Install/@a8,a11~a13=Commission_and_balance/11-26/2/Installer,Finish/@a12~a14=Recycle_the_old_unit/11-30/2/Installer,Finish/@a10~a15=Follow-up_check/12-14/1/Household,Finish/@a13~s1=Heating_back_on/11-28/@a13~v=timeline/color:Team/group:Phase/start:10-12/end:12-14~c=15.1.0~!

Return it as a clickable Markdown link, explaining the assumed installation
and delivery times. Opening it in Tidigar checks the records. Optionally run
`node tidigar-link.mjs --validate "<finished URL>"` beforehand.

## Change a link directly

The user says: "The installer can only start a week later."
Read the link's activity records and dependencies directly. Move Remove the
old heat pump (`a10`) and everything that waits on it, directly or indirectly,
seven days later: `a11`, `a12`, `a13`, `a14`, `a15` and milestone `s1`.
Keep their durations and references. Update the view's end from `12-14` to
`12-21`; counts remain `c=15.1.0`. Return the edited URL as a new clickable
link. The first link keeps opening the first plan.

## Optional JSON builder example

The same plan can optionally be written as JSON and built with a script.
This is a reference for code-based workflows, not a prerequisite for making
a link.

### Replace a heat pump

The request:

```text
Create a Tidigar roadmap for replacing our heat pump this autumn, starting
12 October 2026: 15 tasks with dependencies, a Team dimension (household,
installer, electrician) and a Phase dimension.
```

The agent assumes durations a typical installation takes, names the dimensions Team and Phase, refers to dependencies by title and opens the link as a timeline grouped by phase and colored by team. It writes `plan.json`:

```json
{
  "$schema": "https://tidigar.com/agents/schema/plan-v1.json",
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
https://open.tidigar.com/s#t=1~n=Replace_the_heat_pump~d=From_survey_to_a_warm_house_before_winter.~y=2026~m1=Team:Household,Installer,Electrician~m2=Phase:Prepare,Install,Finish~a1=Survey_the_current_system/10-12/3/Household,Prepare/100p~a2=Calculate_heat_demand/10-15/5/Installer,Prepare/@a1~a3=Request_three_quotes/10-15/14/Household,Prepare/@a1~a4=Choose_the_installer/10-29/5/Household,Prepare/@a2,a3~a5=Check_subsidies_and_permits/11-03/4/Household,Prepare/@a4~a6=Order_the_heat_pump/11-03/2/Installer,Prepare/@a4~a7=Delivery/11-05/14/Installer,Install/@a6~a8=Upgrade_the_electrical_panel/11-09/3/Electrician,Install/@a5~a9=Pour_the_outdoor_foundation/11-12/2/Installer,Install/@a5~a10=Remove_the_old_heat_pump/11-19/1/Installer,Install/@a7,a9~a11=Install_indoor_and_outdoor_units/11-20/5/Installer,Install/@a10~a12=Connect_power/11-25/1/Electrician,Install/@a8,a11~a13=Commission_and_balance/11-26/2/Installer,Finish/@a12~a14=Recycle_the_old_unit/11-30/2/Installer,Finish/@a10~a15=Follow-up_check/12-14/1/Household,Finish/@a13~s1=Heating_back_on/11-28/@a13~v=timeline/color:Team/group:Phase/start:10-12/end:12-14~c=15.1.0~!

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

Fragment: 1103 of 1900 characters.
```

The summary shows every dependency in order and nothing after mid-December, so the agent answers:

```text
Here is your heat pump plan in Tidigar: [Replace the heat pump](https://open.tidigar.com/s#t=1~n=Replace_the_heat_pump~d=From_survey_to_a_warm_house_before_winter.~y=2026~m1=Team:Household,Installer,Electrician~m2=Phase:Prepare,Install,Finish~a1=Survey_the_current_system/10-12/3/Household,Prepare/100p~a2=Calculate_heat_demand/10-15/5/Installer,Prepare/@a1~a3=Request_three_quotes/10-15/14/Household,Prepare/@a1~a4=Choose_the_installer/10-29/5/Household,Prepare/@a2,a3~a5=Check_subsidies_and_permits/11-03/4/Household,Prepare/@a4~a6=Order_the_heat_pump/11-03/2/Installer,Prepare/@a4~a7=Delivery/11-05/14/Installer,Install/@a6~a8=Upgrade_the_electrical_panel/11-09/3/Electrician,Install/@a5~a9=Pour_the_outdoor_foundation/11-12/2/Installer,Install/@a5~a10=Remove_the_old_heat_pump/11-19/1/Installer,Install/@a7,a9~a11=Install_indoor_and_outdoor_units/11-20/5/Installer,Install/@a10~a12=Connect_power/11-25/1/Electrician,Install/@a8,a11~a13=Commission_and_balance/11-26/2/Installer,Finish/@a12~a14=Recycle_the_old_unit/11-30/2/Installer,Finish/@a10~a15=Follow-up_check/12-14/1/Household,Finish/@a13~s1=Heating_back_on/11-28/@a13~v=timeline/color:Team/group:Phase/start:10-12/end:12-14~c=15.1.0~!)

I assumed two weeks for delivery and that the old unit is removed the day
before installation. The heating is back on 28 November; open the link to
move anything, and the activities after it follow.
```
