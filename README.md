# AI Engineering Capacity Dashboard

A lightweight capacity planning tool for the Vector Institute AI Engineering team. Built on Google Sheets + Google Apps Script — no infrastructure, no backend to maintain.

PMs update a single spreadsheet. The dashboard reflects changes in near-real time.

---

## How it works

| Layer | Technology |
| --- | --- |
| Data store | Google Sheets (People, Projects, Assignments) |
| Backend | Google Apps Script (container-bound to the sheet) |
| Frontend | Apps Script Web App — HTML + Chart.js served via `doGet()` |
| CI/CD | GitHub Actions → clasp push → Apps Script deployment |

The Summary sheet is regenerated automatically on every edit to People, Projects, or Assignments. The web app fetches the latest snapshot on page load via `google.script.run`.

---

## Sheet structure

| Sheet | Purpose |
| --- | --- |
| **People** | One row per team member: name, role, weekly FTE capacity |
| **Projects** | One row per project: name, workstream, status (Committed / Planned / Pipeline), individually funded flag, FTE budget |
| **Assignments** | One row per person–project pairing: person, project, FTE, start date, end date |
| **Summary** | Auto-generated. Weekly FTE aggregates by status + surplus calculations. Do not edit manually. |

---

## First-time setup

### 1. Create the Google Sheet

Open Google Sheets and create a new blank spreadsheet.

### 2. Open Apps Script

**Extensions → Apps Script**

Paste the contents of `src/Code.gs`, replacing any existing code. Also create two HTML files — `index` and `client` — and paste `src/index.html` and `src/client.html` respectively.

### 3. Run setup

In the Apps Script editor: **Run → `setupCapacityDashboard`**

Authorize when prompted. This creates all four sheets and populates them with synthetic data.

### 4. Replace synthetic data

Fill in your real team members, projects, and assignments. The Summary sheet updates automatically on every edit.

### 5. Deploy as a Web App

**Deploy → New deployment**

| Setting | Value |
| --- | --- |
| Type | Web app |
| Execute as | Me |
| Who has access | Anyone at [your org] (or Anyone, if no org restriction needed) |

Copy the `/exec` URL — that's your dashboard.

---

## Local development with clasp

[clasp](https://github.com/google/clasp) lets you edit and deploy Apps Script files locally.

```bash
npm install -g @google/clasp
clasp login
```

Clone this repo and update `.clasp.json` with your own script ID:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "./src"
}
```

Find your script ID in the Apps Script editor URL:
`https://script.google.com/home/projects/YOUR_SCRIPT_ID/edit`

Push changes to Apps Script:

```bash
clasp push --force
```

Publish a new version to your existing deployment:

```bash
clasp deploy --deploymentId YOUR_DEPLOYMENT_ID --description "your message"
```

---

## Automated deployment via GitHub Actions

Every push to `main` automatically pushes code and publishes a new deployment version.

**Required secrets and variables** (set in GitHub repo Settings → Secrets and variables → Actions):

| Name | Type | Value |
| --- | --- | --- |
| `CLASP_CREDENTIALS` | Secret | Contents of `~/.clasprc.json` after running `clasp login` |
| `CLASP_DEPLOYMENT_ID` | Variable | Your Apps Script deployment ID |

To get your credentials:

```bash
cat ~/.clasprc.json
```

---

## Dashboard features

- **Scorecards** — Total Capacity, Committed, Available Capacity, Available if Plan Holds; averaged over the selected period
- **Period presets** — Current Quarter, Last/Next 4 or 8 Weeks, Full Year, Custom Range
- **Fiscal year filter** — April 1 – March 31
- **Views** — By Project (weekly FTE stacked by status), By Person (avg weekly FTE per person), By Workstream (weekly FTE timeseries)
- **Metrics**
  - Firm Surplus = Total Capacity − Committed
  - Net Surplus = Total Capacity − Committed − Planned

---

## License

Apache-2.0
