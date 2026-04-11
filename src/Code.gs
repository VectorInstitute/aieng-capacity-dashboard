/**
 * AI Engineering Capacity Dashboard — Google Apps Script
 * Vector Institute
 *
 * SETUP (one time):
 *   1. Open the Google Sheet → Extensions → Apps Script
 *   2. Paste this file, replacing any existing content
 *   3. Run → setupCapacityDashboard
 *   4. Authorize when prompted
 *
 * ONGOING USE:
 *   - PM edits People, Projects, and Assignments sheets directly
 *   - Summary sheet regenerates automatically on every edit
 *   - Capacity menu → Refresh to force a manual update
 *
 * WEB APP:
 *   Deploy → New deployment → Web app
 *     Execute as:     Me (the account owning this sheet)
 *     Who has access: Anyone at Vector Institute
 */


// ── Constants ─────────────────────────────────────────────────────────────────

const HEADER_BG = '#1f3864';
const HEADER_FG = '#ffffff';

const STATUS_COLORS = {
  'Committed': '#c6efce', // green
  'Planned':   '#ffeb9c', // yellow
  'Pipeline':  '#dce6f1', // blue-grey
  'Completed': '#efefef', // light grey
};


// ── Entry Points ──────────────────────────────────────────────────────────────

/**
 * Adds a "Capacity" menu to the spreadsheet UI on open.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Capacity')
    .addItem('Refresh', 'expandAssignments')
    .addItem('Setup Dropdowns', 'setupDropdowns')
    .addToUi();
}

/**
 * Creates all sheets and populates them with synthetic data.
 * Safe to re-run: rebuilds People, Projects, Assignments, and Summary from scratch.
 */
function setupCapacityDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Keep a temp sheet so Google always has at least one sheet during deletion
  const tempSheet = ss.insertSheet('__temp__');

  ['Assignments', 'Projects', 'People', 'Summary', 'Expanded', 'Sheet1', 'Sheet'].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) ss.deleteSheet(sheet);
  });

  _buildPeopleSheet(ss);
  _buildProjectsSheet(ss);
  _buildAssignmentsSheet(ss);
  _buildSummarySheet(ss);

  ss.deleteSheet(tempSheet);

  expandAssignments();

  SpreadsheetApp.getUi().alert(
    'Setup complete.\n\n' +
    'Replace the synthetic data in People, Projects, and Assignments with your real data.\n' +
    'The Summary sheet regenerates automatically on every edit.'
  );
}

/**
 * Regenerates Summary on any edit to Assignments, Projects, or People.
 * Also auto-adds a placeholder row to Assignments when a project is committed.
 */
function onEdit(e) {
  if (!e) return;
  const name = e.source.getActiveSheet().getName();

  if (name === 'Assignments' || name === 'People') {
    expandAssignments();
  }

  if (name === 'Projects') {
    expandAssignments();
    if (e.range.getColumn() === 3 && e.value === 'Committed') {
      _onProjectCommitted(e.source, e.range.getRow());
    }
  }
}

/**
 * Adds a placeholder row to Assignments when a project first becomes Committed.
 * Skips silently if the project already has assignment rows.
 */
function _onProjectCommitted(ss, projectRow) {
  const projectSheet = ss.getSheetByName('Projects');
  const assignSheet  = ss.getSheetByName('Assignments');
  if (!projectSheet || !assignSheet) return;

  const projectName = projectSheet.getRange(projectRow, 1).getValue();
  if (!projectName) return;

  const alreadyAssigned = assignSheet.getDataRange().getValues()
    .slice(1)
    .some(r => r[1] === projectName);

  if (!alreadyAssigned) {
    const newRow = assignSheet.getLastRow() + 1;
    assignSheet.getRange(newRow, 1, 1, 6).setValues([
      ['← assign person', projectName, '', '', '', 'Auto-added on commit — fill in details']
    ]);
    assignSheet.getRange(newRow, 1, 1, 6).setBackground('#fff2cc');
  }
}

/**
 * Applies dynamic dropdowns to Assignments using live People and Projects data.
 * Run from the Capacity menu after adding new people or projects.
 */
function setupDropdowns() {
  const ss           = SpreadsheetApp.getActiveSpreadsheet();
  const assignSheet  = ss.getSheetByName('Assignments');
  const peopleSheet  = ss.getSheetByName('People');
  const projectSheet = ss.getSheetByName('Projects');

  if (!assignSheet || !peopleSheet || !projectSheet) {
    SpreadsheetApp.getUi().alert('Assignments, People, or Projects sheet not found.');
    return;
  }

  const dropdownRows   = 200;
  const lastPeopleRow  = Math.max(peopleSheet.getLastRow(),  2);
  const lastProjectRow = Math.max(projectSheet.getLastRow(), 2);

  const personRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(peopleSheet.getRange(2, 1, lastPeopleRow - 1, 1), true)
    .setAllowInvalid(false)
    .build();
  assignSheet.getRange(2, 1, dropdownRows, 1).setDataValidation(personRule);

  const projectRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(projectSheet.getRange(2, 1, lastProjectRow - 1, 1), true)
    .setAllowInvalid(false)
    .build();
  assignSheet.getRange(2, 2, dropdownRows, 1).setDataValidation(projectRule);

  SpreadsheetApp.getUi().alert('Dropdowns updated.');
}


// ── Web App ───────────────────────────────────────────────────────────────────

/**
 * Serves the capacity dashboard.
 * Deploy → New deployment → Web app
 *   Execute as:     Me  (script runs with sheet owner's access; visitors never touch the sheet)
 *   Who has access: Anyone at Vector Institute
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('AI Engineering Capacity — Vector Institute')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Inlines an HTML file into a server-side template.
 * Used in index.html as: <?!= include('styles') ?> / <?!= include('client') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Returns the org-wide capacity snapshot for the web app.
 * Called from the browser via: google.script.run.getCapacityData()
 * Returns: { meta, people[], projects[], assignments[], summary[] }
 */
function getCapacityData() {
  return _buildSnapshot(SpreadsheetApp.getActiveSpreadsheet());
}


// ── Sheet Builders ────────────────────────────────────────────────────────────

function _buildPeopleSheet(ss) {
  const s = ss.insertSheet('People');
  _writeHeader(s, ['Name', 'Role', 'Weekly FTE Capacity']);

  const rows = [
    // Program management
    ['Sarah Thompson',    'Senior Technical Program Manager',             1.0],
    ['Marcus Rivera',     'Program Manager',                              1.0],
    ['Kevin Park',        'Associate Program Manager',                    1.0],
    ['Aisha Patel',       'Senior Product Manager',                       1.0],
    // Leadership
    ['Elena Kowalski',    'Manager',                                      1.0],
    ['James Chen',        'Technical Team Lead',                          1.0],
    // Scientists
    ['David Osei',        'Applied Machine Learning Scientist',            1.0],
    ['Yuki Tanaka',       'Applied Machine Learning Scientist',            1.0],
    ['Fatima Al-Hassan',  'Applied Machine Learning Scientist',            1.0],
    // Developers
    ['Ben Nakamura',      'Senior Software Developer - Machine Learning',  1.0],
    ['Chloe Martin',      'Software Developer - Machine Learning',         1.0],
    ['Raj Krishnamurthy', 'Software Developer - Machine Learning',         1.0],
    // Specialists
    ['Nina Oduya',        'Applied Machine Learning Specialist',           1.0],
    ['Omar Siddiqui',     'Associate Applied Machine Learning Specialist', 1.0],
    ['Hannah Müller',     'System Specialist',                             1.0],
    // Interns
    ['Lily Zhang',        'Applied Machine Learning Intern',               1.0], // full-time
    ['Tyler Brooks',      'Applied Machine Learning Intern',               0.5], // part-time
  ];

  s.getRange(2, 1, rows.length, 3).setValues(rows);
  s.getRange(2, 3, rows.length, 1).setNumberFormat('0.0');
  s.autoResizeColumns(1, 3);
  s.getRange('A1').setNote(
    'Add or remove team members here.\n' +
    'Weekly FTE Capacity: 1.0 = full-time, 0.5 = part-time.'
  );
}

function _buildProjectsSheet(ss) {
  const s = ss.insertSheet('Projects');
  _writeHeader(s, ['Project', 'Workstream', 'Status', 'Individually Funded', 'Weekly FTE Budget']);

  const rows = [
    ['Meridian Analytics',          'Industry',      'Committed', 'No',  2.0 ],
    ['CivicAI Deployment',          'Public Sector', 'Committed', 'Yes', 3.25],
    ['AI Bootcamp Cohort 5',        'Education',     'Committed', 'No',  1.5 ],
    ['HealthBridge',                'Health Tech',   'Planned',   'No',  2.0 ],
    ['Northern Futures Initiative', 'ROAP',          'Planned',   'Yes', 2.5 ],
    ['Nexus Platform',              'Industry',      'Pipeline',  'No',  2.0 ],
    ['Climate Data Commons',        'Public Sector', 'Pipeline',  'Yes', 2.5 ],
  ];

  s.getRange(2, 1, rows.length, 5).setValues(rows);
  s.getRange(2, 5, rows.length, 1).setNumberFormat('0.0');

  _addDropdown(s, 2, 3, rows.length + 50, ['Committed', 'Planned', 'Pipeline', 'Completed']);
  _addDropdown(s, 2, 4, rows.length + 50, ['Yes', 'No']);

  rows.forEach((row, i) => {
    s.getRange(i + 2, 1, 1, 5).setBackground(STATUS_COLORS[row[2]] || '#ffffff');
  });

  s.getRange('C1').setNote(
    'Committed  — contracted or actively staffed\n' +
    'Planned    — confirmed internally, not yet started\n' +
    'Pipeline   — proposed or potential, not committed\n' +
    'Completed  — work finished; hidden in dashboard by default'
  );
  s.autoResizeColumns(1, 5);
}

function _buildAssignmentsSheet(ss) {
  const s = ss.insertSheet('Assignments');
  _writeHeader(s, ['Person', 'Project', 'FTE', 'Start Date', 'End Date', 'Note']);

  const d = str => new Date(str);

  // Synthetic data: FY2627 (April 2026 – March 2027)
  // Multiple rows per person+project show variable FTE across phases (e.g. bootcamp).
  const rows = [
    // ── Meridian Analytics (Industry, Committed) ──────────────────────────────
    ['David Osei',        'Meridian Analytics',          1.0,  d('2026-04-06'), d('2026-09-28'), ''],
    ['Ben Nakamura',      'Meridian Analytics',          0.75, d('2026-04-06'), d('2026-09-28'), ''],
    ['Nina Oduya',        'Meridian Analytics',          0.25, d('2026-04-06'), d('2026-06-29'), ''],

    // ── CivicAI Deployment (Public Sector, Committed, Individually Funded) ────
    ['Yuki Tanaka',       'CivicAI Deployment',          1.0,  d('2026-04-06'), d('2027-03-29'), ''],
    ['Chloe Martin',      'CivicAI Deployment',          1.0,  d('2026-04-06'), d('2027-03-29'), ''],
    ['Omar Siddiqui',     'CivicAI Deployment',          0.75, d('2026-04-06'), d('2026-12-28'), ''],
    ['Lily Zhang',        'CivicAI Deployment',          0.5,  d('2026-04-06'), d('2026-09-28'), ''],

    // ── AI Bootcamp Cohort 5 (Education, Committed) — prep → delivery → wind-down
    ['Fatima Al-Hassan',  'AI Bootcamp Cohort 5',        1.0,  d('2026-04-06'), d('2026-05-11'), 'Prep'],
    ['Fatima Al-Hassan',  'AI Bootcamp Cohort 5',        0.5,  d('2026-05-18'), d('2026-06-22'), 'Delivery'],
    ['Fatima Al-Hassan',  'AI Bootcamp Cohort 5',        0.1,  d('2026-06-29'), d('2026-07-20'), 'Wind-down'],
    ['James Chen',        'AI Bootcamp Cohort 5',        0.5,  d('2026-04-06'), d('2026-05-11'), 'Prep'],
    ['James Chen',        'AI Bootcamp Cohort 5',        0.25, d('2026-05-18'), d('2026-06-22'), 'Delivery'],
    ['Tyler Brooks',      'AI Bootcamp Cohort 5',        0.5,  d('2026-04-06'), d('2026-06-22'), 'Delivery'],

    // ── HealthBridge (Health Tech, Planned) ───────────────────────────────────
    ['David Osei',        'HealthBridge',                1.0,  d('2026-10-05'), d('2027-03-29'), ''],
    ['Raj Krishnamurthy', 'HealthBridge',                1.0,  d('2026-07-06'), d('2027-03-29'), ''],
    ['Nina Oduya',        'HealthBridge',                0.5,  d('2026-10-05'), d('2027-03-29'), ''],

    // ── Northern Futures Initiative (ROAP, Planned, Individually Funded) ──────
    ['Ben Nakamura',      'Northern Futures Initiative', 1.0,  d('2026-10-05'), d('2027-03-29'), ''],
    ['Fatima Al-Hassan',  'Northern Futures Initiative', 0.75, d('2026-10-05'), d('2027-03-29'), ''],
    ['Hannah Müller',     'Northern Futures Initiative', 0.5,  d('2026-10-05'), d('2027-03-29'), ''],

    // ── Nexus Platform (Industry, Pipeline) ───────────────────────────────────
    ['Raj Krishnamurthy', 'Nexus Platform',              1.0,  d('2027-01-05'), d('2027-03-29'), 'Tentative'],
    ['Omar Siddiqui',     'Nexus Platform',              0.75, d('2027-01-05'), d('2027-03-29'), 'Tentative'],

    // ── Climate Data Commons (Public Sector, Pipeline) ────────────────────────
    ['Yuki Tanaka',       'Climate Data Commons',        0.5,  d('2027-01-05'), d('2027-03-29'), 'Tentative'],
    ['Lily Zhang',        'Climate Data Commons',        1.0,  d('2027-01-05'), d('2027-03-29'), 'Tentative'],
  ];

  s.getRange(2, 1, rows.length, 6).setValues(rows);
  s.getRange(2, 3, rows.length, 1).setNumberFormat('0.00');

  // Date format + validation for 200 rows (covers future entries beyond synthetic data)
  s.getRange(2, 4, 200, 2).setNumberFormat('yyyy-mm-dd');
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .setHelpText('Must be a valid date (yyyy-mm-dd)')
    .build();
  s.getRange(2, 4, 200, 2).setDataValidation(dateRule);

  s.getRange('C1').setNote(
    'FTE = fraction of one full-time week.\n' +
    '1.0 = fully allocated, 0.5 = half time.\n\n' +
    'For variable projects (e.g. bootcamps), add multiple rows\n' +
    'for the same Person + Project with different date ranges.'
  );
  s.autoResizeColumns(1, 6);

  setupDropdowns();
}

function _buildSummarySheet(ss) {
  const s = ss.insertSheet('Summary');
  _writeHeader(s, [
    'Week', 'Fiscal Year', 'Total Capacity', 'Committed FTE', 'Planned FTE', 'Pipeline FTE',
    'Firm Surplus', 'Net Surplus',
  ]);
  s.getRange('G1').setNote('Firm Surplus = Total Capacity − Committed (treats Planned as free)');
  s.getRange('H1').setNote('Net Surplus  = Total Capacity − Committed − Planned (conservative view)');
}


// ── Expansion Engine ──────────────────────────────────────────────────────────

/**
 * Reads People, Projects, and Assignments and regenerates the Summary sheet.
 * Called automatically on every edit and via Capacity menu → Refresh.
 */
function expandAssignments() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('expandAssignments: could not acquire lock, skipping concurrent run.');
    return;
  }

  try {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const assignSheet  = ss.getSheetByName('Assignments');
  const projectSheet = ss.getSheetByName('Projects');
  const peopleSheet  = ss.getSheetByName('People');

  if (!assignSheet || !projectSheet || !peopleSheet) {
    Logger.log('expandAssignments: required sheet not found.');
    return;
  }

  const summarySheet = ss.getSheetByName('Summary') || ss.insertSheet('Summary');

  // Project metadata: name → { status }
  const projectMap = {};
  projectSheet.getDataRange().getValues().slice(1).forEach(r => {
    if (r[0]) projectMap[r[0]] = { status: r[2] };
  });

  // Total team weekly capacity
  const totalCapacity = peopleSheet.getDataRange().getValues()
    .slice(1)
    .reduce((sum, r) => sum + (parseFloat(r[2]) || 0), 0);

  // Valid assignment rows only
  const assignments = assignSheet.getDataRange().getValues()
    .slice(1)
    .filter(r => r[0] && r[1] && r[2] && r[3] && r[4]);

  // Aggregate FTE directly into weekly buckets — no intermediate expanded array needed
  const weekMap = {};

  assignments.forEach(([, project, fte, startRaw, endRaw]) => {
    const status = (projectMap[project]?.status || '').toLowerCase();
    const start  = startRaw instanceof Date ? startRaw : new Date(startRaw);
    const end    = endRaw   instanceof Date ? endRaw   : new Date(endRaw);
    const fteVal = parseFloat(fte);
    if (isNaN(fteVal) || fteVal <= 0) return; // skip blank or negative FTE rows

    _getMondaysBetween(start, end).forEach(week => {
      const key = _toDateKey(week);
      if (!weekMap[key]) weekMap[key] = { week, committed: 0, planned: 0, pipeline: 0 };
      if      (status === 'committed') weekMap[key].committed += fteVal;
      else if (status === 'planned')   weekMap[key].planned   += fteVal;
      else if (status === 'pipeline')  weekMap[key].pipeline  += fteVal;
      else if (status === 'completed') weekMap[key].committed += fteVal; // historical — counts as committed
    });
  });

  const summaryRows = Object.keys(weekMap).sort().map(key => {
    const { week, committed, planned, pipeline } = weekMap[key];
    return [
      week,
      _fiscalYear(week),
      totalCapacity,
      _round(committed),
      _round(planned),
      _round(pipeline),
      _round(totalCapacity - committed),           // Firm Surplus
      _round(totalCapacity - committed - planned), // Net Surplus
    ];
  });

  summarySheet.clearContents();
  _writeHeader(summarySheet, [
    'Week', 'Fiscal Year', 'Total Capacity', 'Committed FTE', 'Planned FTE', 'Pipeline FTE',
    'Firm Surplus', 'Net Surplus',
  ]);

  if (summaryRows.length > 0) {
    summarySheet.getRange(2, 1, summaryRows.length, 8).setValues(summaryRows);
    summarySheet.getRange(2, 1, summaryRows.length, 1).setNumberFormat('yyyy-mm-dd');
    summarySheet.getRange(2, 3, summaryRows.length, 6).setNumberFormat('0.00');
    summarySheet.autoResizeColumns(1, 8);
  }

  Logger.log('expandAssignments: %s assignment rows → %s weekly summary rows.',
    assignments.length, summaryRows.length);

  } finally {
    lock.releaseLock();
  }
}


// ── Snapshot Builder ──────────────────────────────────────────────────────────

/**
 * Assembles the full capacity snapshot from all sheets into a plain object
 * for the web app. Called by getCapacityData().
 *
 * Shape: { meta, people[], projects[], assignments[], summary[] }
 */
function _buildSnapshot(ss) {
  const people = ss.getSheetByName('People').getDataRange().getValues().slice(1)
    .filter(r => r[0])
    .map(r => ({ name: r[0], role: r[1], fte_capacity: r[2] }));

  const projects = ss.getSheetByName('Projects').getDataRange().getValues().slice(1)
    .filter(r => r[0])
    .map(r => ({
      name:                r[0],
      workstream:          r[1],
      status:              r[2],
      individually_funded: r[3],
      fte_budget:          r[4] !== '' && r[4] != null ? Number(r[4]) : null,
    }));

  const assignments = ss.getSheetByName('Assignments').getDataRange().getValues().slice(1)
    .filter(r => r[0] && r[1] && r[2] && r[3] && r[4])
    .map(r => ({
      person:  r[0],
      project: r[1],
      fte:     r[2],
      start:   _toDateKey(r[3] instanceof Date ? r[3] : new Date(r[3])),
      end:     _toDateKey(r[4] instanceof Date ? r[4] : new Date(r[4])),
    }));

  const summary = ss.getSheetByName('Summary').getDataRange().getValues().slice(1)
    .filter(r => r[0])
    .map(r => ({
      week:           _toDateKey(r[0] instanceof Date ? r[0] : new Date(r[0])),
      fiscal_year:    r[1],
      total_capacity: r[2],
      committed:      r[3],
      planned:        r[4],
      pipeline:       r[5],
      firm_surplus:   r[6],
      net_surplus:    r[7],
    }));

  return {
    meta: {
      synced_at:      new Date().toISOString(),
      total_capacity: people.reduce((sum, p) => sum + (p.fte_capacity || 0), 0),
    },
    people,
    projects,
    assignments,
    summary,
  };
}


// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Returns all Mondays between start and end (inclusive).
 */
function _getMondaysBetween(start, end) {
  const mondays = [];
  const cur = new Date(start);
  const day = cur.getDay();
  if (day !== 1) cur.setDate(cur.getDate() + ((8 - day) % 7));
  while (cur <= end) {
    mondays.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return mondays;
}

/**
 * Returns the fiscal year label for a date (April 1 – March 31).
 * e.g. any date in Apr 2026 – Mar 2027 → "FY2627"
 */
function _fiscalYear(date) {
  const d       = date instanceof Date ? date : new Date(date);
  const month   = d.getMonth() + 1;
  const year    = d.getFullYear();
  const fyStart = month >= 4 ? year     : year - 1;
  const fyEnd   = month >= 4 ? year + 1 : year;
  return 'FY' + String(fyStart).slice(2) + String(fyEnd).slice(2);
}

/**
 * Formats a Date as yyyy-MM-dd for use as a map key or JSON value.
 */
function _toDateKey(date) {
  return Utilities.formatDate(
    date instanceof Date ? date : new Date(date),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}

function _round(n) {
  return Math.round(n * 100) / 100;
}

function _writeHeader(sheet, cols) {
  sheet.getRange(1, 1, 1, cols.length)
    .setValues([cols])
    .setFontWeight('bold')
    .setBackground(HEADER_BG)
    .setFontColor(HEADER_FG);
}

function _addDropdown(sheet, startRow, col, count, values) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(startRow, col, count, 1).setDataValidation(rule);
}
