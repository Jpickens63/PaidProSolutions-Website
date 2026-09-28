const header = document.querySelector("[data-header]");
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
const navigationLinks = navigation ? [...navigation.querySelectorAll("a")] : [];
const year = document.getElementById("year");
const desktopLayout = window.matchMedia("(min-width: 981px)");

if (year) year.textContent = new Date().getFullYear();

function closeMenu({ restoreFocus = false } = {}) {
  if (!menuButton || !navigation) return;
  navigation.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Open navigation");
  document.body.classList.remove("menu-open");
  if (restoreFocus) menuButton.focus();
}

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
    document.body.classList.toggle("menu-open", isOpen);
  });

  navigationLinks.forEach((link) => link.addEventListener("click", () => closeMenu()));

  document.addEventListener("click", (event) => {
    if (navigation.classList.contains("open") && !header.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (!navigation.classList.contains("open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
    if (event.key === "Tab") {
      const first = menuButton;
      const last = navigationLinks[navigationLinks.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  desktopLayout.addEventListener("change", (event) => {
    if (event.matches) closeMenu();
  });
}

function updateHeader() {
  header?.classList.toggle("scrolled", window.scrollY > 18);
}
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

if ("IntersectionObserver" in window) {
  const sectionLinks = navigationLinks.filter((link) => link.getAttribute("href").startsWith("#"));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      sectionLinks.forEach((link) => {
        if (link.getAttribute("href") === `#${entry.target.id}`) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    });
  }, { rootMargin: "-18% 0px -58% 0px", threshold: 0 });
  document.querySelectorAll("main > section[id]").forEach((section) => observer.observe(section));
}
