/* ============================================================
   REVEAL ON SCROLL
   ============================================================ */
document.querySelectorAll(".reveal").forEach((el) => {
  new IntersectionObserver(
    ([entry], observer) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.disconnect();
      }
    },
    { threshold: 0.12 }
  ).observe(el);
});

/* ============================================================
   PROJECT TIMELINE: center line fills as you scroll
   ============================================================ */
const timeline = document.getElementById("tl");
if (timeline) {
  let queued = 0;
  const update = () => {
    queued = 0;
    const r = timeline.getBoundingClientRect();
    const p = (innerHeight * 0.6 - r.top) / r.height;
    timeline.style.setProperty("--p", Math.min(1, Math.max(0, p)).toFixed(4));
  };
  const queue = () => { if (!queued) queued = requestAnimationFrame(update); };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  update();
}

document.addEventListener("DOMContentLoaded", () => {
  /* ==========================================================
     CERTIFICATE LIGHTBOX
     ========================================================== */
  const certBox = document.getElementById("cert-lightbox");
  const certImg = document.getElementById("cert-lightbox-img");
  const certImages = () => [...document.querySelectorAll(".cert-img")];
  let certIndex = 0;

  const showCert = (n) => {
    const list = certImages();
    if (!list.length) return;
    certIndex = (n + list.length) % list.length;
    certImg.style.opacity = 0;
    setTimeout(() => {
      certImg.src = list[certIndex].src;
      certImg.style.opacity = 1;
    }, 150);
  };
  const closeCert = () => certBox.classList.remove("open");

  certImages().forEach((img, k) => {
    img.addEventListener("click", () => {
      certIndex = k;
      certImg.src = img.src;
      certBox.classList.add("open");
    });
  });

  document.getElementById("cert-lightbox-prev").onclick = (e) => { e.stopPropagation(); showCert(certIndex - 1); };
  document.getElementById("cert-lightbox-next").onclick = (e) => { e.stopPropagation(); showCert(certIndex + 1); };
  certBox.onclick = (e) => { if (e.target === certBox) closeCert(); };

  document.addEventListener("keydown", (e) => {
    if (!certBox.classList.contains("open")) return;
    if (e.key === "Escape") closeCert();
    if (e.key === "ArrowLeft") showCert(certIndex - 1);
    if (e.key === "ArrowRight") showCert(certIndex + 1);
  });

  /* ==========================================================
     PROJECT PHOTO GALLERY  (opens at the photo you clicked)
     ========================================================== */
  const photoBox = document.getElementById("photo-lightbox");
  const photoImg = document.getElementById("photo-lightbox-img");
  const photoCount = document.getElementById("photo-lightbox-count");
  let photos = [];
  let photoIndex = 0;

  const drawPhoto = () => {
    photoImg.src = photos[photoIndex];
    photoCount.textContent = photoIndex + 1 + " / " + photos.length;
  };
  const closePhoto = () => {
    photoBox.classList.remove("open");
    photoBox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };
  const stepPhoto = (dir) => {
    if (photos.length < 2) return;
    photoIndex = (photoIndex + dir + photos.length) % photos.length;
    drawPhoto();
  };

  document.querySelectorAll(".tl-photo").forEach((fig) => {
    const group = fig.closest("[data-photos]");
    const list = (group ? group.dataset.photos : "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;

    const img = fig.querySelector("img");
    if (img) img.addEventListener("error", () => { fig.style.display = "none"; });

    const open = () => {
      photos = list;
      photoIndex = Math.min(+fig.dataset.start || 0, list.length - 1);
      photoBox.classList.toggle("single", list.length < 2);
      drawPhoto();
      photoBox.classList.add("open");
      photoBox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    };
    fig.onclick = open;
    fig.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    };
  });

  document.getElementById("photo-lightbox-prev").onclick = (e) => { e.stopPropagation(); stepPhoto(-1); };
  document.getElementById("photo-lightbox-next").onclick = (e) => { e.stopPropagation(); stepPhoto(1); };
  document.getElementById("photo-lightbox-close").onclick = closePhoto;
  photoBox.onclick = (e) => { if (e.target === photoBox) closePhoto(); };

  document.addEventListener("keydown", (e) => {
    if (!photoBox.classList.contains("open")) return;
    if (e.key === "Escape") closePhoto();
    if (e.key === "ArrowLeft") stepPhoto(-1);
    if (e.key === "ArrowRight") stepPhoto(1);
  });
});

/* swipe left / right inside the photo lightbox (touch screens) */
document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("photo-lightbox");
  if (!box) return;
  let x0 = null;
  box.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) document.getElementById(dx < 0 ? "photo-lightbox-next" : "photo-lightbox-prev").click();
  });
});

/* ============================================================
   LIGHTBOX SIZE: sets the photo size in pixels, straight on the <img>
   (inline !important, so no stylesheet rule can shrink it).
   Tweak BIG to change it: 0.96 = 96% of the screen width.
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const BIG = 0.96;      // share of screen width the photo may use
  const BOTTOM = 100;    // px kept free at the bottom (counter) and top

  const fit = (box, img) => {
    if (!box || !img) return;
    const mobile = innerWidth < 640;
    const w = Math.round(innerWidth * (mobile ? 0.98 : BIG));
    const h = Math.round(innerHeight - (mobile ? 190 : BOTTOM));
    const set = (k, v) => img.style.setProperty(k, v, "important");
    set("width", w + "px");
    set("height", h + "px");
    set("max-width", "none");
    set("max-height", "none");
    set("object-fit", "contain");
    set("flex", "none");
  };

  [["photo-lightbox", "photo-lightbox-img"], ["cert-lightbox", "cert-lightbox-img"]].forEach(([b, i]) => {
    const box = document.getElementById(b);
    const img = document.getElementById(i);
    if (!box || !img) return;
    new MutationObserver(() => { if (box.classList.contains("open")) fit(box, img); })
      .observe(box, { attributes: true, attributeFilter: ["class"] });
    addEventListener("resize", () => { if (box.classList.contains("open")) fit(box, img); });
    fit(box, img);
  });
});

/* ============================================================
   MOBILE MENU (hamburger)
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("menu-btn");
  const nav = document.getElementById("primary-nav");
  if (!btn || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    btn.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.documentElement.classList.toggle("menu-open", open);
  };

  btn.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  addEventListener("resize", () => { if (innerWidth > 1023) setOpen(false); });
});