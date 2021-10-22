"use strict";

const main = document.getElementsByTagName('main')[0];
const template = document.getElementById('item-template');

function fillTemplate(template, data) {
  // Check if template is a node element
  if (!template || template.nodeType !== Node.ELEMENT_NODE) {
    throw new Error('First argument passed to "fillTemplate" function must be a node element.');
    return;
  }
  // Check if data is object
  if (typeof data !== 'object') {
    throw new Error('Second argument passed to "fillTemplate" function must be an object.');
    return;
  }

  let string = template.innerHTML;
  let start = string.indexOf('{{');
  let end = string.indexOf('}}');

  while(start >= 0 && end >= 0) {
    const varname = string.substring(start+2, end).trim();

    if (data[varname]) {
      string = string.substring(0, start) + String(data[varname]) + string.substring(end+2);

      start = string.indexOf('{{');
      end = string.indexOf('}}');
    } else {
      throw new Error(`Cannot fill template. Variable ${varname} is not defined.`);
      return;
    }
  }

  return string;
}

fetch('/products')
  .then(response => response.json())
  .then((data) => {
    console.log(fillTemplate(template, data[0]));
  }).catch((error) => {
    console.log('Error fetching data from /products.', error);
  })

