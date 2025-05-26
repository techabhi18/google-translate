const axios = require("axios");
require("dotenv").config();

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env;

const getAuthUrl = () => {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
      "https://www.googleapis.com/auth/cloud-translation",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  };

  const params = new URLSearchParams(options);
  return `${rootUrl}?${params.toString()}`;
};

const getTokens = async (code) => {
  const url = "https://oauth2.googleapis.com/token";
  const values = {
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  };

  const res = await axios.post(url, values, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return res.data;
};

const refreshAccessToken = async (refresh_token) => {
  const url = "https://oauth2.googleapis.com/token";
  const values = {
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token,
    grant_type: "refresh_token",
  };

  const res = await axios.post(url, new URLSearchParams(values), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return res.data;
};

const getUserInfo = async (access_token) => {
  const res = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  return res.data;
};

const translateText = async (text, targetLanguage, accessToken) => {
  const url = "https://translation.googleapis.com/language/translate/v2";

  const res = await axios.post(
    url,
    {},
    {
      params: {
        q: text,
        target: targetLanguage,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return res.data.data.translations[0].translatedText;
};

module.exports = {
  getAuthUrl,
  getTokens,
  refreshAccessToken,
  getUserInfo,
  translateText,
};
