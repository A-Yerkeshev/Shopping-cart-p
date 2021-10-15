const express = require("express");

const app = express();

if (process.env.NODE_ENV !== 'production') {
  // Require dotenv and livereload
  // Create live reload server and connect to app
  const livereload = require("livereload");
  const conLivereload = require("connect-livereload");

  require("dotenv").config();

  const liveServer = livereload.createServer();
  liveServer.watch('public');

  app.use(conLivereload());

  liveServer.server.once('connection', () => {
    setTimeout(() => {
      liveServer.refresh('/');
    }, 1000);
  })
}

const skey = process.env.STRIPE_SKEY;
const pkey = process.env.STRIPE_PKEY;

app.set('view engine', 'ejs');

app.use(express.static('public'));
app.listen(process.env.PORT || 3000);
