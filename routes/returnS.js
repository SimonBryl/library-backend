const express = require("express");
const router = express.Router();
const { supabase } = require('../config/supabaseClient');
const axios = require("axios"); //  místo nodemaileru používáme Resend API

// --- Získat všechny nevrácené výpůjčky ---
router.get("/", async (req, res) => {
  try {
    const { data: loans, error } = await supabase
      .from("Loans")
      .select(`
        id_loan,
        id_kniha,
        id_zak,
        datum_vypujceni,
        predpoklad_datum_vraceni,
        Books(nazev, autor),
        Zak(name, surname, datum_narozeni)
      `)
      .is("real_datum_vraceni", null)
      .not("id_zak", "is", null);

    if (error) throw error;

    const formattedLoans = loans.map(l => ({
      id_loan: l.id_loan,
      id_kniha: l.id_kniha,
      id_zak: l.id_zak,
      datum_vypujceni: l.datum_vypujceni,
      predpoklad_datum_vraceni: l.predpoklad_datum_vraceni,
      nazev: l.Books?.nazev || "",
      autor: l.Books?.autor || "",
      name: l.Zak?.name || "",
      surname: l.Zak?.surname || "",
      datum_narozeni: l.Zak?.datum_narozeni || ""
    }));

    res.json(formattedLoans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Chyba při načítání výpůjček" });
  }
});

// --- Vrátit knihu ---
router.put("/:id", async (req, res) => {
  const loanId = req.params.id;
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1️ Aktualizace Loans
    const { error: loanError } = await supabase
      .from("Loans")
      .update({ real_datum_vraceni: today })
      .eq("id_loan", loanId);
    if (loanError) throw loanError;

    // 2️ Získání id_kniha
    const { data: loanData, error: selectError } = await supabase
      .from("Loans")
      .select("id_kniha")
      .eq("id_loan", loanId)
      .single();
    if (selectError) throw selectError;
    const bookId = loanData.id_kniha;

    // 3️ Získání názvu knihy
    const { data: bookData, error: bookSelectError } = await supabase
      .from("Books")
      .select("nazev")
      .eq("id_kniha", bookId)
      .single();
    if (bookSelectError) throw bookSelectError;
    const bookName = bookData.nazev;

    // 4️ Zkontrolovat rezervace
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
        console.log(` Email o dostupnosti knihy "${bookName}" odeslán na ${email}`);
      } catch (err) {
        console.error(" Chyba při odesílání e-mailu:", err.response?.data || err.message);
      }

      // 7️ Update Reservation → email_send = true
      const { error: updateResError } = await supabase
        .from("Reservation")
        .update({ email_send: true, id_kniha: bookId })
        .eq("id_res", chosen.id_res);
      if (updateResError) throw updateResError;

      // 8️ Update Books → stav = "rezervace"
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
    res.status(500).json({ message: "Chyba při vracení knihy" });
  }
});

module.exports = router;
