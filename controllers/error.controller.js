const AppError = require('../utils/appError')

const handleJWTExpiredError = () =>
	new AppError('Your token has expired. Please login again.', 401)

const handleJWTError = () =>
	new AppError('Invalid Token. Please login again.', 401)

const handleValidationErrorDB = (err) => {
	const errors = Object.values(err.errors).map((el) => el.message)
	const message = `Invalid input data: ${errors.join('. ')}`
	return new AppError(message, 400)
}

const handleDuplicateFieldsDB = (err) => {
	const value = err.message.match(/(["'])(?:(?=(\\?))\2.)*?\1/)[0]
	const message = `Duplicate fields value: ${value}. Please use another value.`
	return new AppError(message, 400)
}

const handleCastErrorDB = (err) => {
	const message = `Invalid ${err.path}: ${err.value}`
	return new AppError(message, 400)
}

const sendErrorDev = (err, req, res) => {
	if (req.originalUrl.startsWith('/api')) {
		return res.status(err.statusCode).json({
			status: err.status,
			error: err,
			message: err.message,
			stack: err.stack
		})
	}

	console.error('ERROR: ', err)
	res.status(err.statusCode).render('error', {
		title: 'Something went wrong!',
		message: err.message
	})
}

const sendErrorProd = (err, req, res) => {
	if (req.originalUrl.startsWith('/api')) {
		// Operational trusted error: send message to client
		if (err.isOperational) {
			return res.status(err.statusCode).json({
				status: err.status,
				message: err.message
			})
		}
		// Programming or other unknown error: don't leak error details
		console.error('ERROR: ', err)
		return res.status(500).json({
			status: 'error',
			message: 'Something went wrong...'
		})
	}

	// Operational trusted error: send message to client
	if (err.isOperational) {
		return res.status(err.statusCode).render('error', {
			title: 'Something went wrong!',
			message: err.message
		})
	}
	// Programming or other unknown error: don't leak error details
	console.error('ERROR: ', err)
	res.status(err.statusCode).render('error', {
		title: 'Something went wrong!',
		message: 'Please try again later!'
	})
}

module.exports = (err, req, res, next) => {
	err.statusCode = err.statusCode || 500
	err.status = err.status || 'error'

	if (process.env.NODE_ENV === 'development') {
		sendErrorDev(err, req, res)
	} else if (process.env.NODE_ENV === 'production') {
		let error = Object.assign(err)
		if (error.name === 'CastError') {
			error = handleCastErrorDB(error)
		}

		if (error.code === 11000) {
			error = handleDuplicateFieldsDB(error)
		}

		if (error.name === 'ValidationError') {
			error = handleValidationErrorDB(error)
		}

		if (error.name === 'JsonWebTokenError') {
			error = handleJWTError()
		}

		if (error.name === 'TokenExpiredError') {
			error = handleJWTExpiredError()
		}

		sendErrorProd(error, req, res)
	}
}
