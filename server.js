const express = require("express");
const { Client } = require("pg");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let stripe = require("stripe");
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
  // 1. Connect to Heroku database
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

// Setup Stripe
stripe = stripe(skey);

// Expose public key
app.get('/stripe-pkey', (request, response) => {
  response.status(200).send(pkey);
})

app.post('/create-checkout-session', async (request, response) => {
  const cart = request.body.cart;
  const token = request.body.token;
  const total = request.body.total;
  let userId, username, email;

  // 1. Verify token
  try {
    const payload = jwt.verify(token, jwtkey);

    userId = payload.id;
    username = payload.username;
    email = payload.email;
  } catch(error) {
    response.status(401).send('Authorization token is invalid or expired.');
    return;
  }

  // 2. Make a database query for every item in the cart to validate it
  const queryCalls = [];

  cart.forEach((item) => {
    const query = `SELECT id, name, price FROM products WHERE id = '${item.id}'`;

    queryCalls.push(client.query(query));
  })

  // 3. Verify that cart items have correct names, ids and prices after all queries were complete
  let totalVer = 0;

  Promise.all(queryCalls)
    .then((results) => {
      for (let i=0; i<(results.length); i++) {
        const item = results[i].rows[0];

        // 3.1 Check if item was found in database
        if (!item) {
          throw new Error(`Item with id ${cart[i].id} is not found in database.`);
          return;
        }

        // 3.2 Verify name and price
        if (item.name !== cart[i].name) {
          throw new Error(`Item with id ${cart[i].id} does not have a matching name '${cart[i].name}'.`);
          return;
        }

        if (item.price !== cart[i].price) {
          throw new Error(`Item with id ${cart[i].id} does not have a matching price ${cart[i].price}.`);
          return;
        }

        // 4. Add item price to total
        totalVer += item.price*cart[i].quantity;
      }

      // 3. Verify that total amount to be charged is corresponds with price that user saw
      if (total !== totalVer) {
        throw new Error(`Total purchase amount ${totalVer} does not match price that was displayed to the user ${total}.`);
        return;
      }
    }).then(() => {
      // 3. Build line items array from cart items
      const line = [];

      cart.forEach((item) => {
        line.push({
          price_data: {
            currency: 'USD',
            product_data: {
              name: item.name
            },
            unit_amount: item.price
          },
          quantity: item.quantity
        })
      })

      // 4. Create new session
      const successUrl = `${request.protocol}://${request.get('host')}/#payment-success`;
      const cancelUrl = `${request.protocol}://${request.get('host')}/#payment-cancel`;

      const sessionData = {
        payment_method_types: ['card'],
        line_items: line,
        mode: 'payment',
        metadata: {
          date: Date.now()
        },
        success_url: successUrl,
        cancel_url: cancelUrl
      }

      if (email) sessionData['customer_email'] = email;

      const sessionPromise = stripe.checkout.sessions.create(sessionData)

      return sessionPromise;
    }).then((session) => {
      log('New checkout session successfully initialized.', session.id);

      // 5. Send session id to the client
      response.status(201).send(session.id);
    }).catch((error) => {
      log('Error creating checkout session: ', error.stack);
      response.status(500).send('Error occured when attempting to verify cart items.');
    })
})

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
  const email = request.body.email.trim();
  const password = request.body.password.trim();

  const userRegEx = /[A-Za-z0-9_]+$/;
  const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  const passRegEx = /[A-Za-z0-9_\-@\$\*#\+]+$/;

  // 1.1 Check if value is present
  if (!username) {
    response.status(400).send(`Username is empty or invalid.`);
    return;
  }

  if (!email) {
    response.status(400).send(`Email is empty or invalid.`);
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

  if (typeof email !== 'string') {
    response.status(400).send(`Email is not a string.`);
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

  if (email.search(userRegEx) == -1) {
    response.status(400).send(`Email contains invalid characters or does not match email pattern.`);
    return;
  }

  if (password.search(passRegEx) == -1) {
    response.status(400).send(`Password contains invalid characters. Only A-Z, a-z, 0-9 , _ - @ $ * # + are allowed.`);
    return;
  }

  // 2. Check that username is available
  if (await getUser(username) === null) {
    // 3. Check that email is available
    if (await emailAvailable(email)) {
      // 4. Hash password
      const hash = await bcrypt.hash(password, 13);

      // 5. Add new user to database
      query = `INSERT INTO users(username, email, password) VALUES ('${username}', '${email}', '${hash}')`;

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
      response.status(409).send({
        target: 'email',
        message: `User with this email is already registered.`
      });
    }
  } else {
    response.status(409).send({
      target: 'username',
      message: `Username is not available. Please, choose another name.`
    });
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
    response.status(400).send({
      target: 'username',
      message: `Username is empty or invalid.`
    });
    return;
  }

  if (!password) {
    response.status(400).send({
      target: 'password',
      message: `Password is empty or invalid.`
    });
    return;
  }

  // 1.2 Check that it has correct type
  if (typeof username !== 'string') {
    response.status(400).send({
      target: 'username',
      message: `Username is not a string.`
    });
    return;
  }

  if (typeof password !== 'string') {
    response.status(400).send({
      target: 'password',
      message: `Password is not a string.`
    });
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
        email: user.email,
        exp: Math.floor(Date.now()/1000) + 60*60*12
      }

      const token = jwt.sign(payload, jwtkey);

      response.status(200).send(token);
    } else {
      response.status(400).send({
        target: 'password',
        message: 'Password is not correct.'
      });
    }
  } else {
    response.status(400).send({
      target: 'username',
      message: `User with name "${username}" is not found.`
    });
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
    response.status(401).send({
      target: 'username',
      message: error.message
    });
  }
})

// List customer's orders
app.get('/orders', async (request, response) => {
  const token = request.query.token;

  try {
    // 1. Extract email from token
    const payload = jwt.verify(token, jwtkey);
    const email = payload.email;

    // 2. Fetch checkout sessions from Stripe server
    if (email) {
      let sessions = await stripe.checkout.sessions.list();
      sessions = sessions.data;

      // 3. Leave only paid sessions for given user
      sessions = sessions.filter((session) => {
        return session.customer_email === email && session.payment_status === 'paid';
      })

      // 4. Retrieve list items for every session
      const orders = await Promise.all(sessions.map(async (session) => {
        let items = await stripe.checkout.sessions.listLineItems(session.id);
        items = items.data;

        const order = {
          items: null,
          total: 0,
          date: null
        }

        // 5. Retrieve product name for every item in the order
        order.items = await Promise.all(items.map(async (item) => {
          const product = await stripe.products.retrieve(item.price.product);
          const productName = product.name;

          // 6. Bundle up price, product and quantity data for every item and push to order array
          const itemData = {
            price: item.price.unit_amount,
            product: productName,
            total: item.amount_total,
            quantity: item.quantity
          }

          order.total += item.amount_total;

          if (session.metadata.date) {
            order.date = session.metadata.date;
          }

          return itemData;
        }))

        return order;
      }));

      response.status(200).send(orders);
    } else {
      throw new Error('User email is not present in the token.');
    }
  } catch (error) {
    response.status(401).send(error.message);
  }

})

function getUser(username) {
  return new Promise((resolve, reject) => {
    const query = `SELECT id, username, email, password FROM users WHERE username = '${username}'`;

    client.query(query, (error, data) => {
      if (error) {
        log('Database query error: ', error.stack);
        response.status(500).send('Error occured when attempting to get user from database.');
        reject();
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

function emailAvailable(email) {
  return new Promise((resolve, reject) => {
    const query = `SELECT id FROM users WHERE email = '${email}'`;

    client.query(query, (error, data) => {
      if (error) {
        log('Database query error: ', error.stack);
        response.status(500).send('Error occured when attempting to check email availablility.');
        reject();
      } else {
        if (data.rows.length === 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    })
  })
}

app.listen(process.env.PORT || 3000);

log('Server is running');
