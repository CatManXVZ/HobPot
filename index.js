const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Sequelize, DataTypes } = require('sequelize');


// Use global fetch if available (Node 18+), otherwise fallback to node-fetch
let fetchFn;
if (typeof globalThis.fetch === 'function') {
    fetchFn = globalThis.fetch.bind(globalThis);
} else {
    fetchFn = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
}

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
// We'll set callbackURL dynamically per request

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback', // This will be overridden per request
    passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => {
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

// Helper to get full URL for callback
function getFullCallbackUrl(req) {
    // Use protocol and host from request
    return req.protocol + '://' + req.get('host') + '/auth/google/callback';
}

app.get('/auth/google', (req, res, next) => {
    // Save the page the user was on (referer or query param)
    let returnTo = req.query.returnTo || req.get('referer') || req.session.returnTo || '/';
    req.session.returnTo = returnTo;
    // Dynamically set callbackURL for this request
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        callbackURL: getFullCallbackUrl(req)
    })(req, res, next);
});


app.get('/auth/google/callback', (req, res, next) => {
    // Dynamically set callbackURL for this request
    passport.authenticate('google', {
        failureRedirect: '/',
        callbackURL: getFullCallbackUrl(req)
    })(req, res, next);
}, (req, res) => {
    // Use the stored returnTo URL, or fallback to homepage
    const redirectTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(redirectTo);
});

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

// Homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Homepage.html'));
});
app.get('/Homepage.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'Homepage.html'));
});
app.get('/Poster.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'Poster.html'));
});

// --- Friendly post URL redirect: /post-title-here ---
app.get(/^\/([a-zA-Z0-9\-]+)$/, (req, res, next) => {
    const slug = req.params[0];
    // Split slug into words (hyphens as separator), ignore case
    const slugWords = slug.toLowerCase().split('-').filter(Boolean);
    const POSTS_ROOT = path.join(__dirname, 'Posts');
    try {
        const categories = fs.readdirSync(POSTS_ROOT).filter(f => fs.statSync(path.join(POSTS_ROOT, f)).isDirectory());
        for (const cat of categories) {
            const catDir = path.join(POSTS_ROOT, cat);
            const files = fs.readdirSync(catDir).filter(f => f.endsWith('.html'));
            for (const file of files) {
                const filePath = path.join(catDir, file);
                let content = '';
                try {
                    content = fs.readFileSync(filePath, 'utf8');
                } catch {}
                const match = content.match(/<title>([^<]+)<\/title>/i);
                if (match) {
                    // Normalize title: remove extra spaces, lowercase
                    let fileTitle = match[1].replace(/\s+/g, ' ').trim().toLowerCase();
                    // Split title into words using both spaces and hyphens
                    const titleWords = fileTitle.split(/[-\s]+/).filter(Boolean);
                    // Check if all slug words are present in the title (any order)
                    if (slugWords.length > 0 && slugWords.every(word => titleWords.includes(word))) {
                        // Redirect to the actual post URL (relative to site root)
                        const relPath = path.relative(__dirname, filePath).replace(/\\/g, '/');
                        return res.redirect(relPath);
                    }
                }
            }
        }
    } catch {}
    // Not found, continue to next handler (404 or other routes)
    next();
});

// When creating or editing a post, store the raw markup as a comment in the HTML for future editing
app.post('/post-website', async (req, res) => {
    const { category, title, body, keywords, edit_category, edit_filename, draft_filename, autosave_id } = req.body;
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

    // --- Gemini AI meta description generation ---
    async function getGeminiMetaDescription(postTitle, postBody) {
        try {
            const apiKey = 'AIzaSyBXaA3tV9kBtkmCuxFetDiwdqxot-8cQUw';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
            const prompt = `Generate an SEO-friendly meta description for the following blog post. Make it less than 160 words, concise, and engaging. Do not use hashtags.\nTitle: ${postTitle}\nContent: ${postBody.slice(0, 1200)}`;
            const response = await fetchFn(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const data = await response.json();
            if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
                return data.candidates[0].content.parts[0].text.trim().replace(/\n/g, ' ');
            }
        } catch (e) {
            console.error('Gemini meta description error:', e);
        }
        return '';
    }

    // Custom markup processing
    // --- Unified Markup Processing (matches Poster.html preview) ---
    // Replace all /s (section splitter) with /sec (new section marker) before any further processing (to match Poster.html)
    // Accept /s with or without surrounding whitespace/newlines, but only if not already /sec
    let processed = body.replace(/(^|\n)\s*\/s(?!ec)(?=\s|$)/g, '$1/sec');
    processed = processed.replace(/\s\/s\b/g, ' /sec');
    processed = processed.replace(/(^|\n)\s*\/s\b/g, '$1/sec');

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
            let imgTag = `<img alt="${caption ? caption.trim() : ''}" src="${url}"${attrs}${imgClass ? ` class="${imgClass}"` : ''} style="max-width:100%;border-radius:0.4em;">`;
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
    // --- H3: /3 ... / ---
    processed = processed.replace(/\/3\s*([^\n\/]+)\s*\//g, (match, headerText) => {
        return `<h3>${headerText.trim()}</h3>`;
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
                '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','π':'ᶲ'
            };
            return str.split('').map(c => supMap[c] || c).join('');
        }
        math = math.replace(/(?<!−)\^([a-zA-Z0-9]+)/g, (m, sup) => toSuperscript(sup));
        // Now wrap in <math> (no HTML tags inside)
        return `<math>${math}</math>`;
    });


    // --- Restore code blocks ---
    // (Move this BEFORE the double-hyphen replacement to preserve -- inside code blocks)
    processed = processed.replace(/\|\|\|CODEBLOCK_LANG_(\d+)\|\|\|/g, (match, idx) => {
        let { lang, code } = codeBlocks[Number(idx)];
        code = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class=\"language-${lang}\">${code}</code></pre>`;
    });
    processed = processed.replace(/\|\|\|CODEBLOCK_(\d+)\|\|\|/g, (match, idx) => {
        let { code } = codeBlocks[Number(idx)];
        code = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code>${code}</code></pre>`;
    });

    // --- Replace -- with / everywhere (after all formatting, but NOT inside code blocks) ---
    // This is now safe because code blocks have been restored
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
    let sectionArr = processed
        .split(/(?:\r?\n)?\s*\/sec\s*(?:\r?\n)?/g)
        .map(part => {
            let parts = part.split('|||H2|||');
            let result = '';
            for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 1) {
                    result += `<h2>${parts[i]}</h2>`;
                } else {
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
        });
    // Insert <h1>title</h1> before the first section
    if (sectionArr.length > 0) {
        sectionArr[0] = `<h1>${escapeHtml(title)}</h1>\n` + sectionArr[0];
    }
    const sections = sectionArr.join('\n');

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

    // --- Get meta description from Gemini AI ---
    let metaDescription = await getGeminiMetaDescription(title, body);
    if (!metaDescription) metaDescription = '';

    // --- Meta keywords ---
    let metaKeywords = '';
    if (keywords) {
        if (Array.isArray(keywords)) {
            metaKeywords = keywords.join(',');
        } else if (typeof keywords === 'string') {
            metaKeywords = keywords;
        }
        metaKeywords = metaKeywords.split(',').map(k => k.trim()).filter(Boolean).join(', ');
    }

    // HTML content for the posted website, styled like homepage and with partial includes
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
    ${metaKeywords ? `<meta name="keywords" content="${escapeHtml(metaKeywords)}">` : ''}
    <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,100..900;1,100..900&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="/HumanityIsObliviouslyBlindedToPowersOfTen/style.css">
    <!-- Prism.js for syntax highlighting -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css">
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-javascript.min.js"></script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7840248288117001"
     crossorigin="anonymous"></script>
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
    <section id="comments-section" class="comments-section" style="margin-left:25% !important;">
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
    <script src="/HumanityIsObliviouslyBlindedToPowersOfTen/partials/code/header.js"></script>
    <script src="/HumanityIsObliviouslyBlindedToPowersOfTen/partials/code/sidebar.js"></script>
    <script src="/HumanityIsObliviouslyBlindedToPowersOfTen/partials/code/footer.js"></script>
    <script>
    function includeHTML(id, url, cb) {
        fetch('/HumanityIsObliviouslyBlindedToPowersOfTen/partials/' + url)
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
                  // Open sidebar by default on desktop
                  var sidebar = document.querySelector('#sidebar-include .sidebar');
                  if (sidebar) {
                      sidebar.classList.remove('closed');
                      sidebar.classList.add('open');
                  }
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
    </script>
    <script src="/HumanityIsObliviouslyBlindedToPowersOfTen/partials/code/post.js"></script>
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
                    // Accept any .html file as a post
                    // Try to extract date from filename (dd-mm-yyyy or dd-mm-yyyy_*) else fallback to file mtime
                    let date = '';
                    const dateMatch = file.match(/^(\d{2}-\d{2}-\d{4})/);
                    if (dateMatch) {
                        date = dateMatch[1];
                    } else {
                        // fallback: use file modified time
                        try {
                            const stat = fs.statSync(path.join(catDir, file));
                            date = stat.mtime.toISOString().slice(0, 10).split('-').reverse().join('-');
                        } catch { date = ''; }
                    }
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
function unescapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
}
let rawBody = '';
const rawDivMatch = content.match(/<div id=["']raw-body-data["'][^>]*>([\s\S]*?)<\/div>/);
if (rawDivMatch) {
    rawBody = unescapeHtml(rawDivMatch[1].trim());
} else {
    // Fallback: try old comment method
    const rawMatch = content.match(/<!--RAW_BODY_START-->([\\s\\S]*?)<!--RAW_BODY_END-->/);
    if (rawMatch) {
        rawBody = rawMatch[1].trim();
    } else {
        // Fallback: reconstruct from HTML (existing logic)
        // ...
    }
}
        // Extract keywords from meta tag
        let keywords = '';
        const keywordsMatch = content.match(/<meta name=["']keywords["'] content=["']([^"']*)["']/i);
        if (keywordsMatch) {
            keywords = keywordsMatch[1];
        }
        res.json({ title, rawBody, keywords });
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
app.use('/HumanityIsObliviouslyBlindedToPowersOfTen/partials', express.static(path.join(__dirname, 'partials')));
// Serve partials/code for all pages
app.use('/HumanityIsObliviouslyBlindedToPowersOfTen/partials/code', express.static(path.join(__dirname, 'partials', 'code')));
// Serve CSS and assets for posts and all pages
app.use('/HumanityIsObliviouslyBlindedToPowersOfTen/style.css', express.static(path.join(__dirname, 'style.css')));
app.use('/HumanityIsObliviouslyBlindedToPowersOfTen/Assets', express.static(path.join(__dirname, 'Assets')));

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
    const { category, title, body, keywords, edit_filename, autosave_id, is_autosave } = req.body;
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
        keywords: typeof keywords === 'string' ? keywords : '',
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
            rawBody: data.body,
            keywords: typeof data.keywords === 'string' ? data.keywords : ''
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

// Delete a comment (admin: allow from Poster.html session)
app.post('/delete-comment', (req, res) => {
    // Allow if admin session (Poster.html access)
    if (req.session && req.session.loggedIn) {
        const { category, filename, index } = req.body;
        if (!category || !filename || typeof index !== 'number') return res.status(400).json({ error: 'Missing data.' });
        const commentsFile = path.join(COMMENTS_ROOT, `${category}__${filename}.json`);
        if (!fs.existsSync(commentsFile)) return res.status(404).json({ error: 'Comment not found.' });
        let comments = [];
        try {
            comments = JSON.parse(fs.readFileSync(commentsFile, 'utf8'));
        } catch {}
        if (!comments[index]) return res.status(404).json({ error: 'Comment not found.' });
        comments.splice(index, 1);
        fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2));
        return res.json({ success: true });
    }
    // Otherwise, require Google login and author match
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

