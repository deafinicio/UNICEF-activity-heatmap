const PATHS = {
  schema: "../config/form-schema.json",
  locations: "locations.json"
};

// Paste Apps Script Web App URL here when backend is ready.
// Example: const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXX/exec";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6ixPdp0tgPCH7dk4UYlZilgyZqHG4kwBw-e2RE3-WY8QaagZ_1uGUUVlcd5pyeSIfSg/exec";

let lang = localStorage.getItem("unicef_form_lang") || "uk";
let schema = null;
let locations = null;

const ui = {
  uk: {
    pageTitle: "UNICEF Activity Form",
    pageSubtitle: "Форма внесення активностей у межах спільного проєкту з UNICEF",
    activityGroup: "Напрямок активності",
    demographics: "Демографія",
    calculatedTotals: "Розраховані підсумки",
    submit: "Надіслати",
    reset: "Очистити",
    preview: "Попередній перегляд запису",
    selectPlaceholder: "Оберіть значення",
    success: "Дані підготовлено. Після підключення Apps Script вони будуть надсилатися в Google Sheets.",
    sent: "Дані успішно надіслано.",
    error: "Помилка надсилання даних.",
    totals: {
      people: "Усього людей",
      female: "Жінки / дівчата",
      male: "Чоловіки / хлопці",
      children: "Діти 0–17",
      adults: "18+",
      age_0_4: "0–4",
      age_5_9: "5–9",
      age_10_14: "10–14",
      age_15_17: "15–17"
    }
  },
  en: {
    pageTitle: "UNICEF Activity Form",
    pageSubtitle: "Activity data entry form within the joint UNICEF project",
    activityGroup: "Activity group",
    demographics: "Demographics",
    calculatedTotals: "Calculated totals",
    submit: "Submit",
    reset: "Reset",
    preview: "Submission preview",
    selectPlaceholder: "Select value",
    success: "Data prepared. After Apps Script is connected, it will be sent to Google Sheets.",
    sent: "Data submitted successfully.",
    error: "Submission error.",
    totals: {
      people: "Total people",
      female: "Female",
      male: "Male",
      children: "Children 0–17",
      adults: "18+",
      age_0_4: "0–4",
      age_5_9: "5–9",
      age_10_14: "10–14",
      age_15_17: "15–17"
    }
  }
};

function tr(path) {
  return path.split(".").reduce((obj, key) => obj && obj[key], ui[lang]) || path;
}

function labelOf(field) {
  return field.label?.[lang] || field.label?.en || field.id;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function createField(field) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-section";

  const label = document.createElement("label");
  label.htmlFor = field.id;
  label.textContent = labelOf(field) + (field.required ? " *" : "");
  wrapper.appendChild(label);

  let input;

  if (field.type === "select") {
    input = document.createElement("select");
    input.id = field.id;
    input.name = field.id;
    if (field.required) input.required = true;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = tr("selectPlaceholder");
    input.appendChild(defaultOption);

    if (field.options) {
      field.options.forEach(option => {
        const item = document.createElement("option");
        item.value = option;
        item.textContent = option;
        input.appendChild(item);
      });
    }
  } else if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.id = field.id;
    input.name = field.id;
    if (field.required) input.required = true;
  } else {
    input = document.createElement("input");
    input.id = field.id;
    input.name = field.id;
    input.type = field.type || "text";
    if (field.required) input.required = true;
    if (field.min !== undefined) input.min = field.min;
  }

  wrapper.appendChild(input);
  return wrapper;
}

function populateActivityGroups() {
  const select = document.getElementById("activity_group");
  select.innerHTML = "";

  Object.entries(schema.groups).forEach(([id, group]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = group.label?.[lang] || group.label?.en || id;
    select.appendChild(option);
  });

  select.value = schema.default_group || Object.keys(schema.groups)[0];
}

function getRaions() {
  return Object.keys(locations || {}).sort((a, b) => a.localeCompare(b, lang));
}

function getHromadas(raion) {
  if (!raion || !locations[raion]) return [];
  return Object.keys(locations[raion]).sort((a, b) => a.localeCompare(b, lang));
}

function getSettlements(raion, hromada) {
  if (!raion || !hromada || !locations[raion]?.[hromada]) return [];
  return [...locations[raion][hromada]].sort((a, b) => a.localeCompare(b, lang));
}

function fillSelect(select, values) {
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = tr("selectPlaceholder");
  select.appendChild(defaultOption);

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function renderCommonFields() {
  const container = document.getElementById("common-fields");
  container.innerHTML = "";

  schema.common_fields.forEach(field => {
    container.appendChild(createField(field));
  });

  const raion = document.getElementById("raion");
  const hromada = document.getElementById("hromada");
  const settlement = document.getElementById("settlement");

  fillSelect(raion, getRaions());
  fillSelect(hromada, []);
  fillSelect(settlement, []);

  raion.addEventListener("change", () => {
    fillSelect(hromada, getHromadas(raion.value));
    fillSelect(settlement, []);
    updatePreview();
  });

  hromada.addEventListener("change", () => {
    fillSelect(settlement, getSettlements(raion.value, hromada.value));
    updatePreview();
  });
}

function renderGroupFields() {
  const groupId = document.getElementById("activity_group").value;
  const group = schema.groups[groupId];
  const container = document.getElementById("group-fields");
  container.innerHTML = "";

  if (!group) return;

  group.fields.forEach(field => {
    container.appendChild(createField(field));
  });
}

function renderDemographics() {
  const container = document.getElementById("demographics-fields");
  container.innerHTML = "";

  if (!schema.demographics?.enabled) {
    document.getElementById("demographics-section").classList.add("hidden");
    return;
  }

  document.getElementById("demographics-section").classList.remove("hidden");

  const grid = document.createElement("div");
  grid.className = "grid-2";

  schema.demographics.fields.forEach(field => {
    grid.appendChild(createField(field));
  });

  container.appendChild(grid);
}

function collectPayload() {
  const form = document.getElementById("activity-form");
  const data = new FormData(form);
  const payload = {};

  for (const [key, value] of data.entries()) {
    payload[key] = value;
  }

  payload.created_at = new Date().toISOString();
  payload.event_count = 1;

  const femaleFields = [
    "female_0_4", "female_5_9", "female_10_14", "female_15_17", "female_18_plus"
  ];

  const maleFields = [
    "male_0_4", "male_5_9", "male_10_14", "male_15_17", "male_18_plus"
  ];

  payload.female_total = femaleFields.reduce((sum, key) => sum + safeNumber(payload[key]), 0);
  payload.male_total = maleFields.reduce((sum, key) => sum + safeNumber(payload[key]), 0);

  payload.age_0_4_total = safeNumber(payload.female_0_4) + safeNumber(payload.male_0_4);
  payload.age_5_9_total = safeNumber(payload.female_5_9) + safeNumber(payload.male_5_9);
  payload.age_10_14_total = safeNumber(payload.female_10_14) + safeNumber(payload.male_10_14);
  payload.age_15_17_total = safeNumber(payload.female_15_17) + safeNumber(payload.male_15_17);
  payload.age_18_plus_total = safeNumber(payload.female_18_plus) + safeNumber(payload.male_18_plus);

  const demographicPeople = payload.female_total + payload.male_total;
  const demographicChildren =
    payload.age_0_4_total +
    payload.age_5_9_total +
    payload.age_10_14_total +
    payload.age_15_17_total;

  if (!safeNumber(payload.people_total) && demographicPeople > 0) {
    payload.people_total = demographicPeople;
  }

  if (!safeNumber(payload.children_total) && demographicChildren > 0) {
    payload.children_total = demographicChildren;
  }

  if (!safeNumber(payload.adults_total) && payload.age_18_plus_total > 0) {
    payload.adults_total = payload.age_18_plus_total;
  }

  return payload;
}

function updateCalculatedSummary(payload = collectPayload()) {
  const box = document.getElementById("calculated-summary");

  box.innerHTML = `
    <div class="summary-row"><span>${tr("totals.people")}</span><strong>${safeNumber(payload.people_total)}</strong></div>
    <div class="summary-row"><span>${tr("totals.female")}</span><strong>${safeNumber(payload.female_total)}</strong></div>
    <div class="summary-row"><span>${tr("totals.male")}</span><strong>${safeNumber(payload.male_total)}</strong></div>
    <div class="summary-row"><span>${tr("totals.children")}</span><strong>${safeNumber(payload.children_total)}</strong></div>
    <div class="summary-row"><span>${tr("totals.adults")}</span><strong>${safeNumber(payload.adults_total)}</strong></div>
    <div class="summary-row"><span>${tr("totals.age_0_4")}</span><strong>${safeNumber(payload.age_0_4_total)}</strong></div>
    <div class="summary-row"><span>${tr("totals.age_5_9")}</span><strong>${safeNumber(payload.age_5_9_total)}</strong></div>
    <div class="summary-row"><span>${tr("totals.age_10_14")}</span><strong>${safeNumber(payload.age_10_14_total)}</strong></div>
    <div class="summary-row"><span>${tr("totals.age_15_17")}</span><strong>${safeNumber(payload.age_15_17_total)}</strong></div>
  `;
}

function updatePreview() {
  const payload = collectPayload();
  updateCalculatedSummary(payload);
  document.getElementById("payload-preview").textContent =
    JSON.stringify(payload, null, 2);
}

function translateStaticUI() {
  document.documentElement.lang = lang;
  document.getElementById("page-title").textContent = tr("pageTitle");
  document.getElementById("page-subtitle").textContent = tr("pageSubtitle");
  document.getElementById("activity-group-label").textContent = tr("activityGroup");
  document.getElementById("demographics-title").textContent = tr("demographics");
  document.getElementById("summary-title").textContent = tr("calculatedTotals");
  document.getElementById("submit-btn").textContent = tr("submit");
  document.getElementById("reset-btn").textContent = tr("reset");
  document.getElementById("preview-title").textContent = tr("preview");
}

function renderForm() {
  translateStaticUI();
  populateActivityGroups();
  renderCommonFields();
  renderGroupFields();
  renderDemographics();
  updatePreview();
}

async function submitPayload(payload) {
  if (!APPS_SCRIPT_URL) {
    return { ok: true, localOnly: true };
  }

  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return { ok: true };
}

function setStatus(message, type = "") {
  const status = document.getElementById("status-message");
  status.textContent = message;
  status.className = "status " + type;
}

async function init() {
  const [schemaResponse, locationsResponse] = await Promise.all([
    fetch(PATHS.schema),
    fetch(PATHS.locations)
  ]);

  schema = await schemaResponse.json();
  locations = await locationsResponse.json();

  renderForm();

  document.getElementById("activity_group").addEventListener("change", () => {
    renderGroupFields();
    updatePreview();
  });

  document.getElementById("activity-form").addEventListener("input", updatePreview);
  document.getElementById("activity-form").addEventListener("change", updatePreview);

  document.getElementById("reset-btn").addEventListener("click", () => {
    document.getElementById("activity-form").reset();
    populateActivityGroups();
    renderCommonFields();
    renderGroupFields();
    renderDemographics();
    updatePreview();
    setStatus("");
  });

 let isSubmitting = false;

document.getElementById("activity-form").addEventListener("submit", async event => {
  event.preventDefault();

  if (isSubmitting) return;

  isSubmitting = true;

  const submitButton = document.getElementById("submit-btn");
  submitButton.disabled = true;
  submitButton.textContent = lang === "uk" ? "Надсилається..." : "Submitting...";

  setStatus(lang === "uk" ? "Надсилання даних..." : "Submitting data...");

  const payload = collectPayload();

  try {
    const result = await submitPayload(payload);
    setStatus(result.localOnly ? tr("success") : tr("sent"), "success");
    updatePreview();
  } catch (error) {
    console.error(error);
    setStatus(tr("error"), "error");
  } finally {
    isSubmitting = false;
    submitButton.disabled = false;
    submitButton.textContent = tr("submit");
  }
});

  document.getElementById("lang-uk").addEventListener("click", () => {
    lang = "uk";
    localStorage.setItem("unicef_form_lang", lang);
    renderForm();
  });

  document.getElementById("lang-en").addEventListener("click", () => {
    lang = "en";
    localStorage.setItem("unicef_form_lang", lang);
    renderForm();
  });
}

init().catch(error => {
  console.error(error);
  setStatus("Initialization error. Check console.", "error");
});
