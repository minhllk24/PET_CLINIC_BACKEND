require("dotenv").config();

const configCors = (app) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://www.drpetshouse.lat",
    "https://drpetshouse.lat",
    "https://overlying-lucrative-perm.ngrok-free.dev",
    process.env.REACT_URL
  ].filter(Boolean);

  app.use(function (req, res, next) {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }

    // Request methods you wish to allow
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS, PUT, PATCH, DELETE"
    );

    // Request headers you wish to allow
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-Requested-With,Content-Type,Authorization"
    );

    // Set to true if you need the website to include cookies in the requests sent
    res.setHeader("Access-Control-Allow-Credentials", true);

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    // Pass to next layer of middleware
    next();
  });
};

export default configCors;
