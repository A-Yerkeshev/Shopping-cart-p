"use strict";
import CM from './ChannelManager.js';
const log = console.log;

let User;

// Listen to requests from Main module
CM.listen('add-sign-up-el', addSignUpEventListeners);
CM.listen('add-sign-in-el', addSignInEventListeners);

// Establish connection with Drawer module
CM.open('report-validity');
CM.open('draw-user-elements');

// Establish connection with Cart module
CM.open('activate-cart');

CM.open('get-user');
CM.open('send-user');
CM.listen('get-user', sendUser);

// Try to sign user in if valid token is present in local storage
signInByToken();

function signUp(ev) {
  ev.preventDefault();

  const formData = new FormData(ev.target);
  const username = formData.get('username').trim();
  const email = formData.get('email').trim();
  const password = formData.get('password').trim();
  const passwordRep = formData.get('password-rep');

  // 1. Validate passwords match
  if (password !== passwordRep) {
    CM.send('report-validity', {
      target: 'password',
      message: 'Passwords do not match.'
    });
    return;
  }

  // 2. Send registration request to the server
  const newUser = {
    username,
    email,
    password
  }

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');

  const request = new Request('/users', {
    method: 'POST',
    headers,
    mode: 'same-origin',
    body: JSON.stringify(newUser)
  })

  fetch(request)
    .then((response) => {
      if (response.ok) {
        log(`New user "${username}" successfully registered.`);
      } else {
        return response.json().then((error) => {
          CM.send('report-validity', {
            target: error.target,
            message: error.message
          })

          throw new Error(error.message);
        })
      }
    }).then(() => {
      // Sign newly registered user in
      const request = new Request('/users/auth', {
        method: 'POST',
        headers,
        mode: 'same-origin',
        body: JSON.stringify(newUser)
      })

      sendSignInRequest(request, username)
        .then((token) => {
          log(`User successfully signed in.`);

          // 1. Save token in local storage
          localStorage.setItem('token', token);

          // 2. Redirect to homepage
          location.href = '/#';

          User = username;

          // 3. Get user cart and make it active
          CM.send('activate-cart', username);

          // 4. Give visual indication of successful authentication
          CM.send('draw-user-elements', username);
        })
        .catch((error) => log('Error signing user in: ', error.message))
    }).catch((error) => log('Error registering new user: ', error.message))
}

function signIn(ev) {
  ev.preventDefault();

  const formData = new FormData(ev.target);
  const username = formData.get('username').trim();
  const password = formData.get('password').trim();

  const data = {
    username,
    password
  }

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');

  const request = new Request('/users/auth', {
    method: 'POST',
    headers,
    mode: 'same-origin',
    body: JSON.stringify(data)
  })

  sendSignInRequest(request, username)
    .then((token) => {
      log(`User successfully signed in.`);

      // 1. Save token in local storage
      localStorage.setItem('token', token);

      // 2. Redirect to homepage
      location.href = '/#';

      User = username;

      // 3. Get user cart and make it active
      CM.send('activate-cart', username);

      // 4. Give visual indication of successful authentication
      CM.send('draw-user-elements', username);
    })
    .catch((error) => {
      if (error.hasOwnProperty('target')) {
        CM.send('report-validity', {
          target: error.target,
          message: error.message
        })
      } else {
        console.error('Error signing user in: ', error.message);
      }
    })
}

function signInByToken() {
  const token = localStorage.getItem('token');

  if (!token) {
    log('Authentication token is not present in local storage.');
    return;
  }

  // 1. Send token to the server
  const headers = new Headers();
  headers.append('Content-Type', 'text/plain');

  const request = new Request(`/users/auth/token?token=${token}`, {
    method: 'GET',
    headers,
    mode: 'same-origin'
  })

  // 2. If token is valid, get username from response
  fetch(request)
    .then((response) => {
      if (response.ok) {
        return response.text();
      } else {
        return response.text().then((message) => {
          throw new Error(message);
        })
      }
    }).then((username) => {
      if (!username) return;

      // 3. Set current user
      User = username;

      // 4. Set user cart as active
      CM.send('activate-cart', username);

      // 5. Give visual indication of successful authentication
      CM.send('draw-user-elements', username);
    }).catch((error) => {
      log(error.stack)
      log('Token is not valid or expired. Refused to authenticate automatically.');
    })
}

function sendSignInRequest(request, username) {
  return new Promise((resolve, reject) => {
    fetch(request)
      .then((response) => {
        if (response.ok) {
          return response.text();
        } else {
          return response.json().then((errorObj) => {
            reject(errorObj);
          })
        }
      }).then((token) => {
        if (token) {
          // 1. Verify that token is a string
          if (typeof token !== 'string') {
            reject('Token came from server is not of "string" type.');
          }

          resolve(token);
        } else {
          reject();
        }
      })
  })
}

function addSignUpEventListeners() {
  const form = document.querySelector('.form form');
  const inputs = [];

  form.addEventListener('submit', signUp);

  // 1. Change default pattern mismatch message for input and email fields
  const userInput = form.querySelector('#username');
  const emailInput = form.querySelector('#email');
  const passInput = form.querySelector('#password');
  const passRepInput = form.querySelector('#password-rep');

  if (userInput) inputs.push(userInput);
  if (emailInput) inputs.push(emailInput);
  if (passInput) inputs.push(passInput);
  if (passRepInput) inputs.push(passRepInput);

  userInput.addEventListener('invalid', () => {
    patternMismatchMessage(userInput, 'Only A-Z, a-z, 0-9 and _ are allowed.');
  })

  emailInput.addEventListener('invalid', () => {
    patternMismatchMessage(userInput, 'Email format is invalid.');
  })

  passInput.addEventListener('invalid', () => {
    patternMismatchMessage(passInput, 'Only A-Z, a-z, 0-9 , _ - @ $ * # + are allowed.');
  })

  // 2. Clear validation messages on input value change
  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.setCustomValidity('');
    })
  })
}

function addSignInEventListeners() {
  const form = document.querySelector('.form form');
  const inputs = form.querySelectorAll('input');

  form.addEventListener('submit', signIn);

  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.setCustomValidity('');
    })
  })
}

function patternMismatchMessage(input, message) {
  if (input.validity.patternMismatch) {
    input.setCustomValidity(message);
  }
}

function sendUser() {
  CM.send('send-user', User);
}
