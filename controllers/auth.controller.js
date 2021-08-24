const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const AppError = require('../utils/appError')
const Email = require('../utils/email')
const catchAsync = require('../utils/catchAsync')

const sendUserVerificationEmail = async (
	verificationType,
	message,
	token,
	user,
	statusCode,
	req,
	res,
	next
) => {
	try {
		const host = req.get('host')
		const { protocol } = req
		const url = `${protocol}://${host}/api/v1/users/email/verify/${token}`

		const email = new Email(user, url)
		if (verificationType === 'resend') {
			await email.sendVerification()
		} else {
			await email.sendVerification()
			await email.sendWelcome()
		}

		res.status(statusCode).json({ status: 'success', message: message })
	} catch (error) {
		user.emailVerificationToken = undefined
		user.emailVerificationTokenExpires = undefined
		await user.save({ validateBeforeSave: false })

		return next(
			new AppError(
				'There was an error, sending the email. Try again later',
				500
			)
		)
	}
}

const signToken = (id) =>
	jwt.sign({ id: id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN
	})

const createSendToken = (user, statusCode, req, res) => {
	const token = signToken(user._id)
	res.cookie('jwt', token, {
		expires: new Date(
			Date.now() +
				Number(process.env.JWT_EXPIRES_IN.slice(0, -1)) * 24 * 60 * 60 * 1000
		), // milliseconds
		httpOnly: true,
		secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
	})

	user.password = undefined
	res.status(statusCode).json({
		status: 'success',
		token,
		data: {
			user: user
		}
	})
}

exports.logout = (req, res) => {
	res.cookie('jwt', 'loggedoutnow', {
		expires: new Date(Date.now() + 10 * 1000),
		httpOnly: true
	})

	res.status(200).json({ status: 'success' })
}

exports.signUp = catchAsync(async (req, res, next) => {
	if (await User.findOne({ email: req.body.email, emailVerified: false })) {
		return res.status(200).json({
			status: 'success',
			action: 'verificationPending',
			message: 'Please verify your email address'
		})
	}

	const user = new User({
		name: req.body.name,
		email: req.body.email,
		password: req.body.password,
		passwordConfirm: req.body.passwordConfirm
	})

	const token = user.createVerificationToken()
	await user.save()
	const message = 'Registration successful. Please verify your email address.'
	sendUserVerificationEmail('signup', message, token, user, 201, req, res, next)
})

exports.login = catchAsync(async (req, res, next) => {
	const { email, password } = req.body

	if (!email || !password) {
		return next(new AppError('Please provide password and email address'), 400)
	}

	const user = await User.findOne({ email: email }).select('+password')

	if (!user || !(await user.correctPassword(password, user.password))) {
		return next(new AppError('Incorrect email or password', 401))
	}

	createSendToken(user, 200, req, res)
})

exports.forgotPassword = catchAsync(async (req, res, next) => {
	const user = await User.findOne({
		email: req.body.email,
		emailVerified: true
	})

	if (!user) {
		return next(
			new AppError('There is no user with the given email address.', 404)
		)
	}

	const resetToken = user.createPasswordResetToken()
	await user.save({ validateBeforeSave: false })

	try {
		const resetURL = `${req.protocol}://${req.get(
			'host'
		)}/api/v1/users/password/reset/${resetToken}`
		await new Email(user, resetURL).sendPasswordReset()

		res.status(200).json({
			status: 'success',
			message: 'Token sent to email!'
		})
	} catch (error) {
		user.passwordResetToken = undefined
		user.passwordResetTokenExpires = undefined
		await user.save({ validateBeforeSave: false })

		return next(
			new AppError(
				'There was an error, sending the email. Try again later',
				500
			)
		)
	}
})

exports.resetPassword = catchAsync(async (req, res, next) => {
	const hashedToken = crypto
		.createHash('sha256')
		.update(req.params.token)
		.digest('hex')

	const user = await User.findOne({
		passwordResetToken: hashedToken,
		passwordResetTokenExpires: { $gt: Date.now() }
	})

	if (!user) {
		return next(new AppError('Token is invalid or expired'), 400)
	}

	user.password = req.body.password
	user.passwordConfirm = req.body.passwordConfirm
	user.passwordResetToken = undefined
	user.passwordResetTokenExpires = undefined
	await user.save()

	createSendToken(user, 200, req, res)
})

exports.verifyEmail = catchAsync(async (req, res, next) => {
	const hashedToken = crypto
		.createHash('sha256')
		.update(req.params.token)
		.digest('hex')

	const user = await User.findOne({
		emailVerificationToken: hashedToken,
		emailVerificationTokenExpires: { $gt: Date.now() }
	})

	if (!user) {
		return next(new AppError('Token is invalid or expired'), 400)
	}

	user.emailVerified = true
	user.emailVerificationToken = undefined
	user.emailVerificationTokenExpires = undefined
	await user.save({ validateBeforeSave: false })

	createSendToken(user, 200, req, res)
})

exports.resendVerificationEmail = catchAsync(async (req, res, next) => {
	const user = await User.findOne({
		email: req.body.email,
		emailVerified: false
	})
	const token = user.createVerificationToken()
	await user.save({ validateBeforeSave: false })
	const message = 'We have sent you a verification email. You can verify now!'
	sendUserVerificationEmail('resend', message, token, user, 200, req, res, next)
})

exports.updatePassword = catchAsync(async (req, res, next) => {
	const user = await User.findById(req.user.id).select('+password')

	if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
		return next(new AppError('Your current password is incorrect'), 401)
	}

	user.password = req.body.password
	user.passwordConfirm = req.body.passwordConfirm
	await user.save()

	createSendToken(user, 200, req, res)
})
