"use strict";

const log = console.log;
const main = document.getElementsByTagName('main')[0];
// const template = document.getElementById('item-template');
const template = document.getElementById('store');

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

    // Iterate through iterable, fill new template on every iteration, append result to outputStr
    let outputStr = '';

    iterable.forEach((element) => {
      const template = document.createElement('template');
      const content = repeat.childNodes;

      for (let node of content) {
        template.content.append(node.cloneNode(true));
      }

      outputStr += fillTemplate(template, element);
    })

    // Replace <repeat> tag with actual content
    const parsed = document.createRange().createContextualFragment(outputStr);

    repeat.parentNode.insertBefore(parsed, repeat);
    repeat.remove();
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

  return string;
}

// fetch('/products')
//   .then(response => response.json())
//   .then((data) => {
//     console.log(fillTemplate(template, data[0]));
//   }).catch((error) => {
//     console.log('Error fetching data from /products.', error);
//   })

const p = document.createElement('p');
p.textContent = fillTemplate(template, {items: [{}, {}, {}]});
main.appendChild(p);
