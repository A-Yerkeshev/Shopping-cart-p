"use strict"
// This function accepts string with variable name and data object.
// After that it attempts to get the value from data object according to syntax of the string.
//
// Example 1:
//
// const person = {
//   name: "Toto",
//   char: {
//     height: 179,
//     weight: 76
//   }
// }
//
// searchObjectByString('name', person) ----> "Toto"
// searchObjectByString('char.height', person) ----> 179
// searchObjectByString('char["weight"]') ----> 76
//
// Example 2:
//
// const data = {
//   letters = 'abc',
//   lettersArray = ['a', 'b', 'c']
// }
//
// searchObjectByString('letters[0]', data) ----> 'a'
// searchObjectByString('lettersArray[1]', data) ----> 'b'
//
// Example 3:
//
// const data = {
//   sum(a, b) {
//     return a + b;
//   },
//   a: 10
// }
//
// searchObjectByString('sum(1, 2)', data) ----> 3
// searchObjectByString('sum(1, {{ a }})', data) ----> 11

function searchObjectByString(varname, data) {
  if (typeof varname !== 'string') {
    throw new Error('First argument passed to searchObjectByString() function must be a string.');
    return;
  }
  if (typeof data !== 'object') {
    throw new Error('Second argument passed to searchObjectByString() function must be an object.');
    return;
  }
  varname = varname.trim();

  // 1. Check if variable string contains ".". In this case, treat variable as object
  const dot = varname.indexOf('.');

  if (dot > -1) {
    // 1.1 Split varname into object name and property/method name
    const left = varname.substring(0, dot);
    const right = varname.substring(dot+1);
    const obj = data[left];

    // 1.2 Check if variable is an object
    if (typeof obj !== 'object') {
      throw new Error(`"${left}" is not an object.`);
      return;
    }

    // 1.3 Because obj is object, we can call function recursively, passing obj as data object
    return searchObjectByString(right, obj);
  }

  // 2. Check if variable string contains "[]". In this case, treat variable as array, object or string
  const oBracket = varname.indexOf('[');
  const cBracket = varname.indexOf(']');

  if (oBracket > -1) {
    if (cBracket == -1) {
      throw new Error(`Missing closing square bracket for "${varname}".`);
      return;
    }

    // 2.1 Get value between brackets
    let between = varname.substring(oBracket+1, cBracket);
    varname = varname.substring(0, oBracket);

    // 2.2 If it is a string - treat it as property name of an object
    if (between.startsWith("'") && between.endsWith("'") ||
      between.startsWith('"') && between.endsWith('"')) {

      between = between.slice(1, -1);
      const obj = data[varname];

      if (typeof obj !== 'object') {
        throw new Error(`Cannot access property "${between}" of "${varname}". "${varname}" is not an object.`);
        return;
      }

      if ((between in obj) == false) {
        throw new Error(`Property "${between}" does not exist on "${varname}" object.`);
        return;
      }

      return data[varname][between];
    } else {

    // 2.3 If it is a number - treat it as index of element in array or index of character in string
      const index = parseInt(between);

      if (isNaN(index)) {
        throw new Error(`Value between square brackets should be either integer, either string wrapped in single or double quotes.`);
        return;
      }

      const iter = data[varname];

      if (typeof iter !== 'string' && !Array.isArray(iter)) {
        throw new Error(`"${varname}" is neither string, neither an array. Cannot get element at index ${index}.`);
        return;
      }

      if (index > iter.length - 1) {
        throw new Error(`"${varname}" is out of range. Index is greater than ${varname}'s length`);
        return;
      }

      return iter[index];
    }
  }

  // 3. Check if variable string contains "()". In this case, treat variable as function
  const oPar = varname.indexOf('(');
  const cPar = varname.indexOf(')');

  if (oPar > -1) {
    if (cPar == -1) {
      throw new Error(`Missing closing parenthesis for "${varname}".`);
      return;
    }

    // 3.1 Separate function name from arguments list
    const argsStr = varname.substring(oPar+1, cPar);
    varname = varname.substring(0, oPar);

    // 3.2 Verify that method exists on data object and has function type
    if ((varname in data) == false) {
      throw new Error(`Function "${varname}" is not defined.`);
      return;
    }

    const method = data[varname];

    if (typeof method !== 'function') {
      throw new Error(`"${varname}" is not a function. Unexpected parenthesis after variable name.`);
      return;
    }

    // 3.3 Get value for every argument name
    let args = argsStr.split(',');
    args = args.map((arg) => {
      arg = arg.trim();

      // 3.3.1 If argument is wrapped into {{ }} treat it as variable name
      if (arg.startsWith('{{') && arg.endsWith('}}')) {
        arg = arg.slice(2, -2).trim();

        return searchObjectByString(arg, data);
      } else {
        // 3.3.2 Otherwise, attempt to convert argument to other primitives
        return stringToPrimitive(arg);
      }
    })

    // 3.4 Call method with arguments
    return method.apply(null, args);
  }

  // 4. If variable string does not contain ".", "[]" or "()", lookup varname in data object
  if ((varname in data) == false) {
    throw new Error(`"${varname}" is not defined.`);
    return;
  }

  return data[varname];
}

// This function attempts to convert string expression to other primitive types according to string syntax
function stringToPrimitive(string) {
  if (typeof string !== 'string') {
    throw new Error(`Argument passed to stringToValue() function must be a string.`);
    return;
  }

  string = string.trim();

  // 1. Replace boolean strings with actual boolean values
  if (string === 'true') return true;
  if (string === 'false') return false;

  // 2. Strip off quotes around string values
  if (string.startsWith("'") && string.endsWith("'") ||
    string.startsWith('"') && string.endsWith('"')) {

    return string.slice(1,-1);

  } else {
    // 3. If the value is neither boolean, neither string - attempt to convert it into number
    const num = parseFloat(string);

    if (isNaN(num)) {
      throw new Error(`Failed to determine the primitive type of the condition value. Note that string values must be wrapped in single '' or double "" quotes.`);
      return;
    } else return num;
  }
}

export { searchObjectByString, stringToPrimitive };
