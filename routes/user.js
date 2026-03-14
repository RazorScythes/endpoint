const express                   = require('express')
const router                    = express.Router()
const user                      = require('../controllers/user')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getProfile', auth.authenticateToken, auth.userRequired, auth.allowCors(user.getProfile));
router.get('/getAllUsers', auth.authenticateToken, auth.userRequired, auth.moderatorAccess, auth.allowCors(user.getAllUsers));
router.get('/getSettings', auth.authenticateToken, auth.userRequired, auth.allowCors(user.getSettings));
router.get('/profile/:username', auth.allowCors(user.getPublicProfile));

// POST REQUEST
router.post('/login', auth.allowCors(user.login));
router.post('/register', auth.allowCors(user.register));
router.post('/googleLogin', auth.allowCors(user.googleLogin));
router.post('/updateProfile', auth.authenticateToken, auth.userRequired, auth.allowCors(user.updateProfile));
router.post('/banUser', auth.authenticateToken, auth.userRequired, auth.moderatorAccess, auth.allowCors(user.banUser));
router.post('/updateSettings', auth.authenticateToken, auth.userRequired, auth.allowCors(user.updateSettings));
router.post('/sendVerificationEmail', auth.authenticateToken, auth.userRequired, auth.allowCors(user.sendVerificationEmail));
router.post('/verifyEmail', auth.allowCors(user.verifyEmail));

// PATCH REQUEST
router.patch('/updateRole', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(user.updateUserRole));

// DELETE REQUEST
router.delete('/deleteUser/:id', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(user.deleteUser));
router.delete('/unbanUser/:id', auth.authenticateToken, auth.userRequired, auth.moderatorAccess, auth.allowCors(user.unbanUser));
router.delete('/deleteAccount', auth.authenticateToken, auth.userRequired, auth.allowCors(user.deleteAccount));

module.exports = router