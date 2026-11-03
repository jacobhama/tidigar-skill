# Tidigar examples for AI agents

Follow [llms.txt](https://tidigar.com/llms.txt) to write a link directly.
No tool calls or scripts are needed.

## Create a plan directly

The user asks for a roadmap for launching their new app, with design,
engineering and marketing work in phases. No date is given, so the agent
starts on a coming Monday, here 11 January 2027, and chooses fifteen
activities with dependencies, a Team dimension and a Phase dimension.
Choose dates, write the dimensions and activities as text records, then add
the milestone, view, counts and final `~!`. The finished link is:

https://open.tidigar.com/s#t=1~n=Launch_the_new_app~d=From_goals_to_launch_day_and_the_first_weeks_after.~y=2027~m1=Team:Design,Engineering,Marketing~m2=Phase:Plan,Build,Launch~a1=Set_the_launch_goals/01-11/3/Marketing,Plan/100p~a2=Interview_users/01-14/9/Design,Plan/@a1~a3=Plan_the_architecture/01-14/7/Engineering,Plan/@a1~a4=Plan_the_campaign/01-14/14/Marketing,Plan/@a1~a5=Design_the_app/01-25/12/Design,Build/@a2~a6=Build_the_backend/01-21/23/Engineering,Build/@a3~a7=Build_the_app/02-15/19/Engineering,Build/@a5,a6~a8=Create_app_store_assets/02-08/12/Design,Build/@a5~a9=Build_the_launch_page/02-22/10/Marketing,Build/@a4,a8~a10=Beta_test/03-08/12/Engineering,Launch/@a7~a11=Fix_beta_feedback/03-22/5/Engineering,Launch/@a10~a12=App_store_review/03-29/5/Engineering,Launch/@a11~a13=Brief_press_and_partners/03-29/5/Marketing,Launch/@a9,a11~a14=Run_the_launch_campaign/04-06/11/Marketing,Launch/@a12,a13~a15=Review_user_feedback/04-26/5/Design,Launch/@a14~s1=Launch_day/04-05/@a12,a13~v=timeline/color:Team/group:Phase/start:01-11/end:04-30~c=15.1.0~!

Return it as a clickable Markdown link, explaining the assumed start date and
durations. Opening it in Tidigar checks the records. Optionally run
`node tidigar-link.mjs --validate "<finished URL>"` beforehand.

## Change a link directly

The user says: "The beta test can only start a week later."
Read the link's activity records and dependencies directly. Move Beta test
(`a10`) and everything that waits on it, directly or indirectly, seven days
later: `a11`, `a12`, `a13`, `a14`, `a15` and milestone `s1`.
Keep their durations and references. Update the view's end from `04-30` to
`05-07`; counts remain `c=15.1.0`. Return the edited URL as a new clickable
link. The first link keeps opening the first plan.

## Optional JSON builder example

The same plan can optionally be written as JSON and built with a script.
This is a reference for code-based workflows, not a prerequisite for making
a link.

### Launch an app

The request:

```text
Make a Tidigar roadmap for launching our new app: design, engineering and
marketing work in phases, with dependencies and a launch day.
```

The agent starts on a coming Monday, assumes durations a typical launch takes, names the dimensions Team and Phase, refers to dependencies by title and opens the link as a timeline grouped by phase and colored by team. It writes `plan.json`:

```json
{
  "$schema": "https://tidigar.com/agents/schema/plan-v1.json",
  "version": 1,
  "name": "Launch the new app",
  "description": "From goals to launch day and the first weeks after.",
  "dimensions": {
    "Team": ["Design", "Engineering", "Marketing"],
    "Phase": ["Plan", "Build", "Launch"]
  },
  "activities": [
    { "title": "Set the launch goals", "start": "2027-01-11", "end": "2027-01-13", "progress": 100, "values": { "Team": "Marketing", "Phase": "Plan" } },
    { "title": "Interview users", "start": "2027-01-14", "end": "2027-01-22", "values": { "Team": "Design", "Phase": "Plan" }, "dependsOn": ["Set the launch goals"] },
    { "title": "Plan the architecture", "start": "2027-01-14", "end": "2027-01-20", "values": { "Team": "Engineering", "Phase": "Plan" }, "dependsOn": ["Set the launch goals"] },
    { "title": "Plan the campaign", "start": "2027-01-14", "end": "2027-01-27", "values": { "Team": "Marketing", "Phase": "Plan" }, "dependsOn": ["Set the launch goals"] },
    { "title": "Design the app", "start": "2027-01-25", "end": "2027-02-05", "values": { "Team": "Design", "Phase": "Build" }, "dependsOn": ["Interview users"] },
    { "title": "Build the backend", "start": "2027-01-21", "end": "2027-02-12", "values": { "Team": "Engineering", "Phase": "Build" }, "dependsOn": ["Plan the architecture"] },
    { "title": "Build the app", "start": "2027-02-15", "end": "2027-03-05", "values": { "Team": "Engineering", "Phase": "Build" }, "dependsOn": ["Design the app", "Build the backend"] },
    { "title": "Create app store assets", "start": "2027-02-08", "end": "2027-02-19", "values": { "Team": "Design", "Phase": "Build" }, "dependsOn": ["Design the app"] },
    { "title": "Build the launch page", "start": "2027-02-22", "end": "2027-03-03", "values": { "Team": "Marketing", "Phase": "Build" }, "dependsOn": ["Plan the campaign", "Create app store assets"] },
    { "title": "Beta test", "start": "2027-03-08", "end": "2027-03-19", "values": { "Team": "Engineering", "Phase": "Launch" }, "dependsOn": ["Build the app"] },
    { "title": "Fix beta feedback", "start": "2027-03-22", "end": "2027-03-26", "values": { "Team": "Engineering", "Phase": "Launch" }, "dependsOn": ["Beta test"] },
    { "title": "App store review", "start": "2027-03-29", "end": "2027-04-02", "values": { "Team": "Engineering", "Phase": "Launch" }, "dependsOn": ["Fix beta feedback"] },
    { "title": "Brief press and partners", "start": "2027-03-29", "end": "2027-04-02", "values": { "Team": "Marketing", "Phase": "Launch" }, "dependsOn": ["Build the launch page", "Fix beta feedback"] },
    { "title": "Run the launch campaign", "start": "2027-04-06", "end": "2027-04-16", "values": { "Team": "Marketing", "Phase": "Launch" }, "dependsOn": ["App store review", "Brief press and partners"] },
    { "title": "Review user feedback", "start": "2027-04-26", "end": "2027-04-30", "values": { "Team": "Design", "Phase": "Launch" }, "dependsOn": ["Run the launch campaign"] }
  ],
  "milestones": [{ "title": "Launch day", "date": "2027-04-05", "dependsOn": ["App store review", "Brief press and partners"] }],
  "view": { "type": "timeline", "groupBy": "Phase", "colorBy": "Team" }
}
```

`node tidigar-link.mjs plan.json` prints the link, a summary to check against the request and the link's size:

```text
https://open.tidigar.com/s#t=1~n=Launch_the_new_app~d=From_goals_to_launch_day_and_the_first_weeks_after.~y=2027~m1=Team:Design,Engineering,Marketing~m2=Phase:Plan,Build,Launch~a1=Set_the_launch_goals/01-11/3/Marketing,Plan/100p~a2=Interview_users/01-14/9/Design,Plan/@a1~a3=Plan_the_architecture/01-14/7/Engineering,Plan/@a1~a4=Plan_the_campaign/01-14/14/Marketing,Plan/@a1~a5=Design_the_app/01-25/12/Design,Build/@a2~a6=Build_the_backend/01-21/23/Engineering,Build/@a3~a7=Build_the_app/02-15/19/Engineering,Build/@a5,a6~a8=Create_app_store_assets/02-08/12/Design,Build/@a5~a9=Build_the_launch_page/02-22/10/Marketing,Build/@a4,a8~a10=Beta_test/03-08/12/Engineering,Launch/@a7~a11=Fix_beta_feedback/03-22/5/Engineering,Launch/@a10~a12=App_store_review/03-29/5/Engineering,Launch/@a11~a13=Brief_press_and_partners/03-29/5/Marketing,Launch/@a9,a11~a14=Run_the_launch_campaign/04-06/11/Marketing,Launch/@a12,a13~a15=Review_user_feedback/04-26/5/Design,Launch/@a14~s1=Launch_day/04-05/@a12,a13~v=timeline/color:Team/group:Phase/start:01-11/end:04-30~c=15.1.0~!

Launch the new app (2027)
activities[0] Set the launch goals: 2027-01-11 – 2027-01-13 · 100% done · Team: Marketing · Phase: Plan
activities[1] Interview users: 2027-01-14 – 2027-01-22 · Team: Design · Phase: Plan · after activities[0]
activities[2] Plan the architecture: 2027-01-14 – 2027-01-20 · Team: Engineering · Phase: Plan · after activities[0]
activities[3] Plan the campaign: 2027-01-14 – 2027-01-27 · Team: Marketing · Phase: Plan · after activities[0]
activities[4] Design the app: 2027-01-25 – 2027-02-05 · Team: Design · Phase: Build · after activities[1]
activities[5] Build the backend: 2027-01-21 – 2027-02-12 · Team: Engineering · Phase: Build · after activities[2]
activities[6] Build the app: 2027-02-15 – 2027-03-05 · Team: Engineering · Phase: Build · after activities[4], activities[5]
activities[7] Create app store assets: 2027-02-08 – 2027-02-19 · Team: Design · Phase: Build · after activities[4]
activities[8] Build the launch page: 2027-02-22 – 2027-03-03 · Team: Marketing · Phase: Build · after activities[3], activities[7]
activities[9] Beta test: 2027-03-08 – 2027-03-19 · Team: Engineering · Phase: Launch · after activities[6]
activities[10] Fix beta feedback: 2027-03-22 – 2027-03-26 · Team: Engineering · Phase: Launch · after activities[9]
activities[11] App store review: 2027-03-29 – 2027-04-02 · Team: Engineering · Phase: Launch · after activities[10]
activities[12] Brief press and partners: 2027-03-29 – 2027-04-02 · Team: Marketing · Phase: Launch · after activities[8], activities[10]
activities[13] Run the launch campaign: 2027-04-06 – 2027-04-16 · Team: Marketing · Phase: Launch · after activities[11], activities[12]
activities[14] Review user feedback: 2027-04-26 – 2027-04-30 · Team: Design · Phase: Launch · after activities[13]
milestones[0] Launch day: 2027-04-05 · after activities[11], activities[12]

Fragment: 1030 of 1900 characters.
```

The summary shows every dependency in order and launch day after the app store review, so the agent answers:

```text
Here is your launch plan in Tidigar: [Launch the new app](https://open.tidigar.com/s#t=1~n=Launch_the_new_app~d=From_goals_to_launch_day_and_the_first_weeks_after.~y=2027~m1=Team:Design,Engineering,Marketing~m2=Phase:Plan,Build,Launch~a1=Set_the_launch_goals/01-11/3/Marketing,Plan/100p~a2=Interview_users/01-14/9/Design,Plan/@a1~a3=Plan_the_architecture/01-14/7/Engineering,Plan/@a1~a4=Plan_the_campaign/01-14/14/Marketing,Plan/@a1~a5=Design_the_app/01-25/12/Design,Build/@a2~a6=Build_the_backend/01-21/23/Engineering,Build/@a3~a7=Build_the_app/02-15/19/Engineering,Build/@a5,a6~a8=Create_app_store_assets/02-08/12/Design,Build/@a5~a9=Build_the_launch_page/02-22/10/Marketing,Build/@a4,a8~a10=Beta_test/03-08/12/Engineering,Launch/@a7~a11=Fix_beta_feedback/03-22/5/Engineering,Launch/@a10~a12=App_store_review/03-29/5/Engineering,Launch/@a11~a13=Brief_press_and_partners/03-29/5/Marketing,Launch/@a9,a11~a14=Run_the_launch_campaign/04-06/11/Marketing,Launch/@a12,a13~a15=Review_user_feedback/04-26/5/Design,Launch/@a14~s1=Launch_day/04-05/@a12,a13~v=timeline/color:Team/group:Phase/start:01-11/end:04-30~c=15.1.0~!)

I started on Monday 11 January and assumed a two-week beta and a week for the
app store review. Launch day is 5 April; open the link to move anything, and
the activities after it follow.
```
