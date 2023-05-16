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
        code = console.log(Math.floor(100000 + Math.random() * 900000));
    } while(code == 000000 || code == 111111 || code == 222222 || code == 333333 || 
            code == 444444 || code == 555555 || code == 666666 ||
            code == 777777 || code == 888888 || code == 999999);
        // not the cleanest but I feel like this is easier than making a whole ass function 
        // i'd probably confuse myself that way tbh
    return code;
}

/**
 * @swagger
 * /2FA/code:
 *   post:
 *     summary: Generate a one-time verification code which expires after 1 minute
 *     description: As summarized.
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
 *         description: Generation Succeeded; Code created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       403:
 *         description: Code doesn't exist.
 */

// SMS
function sms_verify() {}

// auth
function auth_verify() {}

// call
function call_verify() {}

// none