require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const email = process.argv[2];

if (!email) {
  console.error('Please provide an email address. Usage: node make-admin.js <email>');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connecting to database...');
    const user = await User.findOneAndUpdate({ email: email }, { isAdmin: true }, { new: true });
    
    if (user) {
      console.log(`Success! User ${email} is now an admin.`);
    } else {
      console.log(`User with email ${email} not found.`);
    }
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
  })
  .finally(() => {
    mongoose.connection.close();
  });
