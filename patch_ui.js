const fs = require('fs');
const content = fs.readFileSync('ui_updates.md', 'utf-8');

const filesToUpdate = [
  'src/app/globals.css',
  'src/app/layout.js',
  'src/app/components/ui/DarkModeToggle.jsx',
  'src/app/components/FileDropZone.jsx',
  'src/app/components/ProgressBar.jsx',
  'src/app/components/SessionCode.jsx'
];

for (const file of filesToUpdate) {
  // Find where the file is mentioned
  const regex = new RegExp(`### \\d+\\. \\[${file}\\][\\s\\S]*?\`\`\`(?:javascript|css)\\n([\\s\\S]*?)\\n\`\`\``, 'm');
  const match = content.match(regex);
  if (match) {
    const code = match[1];
    fs.writeFileSync(file, code);
    console.log(`Updated ${file}`);
  } else {
    console.log(`Failed to find code block for ${file}`);
  }
}
