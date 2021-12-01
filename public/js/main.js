"use strict";
import Router from './router.js';
import fillTemplate from './fillTemplate.js';
import { getCookie, setCookie } from './cookies.js';
import CM from './ChannelManager.js';

const log = console.log;

const store = document.getElementById('store-template');
const signUpTpl = document.getElementById('sign-up-template');
const signInTpl = document.getElementById('sign-in-template');
const cartTpl = document.getElementById('cart-template');
const cartView = document.getElementById('cart');
const cartToggle = document.getElementById('cart-toggle');
const paymentSuccessTpl = document.getElementById('payment-success-template');
const paymentCancelTpl = document.getElementById('payment-cancel-template');

// Number of days after cart cookie will expire
const expDays = 5;

const Data = {
  items: null
}
let User, Cart;

Router.when('/', fillStoreTemplate);
Router.onload('/', addStoreEventListeners);
Router.when('store', fillStoreTemplate);
Router.onload('store', addStoreEventListeners);
Router.when('sign-up', signUpTpl.content);
Router.onload('sign-up', addSignUpEventListeners);
Router.when('sign-in', signInTpl.content);
Router.onload('sign-in', addSignInEventListeners);
Router.when('payment-success', paymentSuccessTpl.content);
Router.onload('payment-success', clearCart);
Router.when('payment-cancel', paymentCancelTpl.content);
Router.onload('payment-cancel', () => {
  setTimeout(() => Router.redirect('/'), 3000)
});
Router.default('/');

// Establish connection with Auth module
CM.openChannel('register-user');
CM.openChannel('sign-in');
CM.openChannel('sign-in-by-token');
CM.openChannel('signed-user');

// Establish connection with Cart module
// Establish connection with Drawer module

// Fetch items from the server
fetchItems();

// Initialize stripe
let stripe;
initStripe();

// Try to sign user in if valid token is present in local storage
signInByToken();

addCloseDescriptionListener();

function updateCart() {
  const items = [];

  if (Cart) {
    Cart.forEach((entry) => {
      let item;

      // Find item by id
      for (let i=0; i<(Data.items.length); i++) {
        if (Data.items[i].id == entry.id) {
          item = {
            id: Data.items[i].id,
            name: Data.items[i].name,
            image: Data.items[i].image,
            price: Data.items[i].price,
            displayPrice: ((Data.items[i].price)/100).toFixed(2),
            quantity: entry.quantity
          }
          break;
        }
      }

      if (item) {
        items.push(item);
      }
    })
  }

  const total = items.reduce((prev, curr) => {
    return prev + curr.price*curr.quantity;
  }, 0)/100

  const data = {
    items,
    total: total.toFixed(2)
  }

  cartView.innerHTML = '';
  cartView.appendChild(fillTemplate(cartTpl, data));
  addCartEventListeners();
}

function addToCart(ev) {
  const itemId = ev.target.getAttribute('data-id');

  // 1. If user is not signed in - redirect to login page
  if (!User) {
    location.href = '/#sign-in';
    return;
  }

  // 2. Check if selected item already present in the cart
  let match;

  for (let i=0; i<(Cart.length); i++) {
    if (Cart[i].id == itemId) {
      match = Cart[i];

      break;
    }
  }

  if (match) {
    // 2.1 If it is, check what triggered addToCart function
    if (ev.target.value) {
      // 2.1.1 If it was triggered by input field - set new quantity
      match.quantity = ev.target.value;
    } else {
      // 2.1.2 If it was triggered by button - increase quantity by 1
      match.quantity++;

      // 2.1.3 Add visual indetification of new item
      cartToggle.classList.add('new');
    }
  } else {
    // 3.2 Otherwise add new entry to cart
    Cart.push({
      id: itemId,
      quantity: 1
    })

    cartToggle.classList.add('new');
  }

  // 5. Update cart cookie and make current cart active
  setCookie(`cart-${User}`, Cart, 1000*60*60*24*expDays);
  updateCart();
}

function removeFromCart(ev) {
  const itemId = ev.target.parentNode.getAttribute('data-id');

  for (let i=0; i<(Cart.length); i++) {
    if (Cart[i].id == itemId) {
      Cart.splice(i, 1);
      break;
    }
  }

  setCookie(`cart-${User}`, Cart, 1000*60*60*24*expDays);
  updateCart();
}

function toggleCart(ev) {
  cartView.classList.toggle('onscreen');
  cartToggle.classList.toggle('onscreen');

  cartToggle.classList.remove('new');
}

function displayCart() {
  cartView.classList.add('visible');
  cartToggle.classList.add('visible');

  // Add new item indicator to cart button if cart is not empty
  initialIndicator();
}

function fillStoreTemplate() {
  if (Data.items) {
    const items = Data.items.map((item) => {
      // Convert price from cent to floating dollar notation

      const result = {
        id: item.id,
        name: item.name,
        image: item.image,
        price: (item.price/100).toFixed(2)
      }

      return result;
    })

    return fillTemplate(store, { items });
  } else {
    return new Promise((resolve, reject) => {
      fetchItems()
        .then((data) => {
          const items = data.map((item) => {
            const result = {
              id: item.id,
              name: item.name,
              image: item.image,
              price: (item.price/100).toFixed(2)
            }

            return result;
          })

          resolve(fillTemplate(store, { items }));
        })
    })
  }
}

function addStoreEventListeners() {
  const buttons = Array.from(document.getElementsByClassName('add'));

  buttons.forEach((button) => {
    button.addEventListener('click', addToCart);
  })
}

function addCartEventListeners() {
  const buttons = Array.from(document.getElementsByClassName('remove'));
  const inputs = Array.from(document.getElementsByClassName('quantity'));
  const pay = document.getElementsByClassName('pay')[0];

  cartToggle.addEventListener('click', toggleCart);

  buttons.forEach((button) => {
    button.addEventListener('click', removeFromCart);
  })

  inputs.forEach((input) => {
    input.addEventListener('change', addToCart);
  })

  pay.addEventListener('click', checkout);
}

function addSignUpEventListeners() {
  const form = document.querySelector('.form form');
  const inputs = [];

  form.addEventListener('submit', signUp);

  // 1. Change default pattern mismatch message for input and email fields
  const userInput = form.querySelector('#username');
  const emailInput = form.querySelector('#email');
  const passInput = form.querySelector('#password');
  const passRepInput = form.querySelector('#password-rep');

  if (userInput) inputs.push(userInput);
  if (emailInput) inputs.push(emailInput);
  if (passInput) inputs.push(passInput);
  if (passRepInput) inputs.push(passRepInput);

  userInput.addEventListener('invalid', () => {
    patternMismatchMessage(userInput, 'Only A-Z, a-z, 0-9 and _ are allowed.');
  })

  emailInput.addEventListener('invalid', () => {
    patternMismatchMessage(userInput, 'Email format is invalid.');
  })

  passInput.addEventListener('invalid', () => {
    patternMismatchMessage(passInput, 'Only A-Z, a-z, 0-9 , _ - @ $ * # + are allowed.');
  })

  // 2. Clear validation messages on input value change
  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.setCustomValidity('');
    })
  })
}

function addSignInEventListeners() {
  const form = document.querySelector('.form form');
  const inputs = form.querySelectorAll('input');

  form.addEventListener('submit', signIn);

  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.setCustomValidity('');
    })
  })
}

function patternMismatchMessage(input, message) {
  if (input.validity.patternMismatch) {
    input.setCustomValidity(message);
  }
}

function fetchItems() {
  return fetch('/products')
    .then((response) => response.json())
    .then((data) => {
      Data.items = data;
      updateCart();
      return data;
    })
    .catch((error) => log('Error fetching data from /products: ' + error));
}

function signUp(ev) {
  ev.preventDefault();

  const formData = new FormData(ev.target);
  const username = formData.get('username').trim();
  const email = formData.get('email').trim();
  const password = formData.get('password').trim();
  const passwordRep = formData.get('password-rep');

  // 1. Validate passwords match
  const passInput = ev.target.querySelector('#password');

  if (password !== passwordRep) {
    passInput.setCustomValidity('Passwords do not match.');
    passInput.reportValidity();
    return;
  }

  // 2. Send registration request to the server
  const newUser = {
    username,
    email,
    password
  }

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');

  const request = new Request('/users', {
    method: 'POST',
    headers,
    mode: 'same-origin',
    body: JSON.stringify(newUser)
  })

  fetch(request)
    .then((response) => {
      if (response.ok) {
        log(`New user "${username}" successfully registered.`);
      } else {
        return response.json().then((error) => {
          const userInput = document.getElementById('username');
          const emailInput = document.getElementById('email');

          if (error.target === 'email') {
            emailInput.setCustomValidity(error.message);
            emailInput.reportValidity();
          }

          if (error.target === 'username') {
            userInput.setCustomValidity(error.message);
            userInput.reportValidity();
          }

          throw new Error(error.message);
        })
      }
    }).then(() => {
      // Sign newly registered user in
      const request = new Request('/users/auth', {
        method: 'POST',
        headers,
        mode: 'same-origin',
        body: JSON.stringify(newUser)
      })

      sendSignInRequest(request, username)
        .then((token) => {
          log(`User successfully signed in.`);

          // 1. Save token in local storage
          localStorage.setItem('token', token);

          // 2. Redirect to homepage
          location.href = '/#';

          User = username;

          // 3. Give visual indication of successful authentication
          fillUserBox(username);

          // 4. Fill cart and display it
          Cart = getCart(username);
          updateCart();
          displayCart();
        })
        .catch((error) => log('Error signing user in: ', error.message))
    }).catch((error) => log('Error registering new user: ', error.message))
}

function signIn(ev) {
  ev.preventDefault();

  const formData = new FormData(ev.target);
  const username = formData.get('username').trim();
  const password = formData.get('password').trim();

  const data = {
    username,
    password
  }

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');

  const request = new Request('/users/auth', {
    method: 'POST',
    headers,
    mode: 'same-origin',
    body: JSON.stringify(data)
  })

  sendSignInRequest(request, username)
    .then((token) => {
      log(`User successfully signed in.`);

      // 1. Save token in local storage
      localStorage.setItem('token', token);

      // 2. Redirect to homepage
      location.href = '/#';

      User = username;

      // 3. Give visual indication of successful authentication
      fillUserBox(username);

      // 4. Fill cart and display it
      Cart = getCart(username);
      updateCart();
      displayCart();
    })
    .catch((error) => {
      const userInput = document.getElementById('username');
      const passInput = document.getElementById('password');

      if (error.message == 'Password is not correct.') {
        passInput.setCustomValidity(error.message);
        passInput.reportValidity();
      } else {
        userInput.setCustomValidity(error.message);
        userInput.reportValidity();
      }

      log('Error signing user in: ', error.message);
    })
}

function sendSignInRequest(request, username) {
  return new Promise((resolve, reject) => {
    fetch(request)
      .then((response) => {
        if (response.ok) {
          return response.text();
        } else {
          return response.text().then((message) => {
            throw new Error(message);
          })
        }
      }).then((token) => {
        // 1. Verify that token is a string
        if (typeof token !== 'string') {
          throw new Error('Token came from server is not of "string" type.');
          return;
        }

        resolve(token);
      }).catch((error) => {
        reject(error);
      })
  })
}

function fillUserBox(username) {
  const userbox = document.getElementById('userbox');
  userbox.textContent = `Signed as ${username}`;
}

function signInByToken() {
  const token = localStorage.getItem('token');

  if (!token) return;

  // 1. Send token to the server
  const headers = new Headers();
  headers.append('Content-Type', 'text/plain');

  const request = new Request(`/users/auth/token?token=${token}`, {
    method: 'GET',
    headers,
    mode: 'same-origin'
  })

  // 2. If token is valid, get username from response
  fetch(request)
    .then((response) => {
      if (response.ok) {
        return response.text();
      } else {
        return response.text().then((message) => {
          throw new Error(message);
        })
      }
    }).then((username) => {
      if (!username) return;

      // 3. Set current user
      User = username;

      // 3. Give visual indication of successful authentication
      fillUserBox(username);

      // 4. Get, fill and display cart
      Cart = getCart(username);
      updateCart();
      displayCart();
    }).catch((error) => log('Token is not valid or expired. Refused to authenticate automatically.'))
}

function addCloseDescriptionListener() {
  const descr = document.getElementsByClassName('descr')[0];
  const close = descr.querySelector('.fa-times');

  close.addEventListener('click', () => {
    descr.remove();
  })
}

function initialIndicator() {
  if (Cart.length > 0) {
    cartToggle.classList.add('new');
  }
}

function initStripe() {
  // 1. Get stripe public key from the server
  fetch('/stripe-pkey')
    .then((response) => response.text())
    .then((key) => {
      if (!key) {
        throw new Error('Invalid value for Stripe public key.');
        return;
      }

      // 2. Activate Stripe using public key
      stripe = Stripe(key);
    }).catch((error) => {
      log('Error fetching Stripe public key.', error);
    })
}

function checkout() {
  // 1. Verify that user is signed in
  if (!User) {
    location.href = '/#sign-in';
    return;
  }

  // 2. Auth token
  const token = localStorage.getItem('token');

  if (!Cart) {
    throw new Error(`Cart is not present.`);
    return;
  }

  if (!token) {
    throw new Error(`No authentication token is present in local storage.`);
    return;
  }

  // 3. Add item name and price to cart items for verification on server side
  Cart.forEach((item) => {
    let match = false;

    for (let i=0; i<(Data.items.length); i++) {
      if (Data.items[i].id == item.id) {
        item.name = Data.items[i].name;
        item.price = Data.items[i].price;

        match = true;
        break;
      }
    }

    if (match == false) {
      throw new Error(`Item with invalid id ${item.id} is present in the cart cookie.`);
      return;
    }
  })

  // 4. Get total price that was displayed to the user
  const totalText = document.querySelector('b.total').textContent;
  const totalString = totalText.substring(totalText.indexOf('$')+1).trim();
  const total = Math.round(parseFloat(totalString)*100);

  const data = {
    cart: Cart,
    token,
    total
  }

  // 5. Create request
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');

  const request = new Request('/create-checkout-session', {
    method: 'POST',
    headers,
    mode: 'same-origin',
    body: JSON.stringify(data)
  })

  fetch(request)
    .then(response => {
      if (response.ok) {
        return response.text();
      } else {
        return response.text().then((message) => {
          throw new Error(message);
        })
      }
    }).then((sessionId) => {
      return stripe.redirectToCheckout({ sessionId });
    }).then((result) => {
      if (result.error) {
        alert(result.error.message);
      }

      clearCart();
    })
    .catch((error) => {
      log('Error proceeding to payment: ', error.message);
    })
}

function clearCart() {
  if (User) {
    setCookie(`cart-${User}`, [], 1000*60*60*24*expDays);
  }
}

function getCart(username) {
  // 1. Check if account has associated cart
  const cart = getCookie(`cart-${username}`);

  // 2. If it does - return in, otherwise - create new cart
  if (cart && Array.isArray(cart)) {
    return cart;
  } else {
    setCookie(`cart-${username}`, [], 1000*60*60*24*expDays);
    return [];
  }
}
