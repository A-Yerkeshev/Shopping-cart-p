const express = require("express");
const { Client } = require("pg");
const bodyParser = require("body-parser");
const log = console.log;
let client;

const app = express();

if (process.env.NODE_ENV !== 'production') {
  // Require dotenv and livereload
  const livereload = require("livereload");
  const conLivereload = require("connect-livereload");
  require("dotenv").config();

  // Create live reload server and connect to app
  const liveServer = livereload.createServer();
  liveServer.watch('public');

  app.use(conLivereload());

  liveServer.server.once('connection', () => {
    setTimeout(() => {
      liveServer.refresh('/');
    }, 1000);
  })

  // Connect to database using .env variables
  client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB,
    password: process.env.DB_PASSWORD
  })
} else {
  // Connect to Heroku database
  client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  })
}

const skey = process.env.STRIPE_SKEY;
const pkey = process.env.STRIPE_PKEY;

client.connect((error) => {
  if (error) {console.log('Database connection error: ', error.stack)} else {
    console.log('Connection to database established');
  }
})

// Setup middleware
app.use('/', express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/fontawesome', express.static('node_modules/@fortawesome/fontawesome-free/'));

// Get products data from database and send it
app.get('/products', (request, response) => {
  client.query('SELECT * from products', (error, data) => {
    if (error) {console.log('Database query error: ', error.stack)};
    response.status(200).send(data.rows);
  })
})

// Register new user
app.post('/users', (request, response) => {
  log('Request body', request.body)
  // 1. Validate request object
  const username = request.body.username.trim();
  const password = request.body.password.trim();

  if (!username) {
    response.status(400).send(`Username is not valid.`);
    return;
  }

  if (!password) {
    response.status(400).send(`Password is not valid.`);
    return;
  }

  response.status(201).send(`User "${username}" successfully registered`);
})

app.listen(process.env.PORT || 3000);

console.log('Server is running');
