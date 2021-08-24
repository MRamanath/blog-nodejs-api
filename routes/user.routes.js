const express = require('express')
const userController = require('../controllers/user.controller')
const authController = require('../controllers/auth.controller')
const userMiddleware = require('../middlewares/user.middleware')
const authMiddleware = require('../middlewares/auth.middleware')

const router = express.Router()

router.post('/sign-up', authController.signUp)
router.post('/login', authController.login)
router.get('/logout', authController.logout)
router.post('/password/forgot', authController.forgotPassword)
router.patch('/password/reset/:token', authController.resetPassword)
router.patch('/email/verify/:token', authController.verifyEmail)
router.patch('/email/resend', authController.resendVerificationEmail)

// since middleware run in sequence order we can do this
router.use(authMiddleware.protect)

router.patch('/password/update', authController.updatePassword)
router.get('/self', userMiddleware.getMe, userController.getUser)
router.patch(
	'/update/self',
	userMiddleware.uploadUserPhoto,
	userMiddleware.resizeUserPhoto,
	userController.updateMe
)
router.delete('/delete/self', userController.deleteMe)

// since middleware run in sequence order we can do this
router.use(authMiddleware.restrictTo('admin'))

router
	.route('/')
	.get(userController.getAllUsers)
	.post(userController.createUser)

router
	.route('/:id')
	.get(userController.getUser)
	.patch(userController.updateUser)
	.delete(userController.deleteUser)

module.exports = router
