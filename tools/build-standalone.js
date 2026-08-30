const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");

const html = fs.readFileSync(path.join(srcDir, "index.html"), "utf8");
const css = fs.readFileSync(path.join(srcDir, "css/styles.css"), "utf8");
const data = fs.readFileSync(path.join(srcDir, "js/data.js"), "utf8");
const ai = fs.readFileSync(path.join(srcDir, "js/ai.js"), "utf8");
const app = fs.readFileSync(path.join(srcDir, "js/app.js"), "utf8");

let out = html;
out = out.replace('<link rel="stylesheet" href="css/styles.css">', "<style>\n" + css + "\n</style>");
out = out.replace('<script src="js/data.js"></script>', "<script>\n" + data + "\n</script>");
out = out.replace('<script src="js/ai.js"></script>', "<script>\n" + ai + "\n</script>");
out = out.replace('<script src="js/app.js"></script>', "<script>\n" + app + "\n</script>");

const checks = ["css/styles.css", "js/data.js", "js/ai.js", "js/app.js"];
checks.forEach((c) => {
  if (out.includes(c)) throw new Error("unresolved reference: " + c);
});

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
const dest = path.join(distDir, "SOZUM-SOZ-TEKDOSYA.html");
fs.writeFileSync(dest, out, "utf8");
console.log("written", dest, out.length, "bytes");