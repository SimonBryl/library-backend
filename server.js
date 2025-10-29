const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

// 🟢 CORS nastavení - MUSÍ být úplně nahoře, před routami
const allowedOrigins = [
  "https://library-frontend-nine-bay.vercel.app",
  "http://localhost:5500"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  // Preflight (OPTIONS) požadavek – odpoví hned
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
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
