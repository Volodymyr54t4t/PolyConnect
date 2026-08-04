/* auth.js — клієнтська логіка сторінки авторизації */

const $ = (sel) => document.querySelector(sel)

const els = {
  tabs: document.querySelectorAll(".tab"),
  forms: document.querySelectorAll(".form"),
  alert: $("#alert"),
  authBox: $("#authBox"),
  account: $("#account"),
  loginForm: $("#loginForm"),
  registerForm: $("#registerForm"),
  forgotForm: $("#forgotForm"),
  resetBlock: $("#resetBlock"),
  resetBtn: $("#resetBtn"),
  logoutBtn: $("#logoutBtn"),
  accName: $("#accName"),
  accEmail: $("#accEmail"),
  accRole: $("#accRole"),
  accAvatar: $("#accAvatar"),
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

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "Сталася помилка")
  return data
}

function switchView(view) {
  clearAlert()
  els.tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.view === view))
  els.forms.forEach((f) => f.classList.toggle("hidden", f.dataset.view !== view))
}

// ------- Показ акаунта / форм -------
function renderAccount(user) {
  els.authBox.classList.add("hidden")
  els.account.classList.remove("hidden")
  els.accName.textContent = user.full_name
  els.accEmail.textContent = user.email
  els.accRole.textContent = user.role
  els.accAvatar.textContent = (user.full_name || "?").trim().charAt(0).toUpperCase()
}

function renderAuth() {
  els.account.classList.add("hidden")
  els.authBox.classList.remove("hidden")
}

// ------- Перевірка сесії при завантаженні -------
async function checkSession() {
  try {
    const res = await fetch("/api/me")
    if (!res.ok) return renderAuth()
    const data = await res.json()
    // Вже авторизований — одразу на головну сторінку
    window.location.href = data.home || "/home.html"
  } catch {
    renderAuth()
  }
}

// ------- Обробники вкладок -------
els.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)))

// ------- Вхід -------
els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearAlert()
  const fd = new FormData(els.loginForm)
  try {
    const data = await api("/api/login", {
      email: fd.get("email"),
      password: fd.get("password"),
    })
    els.loginForm.reset()
    window.location.href = data.redirect || "/"
  } catch (err) {
    showAlert(err.message)
  }
})

// ------- Реєстрація -------
els.registerForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearAlert()
  const fd = new FormData(els.registerForm)
  try {
    const data = await api("/api/register", {
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      role: fd.get("role"),
      password: fd.get("password"),
    })
    els.registerForm.reset()
    window.location.href = data.redirect || "/"
  } catch (err) {
    showAlert(err.message)
  }
})

// ------- Відновлення пароля: крок 1 -------
els.forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  clearAlert()
  const fd = new FormData(els.forgotForm)
  try {
    const data = await api("/api/forgot-password", { email: fd.get("email") })
    els.resetBlock.classList.remove("hidden")
    if (data.reset_token) {
      els.forgotForm.querySelector('input[name="token"]').value = data.reset_token
      showAlert("Токен згенеровано та підставлено нижче. Введіть новий пароль.", true)
    } else {
      showAlert(data.message, true)
    }
  } catch (err) {
    showAlert(err.message)
  }
})

// ------- Відновлення пароля: крок 2 -------
els.resetBtn.addEventListener("click", async () => {
  clearAlert()
  const fd = new FormData(els.forgotForm)
  try {
    const data = await api("/api/reset-password", {
      token: fd.get("token"),
      password: fd.get("new_password"),
    })
    showAlert(data.message, true)
    els.resetBlock.classList.add("hidden")
    els.forgotForm.reset()
    setTimeout(() => switchView("login"), 1500)
  } catch (err) {
    showAlert(err.message)
  }
})

// ------- Вихід -------
els.logoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/logout", {})
  } catch {
    /* ignore */
  }
  renderAuth()
  switchView("login")
})

// Старт
checkSession()
