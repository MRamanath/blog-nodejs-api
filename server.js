const mongoose = require('mongoose')
const dotenv = require('dotenv')

process.on('uncaughtException', (err) => {
	console.log('uncaughtException: APP Shutting down')
	console.log(err.name, err.message)
	process.exit(1)
})

dotenv.config({ path: './.env' })

const app = require('./app')

const DB = process.env.DATABASE_CLOUD.replace(
	'<password>',
	encodeURIComponent(process.env.DATABASE_PASSWORD)
)

mongoose
	.connect(DB, {
		useNewUrlParser: true,
		useCreateIndex: true,
		useFindAndModify: false,
		useUnifiedTopology: true
	})
	.then(() => {
		console.log('DB Connection successfull')
	})

const port = process.env.PORT || 3000
const server = app.listen(port, () => {
	console.log(`App running on ${port}`)
})

process.on('unhandledRejection', (err) => {
	console.log('unhandledRejection: APP Shutting down')
	console.log(err.name, err.message)
	server.close(() => {
		process.exit(1)
	})
})

process.on('SIGTERM', () => {
	console.log('SIGTERM RECEIVED...SHUTTING DOWN GRACEFULLY')
	server.close(() => {
		console.log('PROCESS TERMINATED!')
	})
})
