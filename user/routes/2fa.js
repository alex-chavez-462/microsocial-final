// options: none, auth, call, sms

var express = require('express');
var router = express.Router();
module.exports.router = router;
var { db } = require('../db')

/**
 * @swagger
 * /users/2fa:
 *   post:
 *     summary: Post a 2FA method!
 *     tags: [Users API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *               two_factor_type:
 *                 type: string
 *     responses:
 *       201:
 *         description: Success
 *       400:
 *         description: Invalid
 */
router.post('/users/2fa', async (req, res) => {
    const { user_id, two_factor_type } = req.body
    const q = db.prepare(
      `INSERT INTO user_2fa (user_id, two_factor_type) VALUES(?, ?);`
    )
    q.run(user_id, two_factor_type)
  
    res.status(201).json({ message: 'success' })
})

/**
 * @swagger
 * /users/2fa:
 *   put:
 *     summary: Update a 2fa!
 *     tags: [Users API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *               two_factor_type:
 *                 type: string
 *     responses:
 *       201:
 *         description: successfully
 *       400:
 *         description: Invalid input data
 */
router.put('/users/2fa', (req, res) => {
    const { user_id, two_factor_type } = req.body

    const q = db.prepare(`UPDATE user_2fa SET two_factor_type=? WHERE user_id=?`)
    const result = q.run(two_factor_type, user_id).changes
  
    if (result > 0) res.status(204).json({ message: 'Success' })
    else res.status(400).json({ error: 'Id not found' })
})

/**
 * @swagger
 * /user/2fa/{user_id}:
 *   get:
 *     summary: Get two factor authentication type!
 *     parameters:
 *       - name: user_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     tags: [Users API]
 *     responses:
 *       200:
 *         description: Get two factor auth type
 */
router.get('/user/2fa/:user_id', (req, res) => {
    const { user_id } = req.params
    if (!user_id) return res.status(400).json({ error: "User ID not found" })
  
    const q = db.prepare(`SELECT * FROM user_2fa WHERE user_id=?`)
    const result = q.all(user_id)
    return res.status(200).json({ result: result })
})