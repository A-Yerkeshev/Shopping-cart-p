"use strict";

function getCookie(name) {
  if (typeof name !== 'string') {
    throw new Error('Argument passed to getCookie() function must be of string type.');
    return;
  }

  let cookies = document.cookie;
  let result;

  if (cookies) {
    cookies = cookies.split(';');

    for (let i=0; i<(cookies.length); i++) {
      const split = cookies[i].split('=');
      const key = split[0].trim();

      if (key == name) {
        result = JSON.parse(split[1].trim());
        break;
      }
    }
  }

  return result;
}

function setCookie(key, value='', expirity, sameSite='Strict') {
  if (typeof key !== 'string') {
    throw new Error('First argument passed to setCookie() function must be of string type.');
    return;
  }
  if (typeof expirity !== 'number') {
    throw new Error('Third argument passed to setCookie() function must be of number type.');
    return;
  }
  if (sameSite !== 'Strict' && sameSite !== 'Lax' && sameSite !== 'None') {
    throw new Error(`Argument value ${sameSite} is not valid as SameSite cookie value. Value should be 'Lax', 'Strict' or 'None'.`)
  }

  const date = new Date();

  if (expirity) {
    date.setTime(date.getTime() + expirity);
  }

  document.cookie = `${key}=${JSON.stringify(value)};${date.toUTCString()};SameSite=${sameSite}`;
}

export { getCookie, setCookie }
