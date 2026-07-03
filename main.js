/* ==========================================================================
   APS Filtros - Main JS
   Zero dependencies, vanilla ES6+
   ========================================================================== */

(function () {
  "use strict";

  // ==========================================================================
  // Mobile Navigation
  // ==========================================================================

  const navToggle = document.getElementById("nav-toggle");
  const navMenu = document.getElementById("nav-menu");

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

  // ==========================================================================
  // Active nav link on scroll
  // ==========================================================================

  const sections = document.querySelectorAll(".section[id]");
  const navLinks = document.querySelectorAll(".nav-menu a[href^='#']");

  function setActiveLink() {
    const scrollPos = window.scrollY + 100;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute("id");

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach((link) => {
          link.classList.remove("active");
          if (link.getAttribute("href") === "#" + id) {
            link.classList.add("active");
          }
        });
      }
    });
  }

  window.addEventListener("scroll", setActiveLink, { passive: true });
  setActiveLink();

  // ==========================================================================
  // Lightbox
  // ==========================================================================

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");
  const lightboxPrev = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");

  let currentGallery = [];
  let currentIndex = 0;

  // Collect all gallery images
  const galleryItems = document.querySelectorAll(".gallery-item img");

  galleryItems.forEach((img) => {
    img.addEventListener("click", () => {
      // Find which gallery this image belongs to
      const gallery = img.closest(".gallery");
      const galleryImages = gallery.querySelectorAll(".gallery-item img");
      currentGallery = Array.from(galleryImages);
      currentIndex = currentGallery.indexOf(img);
      openLightbox();
    });
  });

  function openLightbox() {
    const img = currentGallery[currentIndex];
    const fullSrc = img.getAttribute("data-full") || img.src;
    lightboxImg.src = fullSrc;
    lightboxImg.alt = img.alt;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";

    // Show/hide nav buttons based on gallery size
    const hasMultiple = currentGallery.length > 1;
    lightboxPrev.style.display = hasMultiple ? "" : "none";
    lightboxNext.style.display = hasMultiple ? "" : "none";
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.style.overflow = "";
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

  // Keyboard navigation in lightbox
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
    }
  });

  // ==========================================================================
  // i18n - Internationalization
  // ==========================================================================

  const langSelect = document.getElementById("lang-select");
  const STORAGE_KEY = "aps-lang";

  const i18n = {
    currentLang: "pt-BR",
    translations: {},

    async loadLanguage(lang) {
      if (this.translations[lang]) return true;
      try {
        const response = await fetch(`lang/${lang}.json`);
        if (!response.ok) return false;
        this.translations[lang] = await response.json();
        return true;
      } catch (e) {
        console.warn(`Failed to load language: ${lang}`, e);
        return false;
      }
    },

    apply(lang) {
      if (!this.translations[lang]) return;
      this.currentLang = lang;
      document.documentElement.lang = lang;

      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        const value = this.getNestedValue(this.translations[lang], key);
        if (value) {
          el.textContent = value;
        }
      });
    },

    getNestedValue(obj, path) {
      return path.split(".").reduce((acc, part) => acc && acc[part], obj);
    },
  };

  // Language switcher event
  langSelect.addEventListener("change", async () => {
    const lang = langSelect.value;
    const loaded = await i18n.loadLanguage(lang);
    if (loaded) {
      i18n.apply(lang);
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (e) {
        // localStorage not available, ignore
      }
    }
  });

  // Load saved language on page load
  async function initLanguage() {
    let savedLang = null;
    try {
      savedLang = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      // localStorage not available
    }

    // If no saved preference, detect browser language
    if (!savedLang) {
      const browserLang = navigator.language || navigator.userLanguage || "pt-BR";
      const supported = ["pt-BR", "en", "es", "fr", "vi", "zh"];
      // Try exact match first, then prefix match
      savedLang = supported.find(l => l === browserLang)
        || supported.find(l => browserLang.startsWith(l.split("-")[0]))
        || null;
    }

    if (savedLang && savedLang !== "pt-BR") {
      const loaded = await i18n.loadLanguage(savedLang);
      if (loaded) {
        i18n.apply(savedLang);
        langSelect.value = savedLang;
      }
    }
  }

  initLanguage();

  // Expose i18n for external use
  window.apsI18n = i18n;

  // ==========================================================================
  // Scroll Animations (fade-in on scroll)
  // ==========================================================================

  const animateElements = document.querySelectorAll(
    ".product-card, .product-cards-grid, .gallery-item, .text-block, .contact-layout, .section-subtitle"
  );

  // Add fade-in class and stagger index for gallery items
  animateElements.forEach((el) => {
    el.classList.add("fade-in");
    if (el.classList.contains("gallery-item")) {
      const gallery = el.closest(".gallery");
      const items = Array.from(gallery.querySelectorAll(".gallery-item"));
      el.style.setProperty("--item-index", items.indexOf(el));
    }
  });

  // Respect reduced motion preference
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!prefersReducedMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    animateElements.forEach((el) => observer.observe(el));
  } else {
    // If reduced motion, just show everything
    animateElements.forEach((el) => el.classList.add("visible"));
  }

  // ==========================================================================
  // Back to Top Button
  // ==========================================================================

  const backToTop = document.getElementById("back-to-top");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 400) {
      backToTop.classList.add("visible");
    } else {
      backToTop.classList.remove("visible");
    }
  }, { passive: true });

  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
