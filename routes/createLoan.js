const express = require("express");
const router = express.Router();
const { supabase } = require("../config/supabaseClient");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

// GET knihy (typ "zak")
router.get("/books", async (req, res) => {
  const { data, error } = await supabase
    .from("Books")
    .select("*")
    .eq("typ_knihovny", "zak");
  if (error) return res.status(500).json({ message: error.message, details: error });
  res.json(data);
});

// GET studenti
router.get("/students", async (req, res) => {
  const { data, error } = await supabase.from("Zak").select("*");
  if (error) return res.status(500).json({ message: error.message, details: error });
  res.json(data);
});

// POST výpůjčka
router.post("/loans", async (req, res) => {
  const { knihaId, studentId, datumVraceni, datumVypujceni } = req.body;

  if (!knihaId || !studentId || !datumVraceni) {
    return res.status(400).json({ message: "Chybí data pro výpůjčku" });
  }
  const { data: bookData, error: bookError } = await supabase
  .from("Books")
  .select("stav")
  .eq("id_kniha", knihaId)
  .single();
  if (bookData.stav === "vypujceno") {
  return res.status(400).json({ message: "Kniha je již vypůjčena" });
  }
  if (bookData.stav === "rezervace") {
  return res.status(400).json({ message: "Kniha je rezervovaná" });
  }
  // >>> token z hlavičky
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Chybí nebo je neplatný token" });
  }
  const token = authHeader.split(" ")[1];

  // >>> ověření tokenu pomocí našeho SECRET_KEY
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).json({ message: "Neplatný nebo expirovaný token", details: err });
  }

  const currentUserId = decoded.id; // ID uživatele uložené v tokenu při loginu

  const loanData = {
    id_kniha: knihaId,
    id_zak: studentId,
    id_user: currentUserId,
    datum_vypujceni: datumVypujceni,
    predpoklad_datum_vraceni: datumVraceni,
    real_datum_vraceni: null,
  };

  try {
    // vytvoření výpůjčky
    const { data, error: loanError } = await supabase.from("Loans").insert([loanData]);
    if (loanError) {
      console.error("Supabase insert error:", loanError);
      return res.status(500).json({ message: "Chyba při vložení výpůjčky", details: loanError });
    }

    // změna stavu knihy
    const { data: bookData, error: updateError } = await supabase
      .from("Books")
      .update({ stav: "vypujceno" })
      .eq("id_kniha", knihaId);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({
        message: "Výpůjčka vytvořena, ale stav knihy se nepodařilo změnit",
        details: updateError,
      });
    }

    res.json({ message: "Výpůjčka byla vytvořena a kniha nastavena jako vypůjčená" });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Chyba serveru", details: error });
  }
});

module.exports = router;
