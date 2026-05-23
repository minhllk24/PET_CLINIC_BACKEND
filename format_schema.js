const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');
content = content.replace(/enum\s+(\w+)\s+\{\s+([^}]+)\s+\}/g, (match, name, values) => {
  const formattedValues = values.trim().split(/\s+/).join('\n  ');
  return `enum ${name} {\n  ${formattedValues}\n}`;
});
fs.writeFileSync('prisma/schema.prisma', content);
