const express = require("express");
const cookieParser = require("cookie-parser");
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

let tokenStore = {
  access_token: null,
  refresh_token: null,
  expiry_date: 0,
  name: null,
};

app.get("/auth", (req, res) => {
  res.redirect(getAuthUrl());
});

app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

  const { access_token, refresh_token, expires_in } = await getTokens(code);
  tokenStore.access_token = access_token;
  tokenStore.refresh_token = refresh_token;
  tokenStore.expiry_date = Date.now() + expires_in * 1000;

  const profile = await getUserInfo(access_token);
  tokenStore.name = profile.name;

  res.redirect("/");
});

async function checkAccessToken() {
  if (!tokenStore.access_token || Date.now() >= tokenStore.expiry_date) {
    const { access_token, expires_in } = await refreshAccessToken(
      tokenStore.refresh_token
    );
    tokenStore.access_token = access_token;
    tokenStore.expiry_date = Date.now() + expires_in * 1000;
  }
}

app.get("/", async (req, res) => {
  if (!tokenStore.name) return res.redirect("/auth");

  await checkAccessToken();

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head><meta charset="UTF-8"><title>Welcome</title></head>
      <body>
        <h1>Hello ${tokenStore.name}</h1>
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
  await checkAccessToken();
  const translatedText = await translateText(
    text,
    target_language,
    tokenStore.access_token
  );
  res.json({ translatedText });
});

app.post("/translate", async (req, res) => {
  const { tgt_lan, text } = req.query;
  if (!tgt_lan || !text) {
    return res.status(400).json({ error: "Missing target_language or text" });
  }

  await checkAccessToken();
  const translatedText = await translateText(
    text,
    tgt_lan,
    tokenStore.access_token
  );
  res.json({ translatedText });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
