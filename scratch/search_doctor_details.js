import fs from 'fs';

const files = [
  'src/services/appointmentAPIService.js',
  'src/services/medicalRecordAPIService.js'
];

files.forEach(file => {
  console.log(`=== ${file} ===`);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('doctor') || line.toLowerCase().includes('prisma.doctor')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
});
