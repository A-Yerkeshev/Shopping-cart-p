"use strict";
import CM from './ChannelManager.js';

let User;

// Listen to requests from Main module
CM.setFormat('register-user', {
  username: 'STRING',
  email: 'STRING',
  password: 'STRING',
  passwordRep: 'STRING'
});
CM.listen('register-user', signUp);

CM.listen('sign-in', signIn);
CM.listen('sign-in-by-token', signInByToken);
CM.listen('signed-user', getCurrentUser);

// Establish connection with Drawer module
CM.openChannel('report-validity');
CM.openChannel('draw-user-elements');

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

          // 3. Give visual indication of successful authentication
          CM.send('draw-user-elements', username);
          fillUserBox(username);

          // 4. Fill cart and display it
          Cart = getCart(username);
          updateCart();
          displayCart();
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

      // 3. Give visual indication of successful authentication
      fillUserBox(username);

      // 4. Fill cart and display it
      Cart = getCart(username);
      updateCart();
      displayCart();
    })
    .catch((error) => {
      const userInput = document.getElementById('username');
      const passInput = document.getElementById('password');

      if (error.message == 'Password is not correct.') {
        passInput.setCustomValidity(error.message);
        passInput.reportValidity();
      } else {
        userInput.setCustomValidity(error.message);
        userInput.reportValidity();
      }

      log('Error signing user in: ', error.message);
    })
}

function sendSignInRequest(request, username) {
  return new Promise((resolve, reject) => {
    fetch(request)
      .then((response) => {
        if (response.ok) {
          return response.text();
        } else {
          return response.text().then((message) => {
            throw new Error(message);
          })
        }
      }).then((token) => {
        // 1. Verify that token is a string
        if (typeof token !== 'string') {
          throw new Error('Token came from server is not of "string" type.');
          return;
        }

        resolve(token);
      }).catch((error) => {
        reject(error);
      })
  })
}

function signInByToken() {
  const token = localStorage.getItem('token');

  if (!token) return;

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

      // 3. Give visual indication of successful authentication
      fillUserBox(username);

      // 4. Get, fill and display cart
      Cart = getCart(username);
      updateCart();
      displayCart();
    }).catch((error) => log('Token is not valid or expired. Refused to authenticate automatically.'))
}

function getCurrentUser() {
  return User;
}
