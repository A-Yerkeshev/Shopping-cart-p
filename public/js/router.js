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

  // Draw view on initial load
  let hash = location.hash.substring(1);

  // Redraw view on hashchange
  window.addEventListener('hashchange', (ev) => {
    ev.preventDefault();

    // Update hash value
    hash = location.hash.substring(1);

    const html = getHTML(hash);

    if (html) {
      view.innerHTML = '';
      view.appendChild(getHTML(hash));
    } else {
      // Url did not match any route - redirect to default
      location.hash = '#'+defaultRoute;
    }
  })

  return {
    // Router.when() specifies how to change content of view depending on current url
    // Router.when() takes two arguments - first is route name like '/' or '/products' or 'products'
    // Second argument can be either HTMLElement/DocumentFragment either function that returns HTMLElement/DocumentFragment.
    // This function is going to be called each time hashchange event fires and result of this function
    // is going to be drawn on the screen.
    when: function(url, content) {
      if (!validateUrl(url, 'when')) return;
      if (!validateContent(content, 'when')) return;

      // Strip off first '/' in url if present
      if (url.charAt(0) == '/') {
        url = url.substring(1);
      }

      routes[url] = content;
    },

    // Router.default() specifies the route to redirect, if current url did not match any route
    // Router.default() takes one argument - default url like '/' or '/products' or 'products'
    default: function(url) {
      if (!validateUrl(url, 'default')) return;

      // Strip off first '/' in url if present
      if (url.charAt(0) == '/') {
        url = url.substring(1);
      }

      defaultRoute = url;
    }
  }
})();

function getHTML(url) {
  let result;

  // Check if current url matches a route
  if (routes.hasOwnProperty(url)) {
    const content = routes[url];

    if (typeof content == 'function') {
      result = content();
    } else if (content instanceof HTMLElement || content instanceof DocumentFragment) {
      result = content.cloneNode(true);
    }

    return result;
  }
}

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

    const html = content();

    if (!(html instanceof HTMLElement) && !(html instanceof DocumentFragment)) {
      throw new Error(`Function passed to Router.${fname}() function must return HTMLElement or DocumentFragment.`);
      return false;
    }
  // Otherwise verify that content is an HTMLElement/DocumentFragment
  } else if (!(content instanceof HTMLElement) && !(content instanceof DocumentFragment)) {
    throw new Error(`Second argument passed to Router.${fname}() function must be either HTMLElement/DocumentFragment, either function that returns it.`);
    return false;
  }

  return true;
}

export default Router;
