const express                   = require('express')
const router                    = express.Router()
const playlist                  = require('../controllers/playlist')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getPlaylists', auth.authenticateToken, auth.userRequired, auth.allowCors(playlist.getPlaylists));
router.get('/getPlaylistById/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(playlist.getPlaylistById));

// POST REQUEST
router.post('/createPlaylist', auth.authenticateToken, auth.userRequired, auth.allowCors(playlist.createPlaylist));

// PATCH REQUEST
router.patch('/updatePlaylist', auth.authenticateToken, auth.userRequired, auth.allowCors(playlist.updatePlaylist));
router.patch('/toggleVideo', auth.authenticateToken, auth.userRequired, auth.allowCors(playlist.toggleVideo));
router.patch('/removeVideo', auth.authenticateToken, auth.userRequired, auth.allowCors(playlist.removeVideoFromPlaylist));

// DELETE REQUEST
router.delete('/deletePlaylist/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(playlist.deletePlaylist));

module.exports = router
