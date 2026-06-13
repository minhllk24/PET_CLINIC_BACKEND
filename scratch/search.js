import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

console.log('Searching for "doctor" references in src/...');
walkDir('./src', (filePath) => {
  if (filePath.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.toLowerCase().includes('prisma.doctor') || content.toLowerCase().includes('doctor_id')) {
      console.log(`Found in: ${filePath}`);
    }
  }
});
