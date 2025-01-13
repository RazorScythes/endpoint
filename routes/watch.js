const express                   = require('express')
const router                    = express.Router()
const watch                     = require('../controllers/watch')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getVideoById/:id/:access_key?', auth.authenticateToken, auth.userRequired, auth.allowCors(watch.getVideoById));
router.get('/getVideoComment/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(watch.getVideoComment));
router.get('/getVideoList/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(watch.getVideoList));

// POST REQUEST
router.post('/addVideoComment', auth.authenticateToken, auth.userRequired, auth.allowCors(watch.addVideoComment));

// PATCH REQUEST
router.patch('/updateVideoComment', auth.authenticateToken, auth.userRequired, auth.allowCors(watch.updateVideoComment));

// DELETE REQUEST
router.delete('/deleteVideoComment/:id/:video_id', auth.authenticateToken, auth.userRequired, auth.allowCors(watch.deleteVideoComment));

module.exports = router
