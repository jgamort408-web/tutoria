(function () {
  "use strict";

  const state = {
    records: [],
    actions: {},
    anonymized: false,
    selectedStudent: ""
  };

  const levelMeta = [
    { label: "Nivel 0", detail: "0–4 sin justificar" },
    { label: "Nivel 1", detail: "5–11 sin justificar" },
    { label: "Nivel 2", detail: "12–18 sin justificar" },
    { label: "Nivel 3", detail: "19–24 sin justificar" },
    { label: "Nivel 4", detail: "25 o más en un mes" }
  ];

  const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" });
  const dateFormatter = new Intl.DateTimeFormat("es-ES");

  const el = id => document.getElementById(id);
  const elements = {
    csvFile: el("csv-file"),
    sessionFile: el("session-file"),
    dropzone: el("dropzone"),
    feedback: el("import-feedback"),
    rows: el("student-rows"),
    alerts: el("alert-list"),
    search: el("filter-search"),
    group: el("filter-group"),
    month: el("filter-month"),
    level: el("filter-level"),
    dialog: el("student-dialog"),
    dialogTitle: el("dialog-title"),
    dialogSubtitle: el("dialog-subtitle"),
    dialogSummary: el("dialog-summary"),
    dialogMonths: el("dialog-months"),
    dialogActions: el("dialog-actions"),
    actionForm: el("action-form")
  };

  bindEvents();
  setToday();
  renderAll();

  function bindEvents() {
    [el("choose-csv"), el("toolbar-import")].forEach(button => {
      button.addEventListener("click", () => elements.csvFile.click());
    });
    el("toolbar-demo").addEventListener("click", loadDemo);
    el("toolbar-save").addEventListener("click", saveSession);
    el("toolbar-load").addEventListener("click", () => elements.sessionFile.click());
    el("toolbar-anonymize").addEventListener("click", toggleAnonymization);
    el("toolbar-print").addEventListener("click", () => window.print());
    el("toolbar-reset").addEventListener("click", resetSession);
    el("export-visible").addEventListener("click", exportVisible);
    el("dialog-close").addEventListener("click", () => elements.dialog.close());

    elements.csvFile.addEventListener("change", event => importFiles(event.target.files));
    elements.sessionFile.addEventListener("change", event => importSession(event.target.files[0]));
    ["dragenter", "dragover"].forEach(type => elements.dropzone.addEventListener(type, event => {
      event.preventDefault();
      elements.dropzone.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach(type => elements.dropzone.addEventListener(type, event => {
      event.preventDefault();
      elements.dropzone.classList.remove("is-dragging");
    }));
    elements.dropzone.addEventListener("drop", event => importFiles(event.dataTransfer.files));

    [elements.search, elements.group, elements.month, elements.level].forEach(control => {
      control.addEventListener("input", renderStudentTable);
      control.addEventListener("change", renderStudentTable);
    });

    elements.rows.addEventListener("click", event => {
      const button = event.target.closest("button[data-student-key]");
      if (button) openStudent(button.dataset.studentKey);
    });
    elements.alerts.addEventListener("click", event => {
      const button = event.target.closest("button[data-student-key]");
      if (button) openStudent(button.dataset.studentKey);
    });
    elements.actionForm.addEventListener("submit", addAction);
    elements.dialog.addEventListener("click", event => {
      if (event.target === elements.dialog) elements.dialog.close();
    });
  }

  function setToday() {
    el("action-date").value = new Date().toISOString().slice(0, 10);
  }

  async function importFiles(fileList) {
    const files = Array.from(fileList || []).filter(file => /\.csv$/i.test(file.name) || file.type.includes("csv"));
    if (!files.length) {
      showFeedback("Selecciona al menos un archivo CSV.", true);
      return;
    }

    let imported = 0;
    let skipped = 0;
    const warnings = [];
    for (const file of files) {
      try {
        const text = await readTextFile(file);
        const result = normalizeRows(parseDelimited(text));
        const before = state.records.length;
        state.records = deduplicate([...state.records, ...result.records]);
        imported += state.records.length - before;
        skipped += result.skipped;
        warnings.push(...result.warnings);
      } catch (error) {
        warnings.push(`${file.name}: ${error.message}`);
      }
    }

    elements.csvFile.value = "";
    updateFilterOptions();
    renderAll();
    const message = `${imported} registros añadidos${skipped ? ` y ${skipped} filas omitidas` : ""}.`;
    showFeedback([message, ...new Set(warnings)].join(" "), imported === 0);
  }

  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsText(file, "utf-8");
    });
  }

  function parseDelimited(text) {
    const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
    if (!cleaned) throw new Error("el archivo está vacío");
    const delimiter = detectDelimiter(cleaned.split("\n", 1)[0]);
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < cleaned.length; index += 1) {
      const char = cleaned[index];
      if (char === '"') {
        if (quoted && cleaned[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        row.push(value.trim());
        value = "";
      } else if (char === "\n" && !quoted) {
        row.push(value.trim());
        if (row.some(cell => cell !== "")) rows.push(row);
        row = [];
        value = "";
      } else {
        value += char;
      }
    }
    row.push(value.trim());
    if (row.some(cell => cell !== "")) rows.push(row);
    if (quoted) throw new Error("hay una comilla sin cerrar");
    if (rows.length < 2) throw new Error("no contiene filas de datos");

    const headers = rows[0].map(normalizeHeader);
    return rows.slice(1).map(cells => Object.fromEntries(headers.map((header, i) => [header, cells[i] || ""])));
  }

  function detectDelimiter(line) {
    const candidates = [";", ",", "\t"];
    const counts = candidates.map(delimiter => {
      let count = 0;
      let quoted = false;
      for (const char of line) {
        if (char === '"') quoted = !quoted;
        else if (char === delimiter && !quoted) count += 1;
      }
      return count;
    });
    const best = Math.max(...counts);
    if (!best) throw new Error("no se reconoce el separador");
    return candidates[counts.indexOf(best)];
  }

  function normalizeRows(rows) {
    const records = [];
    let skipped = 0;
    let missingStatus = false;
    const warnings = [];

    rows.forEach(row => {
      const student = getColumn(row, ["alumnoa", "alumno", "nombre", "estudiante", "apellidosynombre"]);
      const group = getColumn(row, ["grupo", "unidad", "curso", "clase"]) || "Sin grupo";
      const dateValue = getColumn(row, ["fecha", "dia", "fechafalta"]);
      const date = parseDate(dateValue);
      if (!student || !date) {
        skipped += 1;
        return;
      }

      const status = getColumn(row, ["justificada", "justificacion", "tipo", "estado"]);
      if (!status) missingStatus = true;
      const unitsRaw = getColumn(row, ["horas", "sesiones", "tramos", "faltas", "cantidad"]);
      const units = Math.max(0.1, Number(String(unitsRaw || "1").replace(",", ".")) || 1);
      const note = getColumn(row, ["observacion", "observaciones", "nota", "motivo"]);

      records.push({
        student: student.trim(),
        group: group.trim(),
        date,
        justified: parseJustified(status),
        units: Math.round(units * 10) / 10,
        note: note.trim()
      });
    });

    if (missingStatus) warnings.push("Las filas sin estado se han considerado pendientes de justificar.");
    if (records.length) warnings.push("Comprueba que “Horas/Sesiones” representa tramos equivalentes antes de interpretar el umbral mensual.");
    return { records, skipped, warnings };
  }

  function normalizeHeader(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function getColumn(row, names) {
    for (const name of names) if (Object.prototype.hasOwnProperty.call(row, name)) return String(row[name] || "");
    return "";
  }

  function parseDate(value) {
    const text = String(value || "").trim();
    let match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    match = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }

  function parseJustified(value) {
    const text = normalizeHeader(value);
    if (!text) return false;
    if (
      text.includes("injust") ||
      text.includes("sinjust") ||
      text.includes("nojust") ||
      text.includes("pendient") ||
      ["no", "false", "0", "i"].includes(text)
    ) return false;
    return ["si", "true", "1", "j", "justificada", "justificado"].includes(text);
  }

  function deduplicate(records) {
    const seen = new Set();
    return records.filter(record => {
      const key = [studentKey(record), record.date, record.justified, record.units, record.note].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function studentKey(record) {
    return `${record.student.trim().toLocaleLowerCase("es")}::${record.group.trim().toLocaleLowerCase("es")}`;
  }

  function monthKey(date) { return date.slice(0, 7); }

  function getSummaries(selectedMonth = "") {
    const map = new Map();
    state.records.forEach(record => {
      const key = studentKey(record);
      if (!map.has(key)) map.set(key, { key, student: record.student, group: record.group, records: [], monthly: {} });
      const summary = map.get(key);
      summary.records.push(record);
      const month = monthKey(record.date);
      if (!summary.monthly[month]) summary.monthly[month] = { justified: 0, unjustified: 0 };
      summary.monthly[month][record.justified ? "justified" : "unjustified"] += record.units;
    });

    return Array.from(map.values()).map(summary => {
      const relevant = selectedMonth ? summary.records.filter(record => monthKey(record.date) === selectedMonth) : summary.records;
      summary.justified = sum(relevant.filter(record => record.justified).map(record => record.units));
      summary.unjustified = sum(relevant.filter(record => !record.justified).map(record => record.units));
      const monthlyEntries = Object.entries(summary.monthly);
      const peak = selectedMonth
        ? (summary.monthly[selectedMonth]?.unjustified || 0)
        : Math.max(0, ...monthlyEntries.map(([, values]) => values.unjustified));
      summary.peak = Math.round(peak * 10) / 10;
      summary.peakMonth = selectedMonth || monthlyEntries.sort((a, b) => b[1].unjustified - a[1].unjustified)[0]?.[0] || "";
      summary.level = calculateLevel(summary.peak);
      summary.actionCount = (state.actions[summary.key] || []).length;
      return summary;
    }).sort((a, b) => b.level - a.level || b.peak - a.peak || a.student.localeCompare(b.student, "es"));
  }

  function sum(values) { return Math.round(values.reduce((total, value) => total + value, 0) * 10) / 10; }

  function calculateLevel(unjustified) {
    if (unjustified >= 25) return 4;
    if (unjustified >= 19) return 3;
    if (unjustified >= 12) return 2;
    if (unjustified >= 5) return 1;
    return 0;
  }

  function renderAll() {
    updateFilterOptions();
    renderStats();
    renderStudentTable();
    renderAlerts();
  }

  function updateFilterOptions() {
    const currentGroup = elements.group.value;
    const currentMonth = elements.month.value;
    const groups = [...new Set(state.records.map(record => record.group))].sort((a, b) => a.localeCompare(b, "es"));
    const months = [...new Set(state.records.map(record => monthKey(record.date)))].sort().reverse();
    replaceOptions(elements.group, "Todos los grupos", groups.map(value => ({ value, label: value })), currentGroup);
    replaceOptions(elements.month, "Todos los meses", months.map(value => ({ value, label: formatMonth(value) })), currentMonth);
  }

  function replaceOptions(select, defaultLabel, options, selected) {
    select.replaceChildren(new Option(defaultLabel, ""), ...options.map(option => new Option(option.label, option.value)));
    if (options.some(option => option.value === selected)) select.value = selected;
  }

  function renderStats() {
    const summaries = getSummaries();
    const allJustified = sum(state.records.filter(record => record.justified).map(record => record.units));
    const allUnjustified = sum(state.records.filter(record => !record.justified).map(record => record.units));
    setText("stat-students", summaries.length);
    setText("stat-clear", summaries.filter(summary => summary.level === 0).length);
    setText("stat-follow", summaries.filter(summary => summary.level === 1 || summary.level === 2).length);
    setText("stat-priority", summaries.filter(summary => summary.level >= 3).length);
    setText("stat-justified", formatUnits(allJustified));
    setText("stat-unjustified", formatUnits(allUnjustified));
    setText("stat-groups", new Set(state.records.map(record => record.group)).size);
    setText("stat-actions", Object.values(state.actions).reduce((total, actions) => total + actions.length, 0));
  }

  function renderStudentTable() {
    const summaries = filteredSummaries();
    elements.rows.replaceChildren();
    setText("student-count", state.records.length ? `${summaries.length} de ${getSummaries().length} estudiantes visibles.` : "No hay datos cargados.");
    if (!summaries.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.className = "attendance-empty";
      cell.textContent = state.records.length ? "No hay resultados con estos filtros." : "Importa un CSV o utiliza los datos de ejemplo.";
      row.append(cell);
      elements.rows.append(row);
      return;
    }

    summaries.forEach(summary => {
      const row = document.createElement("tr");
      const personCell = document.createElement("td");
      const person = document.createElement("div");
      person.className = "attendance-person";
      const name = document.createElement("strong");
      name.textContent = displayName(summary);
      const detail = document.createElement("span");
      detail.textContent = summary.peakMonth ? `Pico: ${formatMonth(summary.peakMonth)}` : "Sin mes calculado";
      person.append(name, detail);
      personCell.append(person);
      row.append(
        personCell,
        textCell(summary.group),
        textCell(formatUnits(summary.justified)),
        textCell(formatUnits(summary.unjustified)),
        textCell(formatUnits(summary.peak)),
        levelCell(summary.level)
      );
      const actionCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "attendance-btn";
      button.dataset.studentKey = summary.key;
      button.textContent = summary.actionCount ? `Ver ficha · ${summary.actionCount}` : "Abrir ficha";
      actionCell.append(button);
      row.append(actionCell);
      elements.rows.append(row);
    });
  }

  function filteredSummaries() {
    const search = normalizeHeader(elements.search.value);
    const group = elements.group.value;
    const month = elements.month.value;
    const level = elements.level.value;
    return getSummaries(month).filter(summary => {
      const matchesSearch = !search || normalizeHeader(`${summary.student} ${displayName(summary)}`).includes(search);
      return matchesSearch && (!group || summary.group === group) && (!level || String(summary.level) === level) && (!month || summary.records.some(record => monthKey(record.date) === month));
    });
  }

  function renderAlerts() {
    const alerts = getSummaries().filter(summary => summary.level >= 2);
    elements.alerts.replaceChildren();
    if (!alerts.length) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = state.records.length ? "No hay niveles 2, 3 o 4 con los datos actuales." : "Sin alertas calculadas.";
      elements.alerts.append(empty);
      return;
    }
    alerts.forEach(summary => {
      const item = document.createElement("div");
      item.className = "attendance-alert";
      item.append(levelBadge(summary.level));
      const body = document.createElement("div");
      body.className = "attendance-alert__body";
      const name = document.createElement("strong");
      name.textContent = displayName(summary);
      const detail = document.createElement("span");
      detail.textContent = `${summary.group} · ${formatUnits(summary.peak)} sin justificar en ${formatMonth(summary.peakMonth)}`;
      body.append(name, detail);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "attendance-btn";
      button.dataset.studentKey = summary.key;
      button.textContent = "Revisar";
      item.append(body, button);
      elements.alerts.append(item);
    });
  }

  function textCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    return cell;
  }

  function levelCell(level) {
    const cell = document.createElement("td");
    cell.append(levelBadge(level));
    return cell;
  }

  function levelBadge(level) {
    const badge = document.createElement("span");
    badge.className = `attendance-badge attendance-level-${level}`;
    badge.textContent = levelMeta[level].label;
    badge.title = levelMeta[level].detail;
    return badge;
  }

  function displayName(summary) {
    if (!state.anonymized) return summary.student;
    const all = getSummaries().sort((a, b) => a.student.localeCompare(b.student, "es"));
    return `Alumno/a ${String(all.findIndex(item => item.key === summary.key) + 1).padStart(3, "0")}`;
  }

  function openStudent(key) {
    const summary = getSummaries().find(item => item.key === key);
    if (!summary) return;
    state.selectedStudent = key;
    elements.dialogTitle.textContent = displayName(summary);
    elements.dialogSubtitle.textContent = `${summary.group} · ${levelMeta[summary.level].label} · máximo mensual ${formatUnits(summary.peak)}`;
    renderDialogSummary(summary);
    renderDialogMonths(summary);
    renderDialogActions(summary);
    setToday();
    el("action-note").value = "";
    elements.dialog.showModal();
  }

  function renderDialogSummary(summary) {
    const box = document.createElement("div");
    box.className = "attendance-feedback";
    const actions = summary.actionCount;
    box.textContent = `${formatUnits(sum(summary.records.filter(record => record.justified).map(record => record.units)))} justificadas · ${formatUnits(sum(summary.records.filter(record => !record.justified).map(record => record.units)))} sin justificar · ${actions} actuaciones registradas. Los niveles son una ayuda preventiva; revisa siempre los datos oficiales y el contexto.`;
    elements.dialogSummary.replaceChildren(box);
  }

  function renderDialogMonths(summary) {
    elements.dialogMonths.replaceChildren();
    const entries = Object.entries(summary.monthly).sort((a, b) => b[0].localeCompare(a[0]));
    const max = Math.max(25, ...entries.map(([, values]) => values.unjustified));
    entries.forEach(([month, values]) => {
      const row = document.createElement("div");
      row.className = "attendance-month-row";
      const label = document.createElement("span");
      label.textContent = formatMonth(month);
      const track = document.createElement("div");
      track.className = "attendance-month-track";
      const fill = document.createElement("div");
      fill.className = "attendance-month-fill";
      fill.style.width = `${Math.min(100, (values.unjustified / max) * 100)}%`;
      track.append(fill);
      const count = document.createElement("strong");
      count.textContent = `${formatUnits(values.unjustified)} sin justificar`;
      row.append(label, track, count);
      elements.dialogMonths.append(row);
    });
  }

  function renderDialogActions(summary) {
    elements.dialogActions.replaceChildren();
    const actions = [...(state.actions[summary.key] || [])].sort((a, b) => b.date.localeCompare(a.date));
    if (!actions.length) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = "Todavía no hay actuaciones en esta sesión.";
      elements.dialogActions.append(empty);
      return;
    }
    actions.forEach(action => {
      const item = document.createElement("div");
      item.className = "attendance-action";
      const title = document.createElement("strong");
      title.textContent = action.type;
      const meta = document.createElement("span");
      meta.textContent = formatDate(action.date);
      item.append(title, meta);
      if (action.note) {
        const note = document.createElement("p");
        note.textContent = action.note;
        item.append(note);
      }
      elements.dialogActions.append(item);
    });
  }

  function addAction(event) {
    event.preventDefault();
    if (!state.selectedStudent) return;
    const action = {
      type: el("action-type").value,
      date: el("action-date").value,
      note: el("action-note").value.trim()
    };
    if (!action.date) return;
    if (!state.actions[state.selectedStudent]) state.actions[state.selectedStudent] = [];
    state.actions[state.selectedStudent].push(action);
    renderAll();
    const summary = getSummaries().find(item => item.key === state.selectedStudent);
    renderDialogSummary(summary);
    renderDialogActions(summary);
    el("action-note").value = "";
  }

  function toggleAnonymization() {
    state.anonymized = !state.anonymized;
    const button = el("toolbar-anonymize");
    button.setAttribute("aria-pressed", String(state.anonymized));
    button.innerHTML = state.anonymized
      ? '<i class="fa-solid fa-user-secret" aria-hidden="true"></i> Anonimización activa'
      : '<i class="fa-solid fa-user-secret" aria-hidden="true"></i> Anonimizar';
    renderStudentTable();
    renderAlerts();
  }

  function saveSession() {
    if (!state.records.length) {
      showFeedback("No hay datos que guardar.", true);
      return;
    }
    downloadBlob(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records: state.records, actions: state.actions }, null, 2), "sesion-absentismo.json", "application/json");
  }

  async function importSession(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await readTextFile(file));
      if (!Array.isArray(data.records)) throw new Error("formato de sesión no reconocido");
      state.records = deduplicate(data.records.filter(validSessionRecord).map(record => ({
        student: record.student.trim(),
        group: record.group.trim(),
        date: record.date,
        justified: record.justified === true,
        units: Math.round(Number(record.units) * 10) / 10,
        note: typeof record.note === "string" ? record.note.slice(0, 500) : ""
      })));
      state.actions = sanitizeActions(data.actions);
      renderAll();
      showFeedback(`Sesión restaurada: ${state.records.length} registros.`);
    } catch (error) {
      showFeedback(`No se pudo cargar la sesión: ${error.message}.`, true);
    } finally {
      elements.sessionFile.value = "";
    }
  }

  function validSessionRecord(record) {
    return record && typeof record.student === "string" && record.student.trim() && typeof record.group === "string" && record.group.trim() && isValidISODate(record.date) && Number.isFinite(Number(record.units)) && Number(record.units) > 0;
  }

  function sanitizeActions(actions) {
    if (!actions || typeof actions !== "object" || Array.isArray(actions)) return {};
    const studentKeys = new Set(state.records.map(studentKey));
    const clean = {};
    Object.entries(actions).forEach(([key, items]) => {
      if (!studentKeys.has(key) || !Array.isArray(items)) return;
      clean[key] = items.filter(action => action && typeof action.type === "string" && isValidISODate(action.date)).slice(0, 200).map(action => ({
        type: action.type.slice(0, 120),
        date: action.date,
        note: typeof action.note === "string" ? action.note.slice(0, 500) : ""
      }));
    });
    return clean;
  }

  function isValidISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function exportVisible() {
    const summaries = filteredSummaries();
    if (!summaries.length) {
      showFeedback("No hay filas visibles que exportar.", true);
      return;
    }
    const rows = [["Alumno/a", "Grupo", "Justificadas", "Sin justificar", "Máximo mensual", "Mes del máximo", "Nivel", "Actuaciones"]];
    summaries.forEach(summary => rows.push([
      displayName(summary), summary.group, summary.justified, summary.unjustified, summary.peak,
      summary.peakMonth, summary.level, summary.actionCount
    ]));
    downloadBlob(rows.map(row => row.map(csvValue).join(";")).join("\n"), "seguimiento-absentismo.csv", "text/csv;charset=utf-8");
  }

  function csvValue(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetSession() {
    if ((state.records.length || Object.keys(state.actions).length) && !window.confirm("¿Crear una sesión nueva? Se eliminarán de esta pestaña los datos y actuaciones no guardados.")) return;
    state.records = [];
    state.actions = {};
    state.selectedStudent = "";
    state.anonymized = false;
    el("toolbar-anonymize").setAttribute("aria-pressed", "false");
    el("toolbar-anonymize").innerHTML = '<i class="fa-solid fa-user-secret" aria-hidden="true"></i> Anonimizar';
    elements.search.value = "";
    elements.level.value = "";
    renderAll();
    showFeedback("Sesión restablecida. No quedan datos cargados.");
  }

  function loadDemo() {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 10);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 12);
    const iso = date => date.toISOString().slice(0, 10);
    const demo = [
      ["Alicia Romero", "1.º A", currentMonth, false, 3],
      ["Bruno Díaz", "1.º A", currentMonth, false, 8],
      ["Bruno Díaz", "1.º A", previousMonth, true, 2],
      ["Carmen Torres", "1.º B", currentMonth, false, 14],
      ["Carmen Torres", "1.º B", previousMonth, false, 4],
      ["Diego Martín", "1.º B", currentMonth, true, 6],
      ["Elena Vega", "1.º C", currentMonth, false, 21],
      ["Farid Amrani", "1.º C", currentMonth, false, 26],
      ["Gabriela León", "1.º A", currentMonth, true, 3],
      ["Hugo Sánchez", "1.º B", previousMonth, false, 6]
    ].map(([student, group, date, justified, units]) => ({ student, group, date: iso(date), justified, units, note: "Dato ficticio de demostración" }));
    state.records = deduplicate(demo);
    state.actions = {};
    renderAll();
    showFeedback("Se han cargado datos ficticios. No corresponden a alumnado real.");
    el("student-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showFeedback(message, error = false) {
    elements.feedback.textContent = message;
    elements.feedback.classList.toggle("is-error", error);
  }

  function setText(id, value) { el(id).textContent = String(value); }
  function formatUnits(value) { return Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 1 }); }
  function formatMonth(value) { return value ? monthFormatter.format(new Date(`${value}-02T12:00:00`)) : "—"; }
  function formatDate(value) { return value ? dateFormatter.format(new Date(`${value}T12:00:00`)) : "—"; }
})();
