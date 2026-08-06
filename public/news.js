/* news.js — клієнтська логіка модуля "Новини" */

const $ = (sel) => document.querySelector(sel)

const els = {
  chipAvatar: $("#chipAvatar"),
  chipName: $("#chipName"),
  logoutBtn: $("#logoutBtn"),
  createBtn: $("#createBtn"),
  feed: $("#feed"),
  feedStatus: $("#feedStatus"),
  sentinel: $("#sentinel"),
  // Редактор
  editorModal: $("#editorModal"),
  editorTitle: $("#editorTitle"),
  editorForm: $("#editorForm"),
  editorAlert: $("#editorAlert"),
  fTitle: $("#fTitle"),
  fDescription: $("#fDescription"),
  fAuthor: $("#fAuthor"),
  fCover: $("#fCover"),
  coverPreview: $("#coverPreview"),
  removeCoverBtn: $("#removeCoverBtn"),
  dropzone: $("#dropzone"),
  fFiles: $("#fFiles"),
  attachList: $("#attachList"),
  saveBtn: $("#saveBtn"),
  // Перегляд
  viewModal: $("#viewModal"),
  viewTitle: $("#viewTitle"),
  viewBody: $("#viewBody"),
  // Підтвердження
  confirmModal: $("#confirmModal"),
  confirmDeleteBtn: $("#confirmDeleteBtn"),
}

// ------- Стан -------
const state = {
  me: null,
  page: 1,
  limit: 6,
  loading: false,
  hasMore: true,
  editingId: null, // null → створення, число → редагування
  cover: undefined, // undefined = без змін, null = прибрати, рядок = нова обкладинка (data URL)
  attachments: [], // нові вкладення (для створення/додавання): {name,type,size,data}
  existingAttachments: [], // вже збережені (лише при редагуванні): {id,file_name,file_type,file_size,is_image}
  removeIds: [], // id існуючих вкладень на видалення
  deleteId: null,
}

// ------- Утиліти -------
async function apiJson(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Сталася помилка")
  return data
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error("Не вдалося прочитати файл"))
    reader.readAsDataURL(file)
  })
}

function formatBytes(bytes) {
  if (!bytes) return "—"
  const units = ["Б", "КБ", "МБ", "ГБ"]
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function initial(name) {
  return (name || "?").trim().charAt(0).toUpperCase()
}

function fileExt(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || "")
  return m ? m[1].toUpperCase().slice(0, 4) : "ФАЙЛ"
}

// ------- Сесія -------
async function initSession() {
  try {
    const res = await fetch("/api/me")
    if (!res.ok) {
      window.location.href = "/"
      return false
    }
    const data = await res.json()
    state.me = data.user
    els.chipAvatar.textContent = initial(data.user.full_name)
    els.chipName.textContent = data.user.full_name
    return true
  } catch {
    window.location.href = "/"
    return false
  }
}

// ------- Стрічка новин -------
function newsCardHtml(n) {
  const cover = n.cover
    ? `<div class="news-card__cover" data-open="${n.id}"><img src="${n.cover}" alt="Обкладинка: ${escapeHtml(n.title)}" /></div>`
    : `<div class="news-card__cover news-card__cover--empty" data-open="${n.id}">ЖДТУ</div>`

  const tags = []
  if (n.image_count > 0) tags.push(`<span class="news-card__tag">🖼 ${n.image_count}</span>`)
  const fileCount = n.attachment_count - n.image_count
  if (fileCount > 0) tags.push(`<span class="news-card__tag">📎 ${fileCount}</span>`)

  const actions = n.can_manage
    ? `<div class="news-card__actions">
         <button class="btn btn--ghost btn--xs" data-edit="${n.id}" type="button">Редагувати</button>
         <button class="btn btn--ghost btn--xs" data-delete="${n.id}" type="button">Видалити</button>
       </div>`
    : ""

  return `
    <article class="news-card">
      ${cover}
      <div class="news-card__body">
        <h3 class="news-card__title" data-open="${n.id}">${escapeHtml(n.title)}</h3>
        <p class="news-card__excerpt">${escapeHtml(n.description) || "Без опису"}</p>
        <div class="news-card__meta">
          <span class="news-card__author">
            <span class="news-card__author-avatar">${initial(n.author_name)}</span>
            ${escapeHtml(n.author_name)}
          </span>
          <span>${formatDate(n.created_at)}</span>
          ${tags.join("")}
        </div>
      </div>
      ${actions}
    </article>`
}

async function loadFeed(reset = false) {
  if (state.loading) return
  if (reset) {
    state.page = 1
    state.hasMore = true
    els.feed.innerHTML = ""
  }
  if (!state.hasMore) return

  state.loading = true
  els.feedStatus.textContent = "Завантаження…"
  els.feedStatus.classList.remove("is-empty", "hidden")

  try {
    const data = await apiJson(`/api/news?page=${state.page}&limit=${state.limit}`, "GET")
    const html = data.items.map(newsCardHtml).join("")
    els.feed.insertAdjacentHTML("beforeend", html)
    state.hasMore = data.has_more
    state.page += 1

    if (els.feed.children.length === 0) {
      els.feedStatus.textContent = "Новин поки немає. Створіть першу!"
      els.feedStatus.classList.add("is-empty")
    } else if (!state.hasMore) {
      els.feedStatus.classList.add("hidden")
    } else {
      els.feedStatus.textContent = ""
    }
  } catch (err) {
    els.feedStatus.textContent = err.message
  } finally {
    state.loading = false
  }
}

// Нескінченна прокрутка
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting && state.hasMore && !state.loading) {
      loadFeed()
    }
  },
  { rootMargin: "200px" },
)

// ------- Модалки: відкриття/закриття -------
function openModal(modal) {
  modal.classList.remove("hidden")
  document.body.style.overflow = "hidden"
}

function closeModal(modal) {
  modal.classList.add("hidden")
  if (document.querySelectorAll(".modal:not(.hidden)").length === 0) {
    document.body.style.overflow = ""
  }
}

document.addEventListener("click", (e) => {
  if (e.target.matches("[data-close]")) {
    const modal = e.target.closest(".modal")
    if (modal) closeModal(modal)
  }
})

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal:not(.hidden)").forEach(closeModal)
  }
})

// ------- Редактор: заповнення авторів -------
async function loadAuthors() {
  try {
    const data = await apiJson("/api/users", "GET")
    els.fAuthor.innerHTML = data.users
      .map((u) => `<option value="${u.id}">${escapeHtml(u.full_name)} (${escapeHtml(u.role)})</option>`)
      .join("")
  } catch {
    els.fAuthor.innerHTML = ""
  }
}

function showEditorAlert(msg) {
  els.editorAlert.textContent = msg
  els.editorAlert.className = "alert is-err"
}

function clearEditorAlert() {
  els.editorAlert.className = "alert hidden"
}

// Малюємо прев'ю обкладинки
function renderCover() {
  const src = state.cover
  if (src) {
    els.coverPreview.innerHTML = `<img src="${src}" alt="Обкладинка новини" />`
  } else {
    els.coverPreview.innerHTML = `<span class="cover-preview__empty">Немає обкладинки</span>`
  }
}

// Малюємо список вкладень у формі (нові + існуючі, що не видалені)
function renderAttachList() {
  const existing = state.existingAttachments
    .filter((a) => !state.removeIds.includes(a.id))
    .map((a) => {
      const thumb = a.is_image ? "🖼" : "📎"
      return `<li class="attach-item">
        <span class="attach-item__thumb">${thumb}</span>
        <span class="attach-item__info">
          <span class="attach-item__name">${escapeHtml(a.file_name)}</span>
          <span class="attach-item__size">${formatBytes(a.file_size)} · збережено</span>
        </span>
        <button type="button" class="attach-item__remove" data-remove-existing="${a.id}" aria-label="Видалити">×</button>
      </li>`
    })

  const fresh = state.attachments.map((a, i) => {
    const thumb = a.type.startsWith("image/") ? "🖼" : "📎"
    return `<li class="attach-item">
      <span class="attach-item__thumb">${thumb}</span>
      <span class="attach-item__info">
        <span class="attach-item__name">${escapeHtml(a.name)}</span>
        <span class="attach-item__size">${formatBytes(a.size)}</span>
      </span>
      <button type="button" class="attach-item__remove" data-remove-new="${i}" aria-label="Видалити">×</button>
    </li>`
  })

  els.attachList.innerHTML = [...existing, ...fresh].join("")
}

// ------- Відкриття редактора -------
function resetEditor() {
  state.editingId = null
  state.cover = undefined
  state.attachments = []
  state.existingAttachments = []
  state.removeIds = []
  els.editorForm.reset()
  clearEditorAlert()
  renderCover()
  renderAttachList()
}

async function openCreate() {
  resetEditor()
  els.editorTitle.textContent = "Нова новина"
  els.saveBtn.textContent = "Опублікувати"
  await loadAuthors()
  if (state.me) els.fAuthor.value = String(state.me.id)
  openModal(els.editorModal)
  els.fTitle.focus()
}

async function openEdit(id) {
  resetEditor()
  els.editorTitle.textContent = "Редагувати новину"
  els.saveBtn.textContent = "Зберегти зміни"
  await loadAuthors()
  try {
    const data = await apiJson(`/api/news/${id}`, "GET")
    const n = data.news
    state.editingId = id
    els.fTitle.value = n.title
    els.fDescription.value = n.description || ""
    if (n.author_id) els.fAuthor.value = String(n.author_id)
    state.cover = n.cover || undefined
    state.existingAttachments = [...n.images, ...n.files]
    renderCover()
    renderAttachList()
    openModal(els.editorModal)
  } catch (err) {
    alert(err.message)
  }
}

// ------- Обробники обкладинки -------
els.fCover.addEventListener("change", async (e) => {
  const file = e.target.files[0]
  if (!file) return
  try {
    state.cover = await readFileAsDataURL(file)
    renderCover()
  } catch (err) {
    showEditorAlert(err.message)
  }
  e.target.value = ""
})

els.removeCoverBtn.addEventListener("click", () => {
  state.cover = null
  renderCover()
})

// ------- Обробники вкладень -------
async function addFiles(fileList) {
  const files = Array.from(fileList || [])
  for (const file of files) {
    try {
      const data = await readFileAsDataURL(file)
      state.attachments.push({ name: file.name, type: file.type, size: file.size, data })
    } catch {
      /* пропускаємо файл, який не прочитався */
    }
  }
  renderAttachList()
}

els.fFiles.addEventListener("change", (e) => {
  addFiles(e.target.files)
  e.target.value = ""
})

// Drag & drop
;["dragenter", "dragover"].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => {
    e.preventDefault()
    els.dropzone.classList.add("is-drag")
  }),
)
;["dragleave", "drop"].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => {
    e.preventDefault()
    els.dropzone.classList.remove("is-drag")
  }),
)
els.dropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
})

// Видалення вкладень зі списку (делеговано)
els.attachList.addEventListener("click", (e) => {
  const newBtn = e.target.closest("[data-remove-new]")
  if (newBtn) {
    const i = Number(newBtn.dataset.removeNew)
    state.attachments.splice(i, 1)
    renderAttachList()
    return
  }
  const exBtn = e.target.closest("[data-remove-existing]")
  if (exBtn) {
    state.removeIds.push(Number(exBtn.dataset.removeExisting))
    renderAttachList()
  }
})

// ------- Збереження (створення / редагування) -------
els.editorForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearEditorAlert()

  const title = els.fTitle.value.trim()
  if (!title) return showEditorAlert("Вкажіть заголовок новини")

  els.saveBtn.disabled = true
  const originalText = els.saveBtn.textContent
  els.saveBtn.textContent = "Збереження…"

  try {
    if (state.editingId == null) {
      // Створення
      await apiJson("/api/news", "POST", {
        title,
        description: els.fDescription.value,
        cover: state.cover || null,
        author_id: els.fAuthor.value || null,
        attachments: state.attachments,
      })
    } else {
      // Редагування
      await apiJson(`/api/news/${state.editingId}`, "PUT", {
        title,
        description: els.fDescription.value,
        cover: state.cover, // undefined → без змін, null → прибрати, рядок → замінити
        author_id: els.fAuthor.value || null,
        remove_attachment_ids: state.removeIds,
        new_attachments: state.attachments,
      })
    }
    closeModal(els.editorModal)
    await loadFeed(true)
  } catch (err) {
    showEditorAlert(err.message)
  } finally {
    els.saveBtn.disabled = false
    els.saveBtn.textContent = originalText
  }
})

// ------- Перегляд повної новини -------
async function openView(id) {
  els.viewTitle.textContent = "Завантаження…"
  els.viewBody.innerHTML = `<div class="feed-status">Завантаження…</div>`
  openModal(els.viewModal)

  try {
    const data = await apiJson(`/api/news/${id}`, "GET")
    const n = data.news
    els.viewTitle.textContent = n.title

    const cover = n.cover
      ? `<img class="view-cover" src="${n.cover}" alt="Обкладинка: ${escapeHtml(n.title)}" />`
      : ""

    const gallery =
      n.images.length > 0
        ? `<h4 class="view-section-title">Галерея (${n.images.length})</h4>
           <div class="gallery">
             ${n.images
               .map(
                 (img) =>
                   `<img src="${img.file_data}" alt="${escapeHtml(img.file_name)}" data-lightbox="${img.file_data}" />`,
               )
               .join("")}
           </div>`
        : ""

    const files =
      n.files.length > 0
        ? `<h4 class="view-section-title">Вкладення (${n.files.length})</h4>
           <ul class="files-list">
             ${n.files
               .map(
                 (f) =>
                   `<a class="file-row" href="${f.file_data}" download="${escapeHtml(f.file_name)}">
                      <span class="file-row__icon">${fileExt(f.file_name)}</span>
                      <span class="file-row__info">
                        <span class="file-row__name">${escapeHtml(f.file_name)}</span>
                        <span class="file-row__size">${formatBytes(f.file_size)}</span>
                      </span>
                      <span class="file-row__dl">Завантажити</span>
                    </a>`,
               )
               .join("")}
           </ul>`
        : ""

    const actions = n.can_manage
      ? `<div class="view-actions">
           <button class="btn btn--ghost btn--sm" data-edit="${n.id}" type="button">Редагувати</button>
           <button class="btn btn--danger btn--sm" data-delete="${n.id}" type="button">Видалити</button>
         </div>`
      : ""

    els.viewBody.innerHTML = `
      ${cover}
      <div class="view-meta">
        <span class="news-card__author">
          <span class="news-card__author-avatar">${initial(n.author_name)}</span>
          ${escapeHtml(n.author_name)}
        </span>
        <span>Опубліковано: ${formatDate(n.created_at)}</span>
        ${n.updated_at && n.updated_at !== n.created_at ? `<span>Оновлено: ${formatDate(n.updated_at)}</span>` : ""}
      </div>
      <div class="view-text">${escapeHtml(n.description) || "Без опису"}</div>
      ${gallery}
      ${files}
      ${actions}
    `
  } catch (err) {
    els.viewBody.innerHTML = `<div class="feed-status">${escapeHtml(err.message)}</div>`
  }
}

// Лайтбокс для зображень галереї
els.viewBody.addEventListener("click", (e) => {
  const img = e.target.closest("[data-lightbox]")
  if (!img) return
  const box = document.createElement("div")
  box.className = "lightbox"
  box.innerHTML = `<img src="${img.dataset.lightbox}" alt="Перегляд зображення" />`
  box.addEventListener("click", () => box.remove())
  document.body.appendChild(box)
})

// ------- Видалення -------
function askDelete(id) {
  state.deleteId = id
  openModal(els.confirmModal)
}

els.confirmDeleteBtn.addEventListener("click", async () => {
  if (state.deleteId == null) return
  els.confirmDeleteBtn.disabled = true
  try {
    await apiJson(`/api/news/${state.deleteId}`, "DELETE")
    closeModal(els.confirmModal)
    closeModal(els.viewModal)
    state.deleteId = null
    await loadFeed(true)
  } catch (err) {
    alert(err.message)
  } finally {
    els.confirmDeleteBtn.disabled = false
  }
})

// ------- Делегування дій у стрічці -------
document.addEventListener("click", (e) => {
  const open = e.target.closest("[data-open]")
  if (open) return openView(Number(open.dataset.open))

  const edit = e.target.closest("[data-edit]")
  if (edit) return openEdit(Number(edit.dataset.edit))

  const del = e.target.closest("[data-delete]")
  if (del) return askDelete(Number(del.dataset.delete))
})

els.createBtn.addEventListener("click", openCreate)

els.logoutBtn.addEventListener("click", async () => {
  try {
    await apiJson("/api/logout", "POST", {})
  } catch {
    /* ignore */
  }
  window.location.href = "/"
})

// ------- Старт -------
;(async () => {
  const ok = await initSession()
  if (!ok) return
  await loadFeed(true)
  observer.observe(els.sentinel)
})()
