/* home.js — логіка головної сторінки */

const $ = (sel) => document.querySelector(sel)

const els = {
  loader: $("#loader"),
  app: $("#app"),
  logoutBtn: $("#logoutBtn"),
  profileLink: $("#profileLink"),
  heroAvatar: $("#heroAvatar"),
  heroName: $("#heroName"),
  heroRole: $("#heroRole"),
  incompleteBanner: $("#incompleteBanner"),
  completeBanner: $("#completeBanner"),
  bannerText: $("#bannerText"),
  bannerBtn: $("#bannerBtn"),
  bannerOkBtn: $("#bannerOkBtn"),
  tileProfile: $("#tileProfile"),
}

function setAvatar(user) {
  if (user.photo) {
    els.heroAvatar.innerHTML = ""
    const img = document.createElement("img")
    img.src = user.photo
    img.alt = "Фото профілю"
    els.heroAvatar.appendChild(img)
  } else {
    els.heroAvatar.textContent = (user.full_name || "Ф").trim().charAt(0).toUpperCase()
  }
}

// Перелік незаповнених полів для підказки користувачу
function missingFields(user) {
  const missing = []
  if (user.role === "Студент") {
    if (!(user.group_name || "").trim()) missing.push("Група")
    if (!user.course) missing.push("Курс")
  } else {
    if (!(user.position || "").trim()) missing.push("Посада")
    if (!(user.department || "").trim()) missing.push("Кафедра")
    if (!(Array.isArray(user.subjects) && user.subjects.length > 0)) missing.push("Предмети")
    if (!(user.contacts || "").trim()) missing.push("Контакти")
  }
  return missing
}

async function load() {
  try {
    const res = await fetch("/api/me")
    if (!res.ok) {
      window.location.href = "/"
      return
    }
    const data = await res.json()
    const user = data.user

    // Привітання
    els.heroName.textContent = user.full_name || "—"
    els.heroRole.textContent = user.role || "—"
    setAvatar(user)

    // Посилання на потрібну сторінку профілю
    const profilePath = data.profile_path || "/profileStudent.html"
    els.profileLink.href = profilePath
    els.bannerBtn.href = profilePath
    els.bannerOkBtn.href = profilePath
    els.tileProfile.href = profilePath

    // Банер стану профілю
    if (data.profile_complete) {
      els.completeBanner.classList.remove("hidden")
    } else {
      const missing = missingFields(user)
      if (missing.length) {
        els.bannerText.textContent =
          "Будь ласка, заповніть обовʼязкові поля профілю: " + missing.join(", ") + "."
      }
      els.incompleteBanner.classList.remove("hidden")
    }

    els.loader.classList.add("hidden")
    els.app.classList.remove("hidden")
  } catch {
    window.location.href = "/"
  }
}

els.logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST" })
  } catch {
    /* ignore */
  }
  window.location.href = "/"
})

load()
