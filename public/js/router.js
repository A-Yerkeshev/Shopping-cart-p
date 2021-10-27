"use strict";
const log = console.log;

const Router = (() => {
  const view = document.getElementById('view');

  if (!view) {
    throw new Error("In order to use Router you need to have HTML element with id 'view' in your document.");
    return;
  }

  // Variable that will hold all routes and assosiated HTMLElements/callbacks
  const routes = {}

  window.addEventListener('hashchange', (ev) => {
    ev.preventDefault();

    const hash = location.hash.substring(1);

    // Check if current hash matches a route
    if (routes.hasOwnProperty(hash)) {
      const content = routes[hash];

      if (typeof content == 'function') {
        content = content();
      }

      view.innerHTML = '';
      view.appendChild(content.cloneNode(true));
    }
  })

  return {
    // Router.when() takes two arguments - first is route name like '/' or '/products' or 'products'
    // Second argument can be either HTMLElement/DocumentFragment either function that returns HTMLElement/DocumentFragment.
    // This function is going to be called each time hashchange event fires and result of this function
    // is going to be drawn on the screen.
    when: function(url, content) {
      // Check if url is valid string
      if ((typeof url) !== 'string') {
        throw new Error("First argument passed to Router.when() function must be a string.");
        return
      }

      // If content is a function, check that it returns HTMLElement or DocumentFragment.
      if (typeof content == 'function') {
        const html = content();

        if (!(html instanceof HTMLElement) && !(html instanceof DocumentFragment)) {
          throw new Error("Function passed to Router.when() function must return HTMLElement or DocumentFragment.");
          return
        }
      // Otherwise verify that content is an HTMLElement
      } else if (!(content instanceof HTMLElement) && !(content instanceof DocumentFragment)) {
        throw new Error("Second argument passed to Router.when() function must be either HTMLElement/DocumentFragment, either function that returns it.");
        return
      }

      // Strip off first '/' in url if present
      if (url.charAt(0) == '/') {
        url = url.substring(1);
      }

      routes[url] = content;
    }
  }
})();

export default Router;
