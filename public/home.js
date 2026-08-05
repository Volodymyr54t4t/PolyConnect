/* home.js — клієнтська логіка головної сторінки */

const $ = (sel) => document.querySelector(sel)

const els = {
  logoutBtn: $("#logoutBtn"),
  profileBanner: $("#profileBanner"),
  bannerCta: $("#bannerCta"),
  navProfile: $("#navProfile"),
  openProfileBtn: $("#openProfileBtn"),
  // Верхня панель
  chipAvatar: $("#chipAvatar"),
  chipName: $("#chipName"),
  // Привітання
  welcomeName: $("#welcomeName"),
  welcomeRole: $("#welcomeRole"),
  metaEmail: $("#metaEmail"),
  metaRole: $("#metaRole"),
  metaStatus: $("#metaStatus"),
  // Картка профілю
  profileHint: $("#profileHint"),
  factEmail: $("#factEmail"),
  factRole: $("#factRole"),
  factGroupRow: $("#factGroupRow"),
  factGroup: $("#factGroup"),
  factStatus: $("#factStatus"),
  // Навігація
  navlinks: document.querySelectorAll(".navlink"),
}

// Куди веде сторінка профілю (залежить від ролі)
let profileUrl = "/profileStudent"

async function apiJson(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Сталася помилка")
  return data
}

// ------- Рендер даних користувача -------
function renderUser(user) {
  const isStudent = user.role === "Студент"
  profileUrl = user.redirect || (isStudent ? "/profileStudent" : "/profileTeacher")

  const initial = (user.full_name || "?").trim().charAt(0).toUpperCase()
  els.chipAvatar.textContent = initial
  els.chipName.textContent = user.full_name
  els.welcomeName.textContent = user.full_name
  els.welcomeRole.textContent = user.role
  els.metaEmail.textContent = user.email
  els.metaRole.textContent = user.role

  // Картка профілю
  els.factEmail.textContent = user.email
  els.factRole.textContent = user.role
  els.factGroupRow.classList.toggle("hidden", !isStudent)
  els.factGroup.textContent = user.group_name || "—"
  els.openProfileBtn.setAttribute("href", profileUrl)

  // Статус профілю + банер
  if (user.profile_complete) {
    els.metaStatus.textContent = "Заповнено"
    els.metaStatus.classList.add("is-ok")
    els.metaStatus.classList.remove("is-warn")
    els.factStatus.textContent = "Заповнено"
    els.profileHint.textContent = "Ваш профіль заповнено. Ви можете переглянути або оновити його."
    els.profileBanner.classList.add("hidden")
  } else {
    els.metaStatus.textContent = "Не заповнено"
    els.metaStatus.classList.add("is-warn")
    els.metaStatus.classList.remove("is-ok")
    els.factStatus.textContent = "Не заповнено"
    els.profileHint.textContent = "Профіль ще не заповнений — заповніть обов'язкові поля."
    els.profileBanner.classList.remove("hidden")
  }
}

// ------- Завантаження сторінки: перевірка сесії -------
async function init() {
  try {
    const res = await fetch("/api/me")
    if (!res.ok) {
      window.location.href = "/"
      return
    }
    const data = await res.json()
    renderUser(data.user)
  } catch {
    window.location.href = "/"
  }
}

// ------- Переходи до сторінки профілю -------
function goToProfile(e) {
  if (e) e.preventDefault()
  window.location.href = profileUrl
}

els.bannerCta.addEventListener("click", goToProfile)
els.navProfile.addEventListener("click", goToProfile)
els.openProfileBtn.addEventListener("click", goToProfile)

// ------- Вихід -------
els.logoutBtn.addEventListener("click", async () => {
  try {
    await apiJson("/api/logout", "POST", {})
  } catch {
    /* ignore */
  }
  window.location.href = "/"
})

// Старт
init()
