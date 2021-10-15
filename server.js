const express = require("express");
const app = express();

if (process.env.NODE_ENV !== 'production') {
  require("dotenv").config();
}

const skey = process.env.STRIPE_SKEY;
const pkey = process.env.STRIPE_PKEY;

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.listen(3000);
