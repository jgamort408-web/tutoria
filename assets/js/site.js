(function () {
  const folder = detectFolder();
  const depth = calculateDepth();
  const prefix = "../".repeat(depth);
  const navItems = [
    { key: "inicio", label: "Inicio", href: `${prefix}index.html` },
    { key: "cursos", label: "Cursos", href: `${prefix}cursos/index.html` },
    { key: "estudio", label: "Estudio", href: `${prefix}estudio/index.html` },
    { key: "emociones", label: "Emociones", href: `${prefix}emociones/index.html` },
    { key: "8marzo", label: "8M y ciudadanía", href: `${prefix}8marzo/index.html` },
    { key: "evacuacion", label: "Evacuación", href: `${prefix}evacuacion/index.html` },
    { key: "evaluacion", label: "Evaluación", href: `${prefix}evaluacion/index.html` }
  ];

  const themes = {
    estudio: { label: "Técnicas de estudio", home: `${prefix}estudio/index.html` },
    emociones: { label: "Educación emocional", home: `${prefix}emociones/index.html` },
    "8marzo": { label: "8M y ciudadanía", home: `${prefix}8marzo/index.html` },
    evacuacion: { label: "Seguridad y convivencia", home: `${prefix}evacuacion/index.html` },
    evaluacion: { label: "Seguimiento tutorial", home: `${prefix}evaluacion/index.html` },
    cursos: { label: "Itinerarios por curso", home: `${prefix}cursos/index.html` },
    inicio: { label: "Portada", home: `${prefix}index.html` }
  };

  document.body.dataset.theme = folder.theme;
  document.body.classList.add("site-ready");

  injectHeader();
  injectBreadcrumbs();
  injectFooter();
  wrapMain();

  function detectFolder() {
    const pathname = window.location.pathname.replace(/\\/g, "/").toLowerCase();

    if (pathname.includes("/estudio/")) return { key: "estudio", theme: "estudio" };
    if (pathname.includes("/emociones/")) return { key: "emociones", theme: "emociones" };
    if (pathname.includes("/8marzo/")) return { key: "8marzo", theme: "8marzo" };
    if (pathname.includes("/evacuacion/")) return { key: "evacuacion", theme: "evacuacion" };
    if (pathname.includes("/evaluacion/")) return { key: "evaluacion", theme: "evaluacion" };
    if (pathname.includes("/cursos/")) return { key: "cursos", theme: "cursos" };

    return { key: "inicio", theme: "cursos" };
  }

  function calculateDepth() {
    const filename = window.location.pathname.split("/").pop() || "";
    return filename.toLowerCase() === "index.html" && folder.key === "inicio" ? 0 : folder.key === "inicio" ? 0 : 1;
  }

  function injectHeader() {
    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = `
      <div class="site-header__inner">
        <a class="site-brand" href="${prefix}index.html" aria-label="Ir a la portada de Tutoría Activa">
          <span class="site-brand__mark">TA</span>
          <span class="site-brand__text">
            <span class="site-brand__eyebrow">Tutoría Activa</span>
            <span class="site-brand__title">Secundaria con estructura común</span>
          </span>
        </a>
        <nav class="site-nav" aria-label="Navegación principal">
          ${navItems
            .map((item) => {
              const active = item.key === folder.key ? " is-active" : "";
              return `<a class="site-nav__link${active}" href="${item.href}">${item.label}</a>`;
            })
            .join("")}
        </nav>
      </div>
    `;

    document.body.prepend(header);
  }

  function injectBreadcrumbs() {
    const crumbs = [];
    crumbs.push({ label: "Inicio", href: `${prefix}index.html` });

    if (folder.key !== "inicio") {
      const section = themes[folder.key];
      crumbs.push({ label: section.label, href: section.home });
    }

    const pageTitle = findPageTitle();
    if (pageTitle && folder.key !== "inicio" && pageTitle !== themes[folder.key].label) {
      crumbs.push({ label: pageTitle });
    }

    if (crumbs.length === 1 && folder.key === "inicio") {
      return;
    }

    const nav = document.createElement("nav");
    nav.className = "site-breadcrumbs";
    nav.setAttribute("aria-label", "Migas de pan");
    nav.innerHTML = crumbs
      .map((crumb, index) => {
        const isLast = index === crumbs.length - 1 || !crumb.href;
        if (isLast) return `<span>${crumb.label}</span>`;
        return `<a href="${crumb.href}">${crumb.label}</a><span>/</span>`;
      })
      .join("");

    const header = document.querySelector(".site-header");
    if (header && header.nextSibling) {
      document.body.insertBefore(nav, header.nextSibling);
    } else {
      document.body.appendChild(nav);
    }
  }

  function injectFooter() {
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="site-footer__inner">
        <div class="site-footer__grid">
          <section>
            <h2>Tutoría Activa</h2>
            <p>Base compartida para trabajar tutoría en ESO con una navegación clara, bloques temáticos y actividades interactivas conectadas.</p>
            <ul class="footer-tags">
              <li>Diseño común</li>
              <li>Aprendizaje activo</li>
              <li>Secundaria</li>
            </ul>
          </section>
          <section>
            <h3>Bloques</h3>
            <ul class="footer-links">
              <li><a href="${prefix}estudio/index.html">Estudio</a></li>
              <li><a href="${prefix}emociones/index.html">Emociones</a></li>
              <li><a href="${prefix}8marzo/index.html">8M y ciudadanía</a></li>
              <li><a href="${prefix}evacuacion/index.html">Evacuación</a></li>
            </ul>
          </section>
          <section>
            <h3>Itinerarios</h3>
            <ul class="footer-links">
              <li><a href="${prefix}cursos/1eso.html">1.º ESO</a></li>
              <li><a href="${prefix}cursos/2eso.html">2.º ESO</a></li>
              <li><a href="${prefix}cursos/3eso.html">3.º ESO</a></li>
              <li><a href="${prefix}cursos/4eso.html">4.º ESO</a></li>
            </ul>
          </section>
          <section>
            <h3>Uso recomendado</h3>
            <p>La estructura ya está preparada para crecer. Se pueden ir incorporando contenidos reales, secuencias de tutoría y materiales de los cuadernos sin rehacer la navegación.</p>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(footer);
  }

  function wrapMain() {
    if (document.querySelector(".site-main")) return;

    const main = document.createElement("main");
    main.className = "site-main";

    const persistent = Array.from(document.body.children).filter((child) => {
      return !child.classList.contains("site-header") &&
        !child.classList.contains("site-breadcrumbs") &&
        !child.classList.contains("site-footer") &&
        child.tagName !== "SCRIPT";
    });

    persistent.forEach((node) => main.appendChild(node));
    const footer = document.querySelector(".site-footer");
    document.body.insertBefore(main, footer);
  }

  function findPageTitle() {
    const heading = document.querySelector("h1");
    if (heading && heading.textContent.trim()) return heading.textContent.trim();

    const title = document.title.replace(/\s*-\s*Tutoría.*$/i, "").trim();
    return title;
  }
})();
