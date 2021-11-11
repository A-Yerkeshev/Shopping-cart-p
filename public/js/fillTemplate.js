"use strict"
// Function that replaces template variables with actual data
// Template variable syntax: {{ varname }}
// data must be an object.
//
// Repeated content should be wrapped in <repeat> tag like so:
// <repeat for="i of iterable"> -- iterable is array or set, i is object
//  <h1>{{ name }}</h1>
//  <img src="{{ img }}"/>
// </repeat>
//
// Other templates can be inserted using <insert> tag like so:
// <insert template="tpl-1"/> -- tpl-1 is an id of template tag
// <template id="tpl-1">
// </template>

// Conditions are handled using <if> and <else> tags like so:
// <if cond="{{ num }} > 3">
//   {{ content if true }}
// </if><else>
//   {{ content if false }}
// </else>
// Note that <else> tag must next sibling of <if> tag.
//
// Be aware that function DOES NOT convert condition string into JavaScript
// expression because of security issues.
// Therefore, condition string CAN NOT contain following:
// 1. "!" operator -- <if cond="!{{ value }}"> -- is invalid
// 2. Parenthesis -- <if cond="{{ num }} == 5 || ({{ num }} > 3 && {{ num }} < 7)"> -- is invalid
// 3. Comparison to non-primitive value -- <if cond="{{ func }} === myFunc"> -- is invalid
// 4. Mathematical operations -- <if cond="{{ num + 3 }} > 7"> -- is invalid
// 5. Access of properties and methods -- <if cond="{{ data.number }} > 3"> -- is invalid

const log=console.log;

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

  //*********************************/
  //*********************************/

  // Check for repeat statements

  //*********************************/
  //*********************************/
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

        parent.replaceChild(fillTemplate(template, data), elset);
      }
    } else {
      if (elset.tagName == 'ELSE') elset.remove();

      const content = ift.childNodes;

      for (let node of content) {
        template.content.append(node);
      }

      parent.replaceChild(fillTemplate(template, data), ift);
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

    insert.parentNode.insertBefore(content, insert);
    insert.remove();
  }

  //*********************************/
  //*********************************/

  // Replace template variables with values

  //*********************************/
  //*********************************/
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

// This function takes conditions string, breaks them down and does evaluation
// Return value is boolean.
function evaluateStringConditions(string, data) {
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

  // 4. Replace boolean strings with actual boolean values
  if (left === 'true') left = true;
  if (left === 'false') left = false;

  // 5. Strip off quotes around string values
  if (typeof left == 'string') {
    if (left.startsWith("'") && left.endsWith("'") ||
      left.startsWith('"') && left.endsWith('"')) {
      left = left.slice(1,-1);
    } else {

      // 5. Replace variable names with values
      if (left.startsWith('{{') && left.endsWith('}}')) {
        const varname = left.slice(2, -2).trim();

        left = data[varname];

        if (left === undefined) {
          throw new Error(`Cannot evaluate condition. Variable "${varname}" is not defined.`);
          return;
        }
      } else {
        // If the value is neither boolean, neither string, neither variable, attempt to convert it into number
        left = parseFloat(left);

        if (isNaN(left)) {
          throw new Error(`Failed to determine the data type of the condition value. Note that variable names should be wrapped in duble curly braces {{}} and string values in single '' or double "" quotes.`);
          return;
        }
      }
    }
  }

  // 6. Perform same operations to the right side, if condition string contained a comparison operator
  if (operator) {
    if (right === 'true') right = true;
    if (right === 'false') right = false;

    if (typeof right == 'string') {
      if (right.startsWith("'") && right.endsWith("'") ||
        right.startsWith('"') && right.endsWith('"')) {
        right = right.slice(1,-1);
      } else {
        if (typeof right == 'string' && right.startsWith('{{') && right.endsWith('}}')) {
          const varname = right.slice(2, -2).trim();

          right = data[varname];

          if (right === undefined) {
            throw new Error(`Cannot evaluate condition. Variable "${varname}" is not defined.`);
            return;
          }
        } else {
          right = parseFloat(right);
        }
      }
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

export default fillTemplate;
