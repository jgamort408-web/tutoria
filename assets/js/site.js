(function () {
  const baseLanguage = "es";
  const folder = detectFolder();
  const depth = calculateDepth();
  const prefix = "../".repeat(depth);

  const navItems = [
    { key: "inicio",    label: "Inicio",         icon: "house",                href: `${prefix}index.html` },
    { key: "cursos",    label: "Cursos",          icon: "graduation-cap",       href: `${prefix}cursos/index.html` },
    { key: "estudio",   label: "Estudio",         icon: "book-open",            href: `${prefix}estudio/index.html` },
    { key: "emociones", label: "Emociones",       icon: "heart",                href: `${prefix}emociones/index.html` },
    { key: "8marzo",    label: "8M y ciudadanía", icon: "venus",                href: `${prefix}8marzo/index.html` },
    { key: "evacuacion",label: "Evacuación",      icon: "triangle-exclamation", href: `${prefix}evacuacion/index.html` },
    { key: "evaluacion",label: "Evaluación",      icon: "chart-line",           href: `${prefix}evaluacion/index.html` }
  ];

  const themes = {
    estudio:    { label: "Técnicas de estudio",    home: `${prefix}estudio/index.html` },
    emociones:  { label: "Educación emocional",    home: `${prefix}emociones/index.html` },
    "8marzo":   { label: "8M y ciudadanía",         home: `${prefix}8marzo/index.html` },
    evacuacion: { label: "Seguridad y convivencia", home: `${prefix}evacuacion/index.html` },
    evaluacion: { label: "Seguimiento tutorial",    home: `${prefix}evaluacion/index.html` },
    cursos:     { label: "Itinerarios por curso",   home: `${prefix}cursos/index.html` },
    inicio:     { label: "Portada",                 home: `${prefix}index.html` }
  };

  const themeColors = {
    estudio:    "#065f46",
    emociones:  "#92400e",
    "8marzo":   "#881337",
    evacuacion: "#7f1d1d",
    evaluacion: "#3730a3",
    cursos:     "#1e3a8a",
    inicio:     "#1e40af"
  };

  document.body.dataset.theme = folder.theme;
  document.body.classList.add("site-ready");

  injectHeadMeta();
  injectHeader();
  injectBreadcrumbs();
  injectFooter();
  wrapMain();
  autoReveal();
  setupTranslator();
  setupScrollReveal();
  setupMobileMenu();

  /* ── Folder detection ───────────────────────────────────── */
  function detectFolder() {
    const p = window.location.pathname.replace(/\\/g, "/").toLowerCase();
    if (p.includes("/estudio/"))    return { key: "estudio",    theme: "estudio" };
    if (p.includes("/emociones/"))  return { key: "emociones",  theme: "emociones" };
    if (p.includes("/8marzo/"))     return { key: "8marzo",     theme: "8marzo" };
    if (p.includes("/evacuacion/")) return { key: "evacuacion", theme: "evacuacion" };
    if (p.includes("/evaluacion/")) return { key: "evaluacion", theme: "evaluacion" };
    if (p.includes("/cursos/"))     return { key: "cursos",     theme: "cursos" };
    return { key: "inicio", theme: "cursos" };
  }

  function calculateDepth() {
    const filename = window.location.pathname.split("/").pop() || "";
    return (filename.toLowerCase() === "index.html" && folder.key === "inicio") || folder.key === "inicio" ? 0 : 1;
  }

  /* ── Head meta injection ────────────────────────────────── */
  function injectHeadMeta() {
    if (!document.querySelector('link[rel="icon"]')) {
      const el = document.createElement("link");
      el.rel = "icon"; el.type = "image/svg+xml";
      el.href = `${prefix}assets/icons/icon.svg`;
      document.head.prepend(el);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const el = document.createElement("link");
      el.rel = "apple-touch-icon";
      el.href = `${prefix}assets/icons/icon.svg`;
      document.head.appendChild(el);
    }
    if (!document.querySelector('link[rel="manifest"]')) {
      const el = document.createElement("link");
      el.rel = "manifest"; el.href = `${prefix}manifest.json`;
      document.head.appendChild(el);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const el = document.createElement("meta");
      el.name = "theme-color";
      el.content = themeColors[folder.theme] || "#1e40af";
      document.head.appendChild(el);
    }
    if (!document.querySelector('link[data-fa]')) {
      const el = document.createElement("link");
      el.rel = "stylesheet";
      el.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css";
      el.crossOrigin = "anonymous";
      el.dataset.fa = "true";
      document.head.appendChild(el);
    }
  }

  /* ── Header ─────────────────────────────────────────────── */
  function injectHeader() {
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = `
      <div class="site-header__inner">
        <a class="site-brand" href="${prefix}index.html" aria-label="Ir a la portada de Tutoría Activa">
          <span class="site-brand__mark" aria-hidden="true">
            <i class="fa-solid fa-chalkboard-user"></i>
          </span>
          <span class="site-brand__text">
            <span class="site-brand__eyebrow">Tutoría Activa</span>
            <span class="site-brand__title">ESO · Plataforma docente</span>
          </span>
        </a>
        <button class="site-nav-toggle" aria-label="Abrir menú de navegación" aria-expanded="false" aria-controls="site-nav">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
        <nav class="site-nav" id="site-nav" aria-label="Navegación principal">
          ${navItems.map(item => {
            const active = item.key === folder.key ? " is-active" : "";
            return `<a class="site-nav__link${active}" href="${item.href}">
              <i class="fa-solid fa-${item.icon}" aria-hidden="true"></i>
              <span>${item.label}</span>
            </a>`;
          }).join("")}
        </nav>
      </div>
    `;
    document.body.prepend(header);
  }

  /* ── Breadcrumbs ────────────────────────────────────────── */
  function injectBreadcrumbs() {
    const crumbs = [{ label: "Inicio", href: `${prefix}index.html` }];

    if (folder.key !== "inicio") {
      const section = themes[folder.key];
      crumbs.push({ label: section.label, href: section.home });
    }

    const pageTitle = findPageTitle();
    if (pageTitle && folder.key !== "inicio" && pageTitle !== themes[folder.key].label) {
      crumbs.push({ label: pageTitle });
    }

    if (crumbs.length === 1 && folder.key === "inicio") return;

    const nav = document.createElement("nav");
    nav.className = "site-breadcrumbs";
    nav.setAttribute("aria-label", "Migas de pan");
    nav.innerHTML = crumbs.map((crumb, index) => {
      const isLast = index === crumbs.length - 1 || !crumb.href;
      if (isLast) return `<span aria-current="page">${crumb.label}</span>`;
      return `<a href="${crumb.href}">${crumb.label}</a><span aria-hidden="true" class="bc-sep"><i class="fa-solid fa-chevron-right"></i></span>`;
    }).join("");

    const header = document.querySelector(".site-header");
    if (header && header.nextSibling) {
      document.body.insertBefore(nav, header.nextSibling);
    } else {
      document.body.appendChild(nav);
    }
  }

  /* ── Footer ─────────────────────────────────────────────── */
  function injectFooter() {
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="site-footer__inner">
        <div class="site-footer__grid">
          <section class="footer-about">
            <div class="footer-logo">
              <span class="footer-logo__mark" aria-hidden="true"><i class="fa-solid fa-chalkboard-user"></i></span>
              <span class="footer-logo__name">Tutoría Activa</span>
            </div>
            <p>Base compartida para trabajar tutoría en ESO con navegación clara, bloques temáticos y actividades interactivas conectadas.</p>
            <ul class="footer-tags">
              <li><i class="fa-solid fa-check" aria-hidden="true"></i> Diseño común</li>
              <li><i class="fa-solid fa-check" aria-hidden="true"></i> Aprendizaje activo</li>
              <li><i class="fa-solid fa-check" aria-hidden="true"></i> Secundaria ESO</li>
            </ul>
          </section>

          <section>
            <h3><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Bloques</h3>
            <ul class="footer-links">
              <li><a href="${prefix}estudio/index.html"><i class="fa-solid fa-book-open" aria-hidden="true"></i>Estudio</a></li>
              <li><a href="${prefix}emociones/index.html"><i class="fa-solid fa-heart" aria-hidden="true"></i>Emociones</a></li>
              <li><a href="${prefix}8marzo/index.html"><i class="fa-solid fa-venus" aria-hidden="true"></i>8M y ciudadanía</a></li>
              <li><a href="${prefix}evacuacion/index.html"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>Evacuación</a></li>
            </ul>
          </section>

          <section>
            <h3><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> Itinerarios</h3>
            <ul class="footer-links">
              <li><a href="${prefix}cursos/1eso.html"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>1.º ESO</a></li>
              <li><a href="${prefix}cursos/2eso.html"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>2.º ESO</a></li>
              <li><a href="${prefix}cursos/3eso.html"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>3.º ESO</a></li>
              <li><a href="${prefix}cursos/4eso.html"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>4.º ESO</a></li>
            </ul>
          </section>

          <section>
            <h3><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Uso recomendado</h3>
            <p>La estructura está preparada para crecer. Se pueden incorporar contenidos reales, secuencias de tutoría y materiales de los cuadernos sin rehacer la navegación.</p>
            <a class="footer-cta" href="${prefix}evaluacion/index.html">
              <i class="fa-solid fa-chart-line" aria-hidden="true"></i> Ver evaluación
            </a>
          </section>
        </div>

        <div class="footer-lang">
          <div class="footer-lang__copy">
            <h3><i class="fa-solid fa-language" aria-hidden="true"></i> Idioma de la página</h3>
            <p>Cambio general mediante Google Translate para español, inglés y árabe.</p>
            <p class="translator-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Las traducciones son automáticas y pueden no reflejar exactamente el sentido pedagógico original.</p>
          </div>
          <div class="lang-buttons" aria-label="Selector de idioma">
            <button class="lang-btn" type="button" data-lang="es">🇪🇸 Español</button>
            <button class="lang-btn" type="button" data-lang="en">🇬🇧 English</button>
            <button class="lang-btn" type="button" data-lang="ar">🇸🇦 العربية</button>
          </div>
        </div>

        <div class="footer-legal">
          <i class="fa-regular fa-copyright" aria-hidden="true"></i>
          Juan María Gámez Ortiz. Reproducción y uso permitidos únicamente con fines no comerciales y con atribución.
          Centro educativo: <a href="https://iesalandalus.org/joomla/" target="_blank" rel="noopener noreferrer">
            I.E.S. Al-Ándalus <i class="fa-solid fa-arrow-up-right-from-square fa-xs" aria-hidden="true"></i>
          </a>.
        </div>

        <div id="google_translate_element" aria-hidden="true"></div>
      </div>
    `;
    document.body.appendChild(footer);
  }

  /* ── Auto reveal (hub pages) ────────────────────────────── */
  function autoReveal() {
    const shell = document.querySelector(".page-shell");
    if (!shell) return;

    // Reveal direct section/article children of page-shell
    Array.from(shell.children).forEach(el => {
      if (!el.hasAttribute("data-reveal")) {
        el.dataset.reveal = "";
      }
    });

    // Staggered scale reveal for cards inside grids
    shell.querySelectorAll(
      ".hub-card:not([data-reveal]), .course-card:not([data-reveal]), " +
      ".info-card:not([data-reveal]), .session-card:not([data-reveal])"
    ).forEach(el => {
      el.dataset.reveal = "scale";
    });
  }

  /* ── Mobile menu ────────────────────────────────────────── */
  function setupMobileMenu() {
    const toggle = document.querySelector(".site-nav-toggle");
    const header = document.querySelector(".site-header");
    if (!toggle || !header) return;

    toggle.addEventListener("click", () => {
      const isOpen = header.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    document.querySelectorAll(".site-nav__link").forEach(link => {
      link.addEventListener("click", () => {
        header.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });

    document.addEventListener("click", e => {
      if (!header.contains(e.target) && header.classList.contains("is-open")) {
        header.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      }
    });
  }

  /* ── Scroll reveal ──────────────────────────────────────── */
  function setupScrollReveal() {
    const els = document.querySelectorAll("[data-reveal]");
    if (!els.length || !("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

    els.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i * 80, 480)}ms`;
      observer.observe(el);
    });
  }

  /* ── Translator ─────────────────────────────────────────── */
  function setupTranslator() {
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-lang]");
      if (!button) return;
      setLanguage(button.dataset.lang);
    });

    if (!document.querySelector('script[data-google-translate="true"]')) {
      const script = document.createElement("script");
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      script.dataset.googleTranslate = "true";
      document.body.appendChild(script);
    }

    window.googleTranslateElementInit = function () {
      if (!window.google || !window.google.translate) return;
      const container = document.getElementById("google_translate_element");
      if (!container || container.dataset.ready === "true") return;
      new window.google.translate.TranslateElement(
        { pageLanguage: baseLanguage, autoDisplay: false, includedLanguages: "es,en,ar" },
        "google_translate_element"
      );
      container.dataset.ready = "true";
    };
  }

  function setLanguage(lang) {
    const value = `/${baseLanguage}/${lang}`;
    document.cookie = `googtrans=${value};path=/;max-age=31536000`;
    document.cookie = `googtrans=${value};path=/;domain=${window.location.hostname};max-age=31536000`;
    window.location.reload();
  }

  /* ── Wrap main ──────────────────────────────────────────── */
  function wrapMain() {
    if (document.querySelector(".site-main")) return;
    const main = document.createElement("main");
    main.className = "site-main";
    const nodes = Array.from(document.body.children).filter(child =>
      !child.classList.contains("site-header") &&
      !child.classList.contains("site-breadcrumbs") &&
      !child.classList.contains("site-footer") &&
      child.tagName !== "SCRIPT"
    );
    nodes.forEach(node => main.appendChild(node));
    const footer = document.querySelector(".site-footer");
    document.body.insertBefore(main, footer);
  }

  /* ── Page title ─────────────────────────────────────────── */
  function findPageTitle() {
    const heading = document.querySelector("h1");
    if (heading && heading.textContent.trim()) return heading.textContent.trim();
    return document.title.replace(/\s*-\s*Tutoría.*$/i, "").trim();
  }
})();
