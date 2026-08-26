---
name: run-dashboard-amazon-vendor-booking
description: Use when the user wants to run, start, launch, open, or view the Amazon Vendor Booking Automation dashboard/UI (the Streamlit app in amazon-vendor-booking-automation/). Starts the local server if it isn't already running, then opens it in the browser and reports the link.
allowed-tools: Bash
---

## What This Skill Does

Starts the project's Streamlit dashboard (`amazon-vendor-booking-automation/streamlit_app.py`)
using its existing virtual environment, waits until it's actually serving, opens it in the
default browser, and reports the URL. Reuses an already-running instance instead of starting a
duplicate. This never talks to Amazon Vendor Central — it only launches a local read/validate
UI on `127.0.0.1`.

Project root for all commands below:
`C:\Users\LED 269\Desktop\PERIES-DigitWebLanka\Task-05-amazon-vendor-central-automation\amazon-vendor-booking-automation`

## Step 1: Check if it's already running

Run:
```
curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8501
```
If this returns `200`, the dashboard is already up — skip Step 2 and go straight to Step 3
(open browser + report link).

## Step 2: Start the server

From the project root above, launch it in the background (use the Bash tool's
`run_in_background: true`, and give the background command a distinct description like
"Start Amazon Vendor Booking dashboard"):
```
cd "C:\Users\LED 269\Desktop\PERIES-DigitWebLanka\Task-05-amazon-vendor-central-automation\amazon-vendor-booking-automation" && ./.venv/Scripts/python.exe -m streamlit run streamlit_app.py --server.headless true > streamlit_server.log 2>&1
```

If `.venv/Scripts/python.exe` doesn't exist, tell the user the virtual environment is missing
and stop — do not try to create one or install packages without asking first.

Then poll (don't sleep blindly) until it responds, e.g. a short loop checking
`curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8501` every ~1–2 seconds,
up to ~20 seconds total. If it never returns `200`, read the tail of `streamlit_server.log` and
report the error to the user instead of claiming success.

## Step 3: Open it and report the link

Open the default browser:
```
cmd.exe /c start "" "http://localhost:8501"
```

Tell the user the dashboard is running at **http://localhost:8501**, briefly note it's local-only
(never touches Amazon Vendor Central), and mention it keeps running in the background — invoking
this skill again will just reopen the same instance rather than starting a second one.

## Notes

- Do not stop or restart an already-running instance as part of this skill — it only starts one
  if none is running, and otherwise reuses what's there.
- If the user wants to stop the dashboard, that's a separate ask (find and end the background
  Streamlit process) — this skill does not do that automatically.
