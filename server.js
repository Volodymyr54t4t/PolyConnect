/**
 * server.js — уся серверна логіка в одному файлі
 * Node.js + Express + PostgreSQL (Neon) + JWT
 *
 * Функціонал: Реєстрація, Вхід, Вихід, JWT, Відновлення пароля.
 * Дозволені лише пошти з доменом @ztu.edu.ua.
 * Ролі: ДеканФІКТ, Завідувач Кафедри, Викладач, Студент.
 */

require("dotenv").config()

const path = require("path")
const crypto = require("crypto")
const express = require("express")
const cookieParser = require("cookie-parser")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { Pool } = require("pg")

const app = express()

// ------------------------- Конфігурація -------------------------
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me"
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"
const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "@ztu.edu.ua").toLowerCase()
const VALID_ROLES = ["ДеканФІКТ", "Завідувач Кафедри", "Викладач", "Студент"]

if (!process.env.DATABASE_URL) {
  console.error("[v0] DATABASE_URL не задано у .env")
  process.exit(1)
}

// ------------------------- Пул підключень -------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// ------------------------- Ініціалізація БД -------------------------
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             SERIAL PRIMARY KEY,
      full_name      TEXT NOT NULL,
      email          TEXT UNIQUE NOT NULL,
      password_hash  TEXT NOT NULL,
      role           TEXT NOT NULL,
      reset_token    TEXT,
      reset_expires  TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)

  // Додаткові поля профілю (додаються безпечно, якщо їх ще немає)
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone        TEXT,
      ADD COLUMN IF NOT EXISTS department   TEXT,
      ADD COLUMN IF NOT EXISTS group_name   TEXT,
      ADD COLUMN IF NOT EXISTS about        TEXT,
      ADD COLUMN IF NOT EXISTS course        TEXT,
      ADD COLUMN IF NOT EXISTS achievements  TEXT,
      ADD COLUMN IF NOT EXISTS photo         TEXT,
      ADD COLUMN IF NOT EXISTS position      TEXT,
      ADD COLUMN IF NOT EXISTS subjects      JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS contacts      TEXT;
  `)
  console.log("[v0] Таблиця users готова")
}

// ------------------------- Хелпери -------------------------
function isAllowedEmail(email) {
  return typeof email === "string" && email.toLowerCase().trim().endsWith(ALLOWED_DOMAIN)
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  )
}

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // preview працює по http
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

function publicUser(u) {
  const isStudent = u.role === "Студент"

  // Предмети зберігаються як JSONB → нормалізуємо у масив
  let subjects = []
  if (Array.isArray(u.subjects)) subjects = u.subjects
  else if (typeof u.subjects === "string" && u.subjects.trim()) {
    try {
      const parsed = JSON.parse(u.subjects)
      if (Array.isArray(parsed)) subjects = parsed
    } catch {
      subjects = []
    }
  }

  // Заповненість профілю залежить від ролі:
  //  • студент — потрібні група і курс
  //  • викладач/інші — потрібні посада і кафедра
  const profileComplete = isStudent
    ? Boolean(u.group_name && u.group_name.trim() && u.course && String(u.course).trim())
    : Boolean(u.position && u.position.trim() && u.department && u.department.trim())

  // Сторінка профілю, що відповідає ролі
  const redirect = isStudent ? "/profileStudent" : "/profileTeacher"

  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    phone: u.phone || "",
    department: u.department || "",
    group_name: u.group_name || "",
    about: u.about || "",
    course: u.course || "",
    achievements: u.achievements || "",
    photo: u.photo || "",
    position: u.position || "",
    subjects,
    contacts: u.contacts || "",
    profile_complete: profileComplete,
    redirect,
    created_at: u.created_at,
  }
}

// Мідлвеар авторизації (вбудований у цей файл)
function authRequired(req, res, next) {
  const token = req.cookies?.token || (req.headers.authorization || "").replace("Bearer ", "")
  if (!token) return res.status(401).json({ error: "Не авторизовано" })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: "Недійсний або протермінований токен" })
  }
}

// ------------------------- Мідлвеари Express -------------------------
app.use(express.json({ limit: "8mb" })) // великий ліміт для фото (base64)
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "public")))

// ------------------------- Роути API -------------------------

// Реєстрація
app.post("/api/register", async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body || {}

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ error: "Заповніть усі поля" })
    }
    if (!isAllowedEmail(email)) {
      return res.status(400).json({ error: `Дозволена реєстрація лише з поштою ${ALLOWED_DOMAIN}` })
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Невірна роль" })
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Пароль має містити щонайменше 6 символів" })
    }

    const normEmail = email.toLowerCase().trim()
    const exists = await pool.query("SELECT id FROM users WHERE email = $1", [normEmail])
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: "Користувач з такою поштою вже існує" })
    }

    const hash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [full_name.trim(), normEmail, hash, role],
    )

    const user = result.rows[0]
    const token = signToken(user)
    setAuthCookie(res, token)
    res.status(201).json({ message: "Реєстрація успішна", token, user: publicUser(user) })
  } catch (err) {
    console.error("[v0] register error:", err.message)
    res.status(500).json({ error: "Помилка сервера при реєстрації" })
  }
})

// Вхід
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: "Введіть пошту та пароль" })
    }
    if (!isAllowedEmail(email)) {
      return res.status(400).json({ error: `Дозволений вхід лише з поштою ${ALLOWED_DOMAIN}` })
    }

    const normEmail = email.toLowerCase().trim()
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [normEmail])
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Невірна пошта або пароль" })
    }

    const user = result.rows[0]
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ error: "Невірна пошта або пароль" })
    }

    const token = signToken(user)
    setAuthCookie(res, token)
    res.json({ message: "Вхід успішний", token, user: publicUser(user) })
  } catch (err) {
    console.error("[v0] login error:", err.message)
    res.status(500).json({ error: "Помилка сервера при вході" })
  }
})

// Вихід
app.post("/api/logout", (req, res) => {
  res.clearCookie("token")
  res.json({ message: "Ви вийшли з системи" })
})

// Поточний користувач (перевірка JWT)
app.get("/api/me", authRequired, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id])
    if (result.rows.length === 0) return res.status(404).json({ error: "Користувача не знайдено" })
    const user = publicUser(result.rows[0])
    res.json({ user, redirect: user.redirect })
  } catch (err) {
    console.error("[v0] me error:", err.message)
    res.status(500).json({ error: "Помилка сервера" })
  }
})

// Оновлення профілю — приймає будь-який набір полів (студент або викладач),
// оновлюються лише передані поля, решта лишається без змін.
app.put("/api/profile", authRequired, async (req, res) => {
  try {
    const body = req.body || {}

    // Поточний запис — щоб оновити тільки передані поля (merge)
    const current = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id])
    if (current.rows.length === 0) return res.status(404).json({ error: "Користувача не знайдено" })
    const u = current.rows[0]

    // Дозволені текстові поля профілю
    const textFields = [
      "full_name",
      "phone",
      "department",
      "group_name",
      "about",
      "course",
      "achievements",
      "photo",
      "position",
      "contacts",
    ]

    const nextValues = {}
    for (const key of textFields) {
      nextValues[key] = key in body ? (body[key] == null ? "" : String(body[key])) : u[key]
    }

    // ПІБ не має ставати порожнім
    const fullName = (nextValues.full_name || "").trim() || u.full_name

    // Предмети (масив) → JSONB
    const subjects = Array.isArray(body.subjects)
      ? JSON.stringify(body.subjects)
      : JSON.stringify(Array.isArray(u.subjects) ? u.subjects : [])

    const result = await pool.query(
      `UPDATE users SET
         full_name = $1,
         phone = $2,
         department = $3,
         group_name = $4,
         about = $5,
         course = $6,
         achievements = $7,
         photo = $8,
         position = $9,
         contacts = $10,
         subjects = $11::jsonb
       WHERE id = $12
       RETURNING *`,
      [
        fullName,
        nextValues.phone,
        nextValues.department,
        nextValues.group_name,
        nextValues.about,
        nextValues.course,
        nextValues.achievements,
        nextValues.photo,
        nextValues.position,
        nextValues.contacts,
        subjects,
        req.user.id,
      ],
    )
    res.json({ message: "Профіль оновлено", user: publicUser(result.rows[0]) })
  } catch (err) {
    console.error("[v0] profile error:", err.message)
    res.status(500).json({ error: "Помилка сервера при оновленні профілю" })
  }
})

// Відновлення пароля — крок 1: запит токена
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: "Введіть пошту" })
    if (!isAllowedEmail(email)) {
      return res.status(400).json({ error: `Дозволена лише пошта ${ALLOWED_DOMAIN}` })
    }

    const normEmail = email.toLowerCase().trim()
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [normEmail])

    // Завжди повертаємо однакову відповідь, щоб не розкривати наявність акаунта
    if (result.rows.length === 0) {
      return res.json({ message: "Якщо акаунт існує, токен відновлення згенеровано" })
    }

    const token = crypto.randomBytes(24).toString("hex")
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 година
    await pool.query("UPDATE users SET reset_token = $1, reset_expires = $2 WHERE email = $3", [
      token,
      expires,
      normEmail,
    ])

    // У реальній системі токен надсилається на пошту.
    // Для демо повертаємо його у відповіді.
    res.json({
      message: "Токен відновлення згенеровано (у реальній системі надсилається на пошту)",
      reset_token: token,
    })
  } catch (err) {
    console.error("[v0] forgot error:", err.message)
    res.status(500).json({ error: "Помилка сервера" })
  }
})

// Відновлення пароля — крок 2: встановлення нового пароля
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {}
    if (!token || !password) return res.status(400).json({ error: "Вкажіть токен та новий пароль" })
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Пароль має містити щонайменше 6 символів" })
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE reset_token = $1 AND reset_expires > now()",
      [token],
    )
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Недійсний або протермінований токен" })
    }

    const hash = await bcrypt.hash(password, 10)
    await pool.query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2",
      [hash, result.rows[0].id],
    )
    res.json({ message: "Пароль успішно змінено. Тепер увійдіть з новим паролем." })
  } catch (err) {
    console.error("[v0] reset error:", err.message)
    res.status(500).json({ error: "Помилка сервера" })
  }
})

// Кореневий маршрут → сторінка авторизації
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "auth.html"))
})

// Головна сторінка
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"))
})

// Сторінки профілю
app.get("/profileStudent", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profileStudent.html"))
})

app.get("/profileTeacher", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profileTeacher.html"))
})

// ------------------------- Старт -------------------------
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[v0] Сервер запущено на http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error("[v0] Помилка ініціалізації БД:", err.message)
    process.exit(1)
  })
