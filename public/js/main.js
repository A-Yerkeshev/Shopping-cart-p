"use strict";
import Router from './router.js';

const log = console.log;

const store = document.getElementById('store');
const signUp = document.getElementById('sign-up');
const signIn = document.getElementById('sign-in');
const cartToggle = document.querySelector('.cart-toggle');

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

function fetchItems() {
  return fetch('/products')
    .then((response) => response.json())
    .then((data) => {
      Data.items = data;
      return data;
    })
    .catch((error) => {throw new Error('Error fetching data from /products: ' + error)});
}

function addToCart(ev) {
  log(`Item ${ev.target} added`);
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
