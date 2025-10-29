const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

// CORS – až nasadíš frontend na Vercel, dáš tam jeho doménu
app.use(cors({
  origin: "https://library-frontend-nine-bay.vercel.app/", // dočasně povolíme všechno, ať máš klid při testu
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(bodyParser.json());

// import routů
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

// použití routů
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

// optional test route - klidně si nech
app.get("/", (req, res) => {
  res.status(200).send("server běží 👍");
});

// naslouchání
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server běží na portu ${port}`);
});
