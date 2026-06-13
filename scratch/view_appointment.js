import fs from 'fs';

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const lines = schema.split('\n');
let insideAppointment = false;
lines.forEach((line, idx) => {
  if (line.trim().startsWith('model Appointment ')) {
    insideAppointment = true;
  }
  if (insideAppointment) {
    console.log(`${idx + 1}: ${line}`);
    if (line.trim() === '}') {
      insideAppointment = false;
    }
  }
});
