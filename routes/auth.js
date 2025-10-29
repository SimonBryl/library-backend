const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();
const { supabase } = require("../config/supabaseClient");

const JWT_SECRET = process.env.JWT_SECRET;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// LOGIN
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: users, error } = await supabase
      .from("Users")
      .select("*")
      .eq("username", username)
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) return res.status(401).json({ message: "Uživatel nenalezen" });

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Nesprávné heslo" });

    const clientIp = req.ip.replace("::ffff:", "");

    // ověř, jestli IP už je povolená
    const { data: ipRecord } = await supabase
      .from("Allowedaddress")
      .select("*")
      .eq("id_user", user.id_user)
      .eq("ip_address", clientIp)
      .single();

    if (ipRecord) {
      // IP už povolená → normální přihlášení
      const token = jwt.sign({ id: user.id_user, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "2h" });
      return res.json({ token, username: user.username, role: user.role });
    }

    // IP není povolená → pošli 2FA
const code = Math.floor(100000 + Math.random() * 900000).toString();
const token = uuidv4();
const expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minut

// vložení do Pending2FA s inicializací attempts
const { data: inserted2FA, error: insertError } = await supabase
  .from("Pending2FA")
  .insert([{
    user_id: user.id_user,
    token,
    code,
    ip_address: clientIp,
    expires_at,
    attempts: 0 
  }])
  .select(); 

if (insertError) {
  console.error("Chyba při vkládání 2FA:", insertError);
  return res.status(500).json({ message: "Chyba serveru při generování 2FA" });
}

await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: user.email,
  subject: "Přihlášení – ověřovací kód",
  text: `Váš ověřovací kód je: ${code}`
});

return res.json({ twoFA: true, message: "Byl odeslán ověřovací kód na e-mail", token });


  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Chyba serveru" });
  }
});

// VERIFY 2FA
router.post("/verify-2fa", async (req, res) => {
  const { token, code } = req.body;

  const { data: record } = await supabase
    .from("Pending2FA")
    .select("*")
    .eq("token", token)
    .single();

  if (!record) return res.status(400).json({ message: "2FA kód nenalezen" });
  if (record.attempts >= 3) {
    await supabase.from("Pending2FA").delete().eq("token", token);
    return res.status(403).json({ message: "Příliš mnoho pokusů" });
  }
  if (new Date(record.expires_at) < new Date()) {
    await supabase.from("Pending2FA").delete().eq("token", token);
    return res.status(403).json({ message: "Kód vypršel, přihlaš se znovu" });
  }
  if (record.code !== code) {
    await supabase.from("Pending2FA").update({ attempts: record.attempts + 1 }).eq("token", token);
    return res.status(401).json({ message: "Neplatný kód" });
  }

  // Validní → povol IP
  await supabase.from("Allowedaddress").insert([{ id_user: record.user_id, ip_address: record.ip_address }]);
  await supabase.from("Pending2FA").delete().eq("token", token);

  const { data: user } = await supabase.from("Users").select("*").eq("id_user", record.user_id).single();
  const jwtToken = jwt.sign({ id: user.id_user, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "2h" });

  res.json({ token: jwtToken, username: user.username, role: user.role });
});

module.exports = router;
