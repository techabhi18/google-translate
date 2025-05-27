const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  access_token: String,
  refresh_token: String,
  expiry_date: Number,
  name: String,
});

module.exports = mongoose.model("Token", tokenSchema);
