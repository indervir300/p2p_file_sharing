const fs = require('fs');
let content = fs.readFileSync('src/app/page.js', 'utf-8');

const startTarget = "<div className={`flex-1 overflow-y-auto px-3 py-5 sm:px-4 lg:px-6 flex flex-col ${transfers.length === 0 ? 'justify-center' : ''}`}>\n              <div className=\"mx-auto w-full max-w-3xl flex flex-col gap-5\">\n\n                {/* Drop Zone */}";

const startReplacement = `<div className={\`flex-1 overflow-y-auto px-3 py-5 sm:px-4 lg:px-6 flex flex-col \${transfers.length === 0 ? 'justify-center' : ''}\`}>
              <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

                {/* LEFT COLUMN */}
                <div className="flex flex-col gap-5 lg:col-span-7 xl:col-span-8 w-full">
                  {/* Drop Zone */}`;

content = content.replace(startTarget, startReplacement);

const midTarget = "                {/* Completed Transfers */}\n                {completedTransfers.length > 0 && (\n                  <div className=\"flex flex-col gap-2\">\n                    <p className=\"text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary px-1\">\n                      Completed — {completedTransfers.length} file{completedTransfers.length > 1 ? 's' : ''}\n                    </p>";

const midReplacement = `                </div>

                {/* RIGHT COLUMN: Completed Transfers */}
                <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4 w-full">
                  {completedTransfers.length > 0 && (
                    <div className="flex flex-col gap-2 lg:sticky lg:top-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary px-1">
                        Completed — {completedTransfers.length} file{completedTransfers.length > 1 ? 's' : ''}
                      </p>`;

content = content.replace(midTarget, midReplacement);

fs.writeFileSync('src/app/page.js', content);
console.log("Replaced:", content.includes("RIGHT COLUMN"));
