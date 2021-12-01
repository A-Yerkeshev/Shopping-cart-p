"use strict";
import CM from './ChannelManager.js';

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

function reportValidity(data) {
  const input = document.getElementById(`#${data.target}`);

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
