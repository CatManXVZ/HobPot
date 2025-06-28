// Mobile menu and header logic for all pages

function openMobileNav() {
    var nav = document.getElementById("mobileNav");
    if (nav) nav.style.width = "100vw";
}
function closeMobileNav() {
    var nav = document.getElementById("mobileNav");
    if (nav) nav.style.width = "0";
}
window.openMobileNav = openMobileNav;
window.closeMobileNav = closeMobileNav;

// Wait for the header partial to be loaded into the DOM
function initHeaderMenu() {
    // Populate mobile posts links
    fetch('/categories')
        .then(res => res.json())
        .then(categories => {
            const mobilePostsSimple = document.getElementById('mobile-posts-simple');
            if (mobilePostsSimple && Array.isArray(categories)) {
                mobilePostsSimple.innerHTML = categories.map(cat => {
                    let label = cat.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
                    return `<a href="/Post%20page.html#${cat.toLowerCase()}-posts">${label}</a>`;
                }).join('');
                mobilePostsSimple.innerHTML += `<a href="/Post%20page.html#all-posts">All Posts</a>`;
            }
        });

    // Hamburger menu toggle for mobile: show/hide simple dropdown
    var hamburgerBtn = document.getElementById('mobile-hamburger-btn');
    var simpleMenu = document.getElementById('mobile-simple-menu');
    if (hamburgerBtn && simpleMenu) {
        hamburgerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            simpleMenu.classList.toggle('open');
        });
        hamburgerBtn.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                simpleMenu.classList.toggle('open');
            }
        });
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 800 && simpleMenu.classList.contains('open')) {
                if (!simpleMenu.contains(e.target) && e.target !== hamburgerBtn && !hamburgerBtn.contains(e.target)) {
                    simpleMenu.classList.remove('open');
                    document.querySelectorAll('.mobile-dropdown-content').forEach(el => el.classList.remove('show'));
                }
            }
        });
    }
    // Dropdown open/close for mobile menu
    document.querySelectorAll('.mobile-dropdown-toggle').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            const dropdown = document.getElementById(targetId);
            if (dropdown) {
                dropdown.classList.toggle('show');
            }
        });
    });

    var hamburger = document.getElementById('mobile-hamburger-btn');
    if (hamburger) {
        hamburger.onclick = function(e) {
            e.preventDefault();
            openMobileNav();
        };
    }
    var closeBtn = document.querySelector('.mobile-nav-overlay .closebtn');
    if (closeBtn) {
        closeBtn.onclick = function() {
            closeMobileNav();
        };
    }
}

// === DARK MODE TOGGLE LOGIC (robust, after partials loaded) ===
(function() {
  const darkModeKey = 'hobpot-dark-mode';
  function setDarkMode(on) {
    document.body.classList.toggle('dark-mode', on);
    // Sync toggles
    const mobileToggle = document.getElementById('dark-mode-toggle-mobile');
    const desktopToggle = document.getElementById('dark-mode-toggle-desktop');
    if (mobileToggle) mobileToggle.checked = on;
    if (desktopToggle) desktopToggle.checked = on;
    localStorage.setItem(darkModeKey, on ? '1' : '0');
  }
  function getDarkMode() {
    return localStorage.getItem(darkModeKey) === '1';
  }
  function attachDarkModeListeners() {
    const mobileToggle = document.getElementById('dark-mode-toggle-mobile');
    const desktopToggle = document.getElementById('dark-mode-toggle-desktop');
    if (mobileToggle && !mobileToggle._bound) {
      mobileToggle.addEventListener('change', function() {
        setDarkMode(mobileToggle.checked);
      });
      mobileToggle._bound = true;
    }
    if (desktopToggle && !desktopToggle._bound) {
      desktopToggle.addEventListener('change', function() {
        setDarkMode(desktopToggle.checked);
      });
      desktopToggle._bound = true;
    }
  }
  // Desktop settings dropdown show/hide
  function attachSettingsDropdown() {
    const settingsMenu = document.getElementById('settings-menu-desktop');
    const settingsDropdown = document.getElementById('settings-dropdown');
    const settingsGear = document.getElementById('settings-gear');
    if (settingsGear && settingsDropdown && settingsMenu) {
      let dropdownOpen = false;
      settingsGear.addEventListener('click', function(e) {
        e.preventDefault();
        dropdownOpen = !dropdownOpen;
        settingsDropdown.style.display = dropdownOpen ? 'block' : 'none';
        if (dropdownOpen) {
          setTimeout(() => {
            document.addEventListener('mousedown', closeDropdown, { once: true });
          }, 0);
        }
      });
      function closeDropdown(e) {
        if (!settingsMenu.contains(e.target)) {
          settingsDropdown.style.display = 'none';
          dropdownOpen = false;
        } else {
          document.addEventListener('mousedown', closeDropdown, { once: true });
        }
      }
    }
  }
  // Wait for partials to load, then attach listeners
  function initDarkMode() {
    setDarkMode(getDarkMode());
    attachDarkModeListeners();
    attachSettingsDropdown();
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initDarkMode, 0);
  } else {
    document.addEventListener('DOMContentLoaded', initDarkMode);
  }
  // Also re-attach after partials are loaded (for posts)
  window.addEventListener('load', function() {
    setTimeout(initDarkMode, 100);
  });
})();

// Run after header partial is loaded
if (document.getElementById('header-include')) {
    // If loaded via includeHTML, wait for DOM changes
    const observer = new MutationObserver(function(mutations, obs) {
        if (document.getElementById('mobile-hamburger-btn')) {
            initHeaderMenu();
            obs.disconnect();
        }
    });
    observer.observe(document.getElementById('header-include'), { childList: true, subtree: true });
} else {
    // If header is in the main HTML
    document.addEventListener('DOMContentLoaded', initHeaderMenu);
}
