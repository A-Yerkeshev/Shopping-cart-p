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

// Number of days after cart cookie will expire
const expDays = 5;
const Data = {
  items: null
}

Router.when('/', fillStoreTemplate);
Router.onload('/', addStoreEventListeners);
Router.when('/store', fillStoreTemplate);
Router.onload('/store', addStoreEventListeners);
Router.when('/sign-up', signUpTpl.content);
Router.onload('/sign-up', addSignUpEventListeners);
Router.when('/sign-in', signInTpl.content);
Router.onload('/sign-in', addSignInEventListeners);
Router.default('/');

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

  cartView.innerHTML = '';
  cartView.appendChild(fillTemplate(cartTpl, { items }));
  addCartEventListeners();
}

function addToCart(ev) {
  const itemId = ev.target.getAttribute('data-id');
  let cart = getCookie('cart');

  // If cart cookie was found:
  if (cart) {
    // Check if selected item already present in the cart
    let match;

    for (let i=0; i<(cart.length); i++) {
      if (cart[i].id == itemId) {
        match = cart[i];

        break;
      }
    }

    if (match) {
      // If it is, check what triggered addToCart function
      if (ev.target.value) {
        // If it was triggered by input field - set new quantity
        match.quantity = ev.target.value;
      } else {
        // If it was triggered by button - increase quantity by 1
        match.quantity++;
      }
    } else {
      // Otherwise add new entry to cart
      cart.push({
        id: itemId,
        quantity: 1
      })
    }
  } else {
    // Otherwise create cart and add frist item
    cart = [{
      id: itemId,
      quantity: 1
    }]
  }

  // Update cart cookie
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
  const cart = document.getElementById('cart');

  cart.classList.toggle('onscreen');
  cartToggle.classList.toggle('onscreen');
}

function fillStoreTemplate() {
  if (Data.items) {
    return fillTemplate(store, {items: Data.items});
  } else {
    return new Promise((resolve, reject) => {
      fetchItems()
        .then((data) => resolve(fillTemplate(store, {items: data})));
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
  const cartToggle = document.querySelector('.cart-toggle');

  cartToggle.addEventListener('click', toggleCart);

  buttons.forEach((button) => {
    button.addEventListener('click', removeFromCart);
  })

  inputs.forEach((input) => {
    input.addEventListener('change', addToCart);
  })
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

  form.addEventListener('submit', signIn);
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
    .catch((error) => {throw new Error('Error fetching data from /products: ' + error)});
}

function signUp(ev) {
  ev.preventDefault();

  const error = document.querySelector('.error');
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

  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newUser)
  }

  fetch('/users', request)
    .then((response) => {
      log('Status', response.status)
    }).catch((error) => {
      throw new Error(error);
    })
}
