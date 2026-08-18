const fs = require('fs');
let c = fs.readFileSync('src/data/questions/sports/clubs.json', 'utf8');

// The issue: answer values contain unescaped inner double quotes
// Pattern in file: "answer": ""text" (text)"
// Should be: "answer": "\"text\" (text)"
// Fix: replace the pattern of "" followed by text and " with escaped version
c = c.replace(/"answer\\*":\\* "(\\"|")(\\"|")/g, (m) => m);

// More robust: find all "answer": "..." and escape inner quotes
// Split by lines and fix answer lines
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.trimStart().startsWith('"answer"')) {
    // Find the value part after "answer": "
    const match = line.match(/^(\s*"answer\\*":\s*")(.*?)(",?\s*)$/);
    if (match) {
      let value = match[2];
      // If value starts or contains unescaped quotes, escape them
      value = value.replace(/(?<!\\)"/g, '\\"');
      lines[i] = match[1] + value + match[3];
    }
  }
}
c = lines.join('\n');

fs.writeFileSync('src/data/questions/sports/clubs.json', c, 'utf8');
try {
  JSON.parse(fs.readFileSync('src/data/questions/sports/clubs.json', 'utf8'));
  console.log('Fixed and valid JSON');
} catch (e) {
  console.log('Still error: ' + e.message);
}
