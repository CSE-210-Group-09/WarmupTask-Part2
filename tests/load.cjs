// Load the page's plain scripts into one Node sandbox, as the browser shares
// one global scope between <script> tags. Returns the named top-level functions
// and constants; a name (or script) that doesn't exist yet comes back undefined,
// so a test written before its feature fails on its own instead of breaking the file.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScripts(files, names, globals = {}) {
  const context = vm.createContext({ ...globals });
  for (const file of files) {
    const source = path.join(__dirname, "..", file);
    if (fs.existsSync(source)) vm.runInContext(fs.readFileSync(source, "utf8"), context, { filename: file });
  }
  return Object.fromEntries(names.map((name) =>
    [name, vm.runInContext(`typeof ${name} === "undefined" ? undefined : ${name}`, context)]
  ));
}

module.exports = { loadScripts };
