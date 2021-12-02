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

const Data = {
  items: null
}
let stripe, User, Cart;

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
CM.open('add-sign-up-el');
CM.open('add-sign-in-el');

// Establish connection with Cart module
CM.open('add-store-el');
CM.open('clear-cart');

// Establish connection with Drawer module
CM.open('cart-layout-updated');

CM.open('get-items');
CM.open('send-items');
CM.setFormat('send-items', 'ARRAY');
CM.listen('get-items', sendItems);

// Fetch items from the server
fetchItems();

// Initialize stripe
initStripe();

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
  CM.send('add-store-el', true);
}

function addSignUpEventListeners() {
  CM.send('add-sign-up-el', true);
}

function addSignInEventListeners() {
  CM.send('add-sign-in-el', true);
}

function fetchItems() {
  return fetch('/products')
    .then((response) => response.json())
    .then((data) => {
      Data.items = data;
      return data;
    })
    .catch((error) => log('Error fetching data from /products: ' + error));
}

////////////////////////

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
  CM.send('clear-cart', true);
}
////////////////

function sendItems(req) {
  CM.send('send-items', Data.items);
}
