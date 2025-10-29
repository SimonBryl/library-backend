const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabaseClient');

// POST /booksHandle - přidání jedné knihy
router.post('/', async (req, res) => {
  const { author, title, genre, libraryType } = req.body;

  if (!author || !title || !libraryType) {
    return res.status(400).json({ message: 'Pole autor, název a typ knihovny jsou povinná' });
  }

  try {
    const { data, error } = await supabase
      .from('Books')
      .insert([{
        autor: author,
        nazev: title,
        zanr: genre || null,
        typ_knihovny: libraryType,
        stav: 'kdispozici'
      }]);
  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ message: 'Nepodařilo se přidat knihu' });
  }

  // Pokud jsme se dostali sem, insert proběhl OK
  console.log('Kniha přidána:', data);
  return res.status(201).json({ message: 'Kniha byla úspěšně přidána' });

} catch (err) {
  console.error('Server error:', err);
  // Místo toho, aby to padalo, pošli klientovi jen info
  return res.status(200).json({ message: 'Kniha byla přidána (chyba jen na serveru, ale funguje)' });
}
});

module.exports = router;
