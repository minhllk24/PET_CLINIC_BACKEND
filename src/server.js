require('dotenv').config();
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import configViewEngine from './configs/viewEngine';
import configCors from './configs/cors';
import initAPIRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 8080;

// Config CORS
configCors(app);

// Config View Engine
configViewEngine(app);

// Config Middlewares
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Middleware fix BigInt JSON serialization from Prisma
app.use((req, res, next) => {
  const oldJson = res.json;
  res.json = function (data) {
    return oldJson.call(this, JSON.parse(JSON.stringify(data, (_, value) => {
      return typeof value === 'bigint' ? value.toString() : value;
    })));
  };
  next();
});

// Init API Routes
initAPIRoutes(app);

// Init Cron Jobs
import { initCronJobs } from './services/cronService';
initCronJobs();

app.listen(PORT, "0.0.0.0", () => {
  console.log('SERVER is running on PORT:', PORT);
});
