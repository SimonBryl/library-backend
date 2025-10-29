const express = require("express");
const router = express.Router();
const { supabase } = require("../config/supabaseClient");
const jwt = require("jsonwebtoken");
const axios = require("axios"); //  místo nodemaileru
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware na ověření tokenu a získání id_user
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);
    req.user = decoded; // JWT obsahuje { id: ... }
    next();
  });
}

// --- Získat výpůjčky učitele ---
router.get("/l", authenticateToken, async (req, res) => {
  try {
    const { data: loans, error } = await supabase
      .from("Loans")
      .select(`
        id_loan,
        id_kniha,
        predpoklad_datum_vraceni,
        Books(nazev, autor)
      `)
      .is("real_datum_vraceni", null)
      .is("id_zak", null)
      .eq("id_user", req.user.id);

    if (error) throw error;

    const formatted = loans.map(l => ({
      id_loan: l.id_loan,
      nazev: l.Books?.nazev || "",
      autor: l.Books?.autor || "",
      predpoklad_datum_vraceni: l.predpoklad_datum_vraceni
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Chyba při načítání výpůjček učitele", details: err });
  }
});

// --- Vrátit knihu (stejný mechanismus jako student) ---
router.put("/:id", authenticateToken, async (req, res) => {
  const loanId = parseInt(req.params.id);
  if (isNaN(loanId)) return res.status(400).json({ message: "Neplatné id výpůjčky" });

  const today = new Date().toISOString().split("T")[0];

  try {
    // 1️ Aktualizace Loans
    const { error: loanError } = await supabase
      .from("Loans")
      .update({ real_datum_vraceni: today })
      .eq("id_loan", loanId);
    if (loanError) throw loanError;

    // 2️ Získat id_kniha
    const { data: loanData, error: selectError } = await supabase
      .from("Loans")
      .select("id_kniha")
      .eq("id_loan", loanId)
      .single();
    if (selectError) throw selectError;
    const bookId = loanData.id_kniha;

    // 3️ Získat název knihy
    const { data: bookData, error: bookSelectError } = await supabase
      .from("Books")
      .select("nazev")
      .eq("id_kniha", bookId)
      .single();
    if (bookSelectError) throw bookSelectError;
    const bookName = bookData.nazev;

    // 4️ Zkontrolovat rezervace na tuto knihu
    const { data: reservations, error: resError } = await supabase
      .from("Reservation")
      .select("id_res, id_user, datum_rezervace, email_send")
      .eq("nazev_knihy", bookName)
      .eq("email_send", false)
      .order("datum_rezervace", { ascending: true });
    if (resError) throw resError;

    if (reservations && reservations.length > 0) {
      const chosen = reservations[0];
      const userId = chosen.id_user;

      // 5️ Získat e-mail uživatele
      const { data: userData, error: userError } = await supabase
        .from("Users")
        .select("email")
        .eq("id_user", userId)
        .single();
      if (userError) throw userError;
      const email = userData.email;

      // 6️ Odeslat e-mail přes Resend API
      try {
        await axios.post(
          "https://api.resend.com/emails",
          {
            from: "Školní knihovna <info@skolniknihovna.cz>",
            to: email,
            subject: "Vaše rezervovaná kniha je k dispozici",
            html: `
              <p>Dobrý den,</p>
              <p>Kniha <strong>${bookName}</strong> je nyní k dispozici k vypůjčení.</p>
              <p>Navštivte knihovnu pro její vyzvednutí.</p>
            `
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );
        console.log(` E-mail o dostupnosti knihy "${bookName}" odeslán na ${email}`);
      } catch (err) {
        console.error(" Chyba při odesílání e-mailu:", err.response?.data || err.message);
      }

      // 7️ Update Reservation → email_send = true
      const { error: updateResError } = await supabase
        .from("Reservation")
        .update({ email_send: true, id_kniha: bookId })
        .eq("id_res", chosen.id_res);
      if (updateResError) throw updateResError;

      // 8️ Update Books → stav = rezervace
      const { error: bookError } = await supabase
        .from("Books")
        .update({ stav: "rezervace" })
        .eq("id_kniha", bookId);
      if (bookError) throw bookError;
    } else {
      // žádná rezervace → stav = kdispozici
      const { error: bookError } = await supabase
        .from("Books")
        .update({ stav: "kdispozici" })
        .eq("id_kniha", bookId);
      if (bookError) throw bookError;
    }

    res.json({ message: "Kniha vrácena" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Chyba při vracení knihy", details: err });
  }
});

module.exports = router;
