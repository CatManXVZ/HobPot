// Sidebar logic for all pages

function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebarToggleButton = document.getElementById('sidebar-toggle-button');

  if (!sidebar || !sidebarToggleButton) return;

  let isSidebarOpen = false;

  function setSidebarState(open) {
    isSidebarOpen = open;
    sidebar.classList.toggle('open', open);
    sidebar.classList.toggle('closed', !open);
  }

  function toggleSidebar() {
    setSidebarState(!isSidebarOpen);
  }

  sidebarToggleButton.addEventListener('click', toggleSidebar);

  // Only close sidebar on outside click for mobile
  document.addEventListener('click', (event) => {
    if (
      isSidebarOpen &&
      window.innerWidth <= 900 &&
      !sidebar.contains(event.target) &&
      !sidebarToggle.contains(event.target)
    ) {
      setSidebarState(false);
    }
  });

  // Open sidebar by default on desktop
  if (window.innerWidth > 900) {
    setSidebarState(true);
  }

  // Fetch and display latest posts
  fetch('/list-posts')
    .then(res => res.json())
    .then(posts => {
      let allPosts = [];
      for (const [cat, arr] of Object.entries(posts)) {
        arr.forEach(post => allPosts.push({
          ...post,
          category: cat
        }));
      }
      allPosts.sort((a, b) => b.date.localeCompare(a.date) || b.filename.localeCompare(a.filename));
      const latest = allPosts.slice(0, 3);
      const ul = document.getElementById('sidebar-latest-posts');
      if (!ul) return;
      if (latest.length === 0) {
        ul.innerHTML = '<li style="color:#888;">No posts yet.</li>';
      } else {
        ul.innerHTML = latest.map(post => {
          let label = post.category.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
          return `<li>
                        <a href="/Posts/${post.category}/${post.filename}" title="${post.title}">
                            ${post.title}
                        </a>
                        <a href="/Post%20page.html#${post.category.toLowerCase()}-posts" style="color:#F6E05E;font-size:0.95em;margin-left:0.5em;">[${label}]</a>
                    </li>`;
        }).join('');
      }
    })
    .catch(() => {
      const ul = document.getElementById('sidebar-latest-posts');
      if (ul) ul.innerHTML = '<li style="color:#a00;">Failed to load posts.</li>';
    });
}

// Run after sidebar partial is loaded
if (document.getElementById('sidebar-include')) {
  const observer = new MutationObserver(function(mutations, obs) {
    if (document.querySelector('.sidebar')) {
      initSidebar();
      obs.disconnect();
    }
  });
  observer.observe(document.getElementById('sidebar-include'), { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', initSidebar);
}
