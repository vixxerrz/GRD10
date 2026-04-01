const DATA_TEACHERS_URL = "./data/teacher_leaderboard.json";
const DATA_ABSENCE_URL = "./data/absence_leaderboard.json";

function normalizeTier(tier) {
  if (!tier) return null;
  return String(tier).trim().toUpperCase();
}

function tierLabel(tier) {
  const t = normalizeTier(tier);
  if (!t) return "-";
  // Handle all LT and HT tiers
  if (t.startsWith("LT") || t.startsWith("HT")) return t;
  // Handle regular T tiers
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

function sortByAbsenceDesc(teachers) {
  return [...teachers].sort((a, b) => {
    if (Number(b.lessonsMissed) !== Number(a.lessonsMissed)) return Number(b.lessonsMissed) - Number(a.lessonsMissed);
    return String(a.name).localeCompare(String(b.name));
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

function setupSlidingNav() {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  
  const navItems = nav.querySelectorAll("a");
  
  function updateSlidingBg(targetItem) {
    if (!targetItem) return;
    
    const rect = targetItem.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    
    // Create or update sliding background
    let slidingBg = nav.querySelector(".nav-sliding-bg");
    if (!slidingBg) {
      slidingBg = document.createElement("div");
      slidingBg.className = "nav-sliding-bg";
      nav.appendChild(slidingBg);
    }
    
    slidingBg.style.cssText = `
      position: absolute;
      bottom: 0;
      left: ${rect.left - navRect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: -1;
      opacity: 1;
    `;
  }
  
  navItems.forEach(item => {
    item.addEventListener("mouseenter", () => updateSlidingBg(item));
    item.addEventListener("focus", () => updateSlidingBg(item));
  });
  
  nav.addEventListener("mouseleave", () => {
    const slidingBg = nav.querySelector(".nav-sliding-bg");
    if (slidingBg) {
      slidingBg.style.opacity = "0";
    }
  });
  
  // Set initial position for active page
  const activeItem = nav.querySelector("a[aria-current='page']");
  if (activeItem) {
    updateSlidingBg(activeItem);
  }
}

function setupSlidingHover() {
  // Setup sliding hover for leaderboard items
  const lbContainers = document.querySelectorAll(".lb-list");
  lbContainers.forEach(container => {
    const items = container.querySelectorAll(".lb-item");
    
    // Create sliding background once
    let slidingBg = container.querySelector(".sliding-hover-bg");
    if (!slidingBg) {
      slidingBg = document.createElement("div");
      slidingBg.className = "sliding-hover-bg";
      slidingBg.style.cssText = `
        position: absolute;
        background: rgba(34, 197, 94, 0.08);
        border: 1px solid rgba(34, 197, 94, 0.45);
        border-radius: var(--radius);
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: -1;
        opacity: 0;
        pointer-events: none;
      `;
      container.style.position = "relative";
      container.appendChild(slidingBg);
    }
    
    function updateSlidingHover(targetItem) {
      if (!targetItem) return;
      
      const rect = targetItem.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Calculate position relative to container
      const top = rect.top - containerRect.top;
      const left = rect.left - containerRect.left;
      
      // Update position and size
      slidingBg.style.transform = `translate(${left}px, ${top}px)`;
      slidingBg.style.width = `${rect.width}px`;
      slidingBg.style.height = `${rect.height}px`;
      slidingBg.style.opacity = "1";
      
      console.log('Sliding to:', { top, left, width: rect.width, height: rect.height });
    }
    
    items.forEach((item, index) => {
      item.addEventListener("mouseenter", () => {
        console.log(`Hovering item ${index}`);
        updateSlidingHover(item);
      });
    });
    
    container.addEventListener("mouseleave", () => {
      console.log('Mouse left container');
      slidingBg.style.opacity = "0";
    });
  });
}

function modalApi() {
  const backdrop = document.getElementById("modalBackdrop");
  const title = document.getElementById("modalTitle");
  const meta = document.getElementById("modalMeta");
  const totalPoints = document.getElementById("modalTotalPoints");
  const description = document.getElementById("modalDescription");
  const categoryBody = document.getElementById("modalCategoryBody");
  const closeBtn = document.getElementById("modalClose");

  function close() {
    if (!backdrop) return;
    
    // Add closing class for outro animation
    backdrop.classList.add("closing");
    
    // Wait for animation to complete before removing open class
    setTimeout(() => {
      backdrop.classList.remove("open", "closing");
    }, 250);
  }

  function open(teacher, pointsByTier, categories, clickEvent = null) {
    if (!backdrop || !title || !meta || !totalPoints || !description || !categoryBody) return;

    title.textContent = teacher.name;
    meta.innerHTML = `
      <div>ID</div>
      <div>${teacher.id}</div>
      <div>Range</div>
      <div>${teacher.range}</div>
      <div>Lessons Missed</div>
      <div>${teacher.lessonsMissed}</div>
    `;
    totalPoints.textContent = teacher.totalPoints;
    description.textContent = teacher.description || "No description available";

    // Show categories
    categoryBody.innerHTML = categories.map((cat) => {
      const tier = normalizeTier(teacher.categories?.[cat]);
      const points = pointsForTier(pointsByTier, tier);
      return `
        <tr>
          <td>${cat}</td>
          <td>${tierLabel(tier)}</td>
          <td>${points}</td>
        </tr>
      `;
    }).join("");

    backdrop.classList.add("open");
  }

  // Close on backdrop click
  backdrop?.addEventListener("click", function(e) {
    if (e.target === backdrop) {
      close();
    }
  });

  // Close on button click
  closeBtn?.addEventListener("click", close);

  // Close on Escape key
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && backdrop?.classList.contains("open")) {
      close();
    }
  });

  return { open, close };
}

async function loadData() {
  const teachersRes = await fetch(DATA_TEACHERS_URL);
  const teachersData = await teachersRes.json();

  const teachersWithTotals = computeTeacherTotals(teachersData);
  const teachersSorted = sortByPointsDesc(teachersWithTotals);

  // Use teacher data for absence leaderboard instead of separate file
  const absenceSorted = sortByAbsenceDesc(teachersData.teachers || []);

  return {
    teachersData,
    teachersWithTotals,
    teachersSorted,
    absenceSorted,
  };
}

function renderTimetable(container, teachersData) {
  if (!container) return;
  
  const timetable = teachersData.timetable;
  if (!timetable || !timetable.tomorrow) {
    container.innerHTML = '<div class="lb-item"><div class="lb-left"><div class="lb-primary"><span class="name">No timetable data available</span></div></div></div>';
    return;
  }
  
  const tomorrow = timetable.tomorrow;
  const date = tomorrow.date || 'Tomorrow';
  
  // Create title element outside of container
  const titleDiv = document.createElement('div');
  titleDiv.style.cssText = 'color: var(--text); font-size: 16px; font-weight: 600; margin-bottom: 8px; text-align: center;';
  titleDiv.textContent = `Timetable tomorrow ${date}`;
  
  // Insert title before the container
  container.parentNode.insertBefore(titleDiv, container);
  
  // Create horizontal container for timetable items - more compact
  const horizontalContainer = document.createElement('div');
  horizontalContainer.style.cssText = `display: flex; gap: ${window.innerWidth <= 640 ? '1px' : '2px'}; justify-content: center;`;
  
  // Create timetable items styled like leaderboard items
  (tomorrow.subjects || []).forEach((subject, index) => {
    const item = document.createElement('div');
    item.className = 'lb-item';
    
    // More space-efficient sizing on desktop, much smaller on mobile
    const itemWidth = window.innerWidth <= 640 ? 
      Math.floor((window.innerWidth - 32) / 10) : 
      Math.min(100, Math.floor((window.innerWidth - 32) / 6)); // Smaller max width
    
    item.style.cssText = `width: ${itemWidth}px; flex-shrink: 0; text-align: center; display: flex; justify-content: center; align-items: center; padding: ${window.innerWidth <= 640 ? '1px' : '8px 4px'}; min-height: ${window.innerWidth <= 640 ? '35px' : 'auto'}; border-radius: ${window.innerWidth <= 640 ? '10px' : 'var(--radius)'};`;
    
    item.innerHTML = `
      <div class="lb-left" style="width: 100%; display: flex; justify-content: center; align-items: center;">
        <div class="lb-primary" style="justify-content: center; align-items: center; text-align: center; display: flex; flex-direction: column; gap: 2px;">
          <span class="name" style="text-align: center;">${subject.subject || ''}</span>
        </div>
      </div>
    `;
    
    horizontalContainer.appendChild(item);
  });
  
  container.innerHTML = '';
  container.appendChild(horizontalContainer);
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
    item.addEventListener("click", (e) => modal.open(t, pointsByTier, categories, e));
    container.appendChild(item);
  });
}

function renderTop3Absence(container, absenceSorted, pointsByTier, categories, modal) {
  if (!container) return;
  container.innerHTML = "";

  const top3 = absenceSorted.slice(0, 3);
  top3.forEach((teacher, i) => {
    const rank = i + 1;
    const cls = top3Class(rank);

    const titleHtml = `<span class="top3 ${cls}">${teacher.name}</span>`;
    const item = makeLeaderboardItem({
      rank,
      titleHtml,
      subtitle: "",
      rightPills: [`Missed: ${teacher.lessonsMissed}`],
    });
    item.addEventListener("click", (e) => modal.open(teacher, pointsByTier, categories, e));
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

    item.addEventListener("click", (e) => modal.open(t, pointsByTier, categories, e));
    container.appendChild(item);
  });
}

function renderFullAbsence(container, absenceSorted, pointsByTier, categories, modal) {
  if (!container) return;
  container.innerHTML = "";

  absenceSorted.forEach((teacher, idx) => {
    const rank = idx + 1;
    const isTop3 = rank <= 3;
    const titleHtml = isTop3 ? `<span class="top3 ${top3Class(rank)}">${teacher.name}</span>` : `${teacher.name}`;

    const item = makeLeaderboardItem({
      rank,
      titleHtml,
      subtitle: "",
      rightPills: [`Missed: ${teacher.lessonsMissed}`],
    });

    item.addEventListener("click", (e) => modal.open(teacher, pointsByTier, categories, e));
    container.appendChild(item);
  });
}

async function main() {
  setActiveNav();
  setupReveal();
  setupSlidingNav();
  setupSlidingHover();

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
  renderTop3Absence(document.getElementById("top3Absence"), data.absenceSorted, pointsByTier, categories, modal);
  
  renderTimetable(document.getElementById("timetableContainer"), data.teachersData);

  renderFullPoints(document.getElementById("fullPoints"), data.teachersSorted, pointsByTier, categories, modal);
  renderFullAbsence(document.getElementById("fullAbsence"), data.absenceSorted, pointsByTier, categories, modal);
}

document.addEventListener("DOMContentLoaded", main);

// Handle page transitions - DISABLED FOR TESTING
// document.addEventListener("click", function(e) {
//   const link = e.target.closest("a");
//   if (link && link.href && link.hostname === window.location.hostname) {
//     e.preventDefault();
//     document.body.classList.add("page-transition");
//     setTimeout(() => {
//       window.location.href = link.href;
//     }, 50);
//   }
// });

// Remove transition class when page loads
window.addEventListener("pageshow", function() {
  document.body.classList.remove("page-transition");
});

// Image preview modal functionality
function imageModalApi() {
  const backdrop = document.getElementById("imageModalBackdrop");
  const title = document.getElementById("imageModalTitle");
  const img = document.getElementById("imageModalImg");
  const closeBtn = document.getElementById("imageModalClose");

  function close() {
    if (!backdrop) return;
    
    // Add closing class for outro animation
    backdrop.classList.add("closing");
    
    // Wait for animation to complete before cleaning up
    setTimeout(() => {
      backdrop.classList.remove("open", "closing");
      img.src = "";
      img.alt = "";
    }, 250);
  }

  function openImage(imageSrc, imageTitle, clickEvent = null) {
    if (!backdrop || !title || !img) return;

    title.textContent = imageTitle;
    img.src = imageSrc;
    img.alt = imageTitle;
    
    backdrop.classList.add("open");
  }

  // Close on backdrop click
  backdrop?.addEventListener("click", function(e) {
    if (e.target === backdrop) {
      close();
    }
  });

  // Close on button click
  closeBtn?.addEventListener("click", close);

  // Close on Escape key
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && backdrop?.classList.contains("open")) {
      close();
    }
  });

  return { openImage, close };
}

// Initialize image modal
const imageModal = imageModalApi();

// Handle image resource clicks
document.addEventListener("click", function(e) {
  const resourceLink = e.target.closest(".resource[data-image]");
  if (resourceLink) {
    e.preventDefault();
    const imageSrc = resourceLink.dataset.image;
    const imageTitle = resourceLink.dataset.title;
    imageModal.openImage(imageSrc, imageTitle, e);
  }
});
