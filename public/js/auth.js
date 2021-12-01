"use strict";
import CM from './ChannelManager.js';
const log = console.log;

let User;

// Listen to requests from Main module
CM.setFormat('register-user', {
  username: 'STRING',
  email: 'STRING',
  password: 'STRING',
  passwordRep: 'STRING'
});
CM.listen('register-user', signUp);

CM.setFormat('sign-in', {
  username: 'STRING',
  password: 'STRING',
});
CM.listen('sign-in', signIn);

// Establish connection with Drawer module
CM.open('report-validity');
CM.open('draw-user-elements');

// Establish connection with Cart module
CM.open('activate-cart');

// Try to sign user in if valid token is present in local storage
signInByToken();

function signUp(data) {
  const username = data.username.trim();
  const email = data.email.trim();
  const password = data.password.trim();
  const passwordRep = data.passwordRep.trim();

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

function signIn(data) {
  const username = data.username.trim();
  const password = data.password.trim();

  const reqData = {
    username,
    password
  }

  const headers = new Headers();
  headers.append('Content-Type', 'application/json');

  const request = new Request('/users/auth', {
    method: 'POST',
    headers,
    mode: 'same-origin',
    body: JSON.stringify(reqData)
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
      CM.send('report-validity', {
        target: error.target,
        message: error.message
      })

      log('Error signing user in: ', error.message);
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
    }).catch((error) => log('Token is not valid or expired. Refused to authenticate automatically.'))
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

function getCurrentUser() {
  return User;
}
