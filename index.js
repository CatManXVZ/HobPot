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
        maxAge: 3 * 60 * 60 * 1000 // 3 hours in milliseconds
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
    // --- Unified Markup Processing (matches Poster.html preview) ---
    // Replace all /s (section splitter) with /sec (new section marker) before any further processing (to match Poster.html)
    // Accept /s with or without surrounding whitespace/newlines, but only if not already /sec
    let processed = body.replace(/(^|\n)\s*\/s(?!ec)(?=\s|$)/g, '$1/sec');

    // --- Replace /s with /sec before any section splitting (to match Poster.html preview) ---
    processed = processed.replace(/\s\/s\b/g, ' /sec');
    processed = processed.replace(/(^|\n)\s*\/s\b/g, '$1/sec');

    // --- Protect code blocks with placeholders ---
    let codeBlocks = [];

    // /c language ... /
    processed = processed.replace(/\/c\s*(python|javascript|java|lua|c|cpp)\s+([\s\S]*?)\s*\//g, (match, lang, code) => {
        codeBlocks.push({ lang, code });
        return `|||CODEBLOCK_LANG_${codeBlocks.length - 1}|||`;
    });
    // /c ... /
    processed = processed.replace(/\/c\s+([\s\S]*?)\s*\//g, (match, code) => {
        codeBlocks.push({ lang: null, code });
        return `|||CODEBLOCK_${codeBlocks.length - 1}|||`;
    });

    // --- Images: /pic code [height] [width] [style] [caption]/ ---
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

    // --- Lists ---
    processed = processed.replace(/\/l\s*((?:\/e\s*[^\/]+)+)\/\s*/g, (match, listContent) => {
        const items = [...listContent.matchAll(/\/e\s*([^\/\n]+)/g)].map(m => `<li>${m[1].trim()}</li>`);
        return `<ul>${items.join('')}</ul>`;
    });

    // --- Headers ---
    processed = processed.replace(/\/h\s*([^\n\/]+)\s*\//g, (match, headerText) => {
        return '|||H2|||'+headerText.trim()+'|||H2|||';
    });

    // --- Bold ---
    processed = processed.replace(/\/b\s*([^\n\/]+)\s*\//g, (match, boldText) => {
        return `<b>${boldText.trim()}</b>`;
    });

    // --- Italics ---
    processed = processed.replace(/\/i\s*([^\n\/]+)\s*\//g, (match, italicText) => {
        return `<i>${italicText.trim()}</i>`;
    });

    // --- Underline ---
    processed = processed.replace(/\/u\s*([^\n\/]+)\s*\//g, (match, underlineText) => {
        return `<u>${underlineText.trim()}</u>`;
    });

    // --- Math: /m ... / ---
    processed = processed.replace(/\/m\s*([\s\S]*?)\s*\//g, (match, mathText) => {
        let math = mathText.trim();
        // Replace * with multiplication circle (U+2219) and - with long minus (U+2212)
        math = math.replace(/\*/g, '∙').replace(/-/g, '−');
        // Fractions: replace x--x or da--db with Unicode fraction slash
        math = math.replace(/([a-zA-Z0-9]+)\s*−−\s*([a-zA-Z0-9]+)/g, (m, num, den) => `${num}\u2044${den}`);
        // Subscript: replace −^x with Unicode subscript
        function toSubscript(str) {
            const subMap = {
                '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
                'a':'ₐ','e':'ₑ','h':'ₕ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ','o':'ₒ','p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','x':'ₓ',
                '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎'
            };
            return str.split('').map(c => subMap[c] || c).join('');
        }
        math = math.replace(/−\^([a-zA-Z0-9]+)/g, (m, sub) => toSubscript(sub));
        // Superscript: replace ^x with Unicode superscript
        function toSuperscript(str) {
            const supMap = {
                '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
                'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','i':'ⁱ','j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','n':'ⁿ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ',
                '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾'
            };
            return str.split('').map(c => supMap[c] || c).join('');
        }
        math = math.replace(/(?<!−)\^([a-zA-Z0-9]+)/g, (m, sup) => toSuperscript(sup));
        // Now wrap in <math> (no HTML tags inside)
        return `<math>${math}</math>`;
    });

    // --- Replace -- with / everywhere (after all formatting) ---
    processed = processed.replace(/--/g, '/');

    // --- Restore code blocks ---
    processed = processed.replace(/\|\|\|CODEBLOCK_LANG_(\d+)\|\|\|/g, (match, idx) => {
        let { lang, code } = codeBlocks[Number(idx)];
        // Do NOT replace -- with / inside code blocks (preserve original)
        code = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class=\"language-${lang}\">${code}</code></pre>`;
    });
    processed = processed.replace(/\|\|\|CODEBLOCK_(\d+)\|\|\|/g, (match, idx) => {
        let { code } = codeBlocks[Number(idx)];
        code = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code>${code}</code></pre>`;
    });

    // --- Sections: split on /sec and wrap in <section> ---
    const sections = processed
        .split(/(?:\r?\n)?\s*\/sec\s*(?:\r?\n)?/g)
        .map(part => {
            let parts = part.split('|||H2|||');
            let result = '';
            for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 1) {
                    result += `<h2>${parts[i]}</h2>`;
                } else {
                    // Paragraphs: split by double newlines or single newlines, wrap in <p>
                    // But do NOT wrap <pre><code> blocks in <p>
                    let blocks = parts[i].split(/(<pre><code[\s\S]*?<\/code><\/pre>)/g);
                    for (let b = 0; b < blocks.length; b++) {
                        if (/^<pre><code/.test(blocks[b])) {
                            result += blocks[b];
                        } else {
                            let paras = blocks[b].split(/\n{2,}/g).map(p => p.trim()).filter(p => p.length > 0);
                            result += paras.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
                        }
                    }
                }
            }
            return `<section class=\"section\">\n${result}\n</section>`;
        })
        .join('\n');

    // Store the raw markup as a comment for future editing (hide it with CSS)
    function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function(tag) {
        const charsToReplace = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return charsToReplace[tag] || tag;
    });
}
const rawMarkupComment = `<div id="raw-body-data" style="display:none !important;">${escapeHtml(body)}</div>`;

    // HTML content for the posted website, styled like homepage and with partial includes
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="/HumanityIsObliviouslyBlindedToPowers/

