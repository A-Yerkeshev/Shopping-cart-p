const express = require("express");
const app = express();
app.set('view engine', 'ejs');

if (process.env.NODE_ENV !== 'production') {
  const livereload = require("livereload");
  const conLivereload = require("connect-livereload");

  require("dotenv").config();

  const skey = process.env.STRIPE_SKEY;
  const pkey = process.env.STRIPE_PKEY;

  const liveServer = livereload.createServer();
  liveServer.watch('public');

  app.use(conLivereload());

  liveServer.server.once('connection', () => {
    setTimeout(() => {
      liveServer.refresh('/');
    }, 1000);
  })
}

app.use(express.static('public'));
app.listen(3000);
