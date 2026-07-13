/**
 * Backend for the "Written Descriptions of Orgasm" replication site.
 *
 * SETUP (see README.md for detail):
 *   1. In your Google Sheet: Extensions ▸ Apps Script.
 *   2. Replace the default Code.gs with this file. Save.
 *   3. Deploy ▸ New deployment ▸ type "Web app".
 *        - Execute as:      Me
 *        - Who has access:  Anyone
 *   4. Copy the /exec Web app URL into config.js (WEB_APP_URL).
 *   5. IMPORTANT: after ANY edit to this file, redeploy a NEW VERSION
 *      (Deploy ▸ Manage deployments ▸ edit ▸ Version: New version ▸ Deploy).
 *
 * DATA LAYOUT
 *   Submissions live in the FIRST tab of the spreadsheet, two columns:
 *       A: Description    B: Genitals
 *   (matches the headers you already added).
 *   A second tab, "Guesses", is created automatically to feed the results
 *   dashboard:
 *       A: timestamp  B: gameId  C: actual  D: guess  E: correct
 *   To moderate, delete a row in the first tab — it disappears from the game.
 */

var GUESSES_SHEET = 'Guesses';
var RESPONSE_HEADERS = ['Description', 'Genitals'];
var GUESS_HEADERS = ['timestamp', 'gameId', 'actual', 'guess', 'correct'];
var MAX_LEN = 4000;

// Only these anatomy values are shown/scored in the game. Keep in sync with
// GUESS_OPTIONS in config.js. "intersex_other" submissions are stored in the
// sheet but never served to the game or counted in the stats.
var ELIGIBLE = ['penis', 'vulva'];

/** Submissions tab = the tab whose column A header is "Description" (the one you
 *  set up). Falls back to the first non-Guesses tab, so it stays correct even if
 *  an earlier version of this script left an extra tab lying around. */
function getResponsesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var target = null;

  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === GUESSES_SHEET) continue;
    var a1 = String(sheets[i].getRange(1, 1).getValue()).trim().toLowerCase();
    if (a1 === 'description') { target = sheets[i]; break; }
  }
  if (!target) {
    for (var j = 0; j < sheets.length; j++) {
      if (sheets[j].getName() !== GUESSES_SHEET) { target = sheets[j]; break; }
    }
  }
  if (!target) target = ss.insertSheet('Responses', 0);

  if (target.getLastRow() === 0) target.appendRow(RESPONSE_HEADERS);
  return target;
}

/** Dashboard tab, created at the end of the workbook if missing. */
function getGuessesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GUESSES_SHEET);
  if (!sheet) sheet = ss.insertSheet(GUESSES_SHEET, ss.getNumSheets());
  if (sheet.getLastRow() === 0) sheet.appendRow(GUESS_HEADERS);
  return sheet;
}

function normGenitals(v) {
  return String(v == null ? '' : v).trim().toLowerCase();
}
function isEligible(v) {
  return ELIGIBLE.indexOf(normGenitals(v)) !== -1;
}

/** Eligible (penis/vulva) submissions as {description, genitals}. */
function getEligibleRows() {
  var sheet = getResponsesSheet();
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) { // row 0 is the header
    var description = values[i][0]; // col A: Description
    var genitals = values[i][1];    // col B: Genitals
    if (description === '' || description === null) continue;
    if (!isEligible(genitals)) continue;
    rows.push({ description: String(description), genitals: normGenitals(genitals) });
  }
  return rows;
}

/** Fisher–Yates shuffle (in place). */
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

/** GET router: ?action=random | stats  (default random). */
function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.action === 'stats') return jsonOutput(computeStats());

  var rows = getEligibleRows();
  var n = parseInt(params.n, 10);
  if (isNaN(n) || n < 1) n = 5;
  n = Math.min(n, 25);
  return jsonOutput({ ok: true, count: rows.length, items: shuffle(rows).slice(0, n) });
}

/** POST router: body { action: 'submitResponse' | 'recordGame', ... }. */
function doPost(e) {
  try {
    var body = (e && e.postData && e.postData.contents) || '{}';
    var data = JSON.parse(body);
    if (data.action === 'recordGame') return recordGame(data);
    return submitResponse(data); // default / 'submitResponse'
  } catch (err) {
    return jsonOutput({ ok: false, error: 'Could not save: ' + err });
  }
}

function submitResponse(data) {
  var description = String(data.description || '').trim();
  var genitals = String(data.genitals || '').trim();
  if (!description) return jsonOutput({ ok: false, error: 'Please include a description.' });
  if (!genitals)    return jsonOutput({ ok: false, error: 'Please choose an option.' });
  if (description.length > MAX_LEN) return jsonOutput({ ok: false, error: 'Description is too long.' });

  // Column A: Description, Column B: Genitals.
  getResponsesSheet().appendRow([description, genitals]);
  return jsonOutput({ ok: true });
}

function recordGame(data) {
  var gameId = String(data.gameId || Utilities.getUuid());
  var guesses = data.guesses || [];
  if (!guesses.length) return jsonOutput({ ok: false, error: 'No guesses to record.' });

  var sheet = getGuessesSheet();
  var now = new Date();
  var recorded = 0;
  for (var i = 0; i < guesses.length; i++) {
    var actual = normGenitals(guesses[i].actual);
    var guess = normGenitals(guesses[i].guess);
    if (!isEligible(actual) || !isEligible(guess)) continue; // clean two-way rounds only
    sheet.appendRow([now, gameId, actual, guess, actual === guess]);
    recorded++;
  }
  return jsonOutput({ ok: true, recorded: recorded });
}

/** Aggregate accuracy across all recorded guesses. */
function computeStats() {
  var sheet = getGuessesSheet();
  var values = sheet.getDataRange().getValues();

  var totalGuesses = 0, correctGuesses = 0;
  var byActual = {}, guessDist = {}, games = {};
  ELIGIBLE.forEach(function (v) { byActual[v] = { n: 0, correct: 0 }; guessDist[v] = 0; });

  for (var i = 1; i < values.length; i++) { // skip header
    var gameId = values[i][1];
    var actual = normGenitals(values[i][2]);
    var guess = normGenitals(values[i][3]);
    if (!isEligible(actual) || !isEligible(guess)) continue;

    var correct = (values[i][4] === true || values[i][4] === 'TRUE' || values[i][4] === 'true');
    totalGuesses++;
    if (correct) correctGuesses++;
    byActual[actual].n++;
    if (correct) byActual[actual].correct++;
    guessDist[guess]++;
    if (gameId) games[gameId] = true;
  }

  return {
    ok: true,
    totalGuesses: totalGuesses,
    correctGuesses: correctGuesses,
    accuracy: totalGuesses ? correctGuesses / totalGuesses : null,
    gamesPlayed: Object.keys(games).length,
    chance: 1 / ELIGIBLE.length,
    byActual: byActual,
    guessDistribution: guessDist,
  };
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
