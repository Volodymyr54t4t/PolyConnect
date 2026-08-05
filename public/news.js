/* news.js — клієнтська логіка сторінки новин */

const $ = (sel) => document.querySelector(sel)

// Людські назви реакцій
const REACTION_LABELS = {
  like: "Клас",
  support: "Підтримую",
  interesting: "Цікаво",
}
const REACTION_ORDER = ["like", "support", "interesting"]

const state = {
  me: null,
  canManage: false,
  categories: [],
  openComments: new Set(), // id новин з відкритими коментарями
}

const els = {
  chipAvatar: $("#chipAvatar"),
  chipName: $("#chipName"),
  logoutBtn: $("#logoutBtn"),
  roleHint: $("#roleHint"),
  createBtn: $("#createBtn"),
  // фільтри
  searchInput: $("#searchInput"),
  categoryFilter: $("#categoryFilter"),
  pinnedOnly: $("#pinnedOnly"),
  mineOnly: $("#mineOnly"),
  mineWrap: $("#mineWrap"),
  // стрічка
  newsList: $("#newsList"),
  emptyState: $("#emptyState"),
  // модалка
  modal: $("#editorModal"),
  editorTitle: $("#editorTitle"),
  editorForm: $("#editorForm"),
  editorId: $("#editorId"),
  editorTitleInput: $("#editorTitleInput"),
  editorCategory: $("#editorCategory"),
  editorBody: $("#editorBody"),
  editorAlert: $("#editorAlert"),
  editorClose: $("#editorClose"),
  editorCancel: $("#editorCancel"),
  editorSubmit: $("#editorSubmit"),
}

// ------------------------- Хелпери -------------------------
async function apiJson(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Сталася помилка")
  return data
}

function initial(name) {
  return (name || "?").trim().charAt(0).toUpperCase()
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function debounce(fn, ms) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

// ------------------------- Ініціалізація -------------------------
async function init() {
  // Перевірка сесії
  try {
    const me = await apiJson("/api/me")
    state.me = me.user
  } catch {
    window.location.href = "/"
    return
  }

  els.chipAvatar.textContent = initial(state.me.full_name)
  els.chipName.textContent = state.me.full_name

  // Мета: категорії та права
  const meta = await apiJson("/api/news/meta")
  state.categories = meta.categories
  state.canManage = meta.can_manage

  // Заповнення селектів категорій
  for (const c of state.categories) {
    els.categoryFilter.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    els.editorCategory.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
  }

  if (state.canManage) {
    els.createBtn.classList.remove("hidden")
    els.roleHint.textContent = "Ви можете створювати, редагувати, видаляти та закріплювати новини."
  } else {
    els.mineWrap.classList.add("hidden")
    els.roleHint.textContent = "Переглядайте новини, залишайте коментарі та реакції."
  }

  bindEvents()
  loadNews()
}

// ------------------------- Завантаження стрічки -------------------------
async function loadNews() {
  const params = new URLSearchParams()
  const q = els.searchInput.value.trim()
  if (q) params.set("q", q)
  if (els.categoryFilter.value !== "all") params.set("category", els.categoryFilter.value)
  if (els.pinnedOnly.checked) params.set("pinned", "true")
  if (state.canManage && els.mineOnly.checked) params.set("author", "me")

  try {
    const data = await apiJson(`/api/news?${params.toString()}`)
    renderNews(data.news)
  } catch (err) {
    els.newsList.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`
  }
}

function renderNews(list) {
  els.newsList.innerHTML = ""
  els.emptyState.classList.toggle("hidden", list.length > 0)

  for (const post of list) {
    els.newsList.insertAdjacentHTML("beforeend", postTemplate(post))
  }

  // Відновити відкриті коментарі
  for (const post of list) {
    if (state.openComments.has(post.id)) {
      const box = document.querySelector(`.comments[data-for="${post.id}"]`)
      if (box) {
        box.classList.remove("hidden")
        loadComments(post.id)
      }
    }
  }
}

function reactionsTemplate(post) {
  return REACTION_ORDER.map((type) => {
    const count = post.reactions?.[type] || 0
    const on = post.my_reaction === type ? "is-on" : ""
    return `
      <button class="react ${on}" data-react="${type}" data-id="${post.id}" type="button">
        <span>${REACTION_LABELS[type]}</span>
        <span class="react__count">${count}</span>
      </button>`
  }).join("")
}

function postTemplate(post) {
  const canEdit = state.canManage && (post.author_id === state.me.id || state.me.role === "ДеканФІКТ")
  const canPin = state.canManage

  const pinTag = post.pinned ? `<span class="tag tag--pin">Закріплено</span>` : ""

  const manageBtns = `
    ${
      canPin
        ? `<button class="iconbtn ${post.pinned ? "is-on" : ""}" data-pin="${post.id}" type="button">${
            post.pinned ? "Відкріпити" : "Закріпити"
          }</button>`
        : ""
    }
    ${canEdit ? `<button class="iconbtn" data-edit="${post.id}" type="button">Редагувати</button>` : ""}
    ${canEdit ? `<button class="iconbtn iconbtn--danger" data-delete="${post.id}" type="button">Видалити</button>` : ""}
  `

  const edited =
    post.updated_at && post.updated_at !== post.created_at ? ` · ред. ${formatDate(post.updated_at)}` : ""

  return `
    <article class="post ${post.pinned ? "is-pinned" : ""}" data-post="${post.id}">
      <div class="post__top">
        <span class="post__avatar">${initial(post.author_name)}</span>
        <div class="post__meta">
          <span class="post__author">${escapeHtml(post.author_name)}</span>
          <span class="post__sub">${escapeHtml(post.author_role)} · ${formatDate(post.created_at)}${edited}</span>
        </div>
        <div class="post__tags">
          ${pinTag}
          <span class="tag">${escapeHtml(post.category)}</span>
        </div>
      </div>

      <h3 class="post__title">${escapeHtml(post.title)}</h3>
      <p class="post__body">${escapeHtml(post.body)}</p>

      <div class="post__actions">
        ${reactionsTemplate(post)}
        <button class="iconbtn" data-comments="${post.id}" type="button">
          Коментарі <span class="react__count">${post.comment_count}</span>
        </button>
        <span class="post__spacer"></span>
        ${manageBtns}
      </div>

      <div class="comments hidden" data-for="${post.id}">
        <div class="comments__list" data-list="${post.id}"></div>
        <form class="comment-form" data-comment-form="${post.id}">
          <input type="text" placeholder="Напишіть коментар…" maxlength="1000" required />
          <button class="btn btn--primary" type="submit">Надіслати</button>
        </form>
      </div>
    </article>`
}

// ------------------------- Коментарі -------------------------
async function loadComments(newsId) {
  const listEl = document.querySelector(`.comments__list[data-list="${newsId}"]`)
  if (!listEl) return
  listEl.innerHTML = `<p class="post__sub">Завантаження…</p>`
  try {
    const data = await apiJson(`/api/news/${newsId}/comments`)
    if (data.comments.length === 0) {
      listEl.innerHTML = `<p class="post__sub">Коментарів ще немає. Будьте першим!</p>`
      return
    }
    listEl.innerHTML = data.comments.map(commentTemplate).join("")
  } catch (err) {
    listEl.innerHTML = `<p class="post__sub">${escapeHtml(err.message)}</p>`
  }
}

function commentTemplate(c) {
  const canDelete = c.user_id === state.me.id || state.me.role === "ДеканФІКТ"
  return `
    <div class="comment" data-comment="${c.id}">
      <span class="comment__avatar">${initial(c.author_name)}</span>
      <div class="comment__bubble">
        <div class="comment__head">
          <span class="comment__author">${escapeHtml(c.author_name)}</span>
          <span class="comment__time">${escapeHtml(c.author_role)} · ${formatDate(c.created_at)}</span>
          ${canDelete ? `<button class="comment__del" data-del-comment="${c.id}" type="button">Видалити</button>` : ""}
        </div>
        <p class="comment__text">${escapeHtml(c.body)}</p>
      </div>
    </div>`
}

// ------------------------- Модальне вікно -------------------------
function openEditor(post) {
  els.editorAlert.classList.add("hidden")
  els.editorForm.reset()
  if (post) {
    els.editorTitle.textContent = "Редагувати новину"
    els.editorSubmit.textContent = "Зберегти"
    els.editorId.value = post.id
    els.editorTitleInput.value = post.title
    els.editorBody.value = post.body
    els.editorCategory.value = post.category
  } else {
    els.editorTitle.textContent = "Нова новина"
    els.editorSubmit.textContent = "Опублікувати"
    els.editorId.value = ""
    els.editorCategory.value = state.categories[0] || "Загальне"
  }
  els.modal.classList.remove("hidden")
  els.editorTitleInput.focus()
}

function closeEditor() {
  els.modal.classList.add("hidden")
}

// ------------------------- Події -------------------------
function bindEvents() {
  els.logoutBtn.addEventListener("click", async () => {
    try {
      await apiJson("/api/logout", "POST", {})
    } catch {
      /* ignore */
    }
    window.location.href = "/"
  })

  // Фільтри
  els.searchInput.addEventListener("input", debounce(loadNews, 300))
  els.categoryFilter.addEventListener("change", loadNews)
  els.pinnedOnly.addEventListener("change", loadNews)
  els.mineOnly.addEventListener("change", loadNews)

  // Створити
  els.createBtn.addEventListener("click", () => openEditor(null))

  // Модалка: закриття
  els.editorClose.addEventListener("click", closeEditor)
  els.editorCancel.addEventListener("click", closeEditor)
  els.modal.querySelector("[data-close]").addEventListener("click", closeEditor)

  // Модалка: сабміт (створення / редагування)
  els.editorForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const id = els.editorId.value
    const payload = {
      title: els.editorTitleInput.value.trim(),
      body: els.editorBody.value.trim(),
      category: els.editorCategory.value,
    }
    if (!payload.title || !payload.body) {
      showEditorError("Заповніть заголовок і текст")
      return
    }
    els.editorSubmit.disabled = true
    try {
      if (id) {
        await apiJson(`/api/news/${id}`, "PUT", payload)
      } else {
        await apiJson("/api/news", "POST", payload)
      }
      closeEditor()
      loadNews()
    } catch (err) {
      showEditorError(err.message)
    } finally {
      els.editorSubmit.disabled = false
    }
  })

  // Делегування кліків по стрічці
  els.newsList.addEventListener("click", onListClick)

  // Делегування сабмітів форм коментарів
  els.newsList.addEventListener("submit", async (e) => {
    const form = e.target.closest("[data-comment-form]")
    if (!form) return
    e.preventDefault()
    const newsId = Number(form.dataset.commentForm)
    const input = form.querySelector("input")
    const body = input.value.trim()
    if (!body) return
    const btn = form.querySelector("button")
    btn.disabled = true
    try {
      await apiJson(`/api/news/${newsId}/comments`, "POST", { body })
      input.value = ""
      await loadComments(newsId)
      bumpCommentCount(newsId, 1)
    } catch (err) {
      alert(err.message)
    } finally {
      btn.disabled = false
    }
  })

  // ESC закриває модалку
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.classList.contains("hidden")) closeEditor()
  })
}

async function onListClick(e) {
  const target = e.target.closest("button")
  if (!target) return

  // Реакція
  if (target.dataset.react) {
    const id = Number(target.dataset.id)
    try {
      const data = await apiJson(`/api/news/${id}/react`, "POST", { type: target.dataset.react })
      updateReactions(id, data.reactions, data.my_reaction)
    } catch (err) {
      alert(err.message)
    }
    return
  }

  // Перемкнути коментарі
  if (target.dataset.comments) {
    const id = Number(target.dataset.comments)
    const box = document.querySelector(`.comments[data-for="${id}"]`)
    const isHidden = box.classList.toggle("hidden")
    if (isHidden) {
      state.openComments.delete(id)
    } else {
      state.openComments.add(id)
      loadComments(id)
    }
    return
  }

  // Закріпити / відкріпити
  if (target.dataset.pin) {
    const id = Number(target.dataset.pin)
    try {
      await apiJson(`/api/news/${id}/pin`, "POST", {})
      loadNews()
    } catch (err) {
      alert(err.message)
    }
    return
  }

  // Редагувати
  if (target.dataset.edit) {
    const id = Number(target.dataset.edit)
    const post = extractPostFromDom(id)
    if (post) openEditor(post)
    return
  }

  // Видалити новину
  if (target.dataset.delete) {
    const id = Number(target.dataset.delete)
    if (!confirm("Видалити цю новину? Дію не можна скасувати.")) return
    try {
      await apiJson(`/api/news/${id}`, "DELETE")
      state.openComments.delete(id)
      loadNews()
    } catch (err) {
      alert(err.message)
    }
    return
  }

  // Видалити коментар
  if (target.dataset.delComment) {
    const cid = Number(target.dataset.delComment)
    const postEl = target.closest("[data-post]")
    const newsId = postEl ? Number(postEl.dataset.post) : null
    if (!confirm("Видалити коментар?")) return
    try {
      await apiJson(`/api/news/comments/${cid}`, "DELETE")
      if (newsId) {
        await loadComments(newsId)
        bumpCommentCount(newsId, -1)
      }
    } catch (err) {
      alert(err.message)
    }
    return
  }
}

// Зчитати дані новини з DOM для редактора
function extractPostFromDom(id) {
  const el = document.querySelector(`[data-post="${id}"]`)
  if (!el) return null
  return {
    id,
    title: el.querySelector(".post__title").textContent,
    body: el.querySelector(".post__body").textContent,
    category: el.querySelector(".post__tags .tag:last-child").textContent.trim(),
  }
}

// Оновити відображення реакцій без перезавантаження
function updateReactions(id, reactions, myReaction) {
  const post = document.querySelector(`[data-post="${id}"]`)
  if (!post) return
  for (const type of REACTION_ORDER) {
    const btn = post.querySelector(`[data-react="${type}"][data-id="${id}"]`)
    if (!btn) continue
    btn.querySelector(".react__count").textContent = reactions[type] || 0
    btn.classList.toggle("is-on", myReaction === type)
  }
}

// Оновити лічильник коментарів у кнопці
function bumpCommentCount(newsId, delta) {
  const btn = document.querySelector(`[data-comments="${newsId}"] .react__count`)
  if (btn) btn.textContent = Math.max(0, Number(btn.textContent) + delta)
}

function showEditorError(msg) {
  els.editorAlert.textContent = msg
  els.editorAlert.classList.remove("hidden")
}

// Старт
init()
