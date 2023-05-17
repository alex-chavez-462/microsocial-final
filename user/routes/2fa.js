// options: none, auth, call, sms
// auth will use an authenticator app

// dependencies 
const axios = require('axios');
const speakeasy = require('speakeasy');

var express = require('express');
var router = express.Router();
module.exports.router = router;

// generate 6-digit auth code (10^6 permutations)
// -> remove possibility of 6 identical digits
function generate_auth_code() {
    let code;
    do{
        code = Math.floor(100000 + Math.random() * 900000);
    } while(code == 000000 || code == 111111 || code == 222222 || code == 333333 || 
            code == 444444 || code == 555555 || code == 666666 ||
            code == 777777 || code == 888888 || code == 999999);
        // sure, it's a 1 in 1000000 chance, but it's not 0%
        // not the cleanest but I feel like this is easier than making a whole ass function 
        // i'd probably confuse myself that way tbh
    return code;
}

// all methods use a single code, generated after each request. i dont wanna make multiple.
function verify(generated, user_input) {
    return generated == user_input;
}

// Send codes via selected method

// SMS
function send_sms(phone_number) {
    console.log("Sent code to ${phone_number}.");
}

// call
function place_call(phone_number) {
    console.log("Calling ${phone_number}...")
}

// auth app
// pretend it makes sense to use a phone number anyway
function auth_app(phone_number) {
    console.log("Enter One-Time Passcode in authentication app.")
}

// no verification
function no_auth() {
    return null;
}

function authenticate(phone_number, user_input) {
    const code = generate_auth_code();

    if (method === 'sms') { 
        // SMS 
        send_sms(phone_number);
        return verify(code, user_input);
    } else if (method === 'call') {
        // Call
        place_call(phone_number); 
        return verify(code, user_input);
    } else if (method === 'auth') { 
        // Auth app
        auth_app(phone_number);
        return verify(code, user_input);
    } else { 
        // User likes a bit of danger (no 2fa)
        console.log("If you get hacked it's all on you.")
        return no_auth();
    }
}

/**
 * @swagger
 * /2FA/authenticate/{auth_code}:
 *   post:
 *     summary: Verify user via 2FA.
 *     description: Via the selected verification option, user receives a code. Auth code is then verified by comparing to 
 *     operationId: generateCode
 *     tags: [2FA API]
 *     requestBody:
 *       content:
 *         application/json:
 *           required: true
 *           schema:
 *              $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Authentication Successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       403:
 *         description: Authentication unsuccessful.
 */