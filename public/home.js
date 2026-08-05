/* home.js — клієнтська логіка головної сторінки */

const $ = (sel) => document.querySelector(sel)

const els = {
  alert: $("#alert"),
  logoutBtn: $("#logoutBtn"),
  profileBanner: $("#profileBanner"),
  profileForm: $("#profileForm"),
  groupField: $("#groupField"),
  // Верхня панель
  chipAvatar: $("#chipAvatar"),
  chipName: $("#chipName"),
  // Привітання
  welcomeName: $("#welcomeName"),
  welcomeRole: $("#welcomeRole"),
  metaEmail: $("#metaEmail"),
  metaRole: $("#metaRole"),
  metaStatus: $("#metaStatus"),
  // Навігація
  navlinks: document.querySelectorAll(".navlink"),
}

// ------- Допоміжні -------
function showAlert(message, ok = false) {
  els.alert.textContent = message
  els.alert.classList.remove("hidden", "is-ok", "is-err")
  els.alert.classList.add(ok ? "is-ok" : "is-err")
}

function clearAlert() {
  els.alert.classList.add("hidden")
  els.alert.textContent = ""
}

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
  const initial = (user.full_name || "?").trim().charAt(0).toUpperCase()
  els.chipAvatar.textContent = initial
  els.chipName.textContent = user.full_name
  els.welcomeName.textContent = user.full_name
  els.welcomeRole.textContent = user.role
  els.metaEmail.textContent = user.email
  els.metaRole.textContent = user.role

  // Поле "група" показуємо лише для студентів
  els.groupField.classList.toggle("hidden", user.role !== "Студент")

  // Заповнюємо форму наявними даними
  els.profileForm.phone.value = user.phone || ""
  els.profileForm.department.value = user.department || ""
  els.profileForm.group_name.value = user.group_name || ""
  els.profileForm.about.value = user.about || ""

  // Статус профілю + банер
  if (user.profile_complete) {
    els.metaStatus.textContent = "Заповнено"
    els.metaStatus.classList.add("is-ok")
    els.metaStatus.classList.remove("is-warn")
    els.profileBanner.classList.add("hidden")
  } else {
    els.metaStatus.textContent = "Не заповнено"
    els.metaStatus.classList.add("is-warn")
    els.metaStatus.classList.remove("is-ok")
    els.profileBanner.classList.remove("hidden")
  }
}

// ------- Завантаження сторінки: перевірка сесії -------
async function init() {
  try {
    const res = await fetch("/api/me")
    if (!res.ok) {
      // Не авторизований → на сторінку входу
      window.location.href = "/"
      return
    }
    const data = await res.json()
    renderUser(data.user)
  } catch {
    window.location.href = "/"
  }
}

// ------- Збереження профілю -------
els.profileForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearAlert()
  const fd = new FormData(els.profileForm)
  try {
    const data = await apiJson("/api/profile", "PUT", {
      phone: fd.get("phone"),
      department: fd.get("department"),
      group_name: fd.get("group_name"),
      about: fd.get("about"),
    })
    renderUser(data.user)
    if (data.user.profile_complete) {
      showAlert("Профіль збережено. Дякуємо — усі обов'язкові поля заповнено!", true)
    } else {
      showAlert("Профіль збережено, але деякі обов'язкові поля (*) ще порожні.", false)
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
  } catch (err) {
    showAlert(err.message)
  }
})

// ------- Вихід -------
els.logoutBtn.addEventListener("click", async () => {
  try {
    await apiJson("/api/logout", "POST", {})
  } catch {
    /* ignore */
  }
  window.location.href = "/"
})

// ------- Підсвічування активного пункта навігації при скролі -------
els.navlinks.forEach((link) => {
  link.addEventListener("click", () => {
    els.navlinks.forEach((l) => l.classList.remove("is-active"))
    link.classList.add("is-active")
  })
})

// Старт
init()
