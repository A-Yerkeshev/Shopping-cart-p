"use strict";
import CM from './ChannelManager.js';
import { getCookie, setCookie } from './cookies.js';
const log = console.log;

let Cart;

// Number of days after cart cookie will expire
const expDays = 5;

// Listen to requests from Main module
CM.listen('add-store-el', addStoreEventListeners);
CM.listen('clear-cart', clearCart);

// Establish connection with Drawer module
CM.open('draw-cart-items');
CM.listen('cart-layout-updated', addEventListeners);

CM.open('add-cart-indicator');

// Listen to requests from Auth module
CM.setFormat('activate-cart', 'STRING');
CM.listen('activate-cart', setCurrentCart);

CM.setFormat('send-user', 'STRING');

function setCurrentCart(username) {
  Cart = getCart(username);

  CM.send('draw-cart-items', Cart);

  if (Cart.length > 0) {
    CM.send('add-cart-indicator', true);
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

function addEventListeners() {
  const buttons = Array.from(document.getElementsByClassName('remove'));
  const inputs = Array.from(document.getElementsByClassName('quantity'));
  const payBtn = document.getElementsByClassName('pay')[0];

  buttons.forEach((button) => {
    button.addEventListener('click', removeFromCart);
  })

  inputs.forEach((input) => {
    input.addEventListener('change', addToCart);
  })

  payBtn.addEventListener('click', checkout);
}

function addStoreEventListeners() {
  const buttons = Array.from(document.getElementsByClassName('add'));

  buttons.forEach((button) => {
    button.addEventListener('click', addToCart);
  })
}

function addToCart(ev) {
  const itemId = ev.target.getAttribute('data-id');
  const user = getUser();

  log(user);

  // 1. If user is not signed in - redirect to login page
  if (!user) {
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
      CM.send('add-cart-indicator', true);
    }
  } else {
    // 3.2 Otherwise add new entry to cart
    Cart.push({
      id: itemId,
      quantity: 1
    })

    CM.send('add-cart-indicator', true);
  }

  // 5. Update cart cookie and make current cart active
  setCookie(`cart-${user}`, Cart, 1000*60*60*24*expDays);
  CM.send('draw-cart-items', Cart);
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
  CM.send('draw-cart-items', Cart);
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

function getUser() {
  let user;

  CM.listenOnce('send-user', (username) => {
    user = username;
  })
  CM.send('get-user', true);

  return user;
}
