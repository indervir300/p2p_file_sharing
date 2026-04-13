const fs = require('fs');
let content = fs.readFileSync('src/app/page.js', 'utf-8');

content = content.replace(
  /<div className=\{\`flex-1 overflow-y-auto px-3 py-5 sm:px-4 lg:px-6 flex flex-col \$\{transfers\.length === 0 \? 'justify-center' : ''\}\`\}>\s*<div className="mx-auto w-full max-w-3xl flex flex-col gap-5">\s*\{\/\* Drop Zone \*\/\}\s*<FileDropZone onFilesSelect=\{handleFilesAttach\} disabled=\{false\} \/>/g,
  `<div className={\`flex-1 overflow-y-auto px-3 py-5 sm:px-4 lg:px-6 flex flex-col \${transfers.length === 0 ? 'justify-center' : ''}\`}>
              <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">    

                {/* Left Column: Drop Zone + Active + Queue */}
                <div className="flex flex-col gap-5 lg:col-span-7 xl:col-span-8 w-full max-w-3xl mx-auto lg:mx-0">
                  {/* Drop Zone */}
                  <FileDropZone onFilesSelect={handleFilesAttach} disabled={false} />`
);

content = content.replace(
  /\{\/\* Completed Transfers \*\/\}/g,
  `                </div>

                {/* Right Column: Completed Transfers */}
                <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4 w-full max-w-3xl mx-auto lg:max-w-md lg:sticky lg:top-0">
                  {/* Completed Transfers */}`
);

content = content.replace(
  /<\/div>\s*<\/div>\s*\{\/\* Error message/g,
  `</div>
                </div>
              </div>
            </div>

            {/* Error message`
);

fs.writeFileSync('src/app/page.js', content);
