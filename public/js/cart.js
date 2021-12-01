"use strict";
import CM from './ChannelManager.js';
import { getCookie, setCookie } from './cookies.js';
const log = console.log;

let Cart;

// Number of days after cart cookie will expire
const expDays = 5;

// Establish connection with Drawer module
CM.open('draw-cart-items');

// Listen to requests from Auth module
CM.setFormat('activate-cart', 'STRING');
CM.listen('activate-cart', setCurrentCart);

function setCurrentCart(username) {
  Cart = getCart(username)
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
