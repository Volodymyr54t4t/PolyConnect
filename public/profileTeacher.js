/* profileTeacher.js — логіка сторінки профілю викладача */

const $ = (sel) => document.querySelector(sel)

// Посади (останній пункт — "Інше")
const POSITIONS = [
  "Завідувач кафедри",
  "Проректор з науково-педагогічної роботи (одночасно доцент кафедри)",
  "Професор кафедри",
  "Доцент кафедри",
  "Доцент кафедри (викладач-практик)",
  "Старший викладач кафедри",
  "Старший викладач кафедри (викладач-практик)",
  "Асистент кафедри",
  "Асистент кафедри (викладач-практик)",
  "Інше",
]

// Список предметів кафедри ІПЗ
const SUBJECTS = [
  "Алгоритми та структури даних",
  "Дискретні структури",
  "Аналіз вимог до програмного забезпечення",
  "Архітектура комп’ютера",
  "Архітектура, проєктування та конструювання ПЗ",
  "Бази даних",
  "Безпека програм та даних",
  "Економіка програмного забезпечення",
  "Емпіричні методи програмної інженерії",
  "Людино-машинна взаємодія",
  "Менеджмент проєктів програмного забезпечення",
  "Моделювання та аналіз програмного забезпечення",
  "Об’єктно-орієнтоване програмування",
  "Операційні системи",
  "Організація комп’ютерних мереж",
  "Основи програмної інженерії",
  "Основи програмування",
  "Проєктний практикум та професійна практика програмної інженерії",
  "Веб-дизайн",
  "Інтернет-програмування",
  "Патерни проєктування",
  "Лінійне програмування",
  "Якість програмного забезпечення та тестування",
  "ASP.NET Core",
  "Проєктування інтерфейсів ПЗ",
  "Розробка мережевих додатків",
  "Нелінійне програмування",
  "Дискретне програмування",
  "Системи штучного інтелекту",
  "Програмні оболонки і пакети",
  "Іноземна мова професійного спрямування",
  "Мова програмування РНР",
  "Конструювання інтерфейсів веб-додатків",
  "Програмування мобільних пристроїв",
  "Математичні методи дослідження операцій",
  "Сучасний штучний інтелект",
  "Пакети прикладних програм",
  "Програмування на Node.js",
  "РНР бекенд-фреймворки",
  ".NET-розробка",
  "Dev Net",
]

const els = {
  loader: $("#loader"),
  app: $("#app"),
  alert: $("#alert"),
  form: $("#profileForm"),
  logoutBtn: $("#logoutBtn"),
  photoInput: $("#photoInput"),
  photoPreview: $("#photoPreview"),
  photoPlaceholder: $("#photoPlaceholder"),
  viewName: $("#viewName"),
  viewEmail: $("#viewEmail"),
  viewRole: $("#viewRole"),
  viewPosition: $("#viewPosition"),
  viewDept: $("#viewDept"),
  viewSubjects: $("#viewSubjects"),
  emailField: $("#emailField"),
  positionSelect: $("#positionSelect"),
  positionOtherField: $("#positionOtherField"),
  positionOther: $("#positionOther"),
  subjectSearch: $("#subjectSearch"),
  subjectList: $("#subjectList"),
}

let photoData = null

function showAlert(message, ok = false) {
  els.alert.textContent = message
  els.alert.classList.remove("hidden", "is-ok", "is-err")
  els.alert.classList.add(ok ? "is-ok" : "is-err")
  els.alert.scrollIntoView({ behavior: "smooth", block: "nearest" })
}

function setPhoto(src) {
  if (src) {
    els.photoPreview.src = src
    els.photoPreview.classList.remove("hidden")
    els.photoPlaceholder.classList.add("hidden")
  } else {
    els.photoPreview.classList.add("hidden")
    els.photoPlaceholder.classList.remove("hidden")
  }
}

// Побудова випадаючого списку посад
function buildPositions() {
  els.positionSelect.innerHTML =
    '<option value="">—</option>' +
    POSITIONS.map((p) => `<option value="${p}">${p}</option>`).join("")
}

// Показ/приховування поля "Інше"
function togglePositionOther() {
  const isOther = els.positionSelect.value === "Інше"
  els.positionOtherField.classList.toggle("hidden", !isOther)
}

// Побудова списку предметів (чекбокси)
function buildSubjects(selected = []) {
  els.subjectList.innerHTML = SUBJECTS.map((s, i) => {
    const checked = selected.includes(s) ? "checked" : ""
    return `<label class="subject-item" data-name="${s.toLowerCase()}">
      <input type="checkbox" value="${s}" id="subj-${i}" ${checked} />
      <span>${s}</span>
    </label>`
  }).join("")
}

function getSelectedSubjects() {
  return Array.from(els.subjectList.querySelectorAll("input:checked")).map((i) => i.value)
}

// Фільтр пошуку предметів
els.subjectSearch.addEventListener("input", () => {
  const q = els.subjectSearch.value.trim().toLowerCase()
  els.subjectList.querySelectorAll(".subject-item").forEach((item) => {
    item.style.display = item.dataset.name.includes(q) ? "" : "none"
  })
})

els.positionSelect.addEventListener("change", togglePositionOther)

function renderTags(subjects) {
  if (!subjects || subjects.length === 0) {
    els.viewSubjects.innerHTML = '<span class="tags__empty">—</span>'
    return
  }
  els.viewSubjects.innerHTML = subjects.map((s) => `<span>${s}</span>`).join("")
}

function fillView(user) {
  els.viewName.textContent = user.full_name || "—"
  els.viewEmail.textContent = user.email || "—"
  els.viewRole.textContent = user.role || "Викладач"
  els.viewPosition.textContent = user.position || "—"
  els.viewDept.textContent = user.department || "—"
  els.photoPlaceholder.textContent = (user.full_name || "В").trim().charAt(0).toUpperCase()
  renderTags(user.subjects)

  els.emailField.value = user.email || ""
  els.form.full_name.value = user.full_name || ""
  els.form.contacts.value = user.contacts || ""
  if (user.department) els.form.department.value = user.department

  // Посада: якщо не входить у список — це "Інше"
  if (user.position && POSITIONS.includes(user.position) && user.position !== "Інше") {
    els.positionSelect.value = user.position
  } else if (user.position) {
    els.positionSelect.value = "Інше"
    els.positionOther.value = user.position
  } else {
    els.positionSelect.value = ""
  }
  togglePositionOther()

  buildSubjects(user.subjects || [])
  setPhoto(user.photo)
}

async function load() {
  buildPositions()
  buildSubjects([])
  try {
    const res = await fetch("/api/me")
    if (!res.ok) {
      window.location.href = "/"
      return
    }
    const data = await res.json()
    if (data.user.role === "Студент") {
      window.location.href = data.redirect || "/"
      return
    }
    fillView(data.user)
    els.loader.classList.add("hidden")
    els.app.classList.remove("hidden")
  } catch {
    window.location.href = "/"
  }
}

// Завантаження фото → base64
els.photoInput.addEventListener("change", (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (file.size > 4 * 1024 * 1024) {
    showAlert("Файл завеликий. Максимум 4 МБ.")
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    photoData = reader.result
    setPhoto(photoData)
  }
  reader.readAsDataURL(file)
})

// Збереження
els.form.addEventListener("submit", async (e) => {
  e.preventDefault()

  let position = els.positionSelect.value
  if (position === "Інше") {
    position = els.positionOther.value.trim()
    if (!position) {
      showAlert('Вкажіть посаду у полі "Інше"')
      return
    }
  }

  const body = {
    full_name: els.form.full_name.value,
    position,
    department: els.form.department.value,
    subjects: getSelectedSubjects(),
    contacts: els.form.contacts.value,
  }
  if (photoData) body.photo = photoData

  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "Помилка збереження")
    photoData = null
    fillView(data.user)
    showAlert("Профіль успішно збережено", true)
  } catch (err) {
    showAlert(err.message)
  }
})

// Вихід
els.logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST" })
  } catch {
    /* ignore */
  }
  window.location.href = "/"
})

load()
