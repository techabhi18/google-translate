const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
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
app.use(cookieParser());

mongoose.connect(process.env.MONGODB_URI);

let currentUserId = null;

app.get("/auth", (req, res) => {
  res.redirect(getAuthUrl());
});

app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

  const { access_token, refresh_token, expires_in } = await getTokens(code);
  const profile = await getUserInfo(access_token);

  const expiry_date = Date.now() + expires_in * 1000;
  currentUserId = profile.sub;

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

  res.redirect("/");
});

async function checkAccessToken() {
  if (!currentUserId) return null;

  const tokenDoc = await Token.findOne({ googleId: currentUserId });
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
  const tokenDoc = await checkAccessToken();
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

app.get("/translate", async (req, res) => {
  const { target_language, text } = req.query;
  if (!target_language || !text) {
    return res.status(400).json({ error: "Missing target_language or text" });
  }

  const tokenDoc = await checkAccessToken();
  if (!tokenDoc) return res.redirect("/auth");

  const translatedText = await translateText(
    text,
    target_language,
    tokenDoc.access_token
  );
  res.json({ translatedText });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
