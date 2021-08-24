const { promisify } = require('util')
const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const AppError = require('../utils/appError')
const catchAsync = require('../utils/catchAsync')

exports.protect = catchAsync(async (req, res, next) => {
	let token
	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith('Bearer')
	) {
		token = req.headers.authorization.split(' ')[1]
	} else if (req.cookies.jwt) {
		token = req.cookies.jwt
	}

	if (!token) {
		return next(
			new AppError('You are not logged in. Please login to get access.', 401)
		)
	}

	const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)
	const currentUser = await User.findById(decoded.id)

	if (!currentUser) {
		return next(
			new AppError('The user belonging to this token does not exists.', 401)
		)
	}

	if (currentUser.changePasswordAfter(decoded.iat)) {
		return next(
			new AppError('User recently changed password. Please login again.', 401)
		)
	}

	req.user = currentUser
	res.locals.user = currentUser
	next()
})

exports.restrictTo =
	(...roles) =>
	(req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return next(
				new AppError('You don not have permission to perform this action.', 403)
			)
		}
		next()
	}

// Only for rendered pages
exports.isLoggedIn = async (req, res, next) => {
	if (req.cookies.jwt) {
		try {
			const decoded = await promisify(jwt.verify)(
				req.cookies.jwt,
				process.env.JWT_SECRET
			)

			const currentUser = await User.findById(decoded.id)
			if (!currentUser) {
				return next()
			}

			if (currentUser.changePasswordAfter(decoded.iat)) {
				return next()
			}

			res.locals.user = currentUser
			return next()
		} catch (err) {
			return next()
		}
	}
	next()
}
