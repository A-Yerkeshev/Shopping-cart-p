"use strict";

const ChannelManager = (function() {
  const channels = {};
  const formats = ['ANY', 'STRING', 'NUMBER','BOOLEAN', 'UNDEFINED', 'ARRAY', 'OBJECT', 'FUNCTION', 'BIGINT'];

  // type --- 'string', 'number', 'boolean', 'object', 'function'
  function checkType(input, type, functionName) {
    switch (type) {
      case 'string':
        if (typeof input === 'string') {
          return true;
        } else {
          throw new Error(`Argument passed to .${functionName}() function must be of 'string' type.`);
          return false;
        }
        break;
      case 'number':
        if (typeof input === 'number') {
          return true;
        } else {
          throw new Error(`Argument passed to .${functionName}() function must be of 'number' type.`);
          return false;
        }
        break;
      case 'boolean':
        if (typeof input === 'boolean') {
          return true;
        } else {
          throw new Error(`Argument passed to .${functionName}() function must be of 'boolean' type.`);
          return false;
        }
        break;
      case 'object':
        if (typeof input === 'object') {
          return true;
        } else {
          throw new Error(`Argument passed to .${functionName}() function must be of 'object' type.`);
          return false;
        }
        break;
      case 'function':
        if (typeof input === 'function') {
          return true;
        } else {
          throw new Error(`Argument passed to .${functionName}() function must be of 'function' type.`);
          return false;
        }
        break;
      default:
        throw new Error("Second argument passed to checkType function must be 'string', 'number', 'boolean', 'object' or 'function'");
    }
  }

  function isEmptyString(string, functionName) {
    if (string === '') {
      throw new Error(`Argument passed to .${functionName}() cannot be empty string.`);
      return true;
    } else {
      return false;
    }
  }

  function validateData(data, format) {
    if (arguments.length !== 2) {
      throw new Error('validateData() function expects 2 arguments: data and data format.');
      return;
    }

    switch (typeof format) {
      case 'string':
        return validateByKeyword(data, format);
        break;
      case 'object':
        // Enumerate format object properties and check if same properties exist on data object and their data type is valid
        for (let key in format) {
          if (!data.hasOwnProperty(key) || !validateByKeyword(data[key], format[key])) {
            return false;
          }
        }

        return true;
        break;
      default:
        throw new Error(`Format passed to validateData() function must be 'ANY', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'ARRAY', 'OBJECT', 'FUNCTION', 'BIGINT' keyword or object.`);
        return;
    }
  }

  function validateByKeyword(data, formatKeyword) {
    if (arguments.length !== 2) {
      throw new Error('validateByKeyword() function expects 2 arguments: data and format keyword.');
      return;
    }

    switch (formatKeyword) {
      case 'ANY':
        return true;
        break;
      case 'STRING':
        return typeof data === 'string';
        break;
      case 'NUMBER':
        return typeof data === 'number';
        break;
      case 'BOOLEAN':
        return typeof data === 'boolean';
        break;
      case 'UNDEFINED':
        return typeof data === 'undefined';
        break;
      case 'ARRAY':
        return Array.isArray(data);
        break;
      case 'OBJECT':
        // Check if data is object, not array and not null
        if (typeof data === 'object' && !Array.isArray(data) && data != null) {
          return true;
        } else {return false;}
        break;
      case 'FUNCTION':
        return typeof data === 'function';
        break;
      case 'BIGINT':
        return typeof data === 'bigint';
        break;
      default:
        throw new Error(`Keyword passed to validateByKeyword() function must be 'ANY', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'ARRAY', 'OBJECT', 'FUNCTION', 'BIGINT'.`);
        return;
    }
  }

  function runCallbacks(callbacks, data, headers) {
    callbacks.forEach((callback) => {
      if (!checkType(callback, 'function', 'runCallbacks')) {return;}

      callback(data, headers);
    })
  }

  function runCallbacksOnce(callbacks, data, headers, name) {
    if (!ChannelManager.exists(name)) {
      throw new Error (`Channel with name '${name}' does not exist.`);
      return;
    }

    callbacks.forEach((callback) => {
      if (!checkType(callback, 'function', 'runCallbacks')) {return;}

      callback(data, headers);

      if (channels[name].tmpListeners.has(callback)) {
        channels[name].tmpListeners.delete(callback);
      } else {
        throw new Error(`Callback with name '${callback.name}' does not listen to channel '${name}'.`);
        return;
      }
    })
  }

  return {
    open(name) {
      if (!checkType(name, 'string', 'open')) {return;}
      if (isEmptyString(name, 'open')) {return;}

      if (!channels[name]) {
        channels[name] = {
          format: 'ANY',
          dataHeaders: null,
          data: null,
          listeners: new Set(),
          tmpListeners: new Set()
        }
      }
    },
    close(name) {
      if (!checkType(name, 'string', 'close')) {return;}
      if (isEmptyString(name, 'close')) {return;}
      if (!ChannelManager.exists(name)) {
        throw new Error (`Channel with name '${name}' does not exist.`);
        return;
      }

      delete channels[name];
    },
    send(name, data, headers={}) {
      // headers - data headers object
      if (arguments.length < 2) {
        throw new Error('.send() function expects at least 2 arguments: channel name and data.');
        return;
      }
      if (!checkType(name, 'string', 'send')) {return;}
      if (isEmptyString(name, 'send')) {return;}
      if (!ChannelManager.exists(name)) {
        throw new Error (`Channel with name '${name}' does not exist.`);
        return;
      }

      // Validate data according to the format
      if (!validateData(data, channels[name].format)) {
        throw new Error(`Data passed to .send() function does not match data format for '${name}' channel. Run .getFormat('${name}') to check the data format.`);
        return;
      }

      if (typeof headers !== 'object' || Array.isArray(headers) || headers == null) {
        throw new Error('Data headers argument passed to .send() function must be an object.');
        return;
      }

      const channel = channels[name];

      channel.dataHeaders = headers;
      channel.data = data;

      runCallbacks(channel.listeners, data, headers);
      runCallbacksOnce(channel.tmpListeners, data, headers, name);
    },
    listen(name, ...callbacks) {
      if (arguments.length < 2) {
        throw new Error('.listen() function expects at least 2 arguments: channel name and callback.');
        return;
      }
      if (!checkType(name, 'string', 'listen')) {return;}
      if (isEmptyString(name, 'listen')) {return;}
      if (!ChannelManager.exists(name)) {
        throw new Error (`Channel with name '${name}' does not exist.`);
        return;
      }

      callbacks.forEach((callback) => {
        if (!checkType(callback, 'function', 'listen')) {return;}
      })

      channels[name].listeners = new Set(Array.from(channels[name].listeners).concat(callbacks));
    },
    listenOnce(name, ...callbacks) {
      if (arguments.length < 2) {
        throw new Error('.listenOnce() function expects at least 2 arguments: channel name and callback.');
        return;
      }
      if (!checkType(name, 'string', 'listenOnce')) {return;}
      if (isEmptyString(name, 'listenOnce')) {return;}
      if (!ChannelManager.exists(name)) {
        throw new Error (`Channel with name '${name}' does not exist.`);
        return;
      }

      callbacks.forEach((callback) => {
        if (!checkType(callback, 'function', 'listenOnce')) {return;}
      })

      channels[name].tmpListeners = new Set(Array.from(channels[name].tmpListeners).concat(callbacks));
    },
    unlisten(name, ...callbacks) {
      if (arguments.length < 2) {
        throw new Error('.unlisten() function expects at least 2 arguments: channel name and callback.');
        return;
      }
      if (!checkType(name, 'string', 'unlisten')) {return;}
      if (isEmptyString(name, 'unlisten')) {return;}
      if (!ChannelManager.exists(name)) {
        throw new Error (`Channel with name '${name}' does not exist.`);
        return;
      }

      callbacks.forEach((callback) => {
        if (!checkType(callback, 'function', 'unlisten')) {return;}

        if (channels[name].listeners.has(callback)) {
          channels[name].listeners.delete(callback);
        } else {
          throw new Error(`Callback with name '${callback.name}' does not listen to channel '${name}'.`);
          return;
        }
      })
    },
    setFormat(name, format) {
      // format can either be
      // 'ANY', 'STRING', 'NUMBER',
      // 'BOOLEAN', 'UNDEFINED', 'ARRAY',
      // 'OBJECT', 'FUNCTION', 'BIGINT' or object
      if (arguments.length !== 2) {
        throw new Error('.setFormat() function expects 2 arguments: channel name and data format.');
        return;
      }
      if (!checkType(name, 'string', 'setFormat')) {return;}
      if (isEmptyString(name, 'setFormat')) {return;}
      if (!ChannelManager.exists(name)) {
        throw new Error (`Channel with name '${name}' does not exist.`);
        return;
      }

      switch (typeof format) {
        case 'string':
          if (!formats.includes(format)) {
            throw new Error(`Format passed to .setFormat() function must be 'ANY', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'ARRAY', 'OBJECT', 'FUNCTION', 'BIGINT' keyword or object.`);
            return;
          } else {
            channels[name].format = format;
          }
          break;
        case 'object':
          if (Array.isArray(format)) {
            throw new Error('Format object passed to .setFormat() cannot be array.');
            return;
          }
          if (!format) {
            throw new Error('Format object passed to .setFormat() cannot be null.');
            return;
          }
          if (Object.keys(format).length === 0) {
            throw new Error('Format object passed to .setFormat() cannot be empty.');
            return;
          }

          // Enumerate through object properties and check if values are valid keywords
          for (let key in format) {
            if (!formats.includes(format[key])) {
              throw new Error(`Values of format object, passed to .setFormat() function must be 'ANY', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'ARRAY', 'OBJECT', 'FUNCTION', 'BIGINT' keyword.`);
              return;
            }
          }

          channels[name].format = format;
          break;
        default:
          throw new Error(`Format passed to .setFormat() function must be 'ANY', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'ARRAY', 'OBJECT', 'FUNCTION', 'BIGINT' keyword or object.`);
          return;
      }
    },
    getFormat(name) {
      if (!checkType(name, 'string', 'getFormat')) {return;}
      if (isEmptyString(name, 'getFormat')) {return;}
      if (!ChannelManager.exists(name)) {
        throw new Error (`Channel with name '${name}' does not exist.`);
        return;
      }

      return channels[name].format;
    },
    exists(name) {
      if (!checkType(name, 'string', 'exists')) {return;}
      if (isEmptyString(name, 'exists')) {return;}

      return name in channels;
    },
    request(reqChannel, resChannel) {
      if (arguments.length !== 2) {
        throw new Error('.request() function expects 2 arguments: request channel name and response channel name.');
        return;
      }
      if (!checkType(reqChannel, 'string', 'request')) {return;}
      if (!checkType(resChannel, 'string', 'request')) {return;}
      if (isEmptyString(reqChannel, 'request')) {return;}
      if (isEmptyString(resChannel, 'request')) {return;}
      if (!ChannelManager.exists(reqChannel)) {
        throw new Error (`Channel with name '${reqChannel}' does not exist.`);
        return;
      }
      if (!ChannelManager.exists(resChannel)) {
        throw new Error (`Channel with name '${resChannel}' does not exist.`);
        return;
      }

      let result;

      this.listen(resChannel, (data) => {
        result = data;
      })
      this.send(reqChannel, true);

      return result;
    }
  }
})();

// FOR BROWSERS
export default ChannelManager;

// FOR NODE.JS
//module.exports = ChannelManager;
