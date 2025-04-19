const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
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
</head>
<body>
    <header>
        <img src="/HumanityIsObliviouslyBlindedToPowersOfTen/Assets/Fundementals/Logo.png" alt="Logo" class="logo">
        <h1>${title}</h1>
        <nav>
            <ul>
                <li><a href="/HumanityIsObliviouslyBlindedToPowersOfTen/Homepage.html">Homepage</a></li>
                <li class="dropdown">
                    <a href="#">Projects</a>
                    <div class="dropdown-content">
                        <a href="#">Archived</a>
                        <a href="#">Current</a>
                    </div>
                </li>
                <li><a href="#">Trips</a></li>
                <li class="dropdown">
                    <a href="#">Posts</a>
                    <div class="dropdown-content">
                        <a href="#">Computer Science</a>
                        <a href="#">Maths</a>
                    </div>
                </li>
                <span class="post-date" style="color:#F6E05E;font-weight:bold;margin-left:1em;"><strong>Date:</strong> ${dateStr}</span>
            </ul>
        </nav>
    </header>
    <aside class="sidebar">
        <h2>Posts</h2>
        <ul>
            <li><a href="#" class="sidebar-latest-project">Latest Project</a></li>
            <li><a href="#">Why Powers of Ten Matter</a></li>
            <li><a href="#">Design & Technology</a></li>
            <li><a href="#">Reflections</a></li>
        </ul>
        <p>
            Explore a variety of posts covering technology, design, science, and the wonders of scale. Stay tuned for regular updates and deep dives into the powers of ten and their impact on our world.
        </p>
        <p>
            More categories and featured articles coming soon. Use this sidebar to quickly navigate to topics that interest you most!
        </p>
    </aside>
    <div class="content-layout">
        <main>
            ${sections}
        </main>
    </div>
    <footer>
        <p>Contact me at <a href="mailto:aliomarabdelsalam@gmail.com">aliomarabdelsalam@gmail.com</a></p>
        <div class="footer-details">
            &copy; 2024 Humanity is Obliviously Blinded to Powers of Ten.<br>
            Designed &amp; built by Ali Abdelsalam.<br>
            All rights reserved.<br>
        </div>
        <div class="footer-links">
            <a href="/HumanityIsObliviouslyBlindedToPowersOfTen/LICENSE">Terms of Service</a>
            <a href="701116705027391598"  target="_blank">Discord</a>
            <a href="https://github.com/CatManXVZ/HobPot/">GitHub</a>
        </div>
    </footer>
</body>
</html>
`;

    fs.writeFileSync(filePath, htmlContent);

    res.send(`<p>Post created successfully! <a href="/">Create another</a></p>`);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
