"use strict";

const Router = (() => {
  const view = document.getElementById('view');

  if (!view) {
    throw new Error("In order to use Router you need to have HTML element with id 'view' in your document.");
    return;
  }

  window.addEventListener('hashchange', (ev) => {
    console.log(location.hash);
  })

  return {
    when: function(url, template) {
      // Check if url is valid string
      if ((typeof url) !== 'string') {
        throw new Error("First argument passed to Router.when() function must be a string.");
        return
      } else if (url.charAt(0) !== '/') {
        throw new Error("Url passed to Router.when() function must begin with '/'.");
        return
      }

      // If template is a function that returns template - execute it.
      if (typeof template == 'function') {
        template = template();
      }

      // Check if template is valid
      if (!(template instanceof HTMLElement)) {
        throw new Error("Second argument passed to Router.when() function must be either HTML element, either function that returns it.");
        return
      }
    }
  }
})();

export default Router;
