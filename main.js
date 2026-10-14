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
  const lightboxContent = lightbox ? lightbox.querySelector(".lightbox-content") : null;
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

    // Close menu on escape key, returning focus to the toggle if it was
    // inside the menu (otherwise it would be stranded on a hidden link)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navMenu.classList.contains("open")) {
        const focusWasInMenu = navMenu.contains(document.activeElement);
        navToggle.setAttribute("aria-expanded", "false");
        navMenu.classList.remove("open");
        if (focusWasInMenu) navToggle.focus();
      }
    });
  }

  // ==========================================================================
  // Language switcher (<details>) — close on outside click and Escape
  // ==========================================================================

  const langSwitcher = document.querySelector(".lang-switcher details");

  if (langSwitcher) {
    document.addEventListener("click", (e) => {
      if (langSwitcher.open && !langSwitcher.contains(e.target)) {
        langSwitcher.open = false;
      }
    });

    langSwitcher.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && langSwitcher.open) {
        e.stopPropagation();
        langSwitcher.open = false;
        langSwitcher.querySelector("summary").focus();
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

  if (lightbox && lightboxContent && lightboxClose && lightboxPrev && lightboxNext) {
    // Created here rather than in the markup: an <img> needs a non-empty src
    // to be valid HTML, and there's nothing to show until a photo is opened.
    // A <picture> lets the browser take the WebP (about half the size) and
    // fall back to the JPEG on its own.
    const lightboxPicture = document.createElement("picture");
    const lightboxWebp = document.createElement("source");
    lightboxWebp.type = "image/webp";
    const lightboxImg = document.createElement("img");
    lightboxPicture.append(lightboxWebp, lightboxImg);
    lightboxContent.appendChild(lightboxPicture);

    const lightboxCounter = lightbox.querySelector(".lightbox-counter");
    const counterTemplate = lightbox.getAttribute("data-counter") || "{n} / {total}";

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
      updateLightboxImage();
      lightbox.hidden = false;
      // Next frame, so the opacity transition starts from the hidden state
      requestAnimationFrame(() => lightbox.classList.add("is-open"));
      document.body.style.overflow = "hidden";

      const hasMultiple = currentGallery.length > 1;
      lightboxPrev.style.display = hasMultiple ? "" : "none";
      lightboxNext.style.display = hasMultiple ? "" : "none";

      setBackgroundInert(true);
      updateBackToTopState();
      lightboxClose.focus();
    }

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      lightbox.hidden = true;
      lightboxWebp.removeAttribute("srcset");
      lightboxImg.removeAttribute("src");
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
      const webp = img.getAttribute("data-full-webp");
      if (webp) lightboxWebp.srcset = webp;
      else lightboxWebp.removeAttribute("srcset");
      lightboxImg.src = img.getAttribute("data-full") || img.src;
      lightboxImg.alt = img.alt;
      if (lightboxCounter) {
        lightboxCounter.textContent =
          currentGallery.length > 1
            ? counterTemplate.replace("{n}", currentIndex + 1).replace("{total}", currentGallery.length)
            : "";
      }
    }

    lightboxClose.addEventListener("click", closeLightbox);
    lightboxPrev.addEventListener("click", showPrev);
    lightboxNext.addEventListener("click", showNext);

    // A swipe that starts on the photo and ends on the backdrop also produces
    // a click on the backdrop — that one must not close the lightbox.
    let ignoreNextClick = false;

    // Close on backdrop click
    lightbox.addEventListener("click", (e) => {
      if (ignoreNextClick) {
        ignoreNextClick = false;
        return;
      }
      if (e.target === lightbox || e.target === lightboxContent) {
        closeLightbox();
      }
    });

    // Swipe left/right on touch screens. Ignored while pinch-zoomed, so
    // panning around a zoomed photo doesn't change it.
    let swipeStartX = null;
    lightbox.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" && e.isPrimary) swipeStartX = e.clientX;
    });
    lightbox.addEventListener("pointerup", (e) => {
      if (swipeStartX === null) return;
      const dx = e.clientX - swipeStartX;
      swipeStartX = null;
      const zoomed = window.visualViewport && window.visualViewport.scale > 1.01;
      if (zoomed || Math.abs(dx) < 50 || currentGallery.length < 2) return;
      ignoreNextClick = true;
      setTimeout(() => (ignoreNextClick = false), 400);
      if (dx < 0) showNext();
      else showPrev();
    });
    lightbox.addEventListener("pointercancel", () => {
      swipeStartX = null;
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
    ".product-card, .gallery-item, .text-block, .contact-layout, .section-subtitle"
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
