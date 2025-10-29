const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser'); // npm i csv-parser
const { supabase }  = require('../config/supabaseClient'); // uprav podle toho, jak exportuješ supabase

const upload = multer({ storage: multer.memoryStorage() });

// POST /booksCsv - nahrání CSV souboru
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'CSV soubor nebyl nahrán.' });
  }

  const results = [];
  const headersMap = {}; // pro mapování hlaviček

  try {
    const stream = require('stream');
    const readable = new stream.Readable();
    readable._read = () => {};
    readable.push(req.file.buffer);
    readable.push(null);

    readable
      .pipe(csv({ separator: ';' }))
      .on('headers', (headers) => {
        headers.forEach((h, i) => {
          const key = h.trim().toLowerCase();
          if (['autor', 'author'].includes(key)) headersMap[i] = 'autor';
          else if (['nazev', 'title'].includes(key)) headersMap[i] = 'nazev';
          else if (['zanr', 'genre'].includes(key)) headersMap[i] = 'zanr';
          else if (['typ_knihovny', 'librarytype', 'typknihovny'].includes(key)) headersMap[i] = 'typ_knihovny';
        });
      })
      .on('data', (row) => {
        const newBook = {};
        Object.keys(row).forEach((key, idx) => {
          const mappedKey = headersMap[idx];
          if (mappedKey) newBook[mappedKey] = row[key].trim();
        });
        newBook.stav = 'kdispozici'; // předvyplněný stav
        if (Object.keys(newBook).length >= 4) results.push(newBook);
      })
      .on('end', async () => {
        if (results.length === 0) {
          return res.status(400).json({ message: 'CSV soubor neobsahuje žádná platná data.' });
        }

        const { error } = await supabase.from('Books').insert(results);

        if (error) {
          console.error('Chyba při vkládání knih:', error);
          return res.status(500).json({ message: 'Nepodařilo se přidat knihy.' });
        }

        res.status(201).json({ message: 'CSV soubor byl úspěšně zpracován.' });
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Chyba serveru při zpracování CSV.' });
  }
});

module.exports = router;
