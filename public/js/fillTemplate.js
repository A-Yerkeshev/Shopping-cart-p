"use strict"

import { stringToPrimitive, searchObjectByString } from './stringConverter.js';

// Function that replaces template variables with actual data
// Template variable syntax: {{ varname }}
// Data must be an object.
//
// Repeated content should be wrapped in <repeat> tag like so:
// <repeat for="i of iterable"> -- iterable is array or set, i is object
//  <h1>{{ name }}</h1>
//  <img src="{{ img }}"/>
// </repeat>
//
// Other templates can be inserted using <insert> tag like so:
// <insert template="tpl-1"/> -- tpl-1 is an id of template tag
//
// <template id="tpl-1">
// </template>
//
// Conditions are handled using <if> and <else> tags like so:
// <if cond="{{ num }} > 3">
//   content if true
// </if><else>
//   content if false
// </else>
// Note that <else> tag must next sibling of <if> tag.
//
// Be aware that function DOES NOT convert condition string into JavaScript
// expression because of security issues.
// Therefore, condition string CAN NOT contain following:
// 1. "!" operator -- <if cond="!{{ value }}"> -- is invalid
// 2. Parenthesis (if not meant to be a function call) -- <if cond="{{ num }} == 5 || ({{ num }} > 3 && {{ num }} < 7)"> -- is invalid
// 3. Comparison to non-primitive value -- <if cond="{{ func }} === myFunc"> -- is invalid
// 4. Mathematical operations -- <if cond="{{ num + 3 }} > 7"> -- is invalid

// Because <thead> <tbody> <tr> and <td> tags cannot be parsed from string,
// nor any irrelevant tag can be inserted into <table>, use following substitutes:
// <t> for <table>
// <th> for <thead>
// <tb> for <tbody>
// <trow> for <tr>
// <tcell> for <td>
// Afterwards, call updateTableTags() function, see explanation below.

const log = console.log;

function fillTemplate(template, data) {
  data = JSON.parse(JSON.stringify(data));

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

  template = template.cloneNode(true);
  //*********************************/
  //*********************************/

  // Check for repeat statements

  //*********************************/
  //*********************************/
  const repeatTags = template.content.querySelectorAll('repeat');

  for (let repeat of repeatTags) {
    // 1. Find iterated array
    const attr = repeat.getAttribute('for');
    if (!attr) {
      throw new Error(`<repeat> tag expects "for" attribute.`);
      return;
    }

    const ofI = attr.indexOf(' of ');
    if (ofI == -1) {
      throw new Error(`<repeat> tag's "for" attribute must have following syntax: for="/variable/ of /iterable/".`);
      return;
    }

    const iterName = attr.substring(ofI+4).trim();
    const iterable = searchObjectByString(iterName, data);

    if (!iterable) {
      throw new Error(`Iterable "${iterName}" is not defined.`);
      return;
    } else if (!Array.isArray(iterable) && !(iterable instanceof Set)) {
      throw new Error(`Iterable value "${iterName}" specified in "for=" attribute of the <repeat> tag must be an array or set.`);
      return;
    }

    // By this point iterable is found and has correct type

    // 2. Get variable name
    const varname = attr.substring(0, ofI).trim();

    // 3. Iterate through iterable, fill new template on every iteration, append result to output
    let output = new DocumentFragment();

    // 3.1 Create new property on data object with name equal to variable name
    if (varname in data && data[varname] !== undefined) {
      throw new Error(`Data object already has non-empty property "${varname}". Choose another variable name in "for=" attribute`);
      return;
    }

    const content = repeat.childNodes; // -- Does not include table's inner tags like <tr>, <td>, <tbody> and <thead>.

    /// --- ///
    iterable.forEach((element) => {
      const template = document.createElement('template');

      for (let node of content) {
        template.content.append(node.cloneNode(true));
      }

      data[varname] = element;

      output.append(fillTemplate(template, data));
    })
    /// --- ///
    // This section caused an issue with nested repeat tags.
    // Before, data object was not cloned, but instead assigned new temporary property (data[varname] = element, 5 lines up)
    // After the loop, property was cleared:
    // delete data[varname]; -- This line was located here
    // Issue was that property was cleared out before engine could fill and append child templates
    // So, JavaScript threw an error: 'Iterable /iterName/ is not defined.'
    // Loop seems to be working fine, it loops correct number of times and passes correct data to recursive function, whose
    //   result was appended to the output.
    // The propblem is that for some reason, output cannot keep up with the loop, presumably due to asyncronous nature of .append() method
    // So, after the loop has been finnished, output template was still missing some parts and could not finish them because
    //  temporary iterable property has been already cleared out.
    // The solution was to do a copy of data object on the first line, and then keep iterable property on data object.
    // Better workaround needs to be found if possible
    /// --- ///

    // 4. Replace <repeat> tag with actual content
    repeat.replaceWith(output);
  }

  //*********************************/
  //*********************************/

  // Check for if statements

  //*********************************/
  //*********************************/
  const ifTags = template.content.querySelectorAll('if');

  for (let ift of ifTags) {
    let conditions = ift.getAttribute('cond');

    if (!conditions) {
      throw new Error(`<if> tag requires a "cond" attribute.`);
      return
    }

    const elset = ift.nextSibling;
    const parent = ift.parentNode;
    const evl = evaluateStringConditions(conditions, data);
    const template = document.createElement('template');

    if (evl === false) {
      ift.remove();

      if (elset.tagName == 'ELSE') {
        const content = elset.childNodes;

        for (let node of content) {
          template.content.append(node);
        }

        elset.replaceWith(fillTemplate(template, data));
      }
    } else {
      if (elset.tagName == 'ELSE') elset.remove();

      const content = ift.childNodes;

      for (let node of content) {
        template.content.append(node);
      }

      ift.replaceWith(fillTemplate(template, data));
    }
  }

  //*********************************/
  //*********************************/

  // Check for insert statements

  //*********************************/
  //*********************************/

  const insertTags = template.content.querySelectorAll('insert');

  for (let insert of insertTags) {
    const id = insert.getAttribute('template');
    if (!id) {
      throw new Error(`<insert> tag requires "template" attribute.`);
      return;
    }

    const tpl = document.getElementById(id);
    if (!tpl) {
      throw new Error(`Template with id "${id}" does not exist.`);
      return;
    }

    const content = fillTemplate(tpl, data);

    insert.replaceWith(content);
  }

  //*********************************/
  //*********************************/

  // Replace template variables with values

  //*********************************/
  //*********************************/

  let string = template.innerHTML;

  // Remove comments
  let start = string.indexOf('<!--');
  let end = string.indexOf('-->');

  while (start >= 0 && end >= 0) {
    string = string.substring(0, start) + string.substring(end+3);

    start = string.indexOf('<!--');
    end = string.indexOf('-->');
  }

  // Replace variables
  start = string.indexOf('{{');
  end = string.indexOf('}}');

  while (start >= 0 && end >= 0) {
    const varname = string.substring(start+2, end).trim();
    const value = searchObjectByString(varname, data);

    string = string.substring(0, start) + String(value) + string.substring(end+2);

    start = string.indexOf('{{');
    end = string.indexOf('}}');
  }

  return document.createRange().createContextualFragment(string);
}

// Because <thead> <tbody> <tr> and <td> tags cannot be parsed from string, their substitude tags were used.
// It is not possible to call this function inside fillTemplate(), because if fillTemplate() was called recursively
// result of fillTemplate() will be converted back to string and parsed again, so all inner table tags will be lost.
// Therefore, this function has to be called manually, after fillTemplate() was completed.
// User can pass the result of fillTemplate() into this function and then append result to the page,
// or alternatively, append result of fillTemplate() to the page, and then call this function without arguments.
//
// return value is updated DocumentFragment or document if function was called without arguments
function updateTableTags(target=document) {
  const tables = target.querySelectorAll('t');
  const theads = target.querySelectorAll('th');
  const tbodies = target.querySelectorAll('tb');
  const trows = target.querySelectorAll('trow');
  const tcells = target.querySelectorAll('tcell');

  tables.forEach((table) => {
    const t = document.createElement('table');
    replaceTag(table, t);
  })

  theads.forEach((tablehead) => {
    const thead = document.createElement('thead');
    replaceTag(tablehead, thead);
  })

  tbodies.forEach((tablebody) => {
    const tbody = document.createElement('tbody');
    replaceTag(tablebody, tbody);
  })

  trows.forEach((trow) => {
    const tr = document.createElement('tr');
    replaceTag(trow, tr);
  })

  tcells.forEach((tcell) => {
    const td = document.createElement('td');
    replaceTag(tcell, td);
  })

  return target;
}

// type --- 'string', 'number', 'boolean', 'object', 'function', 'node', 'elementNode'
function checkType(input, type, functionName) {
  switch (type) {
    case 'string':
      if (typeof input === 'string') {
        return true;
      } else {
        throw new Error(`Argument passed to ${functionName}() function must be of 'string' type.`);
        return false;
      }
      break;
    case 'number':
      if (typeof input === 'number') {
        return true;
      } else {
        throw new Error(`Argument passed to ${functionName}() function must be of 'number' type.`);
        return false;
      }
      break;
    case 'boolean':
      if (typeof input === 'boolean') {
        return true;
      } else {
        throw new Error(`Argument passed to ${functionName}() function must be of 'boolean' type.`);
        return false;
      }
      break;
    case 'object':
      if (typeof input === 'object') {
        return true;
      } else {
        throw new Error(`Argument passed to ${functionName}() function must be of 'object' type.`);
        return false;
      }
      break;
    case 'function':
      if (typeof input === 'function') {
        return true;
      } else {
        throw new Error(`Argument passed to ${functionName}() function must be of 'function' type.`);
        return false;
      }
      break;
    case 'node':
      if (input instanceof Node) {
        return true;
      } else {
        throw new Error(`Argument passed to ${functionName}() function must be a HTML node.`);
        return false;
      }
    case 'elementNode':
      if (input.nodeType && input.nodeType === 1) {
        return true;
      } else {
        throw new Error(`Argument passed to ${functionName}() function must be an element node.`);
        return false;
      }
    default:
      throw new Error("Second argument passed to checkType function must be 'string', 'number', 'boolean', 'object', 'function', 'node'or 'elementNode'");
  }
}

// This function takes conditions string, breaks them down and does evaluation
// Return value is boolean.
function evaluateStringConditions(string, data) {
  checkType(string, 'string', 'evaluateStringConditions');
  checkType(data, 'object', 'evaluateStringConditions');

  // Check for invalid characters
  const invalid = ["!", "(", ")", "[", "]", ".", ",", "+", "-", "*", "/"];

  invalid.forEach((char) => {
    if (string.includes(char)) {
      throw new Error(`Conditions string defined in "cond" attribute of <if> tag contains invalid "${char}" character.`);
      return;
    }
  })

  const logic = [];
  // Ex: [true, 'AND', false, 'OR', false]

  // 1. Split conditions string on && and || operators
  for (let c=0; c<(string.length); c++) {
    if ((string[c] === '&' && string[c+1] === '&') ||
      (string[c] === '|' && string[c+1] === '|')) {

      // 2. Evaluate single condition and push it into logic
      logic.push(evaluateSingleStringCondition(string.substring(0, c).trim(), data));

      // 3. Push 'AND'/'OR' keywords to logic
      if (string[c] === '&') {
        logic.push('AND');
      } else if (string[c] === '|') {
        logic.push('OR');
      }

      string = string.substring(c+2);
    }
  }

  // 4. Evaluate last condition and push it into logic
  logic.push(evaluateSingleStringCondition(string.trim(), data));

  // 5. Reduce logic to a single boolean value
  let current = logic[0];

  for (let e=1; e<(logic.length); e+=2) {
    if (logic[e] == 'AND') {
      if ((current + logic[e+1]) !== 2) {
        return false;
      } else {
        current = true;
      }
    } else if (logic[e] == 'OR') {
      if ((current + logic[e+1]) === 0) {
        return false;
      } else {
        current = true;
      }
    }
  }

  return current;
}

function evaluateSingleStringCondition(string, data) {
  checkType(string, 'string', 'evaluateSingleStringCondition');
  checkType(data, 'object', 'evaluateSingleStringCondition');

  const operators = ['===', '!==', '==', '!=', '>=', '<=', '>', '<'];

  // 1. Check if condition contains comparison operators
  let left, operator, right;

  for (let o=0; o<(operators.length); o++) {

    const index = string.indexOf(operators[o]);

    if (index > -1) {
      operator = operators[o];

      // 2. Split condition into two parts if it contains a comparison operator
      left = string.substring(0, index).trim();
      right = string.substring(index+operators[o].length).trim();

      break;
    }
  }

  // 3. If condition does not contain operator, assign whole string to "left" variable
  if (!operator) left = string;

  // 4. Check if left side contains {{ }}. If it does - get the value
  if (left.startsWith('{{') && left.endsWith('}}')) {
    const varname = left.slice(2, -2).trim();

    left = searchObjectByString(varname, data);
  } else {
    // 5. Otherwise attempt to convert it to other primitive types
    left = stringToPrimitive(left);
  }

  // 6. Perform same operations to the right side, if condition string contained a comparison operator
  if (operator) {
    if (right.startsWith('{{') && right.endsWith('}}')) {
      const varname = right.slice(2, -2).trim();

      right = searchObjectByString(varname, data);
    } else {
      right = stringToPrimitive(right);
    }
  }

  // 7. If condition contains an operator - compare two values according to operator
  // Otherwise, convert single value to boolean
  if (operator) {
    switch (operator) {
      case '===':
        return(left === right);
      case '==':
        return(left == right);
      case '!==':
        return(left !== right);
      case '!=':
        return(left != right);
      case '>=':
        return(left >= right);
      case '<=':
        return(left <= right);
      case '>':
        return(left > right);
      case '<':
        return(left < right);
    }
  } else {
    return Boolean(left);
  }
}

function replaceTag(oldTag, newTag) {
  checkType(oldTag, 'elementNode');
  checkType(newTag, 'elementNode');

  // 1. Move all content from old tag to new tag
  const children = oldTag.childNodes;

  while (children.length > 0) {
    newTag.appendChild(children[0]);
  }

  // 2. Move attributes
  const attrs = oldTag.attributes;

  for (let i = attrs.length - 1; i >= 0; i--) {
     newTag.setAttribute(attrs[i].name, attrs[i].value);
  }

  oldTag.replaceWith(newTag);
}

export { fillTemplate, updateTableTags };
