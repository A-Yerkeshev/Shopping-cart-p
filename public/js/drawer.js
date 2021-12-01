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

// Inform other modules when cart layout has been updated
CM.open('cart-layout-updated');
CM.setFormat('cart-layout-updated', {
  buttons: 'ARRAY',
  inputs: 'ARRAY',
  payBtn: 'OBJECT'
})

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

function drawCartItems(items) {
  cartView.innerHTML = '';
  cartView.appendChild(fillTemplate(cartTpl, items));

  const buttons = Array.from(document.getElementsByClassName('remove'));
  const inputs = Array.from(document.getElementsByClassName('quantity'));
  const payBtn = document.getElementsByClassName('pay')[0];

  CM.send('cart-layout-updated', {
    buttons,
    inputs,
    payBtn
  });
}
