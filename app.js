const DATA_TEACHERS_URL = "./data/teacher_leaderboard.json";
const DATA_ABSENCE_URL = "./data/absence_leaderboard.json";

function normalizeTier(tier) {
  if (!tier) return null;
  return String(tier).trim().toUpperCase();
}

function tierLabel(tier) {
  const t = normalizeTier(tier);
  if (!t) return "-";
  if (t === "HT1") return "HT1";
  if (t === "LT1") return "LT1";
  if (t.startsWith("T")) return t;
  return t;
}

function top3Class(rank) {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "";
}

function pointsForTier(pointsByTier, tier) {
  const t = normalizeTier(tier);
  if (!t) return 0;
  return Number(pointsByTier?.[t] ?? 0);
}

function computeTeacherTotals(data) {
  const pointsByTier = data.pointsByTier || {};
  const categories = data.categories || [];

  return (data.teachers || []).map((teacher) => {
    const cat = teacher.categories || {};
    const perCategory = categories.map((c) => {
      const tier = cat[c] ?? null;
      const points = pointsForTier(pointsByTier, tier);
      return { category: c, tier: normalizeTier(tier), points };
    });

    const totalPoints = perCategory.reduce((acc, x) => acc + x.points, 0);

    return {
      ...teacher,
      perCategory,
      totalPoints,
    };
  });
}

function sortByPointsDesc(teachers) {
  return [...teachers].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return String(a.name).localeCompare(String(b.name));
  });
}

function sortByAbsenceDesc(absenceRows, teacherById) {
  return [...absenceRows].sort((a, b) => {
    if (Number(b.absentDays) !== Number(a.absentDays)) return Number(b.absentDays) - Number(a.absentDays);
    const an = teacherById.get(a.teacherId)?.name ?? "";
    const bn = teacherById.get(b.teacherId)?.name ?? "";
    return String(an).localeCompare(String(bn));
  });
}

function makeLeaderboardItem({ rank, titleHtml, subtitle, rightPills = [] }) {
  const item = document.createElement("div");
  item.className = "lb-item";

  const left = document.createElement("div");
  left.className = "lb-left";

  const primary = document.createElement("div");
  primary.className = "lb-primary";

  const rankEl = document.createElement("span");
  rankEl.className = "rank";
  rankEl.textContent = `#${rank}`;

  const titleEl = document.createElement("span");
  titleEl.className = "name";
  titleEl.innerHTML = titleHtml;

  primary.appendChild(rankEl);
  primary.appendChild(titleEl);

  const secondary = document.createElement("div");
  secondary.className = "lb-secondary";
  secondary.textContent = subtitle;

  left.appendChild(primary);
  left.appendChild(secondary);

  const right = document.createElement("div");
  right.className = "lb-right";
  for (const pillText of rightPills) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = pillText;
    right.appendChild(pill);
  }

  item.appendChild(left);
  item.appendChild(right);
  return item;
}

function setActiveNav() {
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href) return;
    const h = href.split("/").pop();
    if (h === path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function setupReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.classList.add("visible");
      }
    },
    { threshold: 0.12 }
  );

  els.forEach((el) => io.observe(el));
}

function modalApi() {
  const backdrop = document.getElementById("modalBackdrop");
  const title = document.getElementById("modalTitle");
  const meta = document.getElementById("modalMeta");
  const tableBody = document.getElementById("modalCategoryBody");
  const total = document.getElementById("modalTotalPoints");
  const closeBtn = document.getElementById("modalClose");

  function close() {
    backdrop?.classList.remove("open");
  }

  function openTeacher(teacher, pointsByTier, categories) {
    if (!backdrop || !title || !meta || !tableBody || !total) return;

    title.textContent = teacher.name;

    const metaRows = [
      ["ID", teacher.id ?? "-"],
      ["Range", teacher.range ?? "-"],
      ["Days absent", String(teacher.absentDays ?? 0)],
      ["Description", teacher.description ?? ""]
    ];

    meta.innerHTML = "";
    for (const [k, v] of metaRows) {
      const dk = document.createElement("div");
      dk.textContent = k;
      const dv = document.createElement("div");
      dv.textContent = v;
      meta.appendChild(dk);
      meta.appendChild(dv);
    }

    tableBody.innerHTML = "";
    for (const cat of categories) {
      const tier = normalizeTier(teacher.categories?.[cat]);
      const pts = pointsForTier(pointsByTier, tier);

      const tr = document.createElement("tr");
      const td1 = document.createElement("td");
      td1.textContent = cat;
      const td2 = document.createElement("td");
      td2.textContent = tierLabel(tier);
      const td3 = document.createElement("td");
      td3.textContent = String(pts);

      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tableBody.appendChild(tr);
    }

    const totalPoints = (categories || []).reduce((acc, c) => acc + pointsForTier(pointsByTier, teacher.categories?.[c]), 0);
    total.textContent = String(totalPoints);

    backdrop.classList.add("open");
  }

  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  closeBtn?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return { openTeacher, close };
}

async function loadData() {
  const [teachersRes, absenceRes] = await Promise.all([fetch(DATA_TEACHERS_URL), fetch(DATA_ABSENCE_URL)]);
  const teachersData = await teachersRes.json();
  const absenceData = await absenceRes.json();

  const teachersWithTotals = computeTeacherTotals(teachersData);
  const teachersSorted = sortByPointsDesc(teachersWithTotals);

  const teacherById = new Map();
  for (const t of teachersWithTotals) teacherById.set(t.id, t);

  const absenceSorted = sortByAbsenceDesc(absenceData.teachers || [], teacherById);

  return {
    teachersData,
    absenceData,
    teachersWithTotals,
    teachersSorted,
    teacherById,
    absenceSorted,
  };
}

function renderTop3Points(container, teachersSorted, pointsByTier, categories, modal) {
  if (!container) return;
  container.innerHTML = "";

  const top3 = teachersSorted.slice(0, 3);
  top3.forEach((t, i) => {
    const rank = i + 1;
    const cls = top3Class(rank);
    const titleHtml = `<span class="top3 ${cls}">${t.name}</span>`;
    const item = makeLeaderboardItem({
      rank,
      titleHtml,
      subtitle: "",
      rightPills: [`Points: ${t.totalPoints}`],
    });
    item.addEventListener("click", () => modal.openTeacher(t, pointsByTier, categories));
    container.appendChild(item);
  });
}

function renderTop3Absence(container, absenceSorted, teacherById, pointsByTier, categories, modal) {
  if (!container) return;
  container.innerHTML = "";

  const top3 = absenceSorted.slice(0, 3);
  top3.forEach((row, i) => {
    const rank = i + 1;
    const cls = top3Class(rank);

    const teacher = teacherById.get(row.teacherId);
    if (!teacher) return;

    const titleHtml = `<span class="top3 ${cls}">${teacher.name}</span>`;
    const item = makeLeaderboardItem({
      rank,
      titleHtml,
      subtitle: "",
      rightPills: [`Absent: ${row.absentDays}`],
    });
    item.addEventListener("click", () => modal.openTeacher(teacher, pointsByTier, categories));
    container.appendChild(item);
  });
}

function renderFullPoints(container, teachersSorted, pointsByTier, categories, modal) {
  if (!container) return;
  container.innerHTML = "";

  teachersSorted.forEach((t, idx) => {
    const rank = idx + 1;
    const isTop3 = rank <= 3;
    const titleHtml = isTop3 ? `<span class="top3 ${top3Class(rank)}">${t.name}</span>` : `${t.name}`;

    const item = makeLeaderboardItem({
      rank,
      titleHtml,
      subtitle: "",
      rightPills: [`Points: ${t.totalPoints}`],
    });

    item.addEventListener("click", () => modal.openTeacher(t, pointsByTier, categories));
    container.appendChild(item);
  });
}

function renderFullAbsence(container, absenceSorted, teacherById, pointsByTier, categories, modal) {
  if (!container) return;
  container.innerHTML = "";

  absenceSorted.forEach((row, idx) => {
    const rank = idx + 1;
    const teacher = teacherById.get(row.teacherId);
    if (!teacher) return;

    const isTop3 = rank <= 3;
    const titleHtml = isTop3 ? `<span class="top3 ${top3Class(rank)}">${teacher.name}</span>` : `${teacher.name}`;

    const item = makeLeaderboardItem({
      rank,
      titleHtml,
      subtitle: "",
      rightPills: [`Absent: ${row.absentDays}`],
    });

    item.addEventListener("click", () => modal.openTeacher(teacher, pointsByTier, categories));
    container.appendChild(item);
  });
}

async function main() {
  setActiveNav();
  setupReveal();

  const modal = modalApi();

  let data;
  try {
    data = await loadData();
  } catch (e) {
    const errs = document.querySelectorAll("[data-error-target]");
    errs.forEach((el) => (el.textContent = "Failed to load leaderboard data."));
    return;
  }

  const pointsByTier = data.teachersData.pointsByTier || {};
  const categories = data.teachersData.categories || [];

  renderTop3Points(document.getElementById("top3Points"), data.teachersSorted, pointsByTier, categories, modal);
  renderTop3Absence(document.getElementById("top3Absence"), data.absenceSorted, data.teacherById, pointsByTier, categories, modal);

  renderFullPoints(document.getElementById("fullPoints"), data.teachersSorted, pointsByTier, categories, modal);
  renderFullAbsence(document.getElementById("fullAbsence"), data.absenceSorted, data.teacherById, pointsByTier, categories, modal);
}

document.addEventListener("DOMContentLoaded", main);
