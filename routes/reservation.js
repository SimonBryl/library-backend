const express = require("express");
const router = express.Router();
const { supabase } = require("../config/supabaseClient");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

router.get("/res", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Chybí nebo je neplatný token" });
  }
  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Neplatný nebo expirovaný token", details: err });
  }

  const id_user = decoded.id;

  try {
    // načtení vypůjčených knih pro uživatele
    const { data: loans, error: loansError } = await supabase
      .from("Loans")
      .select("*")
      .is("real_datum_vraceni", null);

    if (loansError) throw loansError;

    // načtení informací o knihách pro každou výpůjčku
    const booksPromises = loans.map(async (loan) => {
      const { data: bookData, error: bookError } = await supabase
        .from("Books")
        .select("nazev, autor")
        .eq("id_kniha", loan.id_kniha)
        .single();

      if (bookError) throw bookError;

      return {
        nazev: bookData.nazev,
        autor: bookData.autor,
        predpoklad_datum_vraceni: loan.predpoklad_datum_vraceni,
        id_kniha: loan.id_kniha
      };
    });

    const loansWithBooks = await Promise.all(booksPromises);

    res.json(loansWithBooks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Chyba serveru", details: err });
  }
});


// POST /reservation
router.post("/res", async (req, res) => {
  const { nazev_knihy, datum_rezervace } = req.body;

  if (!nazev_knihy || !datum_rezervace) {
    return res.status(400).json({ message: "Chybí povinná data." });
  }

  // >>> token z hlavičky
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Chybí nebo je neplatný token" });
  }
  const token = authHeader.split(" ")[1];

  // >>> ověření tokenu
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).json({ message: "Neplatný nebo expirovaný token", details: err });
  }

  const id_user = decoded.id; // ID uživatele uložené v tokenu při loginu

  try {
    // ověření, zda už nemá uživatel rezervaci na tuto knihu
    const { data: existing, error: checkError } = await supabase
      .from("Reservation")
      .select("*")
      .eq("id_user", id_user)
      .eq("nazev_knihy", nazev_knihy)
      .single(); // vrátí jen jednu rezervaci

    if (existing) {
      return res.status(400).json({ message: "Tuto knihu už máte rezervovanou." });
    }

    // vložení nové rezervace
    const { data, error: insertError } = await supabase.from("Reservation").insert([
      {
        nazev_knihy,
        datum_rezervace,
        id_user,
      },
    ]);

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return res.status(500).json({ message: "Chyba při vytváření rezervace", details: insertError });
    }

    res.json({ message: "Rezervace úspěšně vytvořena.", data });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Chyba serveru", details: err });
  }
});

module.exports = router;
