"use strict";
import Router from './router.js';
import fillTemplate from './fillTemplate.js'
import { getCookie, setCookie } from './cookies.js'

const log = console.log;

const store = document.getElementById('store-template');
const signUpTpl = document.getElementById('sign-up-template');
const signInTpl = document.getElementById('sign-in-template');
const cartTpl = document.getElementById('cart-template');
const cartView = document.getElementById('cart');
const cartToggle = document.getElementById('cart-toggle');

// Number of days after cart cookie will expire
const expDays = 5;

const Data = {
  items: null
}
let signedIn = false;

// Define variables for stripe config
let stripeHandler;

Router.when('/', fillStoreTemplate);
Router.onload('/', addStoreEventListeners);
Router.when('/store', fillStoreTemplate);
Router.onload('/store', addStoreEventListeners);
Router.when('/sign-up', signUpTpl.content);
Router.onload('/sign-up', addSignUpEventListeners);
Router.when('/sign-in', signInTpl.content);
Router.onload('/sign-in', addSignInEventListeners);
Router.default('/');

// Try to sign user in if valid token is present in local storage
signInByToken();

addCloseDescriptionListener();

// Add new item indicator to cart button if cart is not empty
initialIndicator();

function updateCart() {
  const cart = getCookie('cart');
  const items = [];

  if (cart) {
    cart.forEach((entry) => {
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
  let cart = getCookie('cart');

  // 1. If user is not signed in - redirect to login page
  if (!signedIn) {
    location.href = '/#sign-in';
    return;
  }

  // 2. If cart cookie was found:
  if (cart) {
    // 3. Check if selected item already present in the cart
    let match;

    for (let i=0; i<(cart.length); i++) {
      if (cart[i].id == itemId) {
        match = cart[i];

        break;
      }
    }

    if (match) {
      // 3.1 If it is, check what triggered addToCart function
      if (ev.target.value) {
        // 3.1.1 If it was triggered by input field - set new quantity
        match.quantity = ev.target.value;
      } else {
        // 3.1.2 If it was triggered by button - increase quantity by 1
        match.quantity++;

        // 3.1.3 Add visual indetification of new item
        cartToggle.classList.add('new');
      }
    } else {
      // 3.2 Otherwise add new entry to cart
      cart.push({
        id: itemId,
        quantity: 1
      })

      cartToggle.classList.add('new');
    }
  } else {
    // 4. Otherwise create cart and add frist item
    cart = [{
      id: itemId,
      quantity: 1
    }]

    cartToggle.classList.add('new');
  }

  // 5. Update cart cookie
  setCookie('cart', cart, 1000*60*60*24*expDays);
  updateCart();
}

function removeFromCart(ev) {
  const itemId = ev.target.parentNode.getAttribute('data-id');
  let cart = getCookie('cart');

  for (let i=0; i<(cart.length); i++) {
    if (cart[i].id == itemId) {
      cart.splice(i, 1);
      break;
    }
  }

  setCookie('cart', cart, 1000*60*60*24*expDays);
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

  // 1. Change default pattern mismatch message for input fields
  const userInput = form.querySelector('#username');

  if (userInput) inputs.push(userInput);

  userInput.addEventListener('invalid', () => {
    patternMismatchMessage(userInput, 'Only A-Z, a-z, 0-9 and _ are allowed.');
  })


  const passInput = form.querySelector('#password');

  if (passInput) inputs.push(passInput);

  passInput.addEventListener('invalid', () => {
    patternMismatchMessage(passInput, 'Only A-Z, a-z, 0-9 , _ - @ $ * # + are allowed.');
  })


  const passRepInput = form.querySelector('#password-rep');
  if (passRepInput) inputs.push(passRepInput);

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
        if (response.status == 409) {
          const userInput = document.getElementById('username');

          userInput.setCustomValidity('Username is not available. Please, choose another name.');
          userInput.reportValidity();
        }

        return response.text().then((message) => {
          throw new Error(message);
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
        log(`User successfully signed in.`);

        // 1. Verify that token is a string
        if (typeof token !== 'string') {
          throw new Error('Token came from server is not of "string" type.');
          return;
        }

        // 2. Save token in local storage
        localStorage.setItem('token', token);

        // 3. Redirect to homepage
        location.href = '/#';

        signedIn = true;

        // 4. Give visual indication of successful authentication
        fillUserBox(username);

        // 5. Display cart
        displayCart();

        resolve();
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
      signedIn = true;

      // 3. Give visual indication of successful authentication
      fillUserBox(username);

      // 4. Display cart
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
  const cart = getCookie('cart');

  if (cart.length > 0) {
    cartToggle.classList.add('new');
  }
}

function checkout() {
  // 1. Verify that user is signed in
  if (!signedIn) {
    location.href = '/#sign-in';
    return;
  }

  // 2. Get cart and auth token
  const cart = getCookie('cart');
  const token = localStorage.getItem('token');

  if (!cart) {
    throw new Error(`Something went wrong. Cart is ${cart}.`);
    return;
  }

  if (!token) {
    throw new Error(`No authentication token is present in local storage.`);
    return;
  }

  // 3. Add item name and price to cart items for verification on server side
  cart.forEach((item) => {
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
    cart,
    token,
    total
  }

  // 5. Create request
  const headers = new Headers();
  headers.append('Content-Type', 'application/json');

  const request = new Request('/create-stripe-session', {
    method: 'POST',
    headers,
    mode: 'same-origin',
    body: JSON.stringify(data)
  })

  fetch(request)
    .then(response => response.json())
    .then((session) => {
      return stripe.redirectToCheckout({ sessionId: session.id });
    })
    .then((result) => {
      // If `redirectToCheckout` fails due to a browser or network
      // error, you should display the localized error message to your
      // customer using `error.message`.
      if (result.error) {
        alert(result.error.message);
      }
    })
    .catch((error) => {
      log('Error proceeding to payment: ', error);
    })
}
