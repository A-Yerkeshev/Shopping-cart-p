const express = require("express");
const { Client } = require("pg");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
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
const jwtkey = process.env.JWT_KEY;

client.connect((error) => {
  if (error) {log('Database connection error: ', error.stack)} else {
    log('Connection to database established');
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
    if (error) {
      log('Database query error: ', error.stack);
      response.status(500).send('Error occured when attempting to get products data.');
    } else {
      response.status(200).send(data.rows);
    }
  })
})

// Register new user
app.post('/users', async (request, response) => {
  // 1. Validate request object
  const username = request.body.username.trim();
  const password = request.body.password.trim();
  const userRegEx = /[A-Za-z0-9_]+$/;
  const passRegEx = /[A-Za-z0-9_\-@\$\*#\+]+$/;

  // 1.1 Check if value is present
  if (!username) {
    response.status(400).send(`Username is empty or invalid.`);
    return;
  }

  if (!password) {
    response.status(400).send(`Password is empty or invalid.`);
    return;
  }

  // 1.2 Check that it has correct type
  if (typeof username !== 'string') {
    response.status(400).send(`Username is not a string.`);
    return;
  }

  if (typeof password !== 'string') {
    response.status(400).send(`Password is not a string.`);
    return;
  }

  // 1.3 Check that it does not contain invalid characters
  if (username.search(userRegEx) == -1) {
    response.status(400).send(`Username contains invalid characters. Only A-Z, a-z, 0-9 and _ are allowed.`);
    return;
  }

  if (password.search(passRegEx) == -1) {
    response.status(400).send(`Password contains invalid characters. Only A-Z, a-z, 0-9 , _ - @ $ * # + are allowed.`);
    return;
  }

  // 2. Check that username is available
  if (await getUser(username) === null) {
    // 3. Hash password
    const hash = await bcrypt.hash(password, 13);

    // 4. Add new user to database
    query = `INSERT INTO users(username, password) VALUES ('${username}', '${hash}')`;

    client.query(query, (error, data) => {
      if (error) {
        log('Database query error: ', error.stack);
        response.status(500).send('Error occured when attempting to add new user to database.');
      } else {
        log(`User "${username}" successfully registered.`);
        response.status(201).send(`User "${username}" successfully registered.`);
      }
    })
  } else {
    response.status(409).send(`User with username "${username}" already registered.`);
  }
})

// Sign user in
app.post('/users/auth', async (request, response) => {
  // 1. Validate request object
  const username = request.body.username.trim();
  const password = request.body.password.trim();
  const userRegEx = /[A-Za-z0-9_]+$/;
  const passRegEx = /[A-Za-z0-9_\-@\$\*#\+]+$/;

  // 1.1 Check if value is present
  if (!username) {
    response.status(400).send(`Username is empty or invalid.`);
    return;
  }

  if (!password) {
    response.status(400).send(`Password is empty or invalid.`);
    return;
  }

  // 1.2 Check that it has correct type
  if (typeof username !== 'string') {
    response.status(400).send(`Username is not a string.`);
    return;
  }

  if (typeof password !== 'string') {
    response.status(400).send(`Password is not a string.`);
    return;
  }

  // 2. Try to find user
  const user = await getUser(username);

  // 3. If user is found - compare passwords
  if (user) {
    const correctPass = await comparePasswords(password, user.password);

    if (correctPass) {
      // 4. If everything is ok - log user in
      // 4.1 Generate token
      const payload = {
        id: user.id,
        username: user.username,
        exp: Math.floor(Date.now()/1000) + 60*60*12
      }

      const token = jwt.sign(payload, jwtkey);

      response.status(200).send(token);
    } else {
      response.status(401).send('Password is not correct.');
    }
  } else {
    response.status(401).send(`User with name "${username}" is not found.`);
  }
})

// Send username when receiving valid token
app.get('/users/auth/token', async (request, response) => {
  const token = request.query.token;

  try {
    // 1. Extract username and id from token
    const payload = jwt.verify(token, jwtkey);

    // 2. Check if user exists and has correct id
    if (payload && payload.username && payload.id) {
      const user = await getUser(payload.username);

      if (user && user.id == payload.id) {
        // 3. Send username to the client
        response.status(200).send(payload.username);
      } else throw new Error('User is not found.');
    } else throw new Error('Token is not valid.');
  } catch(error) {
    response.status(401).send(error.message);
  }
})

// Temporary route to get all users from database
app.get('/users', (request, response) => {
  client.query('SELECT * from users', (error, data) => {
    if (error) {
      log('Database query error: ', error.stack);
      response.status(500).send('Error occured when attempting to get users.');
    } else {
      response.status(200).send(data.rows);
    }
  })
})

function getUser(username) {
  return new Promise((resolve) => {
    const query = `SELECT id, username, password FROM users WHERE username = '${username}'`;

    client.query(query, (error, data) => {
      if (error) {
        log('Database query error: ', error.stack);
        response.status(500).send('Error occured when attempting to get user from database.');
        resolve(null);
      } else {
        if (data.rows.length === 0) {
          resolve(null);
        } else {
          resolve(data.rows[0]);
        }
      }
    })
  })
}

function comparePasswords(password, hash) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (error, result) => {
      if (error) {
        log('Error occured when comparing passwords.', error);
        reject();
      }

      resolve(result);
    })
  })
}

app.listen(process.env.PORT || 3000);

log('Server is running');
