const express = require("express");
const bodyParser = require("body-parser");

const app = express();

// 🔧 ruční CORS – funguje 100 % i při preflight OPTIONS
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://library-frontend-nine-bay.vercel.app",
    "http://localhost:5500"
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Pokud je to preflight (OPTIONS), ukonči hned tady
  if (req.method === "OPTIONS") {
    return res.sendStatus(204); // 204 = No Content
  }

  next();
});

app.use(bodyParser.json());

// 📦 importy routů
const authRoutes = require("./routes/auth");
const booksRoutes = require("./routes/booksHandle");
const booksCsvRoutes = require("./routes/booksCsv");
const editRoutes = require("./routes/edit");
const createRoutes = require("./routes/createLoan");
const returnSRoutes = require("./routes/returnS");
const evidenceRoutes = require("./routes/evidence");
const reservationRoutes = require("./routes/reservation");
const loanreservationRoutes = require("./routes/loanreservation");
const loanteacherRoutes = require("./routes/loanteacher");
const returnteacherRoutes = require("./routes/returnteacher");

// 📚 registrace routů
app.use("/auth", authRoutes);
app.use("/booksHandle", booksRoutes);
app.use("/booksCsv", booksCsvRoutes);
app.use("/edit", editRoutes);
app.use("/createLoan", createRoutes);
app.use("/returnS", returnSRoutes);
app.use("/evidence", evidenceRoutes);
app.use("/reservation", reservationRoutes);
app.use("/loanreservation", loanreservationRoutes);
app.use("/loanteacher", loanteacherRoutes);
app.use("/returnteacher", returnteacherRoutes);

// test endpoint
app.get("/", (req, res) => {
  res.status(200).send("Server běží ✅");
});

const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => console.log(`Server běží na portu ${port}`));
