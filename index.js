const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Sequelize, DataTypes } = require('sequelize');

// For Node.js v18+ (native fetch)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3000;


const RECAPTCHA_SECRET = '6Lfi3x4rAAAAAJAPeAMJQsnZviJsmIfu5HUZaSbV';


const USERNAME = 'CatManXvZ';
const HASHED_PASSWORD = '$2a$10$nAuygfQg5r/7uEz/qlwJoe0de2Y9iWy76KFPRD.UHLcFCS/uOPP46'; // Replace with actual bcrypt hash

// Middleware to check login session
function requireAuth(req, res, next) {
    if ((req.session && req.session.loggedIn) || (req.isAuthenticated && req.isAuthenticated())) {
        return next();
    }  
    res.redirect('/auth/google');
}

// Session setup
const session = require('express-session');
app.use(session({
    secret: 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: true,
        maxAge: 10 * 60 * 1000 // 10 minutes in milliseconds
    }
}));

// Move this middleware BEFORE the /Poster.html route and express.static
app.use((req, res, next) => {
    // Allow Google OAuth routes to always pass
    if (req.path.startsWith('/auth/google')) {
        return next();
    }
    // Block direct static access to Poster.html (case-insensitive)
    if (
        req.path.toLowerCase() === '/poster.html' &&
        !(req.session && req.session.loggedIn) &&
        !(req.isAuthenticated && req.isAuthenticated())
    ) {
        return res.redirect('/devlogin');
    }
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Needed for JSON POST body

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// === GOOGLE OAUTH CONFIG ===
const GOOGLE_CLIENT_ID = '14757875584-bel60fo55e6bu2u1rjg5jpe8983kgasu.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
    done(null, {
        id: profile.id,
        displayName: profile.displayName,
        emails: profile.emails
    });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.use(passport.initialize());
app.use(passport.session());

// New Google OAuth routes
app.get('/auth/google', (req, res, next) => {
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Use the stored returnTo URL, or fallback to homepage
        const redirectTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        // Notify user if redirected to homepage
        if (redirectTo === '/' || redirectTo === '/Homepage.html') {
            return res.send(`
                <html>
                <head>
                    <meta http-equiv="refresh" content="2;url=/" />
                    <style>
                        body { font-family: sans-serif; background: #f7fafc; color: #23272f; text-align: center; padding-top: 10vh; }
                        .notice { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; display: inline-block; padding: 2em 3em; border-radius: 1em; font-size: 1.3em; }
                    </style>
                </head>
                <body>
                    <div class="notice">
                        You have been redirected to the homepage after login.<br>
                        <small>If you expected to return to a specific page, please navigate there again.</small>
                    </div>
                </body>
                </html>
            `);
        }
        res.redirect(redirectTo);
    }
);

app.get('/logout-google', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Developer Login page (GET)
app.get('/devlogin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Developer Login</title>
    <link rel="stylesheet" href="style.css">
    <style>
    body { background: #222; color: #eee; }
    .login-container {
        max-width: 400px; margin: 8% auto; background: #fff; color: #222;
        border-radius: 1.2rem; box-shadow: 0 8px 32px 0 rgba(74,85,104,0.18);
        padding: 2em 2.5em 2em 2.5em; border: 2px solid #F6E05E;
    }
    .login-container label { display: block; margin-top: 1em; font-weight: bold; color: #FF6B00; }
    .login-container input[type="text"], .login-container input[type="password"] {
        width: 100%; padding: 0.7em; margin-top: 0.3em; border-radius: 0.7em;
        border: 1px solid #4A5568; background: #F7FAFC; font-size: 1.1em; margin-bottom: 0.7em;
    }
    .login-container button { background: #FF6B00; color: #fff; border: none; border-radius: 0.7rem;
        padding: 0.9rem 1.5rem; font-size: 1.2rem; font-weight: bold; cursor: pointer; margin-top: 1em;
    }
    .login-container .error { color: #a00; margin-top: 1em; }
    </style>
    <script src="https://www.google.com/recaptcha/api.js" async defer></script>
</head>
<body>
    <div class="login-container">
        <h2>Developer Login</h2>
        <form method="POST" action="/devlogin">
            <label for="username">Username:</label>
            <input type="text" name="username" id="username" required autocomplete="username">
            <label for="password">Password:</label>
            <input type="password" name="password" id="password" required autocomplete="current-password">
            <div style="margin: 1em 0;">
                <div class="g-recaptcha" data-sitekey="6Lfi3x4rAAAAALzvDsXKe9M02MmJ1yHsismmPBz-"></div>
            </div>
            <button type="submit">Log In</button>
        </form>
        ${req.query.error ? `<div class="error">${req.query.error}</div>` : ''}
        <div style="margin-top:1em;color:#a00;font-weight:bold;">
            Developer Access Only: This page is private and restricted to authorized developers.
        </div>
    </div>
</body>
</html>
    `);
});

// Developer Login POST handler
app.post('/devlogin', async (req, res) => {
    const { username, password, 'g-recaptcha-response': recaptcha } = req.body;
    // Temporarily bypass reCAPTCHA for testing:
    // if (!recaptcha) {
    //     return res.redirect('/devlogin?error=' + encodeURIComponent('Please complete the reCAPTCHA.'));
    // }
    // try {
    //     const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    //         body: `secret=${RECAPTCHA_SECRET}&response=${recaptcha}`
    //     });
    //     const verifyData = await verifyRes.json();
    //     if (!verifyData.success) {
    //         return res.redirect('/devlogin?error=' + encodeURIComponent('reCAPTCHA failed. Try again.'));
    //     }
    // } catch (e) {
    //     return res.redirect('/devlogin?error=' + encodeURIComponent('reCAPTCHA error.'));
    // }
    // Check username and password
    if (username === USERNAME && await bcrypt.compare(password, HASHED_PASSWORD)) {
        req.session.loggedIn = true;
        // Redirect to homepage or poster page after login
        return res.redirect('/Poster.html');
    }
    return res.redirect('/devlogin?error=' + encodeURIComponent('Invalid username or password.'));
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/devlogin');
    });
});

// Protect poster page only, homepage is public
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Homepage.html'));
});
app.get('/Homepage.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Homepage.html'));
});
app.get('/Poster.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'Poster.html'));
});

// When creating or editing a post, store the raw markup as a comment in the HTML for future editing
app.post('/post-website', (req, res) => {
    const { category, title, body, edit_category, edit_filename, draft_filename, autosave_id } = req.body;
    const postsRoot = path.join(__dirname, 'Posts');
    const folderPath = path.join(postsRoot, category);

    // Ensure Posts folder exists
    if (!fs.existsSync(postsRoot)) {
        fs.mkdirSync(postsRoot, { recursive: true });
    }
    // Ensure category folder exists
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }

    // If editing, overwrite the existing file
    let filePath;
    if (edit_category && edit_filename) {
        filePath = path.join(postsRoot, edit_category, edit_filename);
    } else {
        // Get current date in dd-mm-yyyy format
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}-${month}-${year}`;
        // Ensure unique filename by adding a timestamp if file exists
        let baseFilename = `${dateStr}.html`;
        let uniqueFilename = baseFilename;
        let counter = 1;
        while (fs.existsSync(path.join(folderPath, uniqueFilename))) {
            // Add a timestamp or counter to ensure uniqueness
            uniqueFilename = `${dateStr}_${Date.now()}_${counter}.html`;
            counter++;
        }
        filePath = path.join(folderPath, uniqueFilename);
    }

    // Custom markup processing
    let processed = body;

    // Add image markup: /pic code [height] [width] [style] [caption]/ → <figure ...><img ...><figcaption>...</figcaption></figure>
    let images = [];
    try {
        const IMAGES_ROOT = path.join(__dirname, 'Assets', 'Uploads');
        if (fs.existsSync(IMAGES_ROOT)) {
            images = fs.readdirSync(IMAGES_ROOT)
                .filter(f => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f))
                .sort(); // Ensure stable order for code numbers
        }
    } catch {}
    processed = processed.replace(
        /\/pic\s+(\d+)(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+(wrap|block))?(?:\s+([^\/]+?))?\s*\//g,
        (match, code, h, w, style, caption) => {
            code = parseInt(code, 10);
            if (!images[code - 1]) return '';
            // FIX: Correct image URL path
            const url = `/HumanityIsObliviouslyBlindedToPowers/Assets/Uploads/${images[code - 1]}`;
            let attrs = '';
            if (h) attrs += ` height="${h}"`;
            if (w) attrs += ` width="${w}"`;
            let figClass = '';
            let imgClass = '';
            if (style === 'wrap') {
                figClass = 'float-img-container';
                imgClass = 'float-img';
            }
            let imgTag = `<img src="${url}"${attrs}${imgClass ? ` class="${imgClass}"` : ''} style="max-width:100%;border-radius:0.4em;">`;
            let figcaption = caption ? `<figcaption>${caption.trim()}</figcaption>` : '';
            return `<figure${figClass ? ` class="${figClass}"` : ''}>${imgTag}${figcaption}</figure>`;
        }
    );

    // 1. Lists: /l /e item1 /e item2/  → <ul><li>item1</li><li>item2</li></ul>
    processed = processed.replace(/\/l\s*((?:\/e\s*[^\/]+)+)\/\s*/g, (match, listContent) => {
        const items = [...listContent.matchAll(/\/e\s*([^\/\n]+)/g)].map(m => `<li>${m[1].trim()}</li>`);
        return `<ul>${items.join('')}</ul>`;
    });

    // 2. Headers: /h text /  → special marker for later
    processed = processed.replace(/\/h\s*([^\n\/]+)\s*\//g, (match, headerText) => {
        return '|||H2|||'+headerText.trim()+'|||H2|||';
    });

    // 3. Bold: /b text / → <b>text</b>
    processed = processed.replace(/\/b\s*([^\n\/]+)\s*\//g, (match, boldText) => {
        return `<b>${boldText.trim()}</b>`;
    });

    // 4. Italics: /i text / → <i>text</i>
    processed = processed.replace(/\/i\s*([^\n\/]+)\s*\//g, (match, italicText) => {
        return `<i>${italicText.trim()}</i>`;
    });

    // 5. Underline: /u text / → <u>text</u>
    processed = processed.replace(/\/u\s*([^\n\/]+)\s*\//g, (match, underlineText) => {
        return `<u>${underlineText.trim()}</u>`;
    });

    // 6. Sections: split on /s and wrap in <section>
    const sections = processed
        .split(/(?:\r?\n)?\s*\/s\s*(?:\r?\n)?/g)
        .map(part => {
            let parts = part.split('|||H2|||');
            let result = '';
            for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 1) {
                    result += `<h2>${parts[i]}</h2>`;
                } else {
                    let paras = parts[i].split(/\n{2,}/g).map(p => p.trim()).filter(p => p.length > 0);
                    result += paras.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
                }
            }
            return `<section class="section">\n${result}\n</section>`;
        })
        .join('\n');

    // Store the raw markup as a comment for future editing (hide it with CSS)
    const rawMarkupComment = `<div style="font-size:8px;opacity:0.1;user-select:none;pointer-events:none;max-height:1px;overflow:hidden;"><!--RAW_BODY_START-->\n${body}\n<!--RAW_BODY_END--></div>`;

    // HTML content for the posted website, styled like homepage and with partial includes
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="/HumanityIsObliviouslyBlindedToPowers/style.css">
</head>
<body>
    <div id="header-include"></div>
    <div id="sidebar-include"></div>
    <div class="content-layout" style="display:flex;align-items:flex-start;position:relative;">
        <main style="flex:1;">
            ${rawMarkupComment}
            ${sections}
        </main>
    </div>
    <section id="comments-section" class="comments-section" style="margin-left:40% !important;">
      <h3> <span class="comments-tag">Comments</span></h3>
      <div id="google-login-prompt" style="display:none;margin-bottom:1em;">
        <a href="/auth/google" class="google-login-btn">Sign in with Google to comment</a>
      </div>
      <form id="comment-form" style="margin-bottom:1.5em;display:none;">
        <textarea id="comment-text" placeholder="Your comment" required maxlength="1000" style="width:100%;min-height:60px;margin-bottom:0.5em;"></textarea>
        <button type="submit" id="comment-submit-btn" style="padding:0.5em 1.2em;">Post Comment</button>
        <span id="comment-status" style="margin-left:1em;color:#a00;font-weight:bold;"></span>
      </form>
      <div id="comments-list"></div>
      <div id="comments-pagination" style="text-align:center;margin-top:1em;"></div>
    </section>
    <div id="footer-include"></div>
    <script>
    function includeHTML(id, url, cb) {
        fetch('/HumanityIsObliviouslyBlindedToPowers/partials/' + url)
          .then(res => res.text())
          .then(html => {
              document.getElementById(id).innerHTML = html;
              if (cb) cb();
              // Ensure scripts in sidebar partial are executed
              if (id === 'sidebar-include') {
                  var scripts = document.getElementById(id).querySelectorAll('script');
                  scripts.forEach(function(oldScript) {
                      var newScript = document.createElement('script');
                      if (oldScript.src) {
                          newScript.src = oldScript.src;
                      } else {
                          newScript.textContent = oldScript.textContent;
                      }
                      oldScript.parentNode.replaceChild(newScript, oldScript);
                  });
              }
          });
    }
    includeHTML('header-include', 'header.html', function() {
        var titleSpan = document.getElementById('header-title');
        if (titleSpan) titleSpan.textContent = ${JSON.stringify(title)};
        var homeMenu = document.getElementById('menu-homepage');
        if (homeMenu) homeMenu.classList.remove('dulled');
    });
    includeHTML('sidebar-include', 'sidebar.html');
    includeHTML('footer-include', 'footer.html');
    // --- Comment Section JS ---
    let currentUser = null;
    let commentsData = [];
    let currentPage = 1;
    const COMMENTS_PER_PAGE = 8;
    const commentCategory = ${JSON.stringify(category)};
    const commentFilename = ${JSON.stringify(path.basename(filePath))};

    function renderCommentsPage(page) {
      const list = document.getElementById('comments-list');
      const pag = document.getElementById('comments-pagination');
      if (!Array.isArray(commentsData) || commentsData.length === 0) {
        list.innerHTML = '<div class="comment-empty">No comments yet.</div>';
        pag.innerHTML = '';
        return;
      }
      // Newest to oldest
      const totalPages = Math.ceil(commentsData.length / COMMENTS_PER_PAGE);
      page = Math.max(1, Math.min(page, totalPages));
      currentPage = page;
      const start = (page - 1) * COMMENTS_PER_PAGE;
      const end = start + COMMENTS_PER_PAGE;
      const pageComments = commentsData.slice().reverse().slice(start, end);
      list.innerHTML = pageComments.map((c, idx) => {
        const globalIdx = commentsData.length - 1 - (start + idx);
        let editDelete = '';
        if (currentUser && c.name === currentUser) {
          editDelete = 
            '<button class="comment-edit-btn" data-idx="'+globalIdx+'">Edit</button>' +
            '<button class="comment-delete-btn" data-idx="'+globalIdx+'">Delete</button>';
        }
        return (
          '<div class="comment">' +
            '<div class="comment-meta"><span class="comment-name">' + (c.name ? c.name : 'Anonymous') + '</span> ' +
            '<span class="comment-date">' + (new Date(c.date).toLocaleString()) + '</span>' +
            (c.edited ? ' <span class="comment-edited">(edited)</span>' : '') +
            '</div>' +
            '<h2 class="comment-body" id="comment-body-'+globalIdx+'">' + c.text.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\n/g,"<br>") + '</h2>' +
            (editDelete ? '<div class="comment-actions">'+editDelete+'</div>' : '') +
          '</div>'
        );
      }).join('');
      // Pagination
      if (totalPages > 1) {
        let pagHtml = '';
        for (let i = 1; i <= totalPages; ++i) {
          pagHtml += '<button class="comment-page-btn" data-page="'+i+'"'+(i===page?' style="background:#FF6B00;color:#fff;"':'')+'>'+i+'</button> ';
        }
        pag.innerHTML = pagHtml;
      } else {
        pag.innerHTML = '';
      }
    }

    function fetchComments() {
      fetch('/comments?category=' + encodeURIComponent(commentCategory) + '&filename=' + encodeURIComponent(commentFilename))
        .then(res => res.json())
        .then(comments => {
          commentsData = comments;
          renderCommentsPage(currentPage);
        });
    }

    // Check login status for Google (by trying to fetch /user-info)
    fetch('/user-info').then(res => res.json()).then(data => {
      if (data && data.loggedIn) {
        currentUser = data.name;
        document.getElementById('comment-form').style.display = '';
        document.getElementById('google-login-prompt').style.display = 'none';
      } else {
        currentUser = null;
        document.getElementById('comment-form').style.display = 'none';
        document.getElementById('google-login-prompt').style.display = '';
      }
    }).catch(() => {
      currentUser = null;
      document.getElementById('comment-form').style.display = 'none';
      document.getElementById('google-login-prompt').style.display = '';
    });

    document.getElementById('comment-form').onsubmit = function(e) {
      e.preventDefault();
      const text = document.getElementById('comment-text').value.trim();
      if (!text) return;
      fetch('/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: commentCategory,
          filename: commentFilename,
          text
        })
      }).then(res => res.json()).then(r => {
        const status = document.getElementById('comment-status');
        if (r.success) {
          document.getElementById('comment-form').reset();
          status.textContent = '';
          fetchComments();
        } else if (r.error) {
          status.textContent = r.error;
        }
      });
    };

    // Pagination click
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('comment-page-btn')) {
        renderCommentsPage(Number(e.target.getAttribute('data-page')));
      }
      // Edit
      if (e.target.classList.contains('comment-edit-btn')) {
        const idx = Number(e.target.getAttribute('data-idx'));
        const c = commentsData[idx];
        const bodyEl = document.getElementById('comment-body-'+idx);
        if (!bodyEl) return;
        // Replace with textarea and save/cancel
        const origText = c.text;
        bodyEl.innerHTML = '<textarea id="edit-comment-text" style="width:100%;min-height:60px;">'+origText.replace(/</g,"&lt;").replace(/>/g,"&gt;")+'</textarea>' +
          '<br><button id="save-edit-btn" style="background:#FF6B00;color:#fff;margin-right:0.5em;">Save</button>' +
          '<button id="cancel-edit-btn">Cancel</button>';
        document.getElementById('save-edit-btn').onclick = function() {
          const newText = document.getElementById('edit-comment-text').value.trim();
          if (!newText) return;
          fetch('/edit-comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: commentCategory,
              filename: commentFilename,
              index: idx,
              text: newText
            })
          }).then(res => res.json()).then(r => {
            if (r.success) fetchComments();
            else alert(r.error || 'Failed to edit comment');
          });
        };
        document.getElementById('cancel-edit-btn').onclick = function() {
          fetchComments();
        };
      }
      // Delete
      if (e.target.classList.contains('comment-delete-btn')) {
        const idx = Number(e.target.getAttribute('data-idx'));
        if (!confirm('Delete this comment?')) return;
        fetch('/delete-comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: commentCategory,
            filename: commentFilename,
            index: idx
          })
        }).then(res => res.json()).then(r => {
          if (r.success) fetchComments();
          else alert(r.error || 'Failed to delete comment');
        });
      }
    });

    fetchComments();
    // Style the comment button with the orange from the stylesheet
    document.addEventListener('DOMContentLoaded', function() {
      var btn = document.getElementById('comment-submit-btn');
      if (btn) {
        btn.style.background = '#FF6B00';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '0.7rem';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '1.2rem';
        btn.style.cursor = 'pointer';
      }
    });
    </script>
    <style>
    .content-layout {
      display: flex;
      align-items: flex-start;
      position: relative;
    }
    section.comments-section {
      background: var(--background, #f7fafc);
      border-radius: 1em;
      box-shadow: 0 2px 8px #0001;
      margin: 2em auto 3em auto;
      padding: 1em 2em;
      max-width: 700px;
      min-width: 240px;
      width: 100%;
      align-self: flex-start;
      z-index: 10;
      position: static;
    }
    main {
      flex: 1;
      min-width: 0;
    }
    @media (max-width: 1200px) {
      .content-layout {
        flex-direction: column !important;
      }
      section.comments-section {
        max-width: 98vw;
        min-width: 0;
      }
    }
    .comment {
      margin-bottom: 1em;
      padding-bottom: 0.5em;
      border-bottom: 1px solid #eee;
    }
    .comment-meta {
      color: var(--primary, #222);
      font-size: 1em;
      margin-bottom: 0.2em;
    }
    .comment-name {
      color: #F6E05E;
      font-weight: bold;
    }
    .comment-date {
      color: #888;
      font-size: 0.9em;
      margin-left: 0.5em;
    }
    .comment-edited {
      color: #888;
      font-size: 0.85em;
      margin-left: 0.5em;
      font-style: italic;
    }
    .comment-body {
      white-space: pre-line;
      color: var(--text, #222);
      font-size: 1.3em;
      margin: 0.2em 0 0.5em 0;
      font-family: inherit;
      font-weight: 600;
    }
    .comment-actions button {
      background: #FF6B00;
      color: #fff;
      border: none;
      border-radius: 0.5em;
      padding: 0.2em 0.8em;
      margin-right: 0.5em;
      font-size: 1em;
      cursor: pointer;
      font-weight: bold;
      transition: background 0.2s;
    }
    .comment-actions button:hover {
      background: #e65c00;
    }
    .comment-empty {
      color: #888;
      font-style: italic;
      margin: 1em 0;
    }
    .google-login-btn {
      display: inline-block;
      background: #fff;
      color: #444;
      border: 1px solid #ccc;
      border-radius: 0.5em;
      padding: 0.5em 1.2em;
      font-weight: bold;
      text-decoration: none;
      box-shadow: 0 2px 4px #0001;
      transition: background 0.2s;
    }
    .google-login-btn:hover {
      background: #f6f6f6;
      color: #222;
      border-color: #888;
    }
    </style>
</body>
</html>
`;

    fs.writeFileSync(filePath, htmlContent);
    // If this was a draft being promoted to post, delete the draft file
    if (draft_filename) {
        const draftPath = path.join(DRAFTS_ROOT, draft_filename);
        if (fs.existsSync(draftPath)) {
            fs.unlinkSync(draftPath);
        }
    }
    // If there is an autosave draft, delete it
    if (autosave_id) {
        const autoDraftPath = path.join(DRAFTS_ROOT, autosave_id);
        if (fs.existsSync(autoDraftPath)) {
            fs.unlinkSync(autoDraftPath);
        }
    }
    // Respond with reload instruction
    res.json({ success: true, reload: true });
});

const POSTS_ROOT = path.join(__dirname, 'Posts');

// Load categories from centralized file
const categories = require('./categories');

// API endpoint to list all posts for Poster.html
app.get('/list-posts', (req, res) => {
    let result = {};
    for (const cat of categories) result[cat] = [];
    try {
        for (const cat of categories) {
            const catDir = path.join(POSTS_ROOT, cat);
            if (fs.existsSync(catDir)) {
                const files = fs.readdirSync(catDir).filter(f => f.endsWith('.html'));
                for (const file of files) {
                    // Accept filenames like dd-mm-yyyy.html or dd-mm-yyyy_TIMESTAMP_COUNTER.html
                    const dateMatch = file.match(/^\d{2}-\d{2}-\d{4}(?:_\d+_\d+)?\.html$/);
                    if (!dateMatch) continue;
                    const date = dateMatch[0].slice(0, 10);
                    // Try to extract title from file
                    let title = file;
                    try {
                        const content = fs.readFileSync(path.join(catDir, file), 'utf8');
                        const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
                        if (titleMatch) title = titleMatch[1];
                    } catch {}
                    result[cat].push({
                        filename: file,
                        title,
                        date
                    });
                }
            }
        }
        // Sort by date descending in each category
        for (const cat of categories) {
            result[cat].sort((a, b) => b.date.localeCompare(a.date) || b.filename.localeCompare(a.filename));
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to list posts.' });
    }
});

// API endpoint to delete a post
app.post('/delete-post', requireAuth, (req, res) => {
    const { category, filename } = req.body;
    if (!category || !filename) return res.status(400).json({ error: 'Missing data.' });
    const filePath = path.join(__dirname, 'Posts', category, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
    try {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete post.' });
    }
});

// API endpoint to get a post's raw content for editing
app.post('/get-post', requireAuth, (req, res) => {
    const { category, filename } = req.body;
    if (!category || !filename) return res.status(400).json({ error: 'Missing data.' });
    const filePath = path.join(__dirname, 'Posts', category, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Extract <title>
        let title = filename;
        const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) title = titleMatch[1];
        // Try to extract the original body (raw markup) from a comment
        let rawBody = '';
        const rawMatch = content.match(/<!--RAW_BODY_START-->([\s\S]*?)<!--RAW_BODY_END-->/);
        if (rawMatch) {
            rawBody = rawMatch[1].trim();
        } else {
            // Fallback: try to reconstruct the markup from HTML (reverse the HTML to markup)
            const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
            if (mainMatch) {
                let html = mainMatch[1];
                // Remove the RAW_BODY comment if present
                html = html.replace(/<!--RAW_BODY_START-->[\s\S]*?<!--RAW_BODY_END-->/g, '');
                // Reverse HTML to markup (best effort, not perfect)
                // 1. <ul><li>item</li>...</ul> => /l /e item /e item /
                html = html.replace(/<ul>([\s\S]*?)<\/ul>/g, (match, ulContent) => {
                    const items = [...ulContent.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => `/e ${m[1].replace(/<br\s*\/?>/g, '\n').trim()} `);
                    return `/l ${items.join('')}/`;
                });
                // 2. <h2>text</h2> => /h text /
                html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (match, h) => `/h ${h.trim()} /`);
                // 3. <b>text</b> => /b text /
                html = html.replace(/<b>([\s\S]*?)<\/b>/g, (match, b) => `/b ${b.trim()} /`);
                // 4. <i>text</i> => /i text /
                html = html.replace(/<i>([\s\S]*?)<\/i>/g, (match, i) => `/i ${i.trim()} /`);
                // 5. <u>text</u> => /u text /
                html = html.replace(/<u>([\s\S]*?)<\/u>/g, (match, u) => `/u ${u.trim()} /`);
                // 6. <img ...> => /pic code h w /
                // Not possible to reconstruct code/h/w, so just leave as is or try to match src to code
                html = html.replace(/<img[^>]*src="[^"]*\/Assets\/Uploads\/([^"]+)"[^>]*>/g, (match, fname) => {
                    // Try to find code number for this image
                    let code = 1;
                    try {
                        const IMAGES_ROOT = path.join(__dirname, 'Assets', 'Uploads');
                        const files = fs.readdirSync(IMAGES_ROOT).filter(f =>
                            /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f)
                        );
                        code = files.findIndex(f => f === fname) + 1;
                    } catch {}
                    if (code < 1) code = 1;
                    // Try to extract height/width
                    const h = (match.match(/height="(\d+)"/) || [])[1] || '';
                    const w = (match.match(/width="(\d+)"/) || [])[1] || '';
                    let markup = `/pic ${code}`;
                    if (h) markup += ` ${h}`;
                    if (w) markup += ` ${w}`;
                    markup += ' /';
                    return markup;
                });
                // 7. <section ...> => /s (split)
                html = html.replace(/<\/section>/g, '/s');
                html = html.replace(/<section[^>]*>/g, '');
                // 8. <p>...</p> => just text with newlines
                html = html.replace(/<p>([\s\S]*?)<\/p>/g, (match, p) => p.replace(/<br\s*\/?>/g, '\n') + '\n\n');
                // Remove any remaining HTML tags
                html = html.replace(/<\/?[^>]+>/g, '');
                // Clean up whitespace
                rawBody = html.replace(/\n{3,}/g, '\n\n').trim();
            }
        }
        res.json({ title, rawBody });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load post.' });
    }
});

// Prevent direct access to Poster.html static file
app.use((req, res, next) => {
    if (req.path.toLowerCase() === '/poster.html') {
        // If someone tries to access Poster.html directly as a static file, redirect to /devlogin
        return res.redirect('/devlogin');
    }
    next();
});

// Utility to remove RAW_BODY comment from a file
function removeRawBodyFromFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    // Remove the RAW_BODY comment and its contents
    content = content.replace(/<!--RAW_BODY_START-->([\s\S]*?)<!--RAW_BODY_END-->/g, '');
    // Remove any extra blank lines left behind
    content = content.replace(/^\s*\n/gm, '');
    fs.writeFileSync(filepath, content, 'utf8');
}

// Remove RAW_BODY from all posts in all categories
function removeRawBodyFromAllPosts() {
    const POSTS_ROOT = path.join(__dirname, 'Posts');
    if (!fs.existsSync(POSTS_ROOT)) return;
    const categories = fs.readdirSync(POSTS_ROOT).filter(f => fs.statSync(path.join(POSTS_ROOT, f)).isDirectory());
    for (const cat of categories) {
        const catDir = path.join(POSTS_ROOT, cat);
        const files = fs.readdirSync(catDir).filter(f => f.endsWith('.html'));
        for (const file of files) {
            removeRawBodyFromFile(path.join(catDir, file));
        }
    }
}

// Call this function once on server start to clean up all posts
removeRawBodyFromAllPosts();

// Serve static files from the root directory (after Poster.html protection)
app.use(express.static(__dirname));

// Serve partials for posts and all pages
app.use('/HumanityIsObliviouslyBlindedToPowers/partials', express.static(path.join(__dirname, 'partials')));

// Serve CSS and assets for posts and all pages
app.use('/HumanityIsObliviouslyBlindedToPowers/style.css', express.static(path.join(__dirname, 'style.css')));
app.use('/HumanityIsObliviouslyBlindedToPowers/Assets', express.static(path.join(__dirname, 'Assets')));

// DRAFT SYSTEM
const DRAFTS_ROOT = path.join(__dirname, 'Posts', 'Drafts');

// List all drafts
app.get('/list-drafts', requireAuth, (req, res) => {
    let result = [];
    try {
        if (fs.existsSync(DRAFTS_ROOT)) {
            const files = fs.readdirSync(DRAFTS_ROOT).filter(f => f.endsWith('.json'));
            for (const file of files) {
                const filePath = path.join(DRAFTS_ROOT, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                result.push({
                    filename: file,
                    title: data.title,
                    category: data.category,
                    date: data.date
                });
            }
            // Sort by date descending
            result.sort((a, b) => b.date.localeCompare(a.date));
        }
        res.json(result);
    } catch (err) {
        res.status(500).json([]);
    }
});

// Save or update a draft (used by autosave too)
app.post('/save-draft', requireAuth, (req, res) => {
    const { category, title, body, edit_filename, autosave_id, is_autosave } = req.body;
    if (!title || !body || !category) return res.status(400).json({ error: 'Missing data.' });
    if (!fs.existsSync(DRAFTS_ROOT)) fs.mkdirSync(DRAFTS_ROOT, { recursive: true });
    let filename;
    if (edit_filename) {
        filename = edit_filename;
    } else if (autosave_id) {
        filename = autosave_id;
    } else {
        // Use timestamp and sanitized title for uniqueness
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}-${month}-${year}`;
        const safeTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 32);
        filename = `${dateStr}_${safeTitle}_${Date.now()}${is_autosave ? '_autosave' : ''}.json`;
    }
    const draftData = {
        category,
        title,
        body,
        date: new Date().toISOString()
    };
    fs.writeFileSync(path.join(DRAFTS_ROOT, filename), JSON.stringify(draftData, null, 2));
    res.json({ success: true, filename });
});

// Get a draft for editing
app.post('/get-draft', requireAuth, (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Missing filename.' });
    const filePath = path.join(DRAFTS_ROOT, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Draft not found.' });
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // Always return the original raw body (not processed/stripped)
        res.json({
            title: data.title,
            category: data.category,
            rawBody: data.body
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load draft.' });
    }
});

// Delete a draft (used by autosave too)
app.post('/delete-draft', requireAuth, (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Missing filename.' });
    const filePath = path.join(DRAFTS_ROOT, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Draft not found.' });
    try {
        fs.unlinkSync(filePath);
        res.json({ success: true, reload: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete draft.' });
    }
});

// === COMMENT SYSTEM ===
const multer = require('multer');
const IMAGES_ROOT = path.join(__dirname, 'Assets', 'Uploads');
if (!fs.existsSync(IMAGES_ROOT)) fs.mkdirSync(IMAGES_ROOT, { recursive: true });
const upload = multer({
    dest: IMAGES_ROOT,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(null, false);
        cb(null, true);
    }
});

// List all uploaded images (for table and preview)
app.get('/list-images', requireAuth, (req, res) => {
    try {
        const files = fs.readdirSync(IMAGES_ROOT).filter(f =>
            /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f)
        );
        const images = files.map(f => ({
            filename: f,
            url: `/HumanityIsObliviouslyBlindedToPowers/Assets/Uploads/${f}`
        }));
        res.json(images);
    } catch (e) {
        res.json([]);
    }
});

// Upload image endpoint
app.post('/upload-image', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    // Optionally rename file to avoid collisions
    const ext = path.extname(req.file.originalname);
    const safeName = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext;
    const destPath = path.join(IMAGES_ROOT, safeName);
    fs.renameSync(req.file.path, destPath);
    res.json({ success: true, filename: safeName });
});

// Delete image endpoint
app.post('/delete-image', requireAuth, (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Missing filename.' });
    const filePath = path.join(IMAGES_ROOT, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Image not found.' });
    try {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete image.' });
    }
});

app.use('/HumanityIsObliviouslyBlindedToPowers/Assets/Uploads', express.static(IMAGES_ROOT));

const COMMENTS_ROOT = path.join(__dirname, 'Comments');
if (!fs.existsSync(COMMENTS_ROOT)) fs.mkdirSync(COMMENTS_ROOT, { recursive: true });

// Get comments for a post
app.get('/comments', (req, res) => {
    const { category, filename } = req.query;
    if (!category || !filename) return res.status(400).json({ error: 'Missing data.' });
    const commentsFile = path.join(COMMENTS_ROOT, `${category}__${filename}.json`);
    if (!fs.existsSync(commentsFile)) return res.json([]);
    try {
        const comments = JSON.parse(fs.readFileSync(commentsFile, 'utf8'));
        res.json(comments);
    } catch {
        res.json([]);
    }
});

// Add a comment to a post (Google login required)
app.post('/comments', (req, res) => {
    if (!req.user || !req.user.displayName) {
        return res.status(401).json({ error: 'Google login required.' });
    }
    const { category, filename, text } = req.body;
    if (!category || !filename || !text) return res.status(400).json({ error: 'Missing data.' });
    const commentsFile = path.join(COMMENTS_ROOT, `${category}__${filename}.json`);
    let comments = [];
    try {
        if (fs.existsSync(commentsFile)) {
            comments = JSON.parse(fs.readFileSync(commentsFile, 'utf8'));
        }
    } catch {}
    const safeName = String(req.user.displayName).slice(0, 32).replace(/[<>]/g, '');
    const safeText = String(text).slice(0, 1000).replace(/[<>]/g, '');
    comments.push({
        name: safeName,
        text: safeText,
        date: new Date().toISOString()
    });
    fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
    res.json({ success: true });
});

// Add this endpoint before app.listen
app.get('/user-info', (req, res) => {
    if (req.user && req.user.displayName) {
        res.json({ loggedIn: true, name: req.user.displayName });
    } else {
        res.json({ loggedIn: false });
    }
});

// Edit a comment (Google login required)
app.post('/edit-comment', (req, res) => {
    if (!req.user || !req.user.displayName) {
        return res.status(401).json({ error: 'Google login required.' });
    }
    const { category, filename, index, text } = req.body;
    if (!category || !filename || typeof index !== 'number' || !text) return res.status(400).json({ error: 'Missing data.' });
    const commentsFile = path.join(COMMENTS_ROOT, `${category}__${filename}.json`);
    if (!fs.existsSync(commentsFile)) return res.status(404).json({ error: 'Comment not found.' });
    let comments = [];
    try {
        comments = JSON.parse(fs.readFileSync(commentsFile, 'utf8'));
    } catch {}
    if (!comments[index]) return res.status(404).json({ error: 'Comment not found.' });
    // Only allow editing if user is the author
    if (comments[index].name !== String(req.user.displayName).slice(0, 32).replace(/[<>]/g, '')) {
        return res.status(403).json({ error: 'Not your comment.' });
    }
    comments[index].text = String(text).slice(0, 1000).replace(/[<>]/g, '');
    comments[index].edited = true;
    fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
    res.json({ success: true });
});

// Delete a comment (Google login required)
app.post('/delete-comment', (req, res) => {
    if (!req.user || !req.user.displayName) {
        return res.status(401).json({ error: 'Google login required.' });
    }
    const { category, filename, index } = req.body;
    if (!category || !filename || typeof index !== 'number') return res.status(400).json({ error: 'Missing data.' });
    const commentsFile = path.join(COMMENTS_ROOT, `${category}__${filename}.json`);
    if (!fs.existsSync(commentsFile)) return res.status(404).json({ error: 'Comment not found.' });
    let comments = [];
    try {
        comments = JSON.parse(fs.readFileSync(commentsFile, 'utf8'));
    } catch {}
    if (!comments[index]) return res.status(404).json({ error: 'Comment not found.' });
    // Only allow deleting if user is the author
    if (comments[index].name !== String(req.user.displayName).slice(0, 32).replace(/[<>]/g, '')) {
        return res.status(403).json({ error: 'Not your comment.' });
    }
    comments.splice(index, 1);
    fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
    res.json({ success: true });
});

// Add endpoint to serve categories to frontend
app.get('/categories', (req, res) => {
    res.json(categories);
});

/*
Additional security measures you can take:

1. Use HTTPS in production to encrypt all traffic.
2. Set `secure: true` on your session cookie (only works with HTTPS).
3. Use a strong, unpredictable session secret.
4. Set `cookie.sameSite: 'strict'` for your session.
5. Limit login attempts to prevent brute force attacks.
6. Sanitize and validate all user input (especially for post creation).
7. Regularly update dependencies to patch vulnerabilities.
8. Store sensitive config (like secrets and keys) in environment variables, not in code.
9. Use helmet (npm package) to set secure HTTP headers:
   const helmet = require('helmet');
   app.use(helmet());
10. Log out users after inactivity or on logout (already done with session expiry).
11. Restrict file uploads and validate file types if you add upload features.
12. Consider using CSRF protection for forms (e.g., with csurf package).
13. Monitor server logs for suspicious activity.

For most developer/admin tools, HTTPS, strong passwords, session security, and limiting exposure are the most important.
*/
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

// Add this route BEFORE /auth/google
app.get('/login', (req, res) => {
    // Get the URL from the query parameter. Default to homepage if not present.
    const returnTo = req.query.returnTo || '/';
    req.session.returnTo = returnTo;
    res.redirect('/auth/google');
});

// Update your /auth/google to NOT set any session or lastPostUrl
app.get('/auth/google', (req, res, next) => {
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});
    // Get the URL from the query parameter. Default to homepage if not present.


// Update your /auth/google to NOT set any session or lastPostUrl
app.get('/auth/google', (req, res, next) => {
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

