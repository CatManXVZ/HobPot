const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// For Node.js v18+ (native fetch)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3000;


const RECAPTCHA_SECRET = '6Lfi3x4rAAAAAJAPeAMJQsnZviJsmIfu5HUZaSbV';


const USERNAME = 'CatManXvZ';
const HASHED_PASSWORD = '$2a$10$nAuygfQg5r/7uEz/qlwJoe0de2Y9iWy76KFPRD.UHLcFCS/uOPP46'; // Replace with actual bcrypt hash

// Middleware to check login session
function requireAuth(req, res, next) {
    if (req.session && req.session.loggedIn) {
        return next();
    }
    res.redirect('/login');
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
        maxAge: 60 * 1000 // 1 minute in milliseconds
    }
}));

// Move this middleware BEFORE the /Poster.html route and express.static
app.use((req, res, next) => {
    // Block direct static access to Poster.html (case-insensitive)
    if (
        req.path.toLowerCase() === '/poster.html' &&
        (!req.session || !req.session.loggedIn)
    ) {
        return res.redirect('/login');
    }
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Needed for JSON POST body

// Login page (GET)
app.get('/login', (req, res) => {
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
        <form method="POST" action="/login">
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

// Login POST handler
app.post('/login', async (req, res) => {
    const { username, password, 'g-recaptcha-response': recaptcha } = req.body;
    // Verify reCAPTCHA
    if (!recaptcha) {
        return res.redirect('/login?error=' + encodeURIComponent('Please complete the reCAPTCHA.'));
    }
    try {
        const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${RECAPTCHA_SECRET}&response=${recaptcha}`
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
            return res.redirect('/login?error=' + encodeURIComponent('reCAPTCHA failed. Try again.'));
        }
    } catch (e) {
        return res.redirect('/login?error=' + encodeURIComponent('reCAPTCHA error.'));
    }
    // Check username and password
    if (username === USERNAME && await bcrypt.compare(password, HASHED_PASSWORD)) {
        req.session.loggedIn = true;
        return res.redirect('/Poster.html');
    }
    return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password.'));
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
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

app.post('/post-website', (req, res) => {
    const { category, title, body } = req.body;
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

    // Get current date in dd-mm-yyyy format
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}-${month}-${year}`;

    const filePath = path.join(folderPath, `${dateStr}.html`);

    // Use correct absolute path for stylesheet and homepage for localhost
    const styleSheetPath = "/style.css";
    const homepagePath = "/Homepage.html";

    // Custom markup processing
    let processed = body;

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
            // Split by our fake H2 marker
            let parts = part.split('|||H2|||');
            let result = '';
            for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 1) {
                    // Heading
                    result += `<h2>${parts[i]}</h2>`;
                } else {
                    // Paragraphs: split by double newlines or single newlines, wrap in <p>
                    let paras = parts[i].split(/\n{2,}/g).map(p => p.trim()).filter(p => p.length > 0);
                    result += paras.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
                }
            }
            return `<section class="section">\n${result}\n</section>`;
        })
        .join('\n');

    // HTML content for the posted website, styled like homepage
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="/HumanityIsObliviouslyBlindedToPowersOfTen/style.css">
    <style>
    .login-btn {
        background: #F6E05E !important;
        color: #4A5568 !important;
        border: 2px solid #FF6B00;
        font-weight: bold;
        border-radius: 1.2rem;
        padding: 1.0rem 2.5rem;
        margin-left: 1.2rem;
        transition: background 0.2s, color 0.2s, border 0.2s;
    }
    .login-btn:hover,
    .login-btn:focus {
        background: #FF6B00 !important;
        color: #fff !important;
        border: 2px solid #F6E05E;
        outline: none;
    }
    .dulled {
        opacity: 0.5;
        pointer-events: none;
        cursor: default;
    }
    .modal {
        display: none;
        position: fixed;
        z-index: 2000;
        left: 0;
        top: 0;
        width: 100vw;
        height: 100vh;
        overflow: auto;
        background: rgba(0,0,0,0.4);
    }
    .modal-content {
        background: #fff;
        margin: 8% auto;
        padding: 2em 2.5em 2em 2.5em;
        border: 2px solid #F6E05E;
        border-radius: 1.2rem;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 8px 32px 0 rgba(74,85,104,0.18);
        position: relative;
        color: #4A5568;
        font-family: inherit;
    }
    .modal-content label {
        display: block;
        margin-top: 1em;
        font-weight: bold;
        color: #FF6B00;
    }
    .modal-content input[type="text"],
    .modal-content input[type="password"] {
        width: 100%;
        padding: 0.7em;
        margin-top: 0.3em;
        border-radius: 0.7em;
        border: 1px solid #4A5568;
        background: #F7FAFC;
        font-size: 1.1em;
        margin-bottom: 0.7em;
    }
    .modal-content .close {
        position: absolute;
        top: 0.7em;
        right: 1.2em;
        color: #FF6B00;
        font-size: 2em;
        font-weight: bold;
        cursor: pointer;
        transition: color 0.2s;
    }
    .modal-content .close:hover {
        color: #E55D00;
    }
    </style>
</head>
<body>
    <div id="header-include"></div>
    <div id="sidebar-include"></div>
    <div class="content-layout">
        <main>
            ${sections}
        </main>
    </div>
    <div id="footer-include"></div>
    <div id="login-modal-include"></div>
    <script>
    function includeHTML(id, url, cb) {
        fetch('/HumanityIsObliviouslyBlindedToPowersOfTen/partials/' + url)
          .then(res => res.text())
          .then(html => {
              document.getElementById(id).innerHTML = html;
              if (cb) cb();
          });
    }
    includeHTML('header-include', 'header.html', function() {
        // Set header title to the post/page title
        var titleSpan = document.getElementById('header-title');
        if (titleSpan) titleSpan.textContent = ${JSON.stringify(title)};
        // Remove dulled class from Homepage menu
        var homeMenu = document.getElementById('menu-homepage');
        if (homeMenu) homeMenu.classList.remove('dulled');
        // Modal logic: create modal dynamically on Log In click
        var loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.onclick = function(e) {
                e.preventDefault();
                var oldModal = document.getElementById('login-modal');
                if (oldModal) oldModal.remove();
                var modal = document.createElement('div');
                modal.id = 'login-modal';
                modal.className = 'modal';
                modal.innerHTML = \`
                    <div class="modal-content">
                        <span class="close" id="close-login-modal">&times;</span>
                        <h2>Log In</h2>
                        <form id="login-form" autocomplete="off">
                            <label for="login-username">Username:</label>
                            <input type="text" id="login-username" name="username" required>
                            <label for="login-password">Password:</label>
                            <input type="password" id="login-password" name="password" required>
                            <button type="submit" class="login-btn" style="margin-left:0;margin-top:1em;">Log In</button>
                        </form>
                    </div>
                \`;
                document.body.appendChild(modal);
                var closeModal = document.getElementById('close-login-modal');
                closeModal.onclick = function() {
                    modal.style.display = "none";
                    modal.remove();
                };
                window.addEventListener('click', function(event) {
                    if (event.target === modal) {
                        modal.style.display = "none";
                        modal.remove();
                    }
                });
                document.getElementById('login-form').onsubmit = function(e) {
                    e.preventDefault();
                    modal.style.display = "none";
                    modal.remove();
                };
                modal.style.display = "block";
            };
        }
        // Modal CSS (only once)
        if (!document.getElementById('login-modal-style')) {
            var style = document.createElement('style');
            style.id = 'login-modal-style';
            style.textContent = \`
            .modal {
                display: none;
                position: fixed;
                z-index: 2000;
                left: 0;
                top: 0;
                width: 100vw;
                height: 100vh;
                overflow: auto;
                background: rgba(0,0,0,0.4);
            }
            .modal-content {
                background: #fff;
                margin: 8% auto;
                padding: 2em 2.5em 2em 2.5em;
                border: 2px solid #F6E05E;
                border-radius: 1.2rem;
                width: 100%;
                max-width: 400px;
                box-shadow: 0 8px 32px 0 rgba(74,85,104,0.18);
                position: relative;
                color: #4A5568;
                font-family: inherit;
            }
            .modal-content label {
                display: block;
                margin-top: 1em;
                font-weight: bold;
                color: #FF6B00;
            }
            .modal-content input[type="text"],
            .modal-content input[type="password"] {
                width: 100%;
                padding: 0.7em;
                margin-top: 0.3em;
                border-radius: 0.7em;
                border: 1px solid #4A5568;
                background: #F7FAFC;
                font-size: 1.1em;
                margin-bottom: 0.7em;
            }
            .modal-content .close {
                position: absolute;
                top: 0.7em;
                right: 1.2em;
                color: #FF6B00;
                font-size: 2em;
                font-weight: bold;
                cursor: pointer;
                transition: color 0.2s;
            }
            .modal-content .close:hover {
                color: #E55D00;
            }
            \`;
            document.head.appendChild(style);
        }
    });
    includeHTML('sidebar-include', 'sidebar.html');
    includeHTML('footer-include', 'footer.html');
    includeHTML('login-modal-include', 'login-modal.html');
    </script>
</body>
</html>
`;

    fs.writeFileSync(filePath, htmlContent);

    res.send(`<p>Post created successfully! <a href="/">Create another</a></p>`);
});

const POSTS_ROOT = path.join(__dirname, 'Posts');

// API endpoint to list all posts for Poster.html
app.get('/list-posts', requireAuth, (req, res) => {
    const categories = ['ComputerScience', 'Math'];
    let result = { ComputerScience: [], Math: [] };
    try {
        for (const cat of categories) {
            const catDir = path.join(POSTS_ROOT, cat);
            if (fs.existsSync(catDir)) {
                const files = fs.readdirSync(catDir).filter(f => f.endsWith('.html'));
                for (const file of files) {
                    // Expect filename as dd-mm-yyyy.html
                    const dateMatch = file.match(/^(\d{2}-\d{2}-\d{4})\.html$/);
                    if (!dateMatch) continue;
                    const date = dateMatch[1];
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
            result[cat].sort((a, b) => b.date.localeCompare(a.date));
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

// Prevent direct access to Poster.html static file
app.use((req, res, next) => {
    if (req.path.toLowerCase() === '/poster.html') {
        // If someone tries to access Poster.html directly as a static file, redirect to /login
        return res.redirect('/login');
    }
    next();
});

// Serve static files from the root directory (after Poster.html protection)
app.use(express.static(__dirname));

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
    console.log(`Server running at http://localhost:${PORT}`);
});
