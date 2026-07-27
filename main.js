/* ==========================================================================
   APS Filtros - Main JS
   Zero dependencies, vanilla ES6+
   ========================================================================== */

(function () {
  "use strict";

  // ==========================================================================
  // Element references
  // ==========================================================================

  const skipLink = document.querySelector(".skip-link");
  const siteHeader = document.getElementById("site-header");
  const mainEl = document.querySelector("main");
  const siteFooter = document.querySelector(".site-footer");
  const navToggle = document.getElementById("nav-toggle");
  const navMenu = document.getElementById("nav-menu");
  const backToTop = document.getElementById("back-to-top");

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");
  const lightboxPrev = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");

  // Elements to remove from focus/tab order while the lightbox is open —
  // everything on the page except the lightbox itself.
  const backgroundRegions = [skipLink, siteHeader, mainEl, siteFooter].filter(Boolean);

  // ==========================================================================
  // Mobile Navigation
  // ==========================================================================

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", !isOpen);
      navMenu.classList.toggle("open");
    });

    // Close menu when a link is clicked
    navMenu.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        navToggle.setAttribute("aria-expanded", "false");
        navMenu.classList.remove("open");
      }
    });

    // Close menu on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navMenu.classList.contains("open")) {
        navToggle.setAttribute("aria-expanded", "false");
        navMenu.classList.remove("open");
      }
    });
  }

  // ==========================================================================
  // Active nav link on scroll (IntersectionObserver — no forced layout reads)
  // ==========================================================================

  const sections = document.querySelectorAll(".section[id]");
  const navLinks = document.querySelectorAll(".nav-menu a[href^='#']");

  if (sections.length && navLinks.length && "IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute("id");
          navLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );

    sections.forEach((section) => sectionObserver.observe(section));

    // The last section can't always be scrolled far enough to cross the
    // observer's band above (there's a footer after it, and nothing pulls
    // the band down to meet it), so it can get stuck showing the previous
    // section as active. Patch that specific case cheaply — one
    // getBoundingClientRect call on a single element, not a per-section
    // loop like the old scroll handler this replaced.
    const lastSection = sections[sections.length - 1];

    function highlightLastLinkPastFold() {
      if (lastSection.getBoundingClientRect().bottom > window.innerHeight + 2) return;
      navLinks.forEach((link) => link.classList.remove("active"));
      navLinks[navLinks.length - 1].classList.add("active");
    }

    window.addEventListener("scroll", highlightLastLinkPastFold, { passive: true });
    highlightLastLinkPastFold();
  }

  // ==========================================================================
  // Back to Top Button
  // ==========================================================================

  function updateBackToTopState() {
    if (!backToTop) return;
    const isVisible = window.scrollY > 400;
    backToTop.classList.toggle("visible", isVisible);
    // Out of the tab order both when scrolled-out-of-view and while the
    // lightbox is open (it's part of the inert background then too).
    backToTop.inert = !isVisible || !lightbox || !lightbox.hidden;
  }

  if (backToTop) {
    window.addEventListener("scroll", updateBackToTopState, { passive: true });
    updateBackToTopState();

    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ==========================================================================
  // Lightbox
  // ==========================================================================

  if (lightbox && lightboxImg && lightboxClose && lightboxPrev && lightboxNext) {
    let currentGallery = [];
    let currentIndex = 0;
    let lastFocusedTrigger = null;

    // Each gallery photo is a real <button>, so it's reachable and
    // activatable by keyboard, not just by mouse click.
    const galleryTriggers = document.querySelectorAll(".gallery-trigger");

    galleryTriggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const img = trigger.querySelector("img");
        const gallery = trigger.closest(".gallery");
        const galleryImages = Array.from(gallery.querySelectorAll(".gallery-trigger img"));
        currentGallery = galleryImages;
        currentIndex = galleryImages.indexOf(img);
        lastFocusedTrigger = trigger;
        openLightbox();
      });
    });

    function setBackgroundInert(isInert) {
      backgroundRegions.forEach((el) => {
        el.inert = isInert;
      });
    }

    function openLightbox() {
      const img = currentGallery[currentIndex];
      const fullSrc = img.getAttribute("data-full") || img.src;
      lightboxImg.src = fullSrc;
      lightboxImg.alt = img.alt;
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";

      const hasMultiple = currentGallery.length > 1;
      lightboxPrev.style.display = hasMultiple ? "" : "none";
      lightboxNext.style.display = hasMultiple ? "" : "none";

      setBackgroundInert(true);
      updateBackToTopState();
      lightboxClose.focus();
    }

    function closeLightbox() {
      lightbox.hidden = true;
      lightboxImg.src = "";
      document.body.style.overflow = "";

      setBackgroundInert(false);
      updateBackToTopState();

      if (lastFocusedTrigger) {
        lastFocusedTrigger.focus();
        lastFocusedTrigger = null;
      }
    }

    function showPrev() {
      currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
      updateLightboxImage();
    }

    function showNext() {
      currentIndex = (currentIndex + 1) % currentGallery.length;
      updateLightboxImage();
    }

    function updateLightboxImage() {
      const img = currentGallery[currentIndex];
      const fullSrc = img.getAttribute("data-full") || img.src;
      lightboxImg.src = fullSrc;
      lightboxImg.alt = img.alt;
    }

    lightboxClose.addEventListener("click", closeLightbox);
    lightboxPrev.addEventListener("click", showPrev);
    lightboxNext.addEventListener("click", showNext);

    // Close on backdrop click
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox || e.target === lightbox.querySelector(".lightbox-content")) {
        closeLightbox();
      }
    });

    // Keyboard navigation. The inert background keeps Tab from moving
    // focus INTO the rest of the page, but it doesn't wrap focus back to
    // the start when Tab is pressed past the last lightbox control (it
    // just runs out of focusable elements) — that part still needs
    // handling explicitly.
    document.addEventListener("keydown", (e) => {
      if (lightbox.hidden) return;

      switch (e.key) {
        case "Escape":
          closeLightbox();
          break;
        case "ArrowLeft":
          showPrev();
          break;
        case "ArrowRight":
          showNext();
          break;
        case "Tab": {
          const focusable = [lightboxClose, lightboxPrev, lightboxNext].filter(
            (el) => el.style.display !== "none"
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
          break;
        }
      }
    });
  }

  // ==========================================================================
  // Scroll Animations (fade-in on scroll)
  // ==========================================================================

  const animateElements = document.querySelectorAll(
    ".product-card, .product-cards-grid, .gallery-item, .text-block, .contact-layout, .section-subtitle"
  );

  animateElements.forEach((el) => {
    el.classList.add("fade-in");
    if (el.classList.contains("gallery-item")) {
      const gallery = el.closest(".gallery");
      const items = Array.from(gallery.querySelectorAll(".gallery-item"));
      el.style.setProperty("--item-index", items.indexOf(el));
    }
  });

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reveal everything immediately if the browser can't run the reveal
  // animation at all (no IntersectionObserver) or the user asked for
  // reduced motion — content must never depend on JS to become visible.
  if (!prefersReducedMotion && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    animateElements.forEach((el) => revealObserver.observe(el));
  } else {
    animateElements.forEach((el) => el.classList.add("visible"));
  }
})();
