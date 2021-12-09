"use strict";
const log = console.log;

// Variable that will hold all routes and assosiated HTMLElements/DocumentFragments/callbacks
const routes = {}
let defaultRoute;

const Router = (() => {
  const view = document.getElementById('view');

  if (!view) {
    throw new Error("In order to use Router you need to have HTML element with id 'view' in your document.");
    return;
  }

  // Draw view on initial load and set view observer
  document.addEventListener('DOMContentLoaded', (ev) => {
    // Create observer for view and run callbacks assosiated with each route after view is drawn
    const observer = new MutationObserver((changes) => {
      changes.forEach((change) => {
        if (change.addedNodes.length) {
          runCallbacks();
        }
      })
    })
    observer.observe(view, {childList: true});

    updateView();
  })

  // Redraw view on hashchange
  window.addEventListener('hashchange', (ev) => {
    ev.preventDefault();

    updateView();
  })

  return {
    // Router.when() specifies how to change content of view depending on current url
    // Router.when() takes two arguments - first is route name like '/' or '/products' or 'products'
    // Second argument can be either HTMLElement/DocumentFragment either function
    // Function must return HTMLElement/DocumentFragment if it is synchronous.
    // If function requires some time to return result, it should return a promise.
    // This function is going to be called each time hashchange event fires and result of this function
    // is going to be drawn on the screen.
    when: function(url, content) {
      if (!validateUrl(url, 'when')) return;
      if (!validateContent(content, 'when')) return;
      url = stripUrl(url);

      routes[url] = { content };

      return this;
    },

    // Router.default() specifies the route to redirect, if current url did not match any route
    // Router.default() takes one argument - default url like '/' or '/products' or 'products'
    default: function(url) {
      if (!validateUrl(url, 'default')) return;
      url = stripUrl(url);

      defaultRoute = url;

      return this;
    },

    // Router.onload() tells which callback to run after the view for given route was drawn
    // Router.default() takes two arguments - url and callback
    onload: function(url, ...callbacks) {
      if (!validateUrl(url, 'onload')) return;

      callbacks.forEach((callback) => {
        if (typeof callback !== 'function') {
          throw new Error(`Argument passed to Router.onload() function must be a function or array of functions.`);
          return;
        }
        if (callback.length > 0) {
          throw new Error(`Callback passed to Router.onload() function will not be provided any arguments.`);
          return;
        }
      })

      url = stripUrl(url);

      if (routes.hasOwnProperty(url)) {
        if (typeof routes[url] === 'object' && routes[url] !== null) {

          if (!routes[url].onload) {
            routes[url].onload = new Set(callbacks);
          }

          routes[url].onload = new Set([...routes[url].onload, ...callbacks]);
        } else {
          throw new Error(`Value of routes.${url} is not an object.`);
          return;
        }
      } else {
        throw new Error(`Route '${url}' is not defined. Use Router.when() to define new route.`);
        return;
      }

      return this;
    },

    // Redirects user to given url
    redirect: function(url) {
      if (!validateUrl(url, 'redirect')) return;

      url = stripUrl(url)

      location.href = `/#${url}`;

      return this;
    }
  }
})();

function validateUrl(url, fname) {
  // Check if url is valid string
  if ((typeof url) !== 'string') {
    throw new Error(`First argument passed to Router.${fname}() function must be a string.`);
    return false;
  }

  return true;
}

function validateContent(content, fname) {
  // If content is a function, check that it returns HTMLElement or DocumentFragment.
  if (typeof content == 'function') {
    if (content.length > 0) {
      throw new Error(`Function passed to Router.${fname}() function will not be provided any arguments.`);
      return false;
    }
  // Otherwise verify that content is an HTMLElement/DocumentFragment
  } else if (!validateElement(content)) {
    throw new Error(`Second argument passed to Router.${fname}() function must be either HTMLElement/DocumentFragment, either function that returns it.`);
    return false;
  }

  return true;
}

function validateElement(element) {
  if (!(element instanceof HTMLElement) && !(element instanceof DocumentFragment)) {
    return false;
  } else {
    return true;
  }
}

async function updateView() {
  const hash = location.hash.substring(1);

  if (routes.hasOwnProperty(hash)) {
    let content = routes[hash].content;

    if (typeof content == 'function') {
      content = await content();

      if (!validateElement(content)) {
        throw new Error(`Function defined for route '${hash}' did not return HTMLElement/DocumentFragment.`);
        return;
      }
    } else if (validateElement(content)) {
      content = content.cloneNode(true);
    } else {
      throw new Error(`Value set in Router for route '${hash}' is not function, nor HTMLElement, nor DocumentFragment.`);
      return;
    }

    // Check that user did not leave the page before content was loaded
    const currentHash = location.hash.substring(1);

    if (currentHash != hash) {
      return;
    } else {
      view.innerHTML = '';
      view.appendChild(content);
    }
  } else {
    // Url did not match any route - redirect to default
    location.hash = '#'+defaultRoute;
  }
}

function runCallbacks() {
  const hash = location.hash.substring(1);

  if (routes[hash].onload && routes[hash].onload instanceof Set) {
    routes[hash].onload.forEach((callback) => {
      if (typeof callback == 'function') callback();
    });
  }
}

function stripUrl(url) {
  if (url.charAt(0) == '/') {
    url = url.substring(1);
  }

  const index = url.indexOf('?');

  if (index > -1) {
    url = url.substring(index);
  }

  return url;
}

export default Router;
