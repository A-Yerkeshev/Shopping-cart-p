"use strict";
import Router from './router.js';
import { fillTemplate, updateTableTags } from './fillTemplate.js';
import { getCookie, setCookie } from './cookies.js';
import CM from './ChannelManager.js';

const log = console.log;

const store = document.getElementById('store-template');
const signUpTpl = document.getElementById('sign-up-template');
const signInTpl = document.getElementById('sign-in-template');
const paymentSuccessTpl = document.getElementById('payment-success-template');
const paymentCancelTpl = document.getElementById('payment-cancel-template');
const ordersTpl = document.getElementById('orders-template');
const noOrdersTpl = document.getElementById('no-orders-template');

const Data = {
  items: null
}

Router.when('/', fillStoreTemplate);
Router.onload('/', addStoreEventListeners);
Router.when('store', fillStoreTemplate);
Router.onload('store', addStoreEventListeners);
Router.when('sign-up', signUpTpl.content);
Router.onload('sign-up', addSignUpEventListeners);
Router.when('sign-in', signInTpl.content);
Router.onload('sign-in', addSignInEventListeners);
Router.when('payment-success', paymentSuccessTpl.content);
Router.when('payment-cancel', paymentCancelTpl.content);
Router.onload('payment-cancel', () => {
  setTimeout(() => Router.redirect('/'), 3000)
});
Router.when('orders', fillOrdersTemplate);
Router.default('/');

// Establish connection with Auth module
CM.open('add-sign-up-el');
CM.open('add-sign-in-el');

// Establish connection with Cart module
CM.open('add-store-el');

// Establish connection with Drawer module
CM.open('cart-layout-updated');

CM.open('get-items');
CM.open('send-items');
CM.setFormat('send-items', 'ARRAY');
CM.listen('get-items', sendItems);

// Fetch items from the server
fetchItems();

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
        }).catch((error) => {
          reject(error);
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
    .catch((error) => console.error('Error fetching data from /products: ' + error));
}

function sendItems(req) {
  CM.send('send-items', Data.items);
}

function fillOrdersTemplate() {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('token');

    if (!token) {
      console.error('Authentication token is not present in local storage.');
      return;
    }

    const request = new Request(`/orders?token=${token}`, {
      method: 'GET',
      mode: 'same-origin'
    })

    fetch(request)
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          return response.text().then((message) => {
            throw new Error(message);
          })
        }
      }).then((orders) => {

        // Convert price to display price
        orders.forEach((order) => {
          order.items.forEach((item) => {
            item.displayPrice = '$' + (item.price/100).toFixed(2);
          })

          order.total = '$' + (order.total/100).toFixed(2);

          if (order.date) {
            const options = {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric'
            }

            order.date = new Intl.DateTimeFormat('en-UK', options).format(order.date);
          } else {
            order.date = '';
          }
        })

        if (orders.length > 0) {
          let data = {
            orders
          }

          let fragment = fillTemplate(ordersTpl, data);
          fragment = updateTableTags(fragment);

          resolve(fragment);
        } else {
          resolve(noOrdersTpl.content.cloneNode(true));
        }
      }).catch((error) => {
        reject(error);
      })
  })
}
