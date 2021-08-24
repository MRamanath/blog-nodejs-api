const path = require('path')
const express = require('express')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const xss = require('xss-clean')
const hpp = require('hpp')
const cookieParser = require('cookie-parser')
const compression = require('compression')
const cors = require('cors')

const AppError = require('./utils/appError')
const globalErrorHandler = require('./controllers/error.controller')
const userRouter = require('./routes/user.routes')
const viewRouter = require('./routes/view.routes')

const app = express()

app.set('view engine', 'pug')
app.set('views', path.join(__dirname, 'views'))

app.use(cors())
app.options('*', cors())

app.use(express.static(path.join(__dirname, 'public')))
app.use(helmet())

if (process.env.NODE_ENV === 'development') {
	app.use(morgan('dev'))
}

const limiter = rateLimit({
	max: 100,
	windowMs: 60 * 60 * 1000,
	message: 'Too many requests from this ip. Please try again in an hour!'
})

app.use('/api', limiter)

app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))
app.use(cookieParser())

app.use(mongoSanitize())

app.use(xss())

app.use(
	hpp({
		whitelist: [
			'duration',
			'maxGroupSize',
			'difficulty',
			'ratingsAverage',
			'ratingsQuantity',
			'price'
		]
	})
)

app.use(compression())

app.use((req, res, next) => {
	req.requestTime = new Date().toISOString()
	next()
})

// Router Mounting
app.use('/', viewRouter)
app.use('/api/v1/users', userRouter)

app.all('*', (req, res, next) => {
	next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404))
})

app.use(globalErrorHandler)

// Server Start
module.exports = app
