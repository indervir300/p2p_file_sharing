const fs = require('fs');
let content = fs.readFileSync('src/app/page.js', 'utf-8');

content = content.replace(
  /<\/div>\s*<\/div>\s*\{errorMsg && \(/g,
  `</div>\n                </div>\n              </div>\n            </div>\n\n            {errorMsg && (`
);

fs.writeFileSync('src/app/page.js', content);
