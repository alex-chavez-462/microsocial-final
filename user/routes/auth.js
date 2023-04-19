const { StatusCodes } = require("http-status-codes");
const path = require("path");
const jsonwebtoken = require("jsonwebtoken");
var { expressjwt: jwt } = require("express-jwt");
const { v4: uuidv4 } = require("uuid");
const { uri, unprotectedPaths } = require("../common");
const ms = require("ms");
const dotenv = require("dotenv");
var express = require("express");
const { expressjwt } = require("express-jwt");

const { validate } = require("../utils/schema-validation");
const { db } = require("../db");

var router = express.Router();
dotenv.config();


// we need the app to app.use(), so call back on module load
var app;
module.exports.appSetCallback = function (theApp) {
  app = theApp;
  app_setup();
};
module.exports.router = router;

function generateAccessToken(payload) {
  const theToken = jsonwebtoken.sign(payload, process.env.TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRATION,
  });
  console.log({ generateAccessToken: theToken, payload });
  return theToken;
}

// refresh tokens can have some time used ("elapsed" ms) from their normal expiration
const generateRefreshToken = function (payload, timeElapsed = 0) {
  let issuedAt = new Date();
  let expiresAt = new Date();
  expiresAt.setSeconds(
    expiresAt.getSeconds() +
      ms(process.env.REFRESH_TOKEN_EXPIRATION) / 1000 -
      timeElapsed / 1000
  );

  let refreshToken = {
    ...payload,
    token: uuidv4(), // opaque id
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // save token id in db for revoking?
  const stmt =
    db.prepare(`INSERT INTO refresh_tokens (user_id, refresh_token, issued, expires)
                 VALUES (?, ?, ?, ?)`);

  stmt.run([
    payload.id,
    refreshToken.token,
    refreshToken.issuedAt,
    refreshToken.expiresAt,
  ]);

  console.log({ generateRefreshToken: refreshToken, payload });

  return refreshToken.token;
};

// const verifyRefreshTokenExpiration = (token) => {
//   return token.expiryDate.getTime() < new Date().getTime();
// };

//*************
// const catchAccessTokenError = (err, res) => {
//   console.log({ catchAccessTokenError: '1', err, res});
//   if (err instanceof TokenExpiredError) {
//     return res.status(StatusCodes.UNAUTHORIZED).send({ message: "Access token has expired" });
//   }

//   return res.sendStatus(StatusCodes.UNAUTHORIZED).send({ message: "Unauthorized" });
// }

// const verifyAccessToken = (req, res, next) => {
//   let token = req.headers["x-access-token"];

//   if (!token) {
//     return res.status(StatusCodes.FORBIDDEN).send({ message: "No token provided" });
//   }

//   jsonwebtoken.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
//     if (err) {
//       return catchAccessTokenError(err, res);
//     }
//     req.userId = decoded.id;
//     next();
//   });
// };

// const handleExpiredAccessToken = async (req, err) => {
//   const token = req.headers.authorization
//   console.log({ handleExpiredAccessToken: token});
//   console.log("Refresh required",token);
//   res.statusMessage = "Refresh of Access required.";
//   res.status(StatusCodes.UNAUTHORIZED).end();
// // accessToken is expired. throw either needtologin or needtorefresh based on refreshtokenexpiration

//     //     if (new Date() - err.inner.expiredAt < 5000) { return;}
//     //     throw err;
//     //   },
//   };

function app_setup() {
  if (process.env.NO_AUTH) {
    return;
  }
  app.use(
    expressjwt({
      secret: process.env.TOKEN_SECRET,
      algorithms: ["HS256"],
    }).unless({ path: unprotectedPaths() })
  );
  app.use(function (err, req, res, next) {
    if (err.name === "UnauthorizedError") {
      if (err.inner.name === "TokenExpiredError") {
        res.status(StatusCodes.UNAUTHORIZED).send("Token Expired");
      } else {
        res.status(StatusCodes.UNAUTHORIZED).send("Authorization Error");
      }
    } else {
      next(err);
    }
  });
}

/**
 * @swagger
 * /auth/token:
 *   post:
 *     summary: Request a refreshed token
 *     description: Given a valid (non-expired) refresh token, prepare and return a new access token and refresh token
 *     operationId: refreshToken
 *     tags: [Auth API]
 *     requestBody:
 *       content:
 *         application/json:
 *           required: true
 *           schema:
 *              $ref: '#/components/schemas/LoginToken'
 *     responses:
 *       200:
 *         description: Login Succeeded; Token created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginToken'
 *       403:
 *         description: Login Required
 */
router.post("/auth/token", async (req, res) => {
  const { grant_type, client_id, refresh_token } = req.body;

  console.log({ grant_type, client_id, refresh_token });

  const errors = validate.RefreshToken( {refresh_token },"{body}");
  if (errors.length) {
    console.log(
      "No/bad-format refresh token submitted",
      refresh_token
    );
    res.statusMessage = "Login required";
    res.status(StatusCodes.UNAUTHORIZED).end();
    return;
  }

  const stmt = db.prepare(
    "SELECT id, user_id, issued, expires FROM refresh_tokens WHERE refresh_token = ?"
  );
  tokens = stmt.all(refresh_token);
  if (tokens.length == 0) {
    console.log(
      "Nonexistent (revoked?) refresh token submitted",
      refresh_token
    );
    res.statusMessage = "Login required";
    res.status(StatusCodes.UNAUTHORIZED).end();
    return;
  }
  token = tokens[0];
  const delete_token_stmt = db.prepare(
    "DELETE FROM refresh_tokens WHERE id = ?"
  );
  delete_token_stmt.run(token.id);

  if (new Date(token.expires_at).getTime() < new Date().getTime()) {
    console.log("Expired refresh token submitted", refresh_token);
    res.statusMessage = "Login required";
    res.status(StatusCodes.UNAUTHORIZED).end();
    return;
  }

  const access_token = generateAccessToken({ client_id });
  const timeSinceIssued = Date.now() - new Date(token.issued);
  console.log({ token, timeSinceIssued });
  const new_refresh_token = generateRefreshToken(
    { client_id },
    (timeElapsed = timeSinceIssued)
  );

  res.json({ access_token, refresh_token: new_refresh_token });
  res.status(StatusCodes.OK);
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Create a login token
 *     description: Logs in a user by creating a expressjwt. Username and password matched against database. No checks for duplicate tokens or expired accounts.
 *     operationId: login
 *     tags: [Auth API]
 *     requestBody:
 *       content:
 *         application/json:
 *           required: true
 *           schema:
 *              $ref: '#/components/schemas/LoginInfo'
 *     responses:
 *       200:
 *         description: Login Succeeded; Token created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginToken'
 *       401:
 *         description: Login Failed
 */
router.post("/auth/login", async (req, res) => {
  const login_info = req.body;

  const errors = validate.LoginInfo(login_info, "{body}");

  if (errors.length != 0) {
    res.json({ errors });
    res.statusMessage = "Bad login request";
    res.status(StatusCodes.BAD_REQUEST).end();
    return;
  }

  //console.log({login_info});

  const stmt = db.prepare(
    "SELECT * FROM users WHERE name = ? AND password = ?"
  );
  users = stmt.all([login_info.name, login_info.password]);

  if (users.length == 0) {
    console.log("Failed login attempt", login_info);
    res.json([{ message: "Invalid login" }]);
    res.statusMessage = "Invalid login";
    res.status(StatusCodes.UNAUTHORIZED).end();
    return;
  }

  logged_in_user = users[0];

  const delete_token_stmt = db.prepare(
    "DELETE FROM refresh_tokens WHERE user_id = ?"
  );
  delete_token_stmt.run(logged_in_user.id);

  console.log("Successful login", { logged_in_user });

  const access_token = generateAccessToken({ client_id: logged_in_user.id });
  const refresh_token = generateRefreshToken({ client_id: logged_in_user.id });

  res.json({
    id: logged_in_user.id,
    access_token,
    refresh_token,
    uri: uri(`/user/${logged_in_user.id}`),
  });
  res.status(StatusCodes.OK);
});

/**
 * @swagger
 * /auth/login:
 *   get:
 *     summary: Sample login.html
 *     description: Example of a login form that can serve as a login page. All it does is a form-submit with the key fields.  **This is not an API file, it's an example frontend file**
 *     operationId: loginhtml
 *     tags: [Examples]
 *     responses:
 *       200:
 *         description: example form in html
 *         content:
 *           text/html:
 *             schema:
 *               type: html
 */
router.get("/auth/login", (req, res) => {
  const filename = "login.html";
  res.sendFile(filename, { root: path.join(__dirname) });
});