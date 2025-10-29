const express = require("express");
const router = express.Router();
const { supabase } = require('../config/supabaseClient');

// =========================
// 1) Načíst všechny knihy
// =========================
router.get("/books", async (req, res) => {
  try {
    const { data, error } = await supabase.from("Books").select("*");

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Chyba při načítání knih:", err.message);
    res.status(500).json({ error: "Nepodařilo se načíst knihy" });
  }
});

// =========================
// 2) Upravit knihu
// =========================
router.put("/books/:id_kniha", async (req, res) => {
  const { id_kniha } = req.params;
  const { nazev, autor, zanr, typ_knihovny } = req.body;

  try {
    const { error } = await supabase
      .from("Books")
      .update({ nazev, autor, zanr, typ_knihovny })
      .eq("id_kniha", id_kniha);

    if (error) throw error;

    res.json({ message: "Kniha byla úspěšně upravena" });
  } catch (err) {
    console.error("Chyba při úpravě knihy:", err.message);
    res.status(500).json({ error: "Nepodařilo se upravit knihu" });
  }
});

// =========================
// 3) Smazat knihu
// =========================
router.delete("/books/:id_kniha", async (req, res) => {
  const { id_kniha } = req.params;

  try {
    const { error } = await supabase
      .from("Books")
      .delete()
      .eq("id_kniha", id_kniha);

    if (error) throw error;

    res.json({ message: "Kniha byla smazána" });
  } catch (err) {
    console.error("Chyba při mazání knihy:", err.message);
    res.status(500).json({ error: "Nepodařilo se smazat knihu" });
  }
});


module.exports = router;
