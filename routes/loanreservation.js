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
    req.userId = decoded.id;
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(401).json({ message: "Neplatný nebo expirovaný token" });
  }
}

// GET /reservations → vrátí jen rezervace přihlášeného uživatele
router.get("/reservations", authenticateToken, async (req, res) => {
  try {
    const { data: reservations, error } = await supabase
      .from("Reservation")
      .select("id_kniha")
      .eq("id_user", req.userId)
      .eq("email_send", true);

    if (error) throw error;
    if (!reservations || reservations.length === 0) {
      return res.json([]);
    }

    const bookIds = reservations.map(r => r.id_kniha);

    const { data: books, error: booksError } = await supabase
      .from("Books")
      .select("id_kniha, nazev, autor")
      .in("id_kniha", bookIds);

    if (booksError) throw booksError;

    res.json(books);
  } catch (err) {
    console.error("Chyba při načítání rezervací:", err);
    res.status(500).json({ message: "Chyba při načítání rezervací" });
  }
});

// POST /loanReserved → potvrdí výpůjčku rezervované knihy
router.post("/loanReserved", authenticateToken, async (req, res) => {
  const { id_kniha, datumVraceni } = req.body;

  try {
    // Ověříme, že kniha patří mezi rezervace daného uživatele
    const { data: reservation, error: reservationError } = await supabase
      .from("Reservation")
      .select("*")
      .eq("id_user", req.userId)
      .eq("id_kniha", id_kniha)
      .eq("email_send", true)
      .single();

    if (reservationError || !reservation) {
      return res.status(403).json({ message: "Rezervace nenalezena nebo není platná" });
    }

    // Aktualizujeme stav knihy na "vypujceno"
    const { error: updateError } = await supabase
      .from("Books")
      .update({ stav: "vypujceno" })
      .eq("id_kniha", id_kniha);

    if (updateError) throw updateError;

    // Vložíme výpůjčku do Loans
    const { error: loanError } = await supabase
      .from("Loans")
      .insert([
        {
          id_user: req.userId,
          id_kniha,
          datum_vypujceni: new Date().toISOString().split("T")[0],
          predpoklad_datum_vraceni: datumVraceni
        }
      ]);

    if (loanError) throw loanError;

    // Smažeme rezervaci (nebo bychom mohli přidat příznak vyřízeno)
    await supabase
      .from("Reservation")
      .delete()
      .eq("id_res", reservation.id_res);

    res.json({ message: "Výpůjčka úspěšně vytvořena" });
  } catch (err) {
    console.error("Chyba při vytváření výpůjčky:", err);
    res.status(500).json({ message: "Nepodařilo se vytvořit výpůjčku" });
  }
});

module.exports = router;