const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'frontendnext');
const exts = ['.tsx', '.ts', '.jsx', '.js'];

function walk(dir) {
  const results = [];
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      results.push(...walk(file));
    } else if (exts.includes(path.extname(file))) {
      results.push(file);
    }
  }
  return results;
}

function replaceInFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  let orig = src;

  // Replace String(foo._id) -> getId(foo)
  src = src.replace(/String\(\s*([A-Za-z0-9_$.]+)\._id\s*\)/g, 'getId($1)');
  // Replace `${foo._id}:...` -> `${getId(foo)}:...`
  src = src.replace(/\$\{\s*([A-Za-z0-9_$.]+)\._id([^}]*)\}/g, '${getId($1)$2}');
  // Replace foo._id (but avoid already converted getId(foo))
  src = src.replace(/([^A-Za-z0-9_$]|^)\b([A-Za-z0-9_$.]+)\._id\b/g, (m, p1, p2) => {
    // if looks like getId(foo) already present nearby, skip
    return (p1 || '') + 'getId(' + p2 + ')';
  });

  // Replace value={foo._id} -> value={getId(foo)} and key={foo._id} similarly handled above

  if (src !== orig) {
    fs.writeFileSync(file, src, 'utf8');
    return true;
  }
  return false;
}

const files = walk(root);
let changed = 0;
for (const f of files) {
  try {
    if (replaceInFile(f)) changed++;
  } catch (err) {
    console.error('ERR', f, err.message);
  }
}
console.log('Processed', files.length, 'files, changed', changed);
