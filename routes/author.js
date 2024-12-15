const express                   = require('express')
const router                    = express.Router()
const author                    = require('../controllers/author')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// CRON
router.get('/updateAuthorCount', author.updateAuthorCount);

// GET REQUEST
router.get('/getAuthor/:type/:options?', auth.authenticateToken, auth.userRequired, auth.allowCors(author.getAuthor));

// POST REQUEST
router.post('/newAuthor', auth.authenticateToken, auth.userRequired, auth.allowCors(author.newAuthor));

// PATCH REQUEST
router.patch('/updateAuthor', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(author.updateAuthor));
router.patch('/deleteMultipleAuthor', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(author.deleteMultipleAuthor));

// DELETE REQUEST
router.delete('/deleteAuthor/:id/:type', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(author.deleteAuthor));

module.exports = router