/* profileStudent.js — логіка сторінки профілю студента */

const $ = (sel) => document.querySelector(sel)

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
  viewGroup: $("#viewGroup"),
  viewCourse: $("#viewCourse"),
  emailField: $("#emailField"),
  chipAvatar: $("#chipAvatar"),
  chipName: $("#chipName"),
}

let photoData = null // base64 нового фото

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

function fillView(user) {
  // Верхня панель: аватар + ім'я
  els.chipAvatar.textContent = (user.full_name || "?").trim().charAt(0).toUpperCase()
  els.chipName.textContent = user.full_name || "—"

  els.viewName.textContent = user.full_name || "—"
  els.viewEmail.textContent = user.email || "—"
  els.viewGroup.textContent = user.group_name || "—"
  els.viewCourse.textContent = user.course ? `${user.course} курс` : "—"
  els.photoPlaceholder.textContent = (user.full_name || "Ф").trim().charAt(0).toUpperCase()

  els.emailField.value = user.email || ""
  els.form.full_name.value = user.full_name || ""
  els.form.group_name.value = user.group_name || ""
  els.form.course.value = user.course || ""
  els.form.achievements.value = user.achievements || ""
  setPhoto(user.photo)
}

async function load() {
  try {
    const res = await fetch("/api/me")
    if (!res.ok) {
      window.location.href = "/"
      return
    }
    const data = await res.json()
    // Не той тип профілю — перенаправляємо
    if (data.user.role !== "Студент") {
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

// Збереження профілю
els.form.addEventListener("submit", async (e) => {
  e.preventDefault()
  const fd = new FormData(els.form)
  const body = {
    full_name: fd.get("full_name"),
    group_name: fd.get("group_name"),
    course: fd.get("course"),
    achievements: fd.get("achievements"),
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
