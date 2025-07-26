const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const serverless = require("serverless-http");
const Token = require("./models/Token.js");
const {
  getAuthUrl,
  getTokens,
  refreshAccessToken,
  getUserInfo,
  translateText,
} = require("./services/google.service.js");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cookieParser());

let cachedConn = false;
async function connectDB() {
  if (cachedConn) return;
  await mongoose.connect(process.env.MONGODB_URI);
  cachedConn = true;
}

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

app.get("/auth", (req, res) => {
  res.redirect(getAuthUrl());
});

app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

  const { access_token, refresh_token, expires_in } = await getTokens(code);

  const profile = await getUserInfo(access_token);
  const expiry_date = Date.now() + expires_in * 1000;

  await Token.findOneAndUpdate(
    { googleId: profile.sub },
    {
      googleId: profile.sub,
      access_token,
      refresh_token,
      expiry_date,
      name: profile.name,
    },
    { upsert: true }
  );

  res.cookie("googleId", profile.sub, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });

  res.redirect("/");
});

async function getValidToken(req) {
  const googleId = process.env.GOOGLE_ID;
  if (!googleId) return null;

  const tokenDoc = await Token.findOne({ googleId });
  if (!tokenDoc) return null;

  if (Date.now() >= tokenDoc.expiry_date) {
    const { access_token, expires_in } = await refreshAccessToken(
      tokenDoc.refresh_token
    );
    tokenDoc.access_token = access_token;
    tokenDoc.expiry_date = Date.now() + expires_in * 1000;
    await tokenDoc.save();
  }
  return tokenDoc;
}

app.get("/", async (req, res) => {
  const tokenDoc = await getValidToken(req);
  if (!tokenDoc) return res.redirect("/auth");
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head><meta charset="UTF-8"><title>Welcome</title></head>
      <body>
        <h1>Hello ${tokenDoc.name}</h1>
        <form action="/translate" method="get">
          <input type="hidden" name="text" value="Hello world">
          <input type="hidden" name="target_language" value="hi">
          <button type="submit">Translate text</button>
        </form>
      </body>
    </html>
  `);
});

app.post("/translate", async (req, res) => {
  const { text, tgt_lang } = req.body;
  if (!text || !tgt_lang) {
    return res.status(400).json({ error: "Missing text or tgt_lang" });
  }

  const tokenDoc = await getValidToken(req);
  if (!tokenDoc) return res.status(401).json({ error: "Unauthorized" });

  try {
    const translatedText = await translateText(
      text,
      tgt_lang,
      tokenDoc.access_token
    );
    res.json({ translatedText });
  } catch (err) {
    console.error("Translation failed:", err);
    res.status(500).json({ error: "Translation failed" });
  }
});

app.listen(3000, () => {
  console.log("Server started");
})

module.exports = app;
module.exports.handler = serverless(app);
