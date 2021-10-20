const main = document.getElementsByTagName('main')[0];

fetch('/products')
  .then(response => response.json())
  .then((data) => {
    const pre = document.createElement('pre');
    pre.innerText = JSON.stringify(data, null, 2);
    main.appendChild(pre);
  })
