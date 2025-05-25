const express = require("express");
const cookieParser = require("cookie-parser");
const {
  getAuthUrl,
  getTokens,
  refreshAccessToken,
  getUserInfo,
} = require("./services/google.service.js");
require("dotenv").config();

const app = express();
app.use(cookieParser());

let tokenStore = {};

app.get("/auth", (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const { access_token, refresh_token, expires_in } = await getTokens(code);
    console.log(getTokens(code));

    tokenStore = {
      access_token,
      refresh_token,
      expiry_date: Date.now() + expires_in * 1000,
    };

    res.send("Login successful! You can now call /userinfo.");
  } catch (err) {
    res.status(500).send("Auth failed");
  }
});

app.get("/userinfo", async (req, res) => {
  try {
    if (Date.now() >= tokenStore.expiry_date) {
      const { access_token, expires_in } = await refreshAccessToken(
        tokenStore.refresh_token
      );
      tokenStore.access_token = access_token;
      tokenStore.expiry_date = Date.now() + expires_in * 1000;
    }
    const userInfo = await getUserInfo(tokenStore.access_token);
    res.json(userInfo);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
