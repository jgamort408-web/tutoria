(function () {
  "use strict";

  const defaultTemplates = {
    family: "Buenos días. Contactamos desde la tutoría para revisar conjuntamente la asistencia de {alumno/a}. Nos gustaría conocer si existe alguna circunstancia que debamos tener en cuenta y acordar medidas de apoyo.",
    followup: "Buenos días. Realizamos seguimiento del acuerdo de asistencia de {alumno/a}. En el periodo revisado constan {faltas} unidades sin justificar. Agradecemos que podamos valorar la evolución y el próximo paso.",
    commitment: "La familia, el alumno o alumna y el centro acuerdan favorecer la asistencia diaria, justificar las ausencias por los canales oficiales y revisar el acuerdo en la fecha indicada."
  };

  const defaultSettings = {
    course: academicYear(),
    unit: "horas o sesiones",
    thresholds: [5, 12, 19, 25]
  };

  const state = {
    records: [],
    actions: {},
    contacts: {},
    protocol: {},
    derivations: [],
    templates: { ...defaultTemplates },
    settings: { ...defaultSettings, thresholds: [...defaultSettings.thresholds] },
    anonymized: false,
    presentation: false,
    dark: false,
    selectedStudent: "",
    selectedStudents: new Set(),
    listView: "summary",
    pendingImport: null,
    folderFiles: [],
    folderHandle: null
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
    actionForm: el("action-form"),
    contacts: el("dialog-contacts"),
    calendar: el("global-calendar"),
    calendarMonth: el("calendar-month"),
    analysisMonth: el("analysis-month"),
    derivationRows: el("derivation-rows"),
    reportContent: el("report-content")
  };

  bindEvents();
  setToday();
  renderAll();
  restoreFolderHandle();
  showWelcome();

  function bindEvents() {
    [el("choose-csv"), el("toolbar-import")].forEach(button => {
      button.addEventListener("click", () => elements.csvFile.click());
    });
    el("toolbar-demo").addEventListener("click", loadDemo);
    el("toolbar-save").addEventListener("click", saveSession);
    el("toolbar-save-folder").addEventListener("click", saveSessionToFolder);
    el("toolbar-load").addEventListener("click", () => elements.sessionFile.click());
    el("toolbar-theme").addEventListener("click", toggleTheme);
    el("toolbar-presentation").addEventListener("click", togglePresentation);
    el("toolbar-anonymize").addEventListener("click", toggleAnonymization);
    el("toolbar-print").addEventListener("click", () => window.print());
    el("toolbar-reset").addEventListener("click", resetSession);
    el("export-visible").addEventListener("click", exportVisible);
    el("dialog-close").addEventListener("click", () => elements.dialog.close());

    elements.csvFile.addEventListener("change", event => importFiles(event.target.files));
    elements.sessionFile.addEventListener("change", event => importSession(event.target.files[0]));
    el("folder-files").addEventListener("change", event => {
      state.folderFiles = Array.from(event.target.files || []).filter(file => /\.csv$/i.test(file.name));
      el("reload-folder").disabled = state.folderFiles.length === 0;
      setText("folder-status", state.folderFiles.length ? `${state.folderFiles.length} CSV disponibles durante esta sesión.` : "La carpeta no contiene archivos CSV.");
      if (state.folderFiles.length) importFiles(state.folderFiles);
    });
    el("choose-folder").addEventListener("click", chooseDataFolder);
    el("reload-folder").addEventListener("click", reloadDataFolder);
    el("paste-csv").addEventListener("click", () => el("paste-dialog").showModal());
    el("preview-paste").addEventListener("click", previewPastedData);
    el("confirm-import").addEventListener("click", confirmImport);
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
    elements.rows.addEventListener("change", event => {
      const checkbox = event.target.closest("input[data-select-student]");
      if (!checkbox) return;
      checkbox.checked ? state.selectedStudents.add(checkbox.dataset.selectStudent) : state.selectedStudents.delete(checkbox.dataset.selectStudent);
      renderBulkToolbar();
    });
    elements.alerts.addEventListener("click", event => {
      const button = event.target.closest("button[data-student-key]");
      if (button) openStudent(button.dataset.studentKey);
    });
    elements.actionForm.addEventListener("submit", addAction);
    el("contact-form").addEventListener("submit", addContact);
    el("derivation-form").addEventListener("submit", addDerivation);
    elements.dialog.addEventListener("click", event => {
      if (event.target === elements.dialog) elements.dialog.close();
    });
    document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => el(button.dataset.closeDialog).close()));
    document.querySelectorAll("[data-list-view]").forEach(button => button.addEventListener("click", () => setListView(button.dataset.listView)));
    document.querySelectorAll("[data-student-tab]").forEach(button => button.addEventListener("click", () => showStudentTab(button.dataset.studentTab)));
    document.querySelectorAll("[data-report-kind]").forEach(button => button.addEventListener("click", () => openReport(button.dataset.reportKind)));
    el("select-all-students").addEventListener("change", toggleSelectAll);
    el("bulk-clear").addEventListener("click", clearSelection);
    el("bulk-action").addEventListener("click", addBulkAction);
    el("bulk-message").addEventListener("click", () => openReport("messages", [...state.selectedStudents]));
    el("bulk-report").addEventListener("click", () => openReport("students", [...state.selectedStudents]));
    elements.calendarMonth.addEventListener("change", renderCalendar);
    elements.analysisMonth.addEventListener("change", renderMonthlyAnalysis);
    el("new-derivation").addEventListener("click", openDerivationDialog);
    el("derivation-report").addEventListener("click", () => openReport("derivations"));
    el("executive-report").addEventListener("click", () => openReport("executive"));
    el("group-comparison-report").addEventListener("click", () => openReport("comparison"));
    el("individual-group-reports").addEventListener("click", () => openReport("groups-individual"));
    el("combined-group-report").addEventListener("click", () => openReport("groups"));
    el("save-templates").addEventListener("click", saveTemplates);
    el("save-settings").addEventListener("click", saveSettings);
    el("family-meeting").addEventListener("click", () => openReport("meeting", [state.selectedStudent]));
    el("student-message").addEventListener("click", () => { renderGeneratedMessage(); showStudentTab("message"); });
    el("student-commitment").addEventListener("click", () => openReport("commitment", [state.selectedStudent]));
    el("student-ss-report").addEventListener("click", () => openReport("social-services", [state.selectedStudent]));
    el("student-report").addEventListener("click", () => openReport("students", [state.selectedStudent]));
    el("copy-message").addEventListener("click", copyGeneratedMessage);
    el("print-report").addEventListener("click", () => window.print());
    el("save-meeting-action").addEventListener("click", saveMeetingAsAction);
    el("welcome-skip").addEventListener("click", closeWelcome);
    el("welcome-settings").addEventListener("click", () => {
      closeWelcome();
      el("settings-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      el("setting-course").focus();
    });
    el("dialog-protocol").addEventListener("change", updateProtocolStep);
    el("dialog-records").addEventListener("click", deleteAttendanceRecord);
    elements.derivationRows.addEventListener("click", cycleDerivationStatus);
    document.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        elements.search.focus();
        el("student-panel").scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  function setToday() {
    el("action-date").value = new Date().toISOString().slice(0, 10);
  }

  function showWelcome() {
    try {
      if (sessionStorage.getItem("absentismo-welcome-seen")) return;
    } catch {
      // Si el navegador bloquea sessionStorage, se muestra igualmente la ayuda.
    }
    el("welcome-dialog").showModal();
  }

  function closeWelcome() {
    try { sessionStorage.setItem("absentismo-welcome-seen", "1"); } catch { /* Preferencia no persistida. */ }
    el("welcome-dialog").close();
  }

  async function importFiles(fileList) {
    const files = Array.from(fileList || []).filter(file => /\.csv$/i.test(file.name) || file.type.includes("csv"));
    if (!files.length) {
      showFeedback("Selecciona al menos un archivo CSV.", true);
      return;
    }

    const candidates = [];
    let skipped = 0;
    const warnings = [];
    for (const file of files) {
      try {
        const text = await readTextFile(file, el("csv-encoding").value);
        const result = normalizeRows(parseDelimited(text));
        candidates.push(...result.records);
        skipped += result.skipped;
        warnings.push(...result.warnings);
      } catch (error) {
        warnings.push(`${file.name}: ${error.message}`);
      }
    }

    elements.csvFile.value = "";
    prepareImport(candidates, skipped, warnings);
  }

  async function readTextFile(file, encoding = "utf-8") {
    const buffer = await file.arrayBuffer();
    if (encoding !== "auto") return new TextDecoder(encoding).decode(buffer);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder("windows-1252").decode(buffer);
    }
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
    const [one, two, three, four] = state.settings.thresholds;
    if (unjustified >= four) return 4;
    if (unjustified >= three) return 3;
    if (unjustified >= two) return 2;
    if (unjustified >= one) return 1;
    return 0;
  }

  function renderAll() {
    updateFilterOptions();
    renderStats();
    renderStudentTable();
    renderAlerts();
    renderExecutive();
    renderCalendar();
    renderCharts();
    renderMonthlyAnalysis();
    renderDerivations();
    renderReportOptions();
    renderConfiguration();
    setListView(state.listView);
  }

  function updateFilterOptions() {
    const currentGroup = elements.group.value;
    const currentMonth = elements.month.value;
    const groups = [...new Set(state.records.map(record => record.group))].sort((a, b) => a.localeCompare(b, "es"));
    const months = [...new Set(state.records.map(record => monthKey(record.date)))].sort().reverse();
    replaceOptions(elements.group, "Todos los grupos", groups.map(value => ({ value, label: value })), currentGroup);
    replaceOptions(elements.month, "Todos los meses", months.map(value => ({ value, label: formatMonth(value) })), currentMonth);
    [elements.calendarMonth, elements.analysisMonth].forEach(select => {
      const selected = select.value;
      replaceOptions(select, "Selecciona un mes", months.map(value => ({ value, label: formatMonth(value) })), selected || months[0] || "");
      if (!selected && months[0]) select.value = months[0];
    });
    const reportPeriod = el("report-period");
    const selectedPeriod = reportPeriod.value;
    reportPeriod.replaceChildren(new Option("Curso completo", "all"), ...months.map(value => new Option(formatMonth(value), value)));
    if (["all", ...months].includes(selectedPeriod)) reportPeriod.value = selectedPeriod;
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
    setText("stat-absolute", summaries.filter(summary => summary.level === 4).length);
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
      cell.colSpan = 8;
      cell.className = "attendance-empty";
      cell.textContent = state.records.length ? "No hay resultados con estos filtros." : "Importa un CSV o utiliza los datos de ejemplo.";
      row.append(cell);
      elements.rows.append(row);
      return;
    }

    summaries.forEach(summary => {
      const row = document.createElement("tr");
      const selectCell = document.createElement("td");
      selectCell.className = "attendance-select-cell";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.selectStudent = summary.key;
      checkbox.checked = state.selectedStudents.has(summary.key);
      checkbox.setAttribute("aria-label", `Seleccionar ${displayName(summary)}`);
      selectCell.append(checkbox);
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
        selectCell,
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
    renderStudentCards(summaries);
    renderBulkToolbar();
    const all = el("select-all-students");
    all.checked = summaries.length > 0 && summaries.every(summary => state.selectedStudents.has(summary.key));
    all.indeterminate = summaries.some(summary => state.selectedStudents.has(summary.key)) && !all.checked;
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
    badge.title = levelDetail(level);
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
    renderDialogContacts(summary);
    renderDialogProtocol(summary);
    renderStudentTimeline(summary);
    renderStudentCalendar(summary);
    renderStudentEvolution(summary);
    renderStudentHistory(summary);
    renderGeneratedMessage();
    renderDialogRecords(summary);
    showStudentTab("summary");
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
    const max = Math.max(state.settings.thresholds[3], ...entries.map(([, values]) => values.unjustified));
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
    renderStudentTimeline(summary);
    renderStudentHistory(summary);
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
    downloadBlob(sessionJson(), "sesion-absentismo.json", "application/json");
  }

  async function importSession(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await readTextFile(file));
      if (!Array.isArray(data.records)) throw new Error("formato de sesión no reconocido");
      state.records = deduplicate(data.records.filter(validSessionRecord).map(record => ({
        student: record.student.trim().slice(0, 200),
        group: record.group.trim().slice(0, 80),
        date: record.date,
        justified: record.justified === true,
        units: Math.round(Number(record.units) * 10) / 10,
        note: typeof record.note === "string" ? record.note.slice(0, 500) : ""
      })));
      state.actions = sanitizeActions(data.actions);
      state.contacts = sanitizeContacts(data.contacts);
      state.protocol = sanitizeProtocol(data.protocol);
      state.derivations = sanitizeDerivations(data.derivations);
      state.templates = sanitizeTemplates(data.templates);
      state.settings = sanitizeSettings(data.settings);
      state.selectedStudents.clear();
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
    if (sessionHasChanges() && !window.confirm("¿Crear una sesión nueva? Se eliminarán de esta pestaña los datos, la configuración y las actuaciones no guardadas.")) return;
    state.records = [];
    state.actions = {};
    state.contacts = {};
    state.protocol = {};
    state.derivations = [];
    state.templates = { ...defaultTemplates };
    state.settings = { ...defaultSettings, thresholds: [...defaultSettings.thresholds] };
    state.selectedStudent = "";
    state.selectedStudents.clear();
    state.pendingImport = null;
    state.anonymized = false;
    state.presentation = false;
    state.dark = false;
    document.body.classList.remove("attendance-presentation");
    el("toolbar-theme").setAttribute("aria-pressed", "false");
    el("toolbar-theme").innerHTML = '<i class="fa-solid fa-moon" aria-hidden="true"></i> Tema oscuro';
    el("toolbar-theme").closest(".attendance-app")?.classList.remove("is-dark");
    el("toolbar-presentation").setAttribute("aria-pressed", "false");
    el("toolbar-presentation").innerHTML = '<i class="fa-solid fa-display" aria-hidden="true"></i> Presentación';
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
    state.contacts = {};
    state.protocol = {};
    state.derivations = [
      { id: crypto.randomUUID(), studentKey: "farid amrani::1.º c", date: iso(currentMonth), destination: "Equipo Técnico de Absentismo", status: "Preparación", reason: "Dato ficticio: valorar coordinación tras revisar medidas previas." }
    ];
    renderAll();
    showFeedback("Se han cargado datos ficticios. No corresponden a alumnado real.");
    el("student-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function prepareImport(candidates, skipped, warnings) {
    const existing = new Set(state.records.map(recordIdentity));
    const unique = deduplicate(candidates).filter(record => !existing.has(recordIdentity(record)));
    state.pendingImport = { records: unique, skipped, warnings: [...new Set(warnings)] };
    setText("import-preview-summary", `${unique.length} registros nuevos · ${skipped} filas omitidas`);
    const preview = el("import-preview");
    preview.replaceChildren();
    if (!unique.length) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = "No hay registros nuevos que importar.";
      preview.append(empty);
    } else {
      const wrap = document.createElement("div");
      wrap.className = "attendance-table-wrap";
      const table = document.createElement("table");
      table.className = "attendance-table";
      table.innerHTML = "<thead><tr><th>Alumno/a</th><th>Grupo</th><th>Fecha</th><th>Estado</th><th>Unidades</th></tr></thead>";
      const body = document.createElement("tbody");
      unique.slice(0, 8).forEach(record => {
        const row = document.createElement("tr");
        row.append(textCell(record.student), textCell(record.group), textCell(formatDate(record.date)), textCell(record.justified ? "Justificada" : "Sin justificar"), textCell(formatUnits(record.units)));
        body.append(row);
      });
      table.append(body);
      wrap.append(table);
      preview.append(wrap);
      if (unique.length > 8) {
        const note = document.createElement("p");
        note.className = "attendance-source";
        note.textContent = `Se muestran 8 de ${unique.length} registros.`;
        preview.append(note);
      }
    }
    if (state.pendingImport.warnings.length) {
      const warning = document.createElement("p");
      warning.className = "attendance-feedback";
      warning.textContent = state.pendingImport.warnings.join(" ");
      preview.append(warning);
    }
    el("confirm-import").disabled = unique.length === 0;
    el("import-dialog").showModal();
  }

  function previewPastedData() {
    try {
      const result = normalizeRows(parseDelimited(el("paste-content").value));
      el("paste-dialog").close();
      prepareImport(result.records, result.skipped, result.warnings);
    } catch (error) {
      showFeedback(`No se pudieron interpretar los datos pegados: ${error.message}.`, true);
    }
  }

  function confirmImport() {
    if (!state.pendingImport?.records.length) return;
    const count = state.pendingImport.records.length;
    state.records = deduplicate([...state.records, ...state.pendingImport.records]);
    state.pendingImport = null;
    el("import-dialog").close();
    renderAll();
    showFeedback(`${count} registros añadidos después de revisar la vista previa.`);
  }

  function recordIdentity(record) {
    return [studentKey(record), record.date, record.justified, record.units, record.note].join("|");
  }

  function sessionJson() {
    return JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      records: state.records,
      actions: state.actions,
      contacts: state.contacts,
      protocol: state.protocol,
      derivations: state.derivations,
      templates: state.templates,
      settings: state.settings
    }, null, 2);
  }

  async function saveSessionToFolder() {
    if (typeof window.showSaveFilePicker !== "function") {
      saveSession();
      showFeedback("Este navegador no permite elegir carpeta directamente; se ha descargado el archivo de sesión.");
      return;
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: "sesion-absentismo.json",
        types: [{ description: "Sesión de absentismo", accept: { "application/json": [".json"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(sessionJson());
      await writable.close();
      showFeedback("Sesión guardada en la ubicación seleccionada.");
    } catch (error) {
      if (error.name !== "AbortError") showFeedback(`No se pudo guardar en la carpeta: ${error.message}.`, true);
    }
  }

  function sessionHasChanges() {
    return state.records.length > 0 ||
      Object.keys(state.actions).length > 0 ||
      Object.keys(state.contacts).length > 0 ||
      state.derivations.length > 0 ||
      JSON.stringify(state.templates) !== JSON.stringify(defaultTemplates) ||
      JSON.stringify(state.settings) !== JSON.stringify(defaultSettings);
  }

  function togglePresentation() {
    state.presentation = !state.presentation;
    document.body.classList.toggle("attendance-presentation", state.presentation);
    const button = el("toolbar-presentation");
    button.setAttribute("aria-pressed", String(state.presentation));
    button.innerHTML = state.presentation
      ? '<i class="fa-solid fa-display" aria-hidden="true"></i> Presentación activa'
      : '<i class="fa-solid fa-display" aria-hidden="true"></i> Presentación';
    if (state.presentation && !state.anonymized) toggleAnonymization();
    showFeedback(state.presentation ? "Modo presentación activo: nombres anonimizados y controles sensibles ocultos." : "Modo presentación desactivado.");
  }

  function toggleTheme() {
    state.dark = !state.dark;
    document.querySelector(".attendance-app").classList.toggle("is-dark", state.dark);
    const button = el("toolbar-theme");
    button.setAttribute("aria-pressed", String(state.dark));
    button.innerHTML = state.dark
      ? '<i class="fa-solid fa-sun" aria-hidden="true"></i> Tema claro'
      : '<i class="fa-solid fa-moon" aria-hidden="true"></i> Tema oscuro';
  }

  async function chooseDataFolder() {
    if (typeof window.showDirectoryPicker !== "function") {
      el("folder-files").click();
      return;
    }
    try {
      state.folderHandle = await window.showDirectoryPicker({ mode: "read", id: "absentismo-data" });
      await rememberFolderHandle(state.folderHandle);
      await loadFolderFiles(state.folderHandle, true);
    } catch (error) {
      if (error.name !== "AbortError") showFeedback(`No se pudo abrir la carpeta: ${error.message}.`, true);
    }
  }

  async function reloadDataFolder() {
    if (state.folderHandle) {
      try {
        let permission = await state.folderHandle.queryPermission({ mode: "read" });
        if (permission !== "granted") permission = await state.folderHandle.requestPermission({ mode: "read" });
        if (permission !== "granted") {
          showFeedback("La carpeta recordada necesita permiso para volver a leerse.", true);
          return;
        }
        await loadFolderFiles(state.folderHandle, true);
      } catch (error) {
        showFeedback(`No se pudo recargar la carpeta: ${error.message}.`, true);
      }
      return;
    }
    if (state.folderFiles.length) importFiles(state.folderFiles);
  }

  async function loadFolderFiles(handle, importAfter) {
    const files = [];
    for await (const entry of handle.values()) {
      if (entry.kind === "file" && /\.csv$/i.test(entry.name)) files.push(await entry.getFile());
    }
    state.folderFiles = files;
    el("reload-folder").disabled = files.length === 0;
    setText("folder-status", files.length ? `${files.length} CSV en “${handle.name}”. La carpeta queda recordada localmente; el navegador puede volver a pedir permiso.` : `La carpeta “${handle.name}” no contiene CSV.`);
    if (importAfter && files.length) importFiles(files);
  }

  function folderDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("tutoria-activa-absentismo", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("handles");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function rememberFolderHandle(handle) {
    try {
      const db = await folderDatabase();
      const transaction = db.transaction("handles", "readwrite");
      transaction.objectStore("handles").put(handle, "data-folder");
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    } catch {
      // La herramienta continúa funcionando aunque el navegador no permita recordar el handle.
    }
  }

  async function restoreFolderHandle() {
    if (!("indexedDB" in window)) return;
    try {
      const db = await folderDatabase();
      const transaction = db.transaction("handles", "readonly");
      const request = transaction.objectStore("handles").get("data-folder");
      state.folderHandle = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      if (state.folderHandle) {
        el("reload-folder").disabled = false;
        setText("folder-status", `Carpeta “${state.folderHandle.name}” recordada localmente. Pulsa “Recargar carpeta” para conceder acceso y leerla.`);
      }
    } catch {
      state.folderHandle = null;
    }
  }

  function setListView(view) {
    state.listView = view;
    document.querySelectorAll("[data-list-view]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.listView === view));
    });
    const table = el("student-panel").querySelector(".attendance-table-wrap");
    table.hidden = view === "cards";
    el("student-cards").hidden = view !== "cards";
    el("student-panel").classList.toggle("is-summary-view", view === "summary");
  }

  function renderStudentCards(summaries) {
    const container = el("student-cards");
    container.replaceChildren();
    summaries.forEach(summary => {
      const card = document.createElement("article");
      card.className = "attendance-student-card";
      const heading = document.createElement("div");
      heading.className = "attendance-student-card__heading";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selectedStudents.has(summary.key);
      checkbox.setAttribute("aria-label", `Seleccionar ${displayName(summary)}`);
      checkbox.addEventListener("change", () => {
        checkbox.checked ? state.selectedStudents.add(summary.key) : state.selectedStudents.delete(summary.key);
        renderStudentTable();
      });
      const title = document.createElement("strong");
      title.textContent = displayName(summary);
      heading.append(checkbox, title, levelBadge(summary.level));
      const metrics = document.createElement("p");
      metrics.textContent = `${summary.group} · ${formatUnits(summary.unjustified)} sin justificar · máximo ${formatUnits(summary.peak)}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "attendance-btn";
      button.textContent = "Abrir ficha";
      button.addEventListener("click", () => openStudent(summary.key));
      card.append(heading, metrics, button);
      container.append(card);
    });
    if (!summaries.length) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = "No hay alumnado para mostrar.";
      container.append(empty);
    }
  }

  function renderBulkToolbar() {
    const validKeys = new Set(getSummaries().map(summary => summary.key));
    [...state.selectedStudents].forEach(key => { if (!validKeys.has(key)) state.selectedStudents.delete(key); });
    const count = state.selectedStudents.size;
    el("bulk-toolbar").hidden = count === 0;
    setText("selected-count", count);
  }

  function toggleSelectAll() {
    const visible = filteredSummaries();
    visible.forEach(summary => el("select-all-students").checked ? state.selectedStudents.add(summary.key) : state.selectedStudents.delete(summary.key));
    renderStudentTable();
  }

  function clearSelection() {
    state.selectedStudents.clear();
    renderStudentTable();
  }

  function addBulkAction() {
    if (!state.selectedStudents.size) return;
    const date = todayIso();
    state.selectedStudents.forEach(key => {
      if (!state.actions[key]) state.actions[key] = [];
      state.actions[key].push({ type: "Revisión colectiva", date, note: "Caso incluido en una revisión conjunta del equipo educativo." });
    });
    renderAll();
    showFeedback(`Actuación registrada para ${state.selectedStudents.size} ${state.selectedStudents.size === 1 ? "estudiante" : "estudiantes"}.`);
  }

  function groupSummaries(selectedMonth = "") {
    const groups = new Map();
    getSummaries(selectedMonth).forEach(summary => {
      if (!groups.has(summary.group)) groups.set(summary.group, { group: summary.group, students: 0, unjustified: 0, risk: 0, actions: 0, summaries: [] });
      const group = groups.get(summary.group);
      group.students += 1;
      group.unjustified += summary.unjustified;
      group.risk += summary.level >= 2 ? 1 : 0;
      group.actions += summary.actionCount;
      group.summaries.push(summary);
    });
    return [...groups.values()].sort((a, b) => a.group.localeCompare(b.group, "es"));
  }

  function renderExecutive() {
    const groups = groupSummaries();
    const container = el("executive-summary");
    container.replaceChildren();
    const metrics = [
      ["Grupos analizados", groups.length],
      ["Casos niveles 2–4", groups.reduce((total, group) => total + group.risk, 0)],
      ["Derivaciones abiertas", state.derivations.filter(item => item.status !== "Cerrada").length],
      ["Actuaciones documentadas", Object.values(state.actions).reduce((total, items) => total + items.length, 0)]
    ];
    metrics.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "attendance-mini-stat";
      const strong = document.createElement("strong");
      strong.textContent = value;
      const span = document.createElement("span");
      span.textContent = label;
      card.append(strong, span);
      container.append(card);
    });
    const body = el("group-rows");
    body.replaceChildren();
    groups.forEach(group => {
      const months = [...new Set(state.records.filter(record => record.group === group.group).map(record => monthKey(record.date)))].sort().reverse();
      const current = groupSummaries(months[0]).find(item => item.group === group.group)?.unjustified || 0;
      const previous = months[1] ? (groupSummaries(months[1]).find(item => item.group === group.group)?.unjustified || 0) : current;
      const trend = current === previous ? "Estable" : current > previous ? "Sube" : "Baja";
      const row = document.createElement("tr");
      row.append(textCell(group.group), textCell(group.students), textCell(formatUnits(group.unjustified)), textCell(group.risk), textCell(group.actions), textCell(trend));
      body.append(row);
    });
    if (!groups.length) {
      const row = document.createElement("tr");
      const cell = textCell("Sin datos para comparar.");
      cell.colSpan = 6;
      cell.className = "attendance-empty";
      row.append(cell);
      body.append(row);
    }
  }

  function renderCalendar() {
    const month = elements.calendarMonth.value;
    elements.calendar.replaceChildren();
    if (!month) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = "Carga datos para generar el calendario.";
      elements.calendar.append(empty);
      return;
    }
    ["L", "M", "X", "J", "V", "S", "D"].forEach(day => {
      const label = document.createElement("strong");
      label.className = "attendance-calendar__weekday";
      label.textContent = day;
      elements.calendar.append(label);
    });
    const [year, monthNumber] = month.split("-").map(Number);
    const firstOffset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    const days = new Date(year, monthNumber, 0).getDate();
    const totals = {};
    state.records.filter(record => !record.justified && monthKey(record.date) === month).forEach(record => { totals[record.date] = (totals[record.date] || 0) + record.units; });
    const max = Math.max(1, ...Object.values(totals));
    for (let offset = 0; offset < firstOffset; offset += 1) {
      const spacer = document.createElement("span");
      spacer.className = "attendance-calendar__spacer";
      elements.calendar.append(spacer);
    }
    for (let day = 1; day <= days; day += 1) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const value = totals[date] || 0;
      const cell = document.createElement("div");
      cell.className = "attendance-calendar__day";
      cell.dataset.intensity = value ? String(Math.max(1, Math.ceil((value / max) * 4))) : "0";
      cell.setAttribute("aria-label", `${formatDate(date)}: ${formatUnits(value)} sin justificar`);
      const number = document.createElement("strong");
      number.textContent = day;
      const amount = document.createElement("span");
      amount.textContent = value ? formatUnits(value) : "—";
      cell.append(number, amount);
      elements.calendar.append(cell);
    }
  }

  function renderCharts() {
    const summaries = getSummaries();
    renderBarChart(el("level-chart"), "Distribución por nivel", [0, 1, 2, 3, 4].map(level => ({ label: `Nivel ${level}`, value: summaries.filter(summary => summary.level === level).length, className: `attendance-level-${level}` })));
    const groups = groupSummaries();
    renderBarChart(el("group-chart"), "Ausencias sin justificar por grupo", groups.map(group => ({ label: group.group, value: group.unjustified })));
  }

  function renderBarChart(container, title, data) {
    container.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = title;
    container.append(heading);
    const max = Math.max(1, ...data.map(item => item.value));
    data.forEach(item => {
      const row = document.createElement("div");
      row.className = "attendance-chart-row";
      const label = document.createElement("span");
      label.textContent = item.label;
      const track = document.createElement("div");
      track.className = "attendance-chart-track";
      const fill = document.createElement("div");
      fill.className = `attendance-chart-fill ${item.className || ""}`;
      fill.style.width = `${(item.value / max) * 100}%`;
      track.append(fill);
      const value = document.createElement("strong");
      value.textContent = formatUnits(item.value);
      row.append(label, track, value);
      container.append(row);
    });
    if (!data.length) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = "Sin datos.";
      container.append(empty);
    }
  }

  function renderMonthlyAnalysis() {
    const month = elements.analysisMonth.value;
    const container = el("monthly-analysis");
    container.replaceChildren();
    if (!month) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = "Selecciona un mes con registros.";
      container.append(empty);
      return;
    }
    const current = getSummaries(month).filter(summary => summary.records.some(record => monthKey(record.date) === month));
    const previousMonth = shiftMonth(month, -1);
    const previousMap = new Map(getSummaries(previousMonth).map(summary => [summary.key, summary]));
    const newCases = current.filter(summary => summary.level >= 2 && (previousMap.get(summary.key)?.level || 0) < 2).length;
    const escalations = current.filter(summary => summary.level > (previousMap.get(summary.key)?.level || 0)).length;
    const metrics = [
      ["Alumnado con faltas", current.filter(summary => summary.justified + summary.unjustified > 0).length],
      ["Sin justificar", formatUnits(sum(current.map(summary => summary.unjustified)))],
      ["Casos nuevos nivel 2–4", newCases],
      ["Escaladas de nivel", escalations]
    ];
    metrics.forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "attendance-mini-stat";
      const strong = document.createElement("strong");
      strong.textContent = value;
      const span = document.createElement("span");
      span.textContent = label;
      card.append(strong, span);
      container.append(card);
    });
  }

  function openDerivationDialog() {
    const select = el("derivation-student");
    const summaries = getSummaries();
    select.replaceChildren(...summaries.map(summary => new Option(`${displayName(summary)} · ${summary.group}`, summary.key)));
    if (!summaries.length) {
      showFeedback("Carga alumnado antes de registrar una derivación.", true);
      return;
    }
    el("derivation-date").value = todayIso();
    el("derivation-reason").value = "";
    el("derivation-dialog").showModal();
  }

  function addDerivation(event) {
    event.preventDefault();
    state.derivations.push({
      id: crypto.randomUUID(),
      studentKey: el("derivation-student").value,
      date: el("derivation-date").value,
      destination: el("derivation-destination").value,
      status: el("derivation-status").value,
      reason: el("derivation-reason").value.trim()
    });
    el("derivation-dialog").close();
    renderAll();
    showFeedback("Derivación incorporada a esta sesión local.");
  }

  function renderDerivations() {
    elements.derivationRows.replaceChildren();
    state.derivations.forEach(item => {
      const summary = getSummaries().find(candidate => candidate.key === item.studentKey);
      if (!summary) return;
      const row = document.createElement("tr");
      row.append(textCell(displayName(summary)), textCell(formatDate(item.date)), textCell(item.destination), textCell(item.status), textCell(item.reason));
      const action = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "attendance-btn";
      button.dataset.derivationId = item.id;
      button.textContent = item.status === "Cerrada" ? "Reabrir" : "Avanzar estado";
      action.append(button);
      row.append(action);
      elements.derivationRows.append(row);
    });
    if (!elements.derivationRows.children.length) {
      const row = document.createElement("tr");
      const cell = textCell("No hay derivaciones registradas.");
      cell.colSpan = 6;
      cell.className = "attendance-empty";
      row.append(cell);
      elements.derivationRows.append(row);
    }
  }

  function cycleDerivationStatus(event) {
    const button = event.target.closest("button[data-derivation-id]");
    if (!button) return;
    const item = state.derivations.find(candidate => candidate.id === button.dataset.derivationId);
    if (!item) return;
    const states = ["Preparación", "Enviada", "En seguimiento", "Cerrada"];
    item.status = states[(states.indexOf(item.status) + 1) % states.length];
    renderAll();
  }

  function renderReportOptions() {
    const container = el("report-groups");
    const groups = [...new Set(state.records.map(record => record.group))].sort((a, b) => a.localeCompare(b, "es"));
    const existingInputs = [...container.querySelectorAll("input")];
    const selected = new Set(existingInputs.filter(input => input.checked).map(input => input.value));
    container.replaceChildren();
    groups.forEach(group => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = group;
      input.checked = existingInputs.length ? selected.has(group) : true;
      label.append(input, document.createTextNode(` ${group}`));
      container.append(label);
    });
    if (!groups.length) {
      const empty = document.createElement("span");
      empty.className = "attendance-empty";
      empty.textContent = "Sin grupos disponibles.";
      container.append(empty);
    }
  }

  function openReport(kind, keys = []) {
    const titleMap = {
      executive: "Informe de dirección", comparison: "Comparativa entre grupos", monthly: "Informe mensual", minutes: "Acta de reunión", derivations: "Seguimiento de derivaciones", groups: "Informe combinado por grupos", "groups-individual": "Informes individuales por grupos", students: "Informe de alumnado", messages: "Mensajes para familias", meeting: "Guion de reunión familiar", commitment: "Compromiso de asistencia", "social-services": "Informe para Servicios Sociales"
    };
    setText("report-title", titleMap[kind] || "Vista imprimible");
    const header = `<header class="attendance-report-header"><h2>${escapeHtml(titleMap[kind] || "Informe de seguimiento")}</h2><p>${escapeHtml(state.settings.course)} · Generado ${escapeHtml(dateFormatter.format(new Date()))}</p></header>`;
    let html = "";
    if (["executive", "comparison"].includes(kind)) html = groupReportHtml(groupSummaries());
    else if (kind === "derivations") html = derivationReportHtml();
    else if (["monthly", "minutes"].includes(kind)) html = monthlyReportHtml(kind === "minutes");
    else if (["groups", "groups-individual"].includes(kind)) {
      const selectedGroups = [...el("report-groups").querySelectorAll("input:checked")].map(input => input.value);
      const selectedContent = new Set([...document.querySelectorAll('input[name="report-content"]:checked')].map(input => input.value));
      const groups = groupSummaries(el("report-period").value === "all" ? "" : el("report-period").value).filter(group => selectedGroups.includes(group.group));
      html = groups.map(group => `<section class="attendance-report-page">${groupDetailedReportHtml(group, selectedContent)}</section>`).join("");
    } else {
      const summaries = getSummaries().filter(summary => keys.includes(summary.key));
      if (kind === "messages") html = summaries.map(summary => `<section class="attendance-report-page"><h3>${escapeHtml(displayName(summary))}</h3><p>${escapeHtml(messageFor(summary, "followup"))}</p></section>`).join("");
      else if (kind === "meeting") html = summaries.map(meetingReportHtml).join("");
      else if (kind === "commitment") html = summaries.map(commitmentReportHtml).join("");
      else if (kind === "social-services") html = summaries.map(socialServicesReportHtml).join("");
      else html = summaries.map(studentReportHtml).join("");
    }
    elements.reportContent.innerHTML = header + (html || '<div class="attendance-empty">No hay datos para este informe.</div>');
    const meeting = kind === "meeting" && keys.length === 1;
    el("meeting-note-field").hidden = !meeting;
    el("save-meeting-action").hidden = !meeting;
    el("save-meeting-action").dataset.studentKey = meeting ? keys[0] : "";
    el("meeting-note").value = "";
    el("report-dialog").showModal();
  }

  function groupReportHtml(groups) {
    if (!groups.length) return '<div class="attendance-empty">Sin grupos disponibles.</div>';
    return `<table><thead><tr><th>Grupo</th><th>Alumnado</th><th>Sin justificar</th><th>Niveles 2–4</th><th>Actuaciones</th></tr></thead><tbody>${groups.map(group => `<tr><td>${escapeHtml(group.group)}</td><td>${group.students}</td><td>${escapeHtml(formatUnits(group.unjustified))}</td><td>${group.risk}</td><td>${group.actions}</td></tr>`).join("")}</tbody></table>`;
  }

  function groupDetailedReportHtml(group, content) {
    let html = `<h3>${escapeHtml(group.group)}</h3>`;
    if (content.has("metrics")) html += `<p><strong>${group.students}</strong> estudiantes · <strong>${escapeHtml(formatUnits(group.unjustified))}</strong> sin justificar · <strong>${group.risk}</strong> casos en niveles 2–4.</p>`;
    if (content.has("students")) html += `<h4>Alumnado</h4><table><thead><tr><th>Alumno/a</th><th>Nivel</th><th>Máximo mensual</th><th>Total sin justificar</th></tr></thead><tbody>${group.summaries.map(summary => `<tr><td>${escapeHtml(displayName(summary))}</td><td>${summary.level}</td><td>${escapeHtml(formatUnits(summary.peak))}</td><td>${escapeHtml(formatUnits(summary.unjustified))}</td></tr>`).join("")}</tbody></table>`;
    if (content.has("monthly")) {
      const months = {};
      group.summaries.forEach(summary => Object.entries(summary.monthly).forEach(([month, values]) => {
        if (!months[month]) months[month] = { justified: 0, unjustified: 0 };
        months[month].justified += values.justified;
        months[month].unjustified += values.unjustified;
      }));
      html += `<h4>Desglose mensual</h4><ul>${Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).map(([month, values]) => `<li>${escapeHtml(formatMonth(month))}: ${escapeHtml(formatUnits(values.justified))} justificadas y ${escapeHtml(formatUnits(values.unjustified))} sin justificar</li>`).join("")}</ul>`;
    }
    if (content.has("actions")) html += `<h4>Últimas actuaciones</h4><ul>${group.summaries.map(summary => { const action = [...(state.actions[summary.key] || [])].sort((a, b) => b.date.localeCompare(a.date))[0]; return `<li><strong>${escapeHtml(displayName(summary))}:</strong> ${action ? escapeHtml(`${formatDate(action.date)} · ${action.type}: ${action.note}`) : "sin actuaciones registradas"}</li>`; }).join("")}</ul>`;
    if (content.has("protocol")) html += `<h4>Actuación recomendada</h4><ul>${group.summaries.filter(summary => summary.level > 0).map(summary => `<li><strong>${escapeHtml(displayName(summary))}:</strong> ${escapeHtml(protocolRecommendation(summary.level))}</li>`).join("") || "<li>Mantener el registro ordinario.</li>"}</ul>`;
    return html;
  }

  function studentReportHtml(summary) {
    const actions = state.actions[summary.key] || [];
    const contacts = state.contacts[summary.key] || [];
    return `<section class="attendance-report-page"><h3>${escapeHtml(displayName(summary))} · ${escapeHtml(summary.group)}</h3><p><strong>${escapeHtml(levelMeta[summary.level].label)}</strong> · máximo mensual ${escapeHtml(formatUnits(summary.peak))} · total sin justificar ${escapeHtml(formatUnits(summary.unjustified))}</p><h4>Desglose mensual</h4><ul>${Object.entries(summary.monthly).sort((a, b) => b[0].localeCompare(a[0])).map(([month, values]) => `<li>${escapeHtml(formatMonth(month))}: ${escapeHtml(formatUnits(values.justified))} justificadas y ${escapeHtml(formatUnits(values.unjustified))} sin justificar</li>`).join("")}</ul><h4>Actuaciones y contactos</h4><ul>${[...actions.map(item => `${formatDate(item.date)} · ${item.type}: ${item.note}`), ...contacts.map(item => `${formatDate(item.date)} · ${item.channel}: ${item.result}`)].map(item => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Sin actuaciones documentadas.</li>"}</ul><p><strong>Orientación:</strong> ${escapeHtml(protocolRecommendation(summary.level))}</p></section>`;
  }

  function derivationReportHtml() {
    return `<table><thead><tr><th>Alumno/a</th><th>Fecha</th><th>Destino</th><th>Estado</th><th>Motivo</th></tr></thead><tbody>${state.derivations.map(item => { const summary = getSummaries().find(candidate => candidate.key === item.studentKey); return summary ? `<tr><td>${escapeHtml(displayName(summary))}</td><td>${escapeHtml(formatDate(item.date))}</td><td>${escapeHtml(item.destination)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.reason)}</td></tr>` : ""; }).join("")}</tbody></table>`;
  }

  function monthlyReportHtml(asMinutes) {
    const month = elements.analysisMonth.value;
    const summaries = getSummaries(month).filter(summary => summary.records.some(record => monthKey(record.date) === month));
    const intro = asMinutes ? `<p>Reunido el equipo educativo, se revisan los indicadores de asistencia de ${escapeHtml(formatMonth(month))}. Los acuerdos y responsables se completarán durante la sesión.</p><h3>Acuerdos</h3><ol><li>Casos que requieren seguimiento:</li><li>Medidas educativas acordadas:</li><li>Responsables y fecha de revisión:</li></ol>` : "";
    return `${intro}<table><thead><tr><th>Alumno/a</th><th>Grupo</th><th>Sin justificar</th><th>Nivel</th></tr></thead><tbody>${summaries.map(summary => `<tr><td>${escapeHtml(displayName(summary))}</td><td>${escapeHtml(summary.group)}</td><td>${escapeHtml(formatUnits(summary.unjustified))}</td><td>${summary.level}</td></tr>`).join("")}</tbody></table>`;
  }

  function meetingReportHtml(summary) {
    return `<section class="attendance-report-page"><h3>Reunión familiar · ${escapeHtml(displayName(summary))}</h3><ol><li>Acoger y explicar el objetivo de apoyo.</li><li>Contrastar los datos oficiales: máximo mensual ${escapeHtml(formatUnits(summary.peak))}.</li><li>Escuchar circunstancias y barreras sin emitir juicios.</li><li>Acordar apoyos, responsabilidades y fecha de revisión.</li></ol><h4>Actuaciones previas</h4><ul>${(state.actions[summary.key] || []).map(item => `<li>${escapeHtml(`${formatDate(item.date)} · ${item.type}: ${item.note}`)}</li>`).join("") || "<li>Sin actuaciones previas.</li>"}</ul><h4>Notas de la reunión</h4><div class="attendance-report-writing-space"></div></section>`;
  }

  function commitmentReportHtml(summary) {
    return `<section class="attendance-report-page"><h3>Compromiso de asistencia</h3><p>Alumno/a: ${escapeHtml(displayName(summary))} · Grupo: ${escapeHtml(summary.group)}</p><p>${escapeHtml(state.templates.commitment)}</p><ul><li>Apoyo que ofrecerá el centro:</li><li>Compromiso del alumno o alumna:</li><li>Compromiso familiar:</li><li>Fecha de revisión:</li></ul><div class="attendance-signatures"><span>Familia</span><span>Alumno/a</span><span>Tutor/a</span></div></section>`;
  }

  function socialServicesReportHtml(summary) {
    const derivations = state.derivations.filter(item => item.studentKey === summary.key);
    return `<section class="attendance-report-page"><h3>Informe de coordinación institucional</h3><p><strong>Alumno/a:</strong> ${escapeHtml(displayName(summary))} · ${escapeHtml(summary.group)}</p><p><strong>Indicadores:</strong> máximo mensual ${escapeHtml(formatUnits(summary.peak))}; nivel preventivo ${summary.level}.</p><h4>Actuaciones educativas previas</h4><ul>${(state.actions[summary.key] || []).map(item => `<li>${escapeHtml(`${formatDate(item.date)} · ${item.type}: ${item.note}`)}</li>`).join("") || "<li>Sin actuaciones consignadas.</li>"}</ul><h4>Coordinaciones registradas</h4><ul>${derivations.map(item => `<li>${escapeHtml(`${formatDate(item.date)} · ${item.destination} · ${item.status}: ${item.reason}`)}</li>`).join("") || "<li>Sin derivaciones consignadas.</li>"}</ul><p class="attendance-source">Completar y tramitar únicamente mediante los modelos y canales oficiales vigentes.</p></section>`;
  }

  function renderConfiguration() {
    const fields = {
      "setting-course": state.settings.course,
      "setting-unit": state.settings.unit,
      "setting-threshold-1": state.settings.thresholds[0],
      "setting-threshold-2": state.settings.thresholds[1],
      "setting-threshold-3": state.settings.thresholds[2],
      "setting-threshold-4": state.settings.thresholds[3],
      "template-family": state.templates.family,
      "template-followup": state.templates.followup,
      "template-commitment": state.templates.commitment
    };
    Object.entries(fields).forEach(([id, value]) => { if (document.activeElement !== el(id)) el(id).value = value; });
  }

  function saveTemplates() {
    state.templates = {
      family: el("template-family").value.trim() || defaultTemplates.family,
      followup: el("template-followup").value.trim() || defaultTemplates.followup,
      commitment: el("template-commitment").value.trim() || defaultTemplates.commitment
    };
    showFeedback("Plantillas actualizadas en esta sesión. Guarda la sesión para conservarlas en un archivo.");
  }

  function saveSettings() {
    const thresholds = [1, 2, 3, 4].map(index => Number(el(`setting-threshold-${index}`).value));
    if (thresholds.some(value => !Number.isFinite(value)) || thresholds.some((value, index) => index && value <= thresholds[index - 1])) {
      showFeedback("Los umbrales deben ser números crecientes, sin repeticiones.", true);
      return;
    }
    state.settings = { course: el("setting-course").value.trim() || academicYear(), unit: el("setting-unit").value, thresholds };
    renderAll();
    showFeedback("Configuración aplicada a la sesión actual.");
  }

  function showStudentTab(tab) {
    document.querySelectorAll("[data-student-tab]").forEach(button => button.setAttribute("aria-selected", String(button.dataset.studentTab === tab)));
    document.querySelectorAll("[data-student-panel]").forEach(panel => { panel.hidden = panel.dataset.studentPanel !== tab; });
  }

  function addContact(event) {
    event.preventDefault();
    const contact = { channel: el("contact-channel").value, date: el("contact-date").value, result: el("contact-result").value.trim() };
    if (!state.selectedStudent || !contact.date || !contact.result) return;
    if (!state.contacts[state.selectedStudent]) state.contacts[state.selectedStudent] = [];
    state.contacts[state.selectedStudent].push(contact);
    const summary = getSummaries().find(item => item.key === state.selectedStudent);
    renderDialogContacts(summary);
    renderStudentTimeline(summary);
    renderStudentHistory(summary);
    el("contact-result").value = "";
    renderExecutive();
  }

  function renderDialogContacts(summary) {
    elements.contacts.replaceChildren();
    const contacts = [...(state.contacts[summary.key] || [])].sort((a, b) => b.date.localeCompare(a.date));
    contacts.forEach(contact => {
      const item = document.createElement("div");
      item.className = "attendance-action";
      const strong = document.createElement("strong");
      strong.textContent = contact.channel;
      const meta = document.createElement("span");
      meta.textContent = formatDate(contact.date);
      const text = document.createElement("p");
      text.textContent = contact.result;
      item.append(strong, meta, text);
      elements.contacts.append(item);
    });
    if (!contacts.length) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = "No hay contactos registrados.";
      elements.contacts.append(empty);
    }
    el("contact-date").value = todayIso();
  }

  function renderStudentTimeline(summary) {
    const container = el("dialog-timeline");
    const entries = [
      ...summary.records.map(record => ({ date: record.date, title: record.justified ? "Ausencia justificada" : "Ausencia sin justificar", detail: `${formatUnits(record.units)} ${state.settings.unit}${record.note ? ` · ${record.note}` : ""}` })),
      ...(state.actions[summary.key] || []).map(item => ({ date: item.date, title: item.type, detail: item.note })),
      ...(state.contacts[summary.key] || []).map(item => ({ date: item.date, title: `Contacto · ${item.channel}`, detail: item.result })),
      ...state.derivations.filter(item => item.studentKey === summary.key).map(item => ({ date: item.date, title: `Derivación · ${item.status}`, detail: `${item.destination} · ${item.reason}` }))
    ].sort((a, b) => b.date.localeCompare(a.date));
    renderTimelineEntries(container, entries, "No hay hechos en la línea de tiempo.");
  }

  function renderStudentCalendar(summary) {
    const container = el("dialog-student-calendar");
    container.replaceChildren();
    const month = summary.peakMonth || [...Object.keys(summary.monthly)].sort().reverse()[0];
    if (!month) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = "Sin calendario disponible.";
      container.append(empty);
      return;
    }
    ["L", "M", "X", "J", "V", "S", "D"].forEach(day => {
      const label = document.createElement("strong");
      label.className = "attendance-calendar__weekday";
      label.textContent = day;
      container.append(label);
    });
    const [year, monthNumber] = month.split("-").map(Number);
    const offset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
    const days = new Date(year, monthNumber, 0).getDate();
    const recordsByDate = {};
    summary.records.filter(record => monthKey(record.date) === month).forEach(record => {
      if (!recordsByDate[record.date]) recordsByDate[record.date] = { justified: 0, unjustified: 0 };
      recordsByDate[record.date][record.justified ? "justified" : "unjustified"] += record.units;
    });
    for (let index = 0; index < offset; index += 1) container.append(document.createElement("span"));
    for (let day = 1; day <= days; day += 1) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const values = recordsByDate[date] || { justified: 0, unjustified: 0 };
      const cell = document.createElement("div");
      cell.className = "attendance-calendar__day";
      cell.dataset.intensity = values.unjustified ? String(Math.min(4, Math.max(1, Math.ceil(values.unjustified / 3)))) : "0";
      const number = document.createElement("strong");
      number.textContent = day;
      const amount = document.createElement("span");
      amount.textContent = values.unjustified ? `${formatUnits(values.unjustified)} sin just.` : values.justified ? `${formatUnits(values.justified)} just.` : "—";
      cell.append(number, amount);
      container.append(cell);
    }
  }

  function renderStudentEvolution(summary) {
    const data = Object.entries(summary.monthly).sort((a, b) => a[0].localeCompare(b[0])).map(([month, values]) => ({ label: formatMonth(month), value: values.unjustified }));
    renderBarChart(el("dialog-evolution"), "Ausencias sin justificar", data);
  }

  function renderStudentHistory(summary) {
    const entries = [
      ...(state.actions[summary.key] || []).map(item => ({ date: item.date, title: item.type, detail: item.note })),
      ...(state.contacts[summary.key] || []).map(item => ({ date: item.date, title: item.channel, detail: item.result })),
      ...state.derivations.filter(item => item.studentKey === summary.key).map(item => ({ date: item.date, title: `${item.destination} · ${item.status}`, detail: item.reason }))
    ].sort((a, b) => b.date.localeCompare(a.date));
    renderTimelineEntries(el("dialog-history"), entries, "No hay historial de intervenciones.");
  }

  function renderTimelineEntries(container, entries, emptyMessage) {
    container.replaceChildren();
    entries.forEach(entry => {
      const item = document.createElement("div");
      item.className = "attendance-action";
      const title = document.createElement("strong");
      title.textContent = entry.title;
      const date = document.createElement("span");
      date.textContent = formatDate(entry.date);
      const detail = document.createElement("p");
      detail.textContent = entry.detail || "Sin nota adicional.";
      item.append(title, date, detail);
      container.append(item);
    });
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "attendance-empty";
      empty.textContent = emptyMessage;
      container.append(empty);
    }
  }

  function saveMeetingAsAction() {
    const key = el("save-meeting-action").dataset.studentKey;
    if (!key) return;
    if (!state.actions[key]) state.actions[key] = [];
    state.actions[key].push({ type: "Reunión familiar", date: todayIso(), note: el("meeting-note").value.trim() || "Reunión familiar realizada; acuerdos pendientes de completar." });
    el("report-dialog").close();
    renderAll();
    showFeedback("La reunión se ha guardado como actuación en la sesión.");
  }

  function renderDialogProtocol(summary) {
    const container = el("dialog-protocol");
    const steps = ["Comprobar registros y justificaciones", "Analizar con el equipo docente", "Contactar y acordar apoyos con la familia", "Coordinar con jefatura y orientación", "Valorar derivación según el protocolo local"];
    const values = state.protocol[summary.key] || Array(steps.length).fill(false);
    container.replaceChildren();
    steps.forEach((step, index) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.protocolIndex = index;
      input.checked = Boolean(values[index]);
      label.append(input, document.createTextNode(step));
      container.append(label);
    });
  }

  function updateProtocolStep(event) {
    const input = event.target.closest("input[data-protocol-index]");
    if (!input || !state.selectedStudent) return;
    if (!state.protocol[state.selectedStudent]) state.protocol[state.selectedStudent] = Array(5).fill(false);
    state.protocol[state.selectedStudent][Number(input.dataset.protocolIndex)] = input.checked;
  }

  function renderGeneratedMessage() {
    const summary = getSummaries().find(item => item.key === state.selectedStudent);
    el("generated-message").value = summary ? messageFor(summary, summary.level >= 2 ? "followup" : "family") : "";
  }

  function messageFor(summary, templateName) {
    return state.templates[templateName].replaceAll("{alumno/a}", displayName(summary)).replaceAll("{faltas}", formatUnits(summary.unjustified));
  }

  async function copyGeneratedMessage() {
    const text = el("generated-message").value;
    try {
      await navigator.clipboard.writeText(text);
      showFeedback("Mensaje copiado al portapapeles.");
    } catch {
      el("generated-message").select();
      showFeedback("Selecciona y copia el mensaje manualmente.");
    }
  }

  function renderDialogRecords(summary) {
    const container = el("dialog-records");
    container.replaceChildren();
    summary.records.slice().sort((a, b) => b.date.localeCompare(a.date)).forEach(record => {
      const index = state.records.indexOf(record);
      const row = document.createElement("div");
      row.className = "attendance-record";
      const text = document.createElement("span");
      text.textContent = `${formatDate(record.date)} · ${record.justified ? "Justificada" : "Sin justificar"} · ${formatUnits(record.units)} ${state.settings.unit}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "attendance-btn attendance-btn--danger";
      button.dataset.recordIndex = index;
      button.textContent = "Eliminar";
      row.append(text, button);
      container.append(row);
    });
  }

  function deleteAttendanceRecord(event) {
    const button = event.target.closest("button[data-record-index]");
    if (!button || !window.confirm("¿Eliminar este registro solo de la sesión local?")) return;
    state.records.splice(Number(button.dataset.recordIndex), 1);
    const summary = getSummaries().find(item => item.key === state.selectedStudent);
    if (!summary) {
      elements.dialog.close();
      renderAll();
      return;
    }
    renderAll();
    elements.dialog.close();
    openStudent(summary.key);
  }

  function sanitizeContacts(contacts) {
    if (!contacts || typeof contacts !== "object" || Array.isArray(contacts)) return {};
    const clean = {};
    Object.entries(contacts).forEach(([key, items]) => {
      if (!Array.isArray(items)) return;
      clean[key] = items.filter(item => item && typeof item.channel === "string" && isValidISODate(item.date) && typeof item.result === "string").slice(0, 200).map(item => ({ channel: item.channel.slice(0, 80), date: item.date, result: item.result.slice(0, 500) }));
    });
    return clean;
  }

  function sanitizeProtocol(protocol) {
    if (!protocol || typeof protocol !== "object" || Array.isArray(protocol)) return {};
    return Object.fromEntries(Object.entries(protocol).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.slice(0, 5).map(Boolean)]));
  }

  function sanitizeDerivations(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(item => item && typeof item.studentKey === "string" && isValidISODate(item.date) && typeof item.destination === "string" && typeof item.status === "string" && typeof item.reason === "string").slice(0, 500).map(item => ({ id: typeof item.id === "string" ? item.id : crypto.randomUUID(), studentKey: item.studentKey, date: item.date, destination: item.destination.slice(0, 120), status: item.status.slice(0, 60), reason: item.reason.slice(0, 800) }));
  }

  function sanitizeTemplates(templates) {
    if (!templates || typeof templates !== "object") return { ...defaultTemplates };
    return Object.fromEntries(Object.entries(defaultTemplates).map(([key, fallback]) => [key, typeof templates[key] === "string" && templates[key].trim() ? templates[key].slice(0, 1000) : fallback]));
  }

  function sanitizeSettings(settings) {
    if (!settings || typeof settings !== "object") return { ...defaultSettings, thresholds: [...defaultSettings.thresholds] };
    const thresholds = Array.isArray(settings.thresholds) ? settings.thresholds.map(Number).slice(0, 4) : [];
    const valid = thresholds.length === 4 && thresholds.every(Number.isFinite) && thresholds.every((value, index) => !index || value > thresholds[index - 1]);
    return { course: typeof settings.course === "string" ? settings.course.slice(0, 20) : academicYear(), unit: ["horas o sesiones", "sesiones", "horas", "días"].includes(settings.unit) ? settings.unit : defaultSettings.unit, thresholds: valid ? thresholds : [...defaultSettings.thresholds] };
  }

  function protocolRecommendation(level) {
    return ["Mantener registro ordinario.", "Comprobar patrón y realizar seguimiento tutorial.", "Contrastar con el equipo docente y contactar con la familia.", "Coordinar medidas con jefatura y orientación sin demorar la intervención.", "Aplicar el protocolo del centro y valorar coordinación institucional."][level];
  }

  function levelDetail(level) {
    const [one, two, three, four] = state.settings.thresholds;
    return [`0–${one - 1} sin justificar`, `${one}–${two - 1} sin justificar`, `${two}–${three - 1} sin justificar`, `${three}–${four - 1} sin justificar`, `${four} o más en un mes`][level];
  }

  function shiftMonth(value, offset) {
    const [year, month] = value.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function academicYear() {
    const now = new Date();
    const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${start}/${start + 1}`;
  }

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
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
