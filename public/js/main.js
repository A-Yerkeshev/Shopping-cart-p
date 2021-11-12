"use strict";
import Router from './router.js';
import fillTemplate from './fillTemplate.js'
import { getCookie, setCookie } from './cookies.js'

const log = console.log;

const store = document.getElementById('store-template');
const signUp = document.getElementById('sign-up-template');
const signIn = document.getElementById('sign-in-template');
const cartTpl = document.getElementById('cart-template');
const cartView = document.getElementById('cart');
const cartToggle = document.querySelector('.cart-toggle');

// Number of days after cart cookie will expire
const expDays = 5;
const Data = {
  items: null
}

Router.when('/', fillStoreTemplate);
Router.onload('/', addStoreEventListeners);
Router.when('/store', fillStoreTemplate);
Router.onload('/store', addStoreEventListeners);
Router.when('/sign-up', signUp.content);
Router.when('/sign-in', signIn.content);
Router.default('/');

cartToggle.addEventListener('click', toggleCart);

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
      // If it is, increase the quantity
      match.quantity++;
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
      cart.splice(cart[i], 1);

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

  buttons.forEach((button) => {
    button.addEventListener('click', removeFromCart);
  })
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
