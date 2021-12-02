"use strict";
import CM from './ChannelManager.js';
import fillTemplate from './fillTemplate.js';
const log = console.log;

const store = document.getElementById('store-template');
const signUpTpl = document.getElementById('sign-up-template');
const signInTpl = document.getElementById('sign-in-template');
const cartTpl = document.getElementById('cart-template');
const cartView = document.getElementById('cart');
const cartToggle = document.getElementById('cart-toggle');
const paymentSuccessTpl = document.getElementById('payment-success-template');
const paymentCancelTpl = document.getElementById('payment-cancel-template');

// Listen to requests from Auth module
CM.setFormat('report-validity', {
  target: 'STRING',
  message: 'STRING'
})
CM.listen('report-validity', reportValidity);

CM.setFormat('draw-user-elements', 'STRING');
CM.listen('draw-user-elements', fillUserBox, displayCart);

// Listen to requests from Cart module
CM.setFormat('draw-cart-items', 'ARRAY');
CM.listen('draw-cart-items', drawCartItems);

CM.listen('add-cart-indicator', addIndicator);

cartToggle.addEventListener('click', toggleCart);
addCloseDescriptionListener();

function reportValidity(data) {
  const input = document.getElementById(`${data.target}`);

  if (!input) {
    throw new Error(`Element with id ${data.target} is not present in the document.`);
    return;
  }

  if (input.tagName !== 'INPUT') {
    throw new Error(`Element with id ${data.target} is not an input tag.`);
    return;
  }

  input.setCustomValidity(data.message);
  input.reportValidity();
}

function fillUserBox(username) {
  const userbox = document.getElementById('userbox');
  userbox.textContent = `Signed as ${username}.`;
}

function displayCart() {
  cartView.classList.add('visible');
  cartToggle.classList.add('visible');
}

function patternMismatchMessage(input, message) {
  if (input.validity.patternMismatch) {
    input.setCustomValidity(message);
  }
}

function drawCartItems(cartEntries) {
  const itemsData = getItems();
  let items = [];

  cartEntries.forEach((entry) => {
    let item;

    // Find item by id
    for (let i=0; i<(itemsData.length); i++) {
      if (itemsData[i].id == entry.id) {
        item = {
          id: itemsData[i].id,
          name: itemsData[i].name,
          image: itemsData[i].image,
          price: itemsData[i].price,
          displayPrice: ((itemsData[i].price)/100).toFixed(2),
          quantity: entry.quantity
        }
        break;
      }
    }

    if (item) {
      items.push(item);
    }
  })

  const total = items.reduce((prev, curr) => {
    return prev + curr.price*curr.quantity;
  }, 0)/100

  const data = {
    items,
    total: total.toFixed(2)
  }

  cartView.innerHTML = '';
  cartView.appendChild(fillTemplate(cartTpl, data));

  // Inform other modules that cart layout has been updated
  CM.send('cart-layout-updated', true);
}

function addIndicator() {
  cartToggle.classList.add('new');
}

function toggleCart() {
  cartToggle.classList.toggle('onscreen');
  cartView.classList.toggle('onscreen');
}

function getItems() {
  let items;

  CM.listenOnce('send-items', (data) => {
    items = data;
  })
  CM.send('get-items', true);

  return items;
}

function addCloseDescriptionListener() {
  const descr = document.getElementsByClassName('descr')[0];
  const close = descr.querySelector('.fa-times');

  close.addEventListener('click', () => {
    descr.remove();
  })
}

