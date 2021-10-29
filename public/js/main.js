"use strict";
import Router from './router.js';

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
Router.onload('/', addStoreEventListeners, displayCart);
Router.when('/store', fillStoreTemplate);
Router.onload('/store', addStoreEventListeners, displayCart);
Router.when('/sign-up', signUp.content);
Router.when('/sign-in', signIn.content);
Router.default('/');

cartToggle.addEventListener('click', toggleCart);

// Draw shopping cart items
function displayCart() {
  const cart = getCookie('cart');
  const items = [];

  if (cart) {
    cart.forEach((entry) => {
      let item;

      // Find item by id
      for (let i=0; i<(cart.length); i++) {
        if (Data.items[i].id == entry.id) {
          item = {
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

  cartView.appendChild(fillTemplate(cartTpl, { items }));
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

function fetchItems() {
  return fetch('/products')
    .then((response) => response.json())
    .then((data) => {
      Data.items = data;
      return data;
    })
    .catch((error) => {throw new Error('Error fetching data from /products: ' + error)});
}

function getCookie(name) {
  if (typeof name !== 'string') {
    throw new Error('Argument passed to getCookie() function must be of string type.');
    return;
  }

  let cookies = document.cookie;
  let result;

  if (cookies) {
    cookies = cookies.split(';');

    for (let i=0; i<(cookies.length); i++) {
      const split = cookies[i].split('=');
      const key = split[0].trim();

      if (key == name) {
        result = JSON.parse(split[1].trim());
        break;
      }
    }
  }

  return result;
}

function setCookie(key, value='', expirity) {
  if (typeof key !== 'string') {
    throw new Error('First argument passed to setCookie() function must be of string type.');
    return;
  }
  if (typeof expirity !== 'number') {
    throw new Error('Third argument passed to setCookie() function must be of number type.');
    return;
  }

  const date = new Date();

  if (expirity) {
    date.setTime(date.getTime() + expirity);
  }

  document.cookie = key + "=" + JSON.stringify(value) + ';' + date.toUTCString();
}

function fillTemplate(template, data) {
  // Check if template is a node element
  if (!('nodeType' in template) || template.nodeType !== Node.ELEMENT_NODE) {
    throw new Error('First argument passed to "fillTemplate" function must be a node element.');
    return;
  }
  // Check if data is object
  if (typeof data !== 'object') {
    throw new Error('Second argument passed to "fillTemplate" function must be an object.');
    return;
  }

  // Check for repeat statements
  const repeatTags = template.content.querySelectorAll('repeat');

  for (let repeat of repeatTags) {
    // Find iterated array
    const attr = repeat.getAttribute('for');
    if (!attr) {
      throw new Error(`<repeat> tag expects "for" attribute.`);
      return;
    }

    const ofI = attr.indexOf(' of ');
    if (ofI == -1) {
      throw new Error(`<repeat> tag's "for" attribute must have following syntax: for="/value/ of /iterable/".`);
      return;
    }

    const iterName = attr.substring(ofI+4).trim();
    const iterable = data[iterName];
    if (!iterable) {
      throw new Error(`Iterable "${iterName}" is not defined.`);
      return;
    } else if (!Array.isArray(iterable) && !(iterable instanceof Set)) {
      throw new Error(`Iterable value "${iterName}" specified in "for=" attribute of the <repeat> tag must be an array or set.`);
      return;
    }

    // By this point iterable is found and has correct type

    // Iterate through iterable, fill new template on every iteration, append result to output
    let output = new DocumentFragment();

    iterable.forEach((element) => {
      const template = document.createElement('template');
      const content = repeat.childNodes;

      for (let node of content) {
        template.content.append(node.cloneNode(true));
      }

      output.append(fillTemplate(template, element));
    })

    // Replace <repeat> tag with actual content
    repeat.parentNode.insertBefore(output, repeat);
    repeat.remove();
  }

  // Check for insert statements
  const insertTags = template.content.querySelectorAll('insert');

  for (let insert of insertTags) {
    const id = insert.getAttribute('template');
    if (!id) {
      throw new Error(`<insert> tag requires "template attribute".`);
      return;
    }

    const tpl = document.getElementById(id);
    if (!tpl) {
      throw new Error(`Template with id "${id}" does not exist.`);
      return;
    }

    const content = fillTemplate(tpl, data);

    insert.parentNode.insertBefore(content, insert);
    insert.remove();
  }

  // Replace template variables with values
  let string = template.innerHTML;
  let start = string.indexOf('{{');
  let end = string.indexOf('}}');

  while (start >= 0 && end >= 0) {
    const varname = string.substring(start+2, end).trim();

    if (data[varname]) {
      string = string.substring(0, start) + String(data[varname]) + string.substring(end+2);

      start = string.indexOf('{{');
      end = string.indexOf('}}');
    } else {
      throw new Error(`Cannot fill template. Variable "${varname}" is not defined.`);
      return;
    }
  }

  return document.createRange().createContextualFragment(string);
}
