const express = require("express");
const router = express.Router();
const { supabase } = require("../config/supabaseClient");

// GET všechny výpůjčky s daty z navázaných tabulek
router.get("/loans", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("Loans")
      .select(`
        id_loan,
        predpoklad_datum_vraceni,
        real_datum_vraceni,
        Zak ( name, surname ),
        Users ( name, surname ),
        Books ( nazev, autor )
      `);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Chyba při načítání výpůjček." });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
