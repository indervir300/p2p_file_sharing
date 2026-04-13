const fs = require('fs');
let content = fs.readFileSync('src/app/page.js', 'utf-8');

const regex = /<\/div>\s*<\/div>\s*\{\/\* Error message/g;
if (regex.test(content)) {
  console.log("Matched the end tags");
} else {
  console.log("no match for end tags");
}
