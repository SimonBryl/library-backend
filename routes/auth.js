const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const router = express.Router();
const { supabase } = require("../config/supabaseClient");

const JWT_SECRET = process.env.JWT_SECRET;

//  Funkce pro odeslání 2FA e-mailu přes Resend API
async function send2FAEmail(to, code) {
  try {
    await axios.post(
      "https://api.resend.com/emails",
      {
        from: "Školní knihovna <onboarding@resend.dev>", // můžeš změnit po ověření domény
        to,
        subject: "Přihlášení – ověřovací kód",
        html: `
          <p>Dobrý den,</p>
          <p>Váš ověřovací kód pro přihlášení do systému <strong>Školní knihovna</strong> je:</p>
          <h2>${code}</h2>
          <p>Kód je platný po dobu 5 minut.</p>
        `
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log(` 2FA e-mail odeslán na ${to}`);
  } catch (err) {
    console.error(" Chyba při odesílání e-mailu:", err.response?.data || err.message);
  }
}

//  LOGIN
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: users, error } = await supabase
      .from("Users")
      .select("*")
      .eq("username", username)
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0)
      return res.status(401).json({ message: "Uživatel nenalezen" });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Nesprávné heslo" });

    const clientIp = (req.headers["x-forwarded-for"] || req.ip || "")
      .replace("::ffff:", "")
      .split(",")[0];

    //  Ověření, zda je IP povolená
    const { data: ipRecord } = await supabase
      .from("Allowedaddress")
      .select("*")
      .eq("id_user", user.id_user)
      .eq("ip_address", clientIp)
      .single();

    if (ipRecord) {
      //  IP už je povolená → přímé přihlášení
      const token = jwt.sign(
        { id: user.id_user, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: "2h" }
      );
      return res.json({
        token,
        username: user.username,
        role: user.role
      });
    }

    //  IP není povolená → spustíme 2FA
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const token = uuidv4();
    const expires_at = new Date(Date.now() + 5 * 60 * 1000); // platnost 5 minut

    const { error: insertError } = await supabase.from("Pending2FA").insert([
      {
        user_id: user.id_user,
        token,
        code,
        ip_address: clientIp,
        expires_at,
        attempts: 0
      }
    ]);

    if (insertError) {
      console.error(" Chyba při vkládání 2FA:", insertError);
      return res
        .status(500)
        .json({ message: "Chyba serveru při generování 2FA" });
    }

    //  Odeslání 2FA e-mailu
    await send2FAEmail(user.email, code);

    return res.json({
      twoFA: true,
      message: "Byl odeslán ověřovací kód na e-mail",
      token
    });
  } catch (err) {
    console.error(" Chyba /auth/login:", err);
    res.status(500).json({ message: "Chyba serveru" });
  }
});

//  OVĚŘENÍ 2FA
router.post("/verify-2fa", async (req, res) => {
  const { token, code } = req.body;

  try {
    const { data: record } = await supabase
      .from("Pending2FA")
      .select("*")
      .eq("token", token)
      .single();

    if (!record)
      return res.status(400).json({ message: "2FA kód nenalezen" });

    if (record.attempts >= 3) {
      await supabase.from("Pending2FA").delete().eq("token", token);
      return res.status(403).json({ message: "Příliš mnoho pokusů" });
    }

    if (new Date(record.expires_at) < new Date()) {
      await supabase.from("Pending2FA").delete().eq("token", token);
      return res
        .status(403)
        .json({ message: "Kód vypršel, přihlas se znovu" });
    }

    if (record.code !== code) {
      await supabase
        .from("Pending2FA")
        .update({ attempts: record.attempts + 1 })
        .eq("token", token);
      return res.status(401).json({ message: "Neplatný kód" });
    }

    //  Kód platný → přidat IP a vytvořit JWT
    await supabase
      .from("Allowedaddress")
      .insert([{ id_user: record.user_id, ip_address: record.ip_address }]);
    await supabase.from("Pending2FA").delete().eq("token", token);

    const { data: user } = await supabase
      .from("Users")
      .select("*")
      .eq("id_user", record.user_id)
      .single();

    const jwtToken = jwt.sign(
      { id: user.id_user, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ token: jwtToken, username: user.username, role: user.role });
  } catch (err) {
    console.error(" Chyba /verify-2fa:", err);
    res.status(500).json({ message: "Chyba serveru při ověření 2FA" });
  }
});

module.exports = router;
