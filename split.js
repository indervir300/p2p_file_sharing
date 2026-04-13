const fs = require('fs');
let content = fs.readFileSync('src/app/page.js', 'utf-8');

content = content.replace(
  /<div className="\s*mx-auto w-full max-w-3xl flex flex-col gap-5\s*">/,
  '<div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">\n<div className="flex flex-col gap-5 lg:col-span-7 xl:col-span-8 w-full">'
);

content = content.replace(
  /\{\/\* Completed Transfers \*\/\}\s*\{completedTransfers\.length > 0 && \(\s*<div className="flex flex-col gap-2">/,
  '</div>\n<div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4 w-full">\n{/* Completed Transfers */}\n{completedTransfers.length > 0 && (\n<div className="flex flex-col gap-2 lg:sticky lg:top-0">'
);

fs.writeFileSync('src/app/page.js', content);
console.log("Success:", content.includes('lg:col-span-5'));
