const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, sparse: true },
    name: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
