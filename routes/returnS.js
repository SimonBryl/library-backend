const express = require("express");
const router = express.Router();
const { supabase } = require('../config/supabaseClient'); // správně importovat Supabase
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
      .is("real_datum_vraceni", null);

    if (error) throw error;

    // Supabase vrací data včetně vložených tabulek jako objekty
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
    // 1) aktualizace Loans
    const { error: loanError } = await supabase
      .from("Loans")
      .update({ real_datum_vraceni: today })
      .eq("id_loan", loanId);

    if (loanError) throw loanError;

    // 2) zjistit id_kniha
    const { data: loanData, error: selectError } = await supabase
      .from("Loans")
      .select("id_kniha")
      .eq("id_loan", loanId)
      .single();

    if (selectError) throw selectError;
    const bookId = loanData.id_kniha;

    // 3) zjistit název knihy
    const { data: bookData, error: bookSelectError } = await supabase
      .from("Books")
      .select("nazev")
      .eq("id_kniha", bookId)
      .single();

    if (bookSelectError) throw bookSelectError;
    const bookName = bookData.nazev;

    // 4) zkontrolovat rezervace na tuto knihu
    const { data: reservations, error: resError } = await supabase
      .from("Reservation")
      .select("id_res, id_user, datum_rezervace, email_send")
      .eq("nazev_knihy", bookName)
      .eq("email_send", false)
      .order("datum_rezervace", { ascending: true }); // nejstarší první

    if (resError) throw resError;

    if (reservations && reservations.length > 0) {
      const chosen = reservations[0]; // první (nejdéle čeká)
      const userId = chosen.id_user;

      // 5) zjistit email uživatele
      const { data: userData, error: userError } = await supabase
        .from("Users")
        .select("email")
        .eq("id_user", userId)
        .single();

      if (userError) throw userError;

      const email = userData.email;

      // 6) odeslat e-mail 
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Vaše rezervovaná kniha je k dispozici",
        text: `Dobrý den, kniha "${bookName}" je nyní k dispozici k vypůjčení.`
      });

      // 7) update Reservation -> email_send = true
      const { error: updateResError } = await supabase
        .from("Reservation")
        .update({ email_send: true, id_kniha: bookId })
          .eq("id_res", chosen.id_res);

      if (updateResError) throw updateResError;

      // 8) update Books -> stav = rezervace
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