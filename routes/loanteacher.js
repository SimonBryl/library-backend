const express = require("express");
const router = express.Router();
const { supabase } = require("../config/supabaseClient");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware pro ověření tokenu
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Chybí nebo je neplatný token" });
  }
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id; // stejné jako v loanreservation.js
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).json({ message: "Neplatný nebo expirovaný token" });
  }
}

// GET /books/:typ → načte knihy podle typu
router.get("/books/:typ", authenticateToken, async (req, res) => {
  const { typ } = req.params;
  try {
    const { data: books, error } = await supabase
      .from("Books")
      .select("id_kniha, nazev, autor, stav, typ_knihovny, zanr")
      .eq("typ_knihovny", typ);

    if (error) throw error;
    res.json(books || []);
  } catch (err) {
    console.error("Chyba při načítání knih:", err);
    res.status(500).json({ message: "Chyba při načítání knih" });
  }
});

// POST /create → vytvoří výpůjčku učitele
router.post("/create", authenticateToken, async (req, res) => {
  const { id_kniha, predpoklad_datum_vraceni } = req.body;
  const id_user = req.userId; // z JWT
  const datum_vypujceni = new Date().toISOString().split("T")[0]; // dnešní datum YYYY-MM-DD

  if (!id_user) {
    return res.status(400).json({ message: "Uživatel není přihlášen" });
  }

  try {
    // Vložíme výpůjčku
    const { error: loanError } = await supabase.from("Loans").insert([
      {
        id_user,
        id_kniha,
        datum_vypujceni,
        predpoklad_datum_vraceni
      }
    ]);
    if (loanError) throw loanError;

    // Aktualizujeme stav knihy
    const { error: updateError } = await supabase
      .from("Books")
      .update({ stav: "vypujceno" })
      .eq("id_kniha", id_kniha);

    if (updateError) throw updateError;

    res.status(201).json({ message: "Výpůjčka byla vytvořena" });
  } catch (err) {
    console.error("Chyba při vytváření výpůjčky:", err);
    res.status(500).json({ message: "Nepodařilo se vytvořit výpůjčku" });
  }
});

module.exports = router;
