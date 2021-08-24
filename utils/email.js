const nodemailer = require('nodemailer')
const pug = require('pug')
const { convert } = require('html-to-text')

module.exports = class Email {
	constructor(user, url) {
		this.to = user.email
		this.firstName = user.name.split(' ')[0]
		this.url = url
		this.from =
			process.env.NODE_ENV === 'production'
				? `${process.env.MAIL_FROM_NAME} < ${process.env.SENDGRID_FROM_ADDRESS} >`
				: `${process.env.MAIL_FROM_NAME} < ${process.env.MAIL_FROM_ADDRESS} >`
	}

	mailTransport() {
		if (process.env.NODE_ENV === 'production') {
			// SendGrid
			return nodemailer.createTransport({
				service: 'SendGrid',
				auth: {
					user: process.env.SENDGRID_USERNAME,
					pass: process.env.SENDGRID_PASSWORD
				}
			})
		}

		return nodemailer.createTransport({
			host: process.env.MAIL_HOST,
			port: process.env.MAIL_PORT,
			auth: {
				user: process.env.MAIL_USERNAME,
				pass: process.env.MAIL_PASSWORD
			}
		})
	}

	async send(template, subject) {
		const html = pug.renderFile(
			`${__dirname}/../views/emails/${template}.pug`,
			{
				firstName: this.firstName,
				url: this.url,
				subject
			}
		)

		const mailOptions = {
			from: this.from,
			to: this.to,
			subject: subject,
			html: html,
			text: convert(html)
		}

		await this.mailTransport().sendMail(mailOptions)
	}

	async sendWelcome() {
		await this.send('welcomeEmail', "Welcome to Ramanath's Blog!")
	}

	async sendPasswordReset() {
		await this.send(
			'resetPassword',
			'Your password reset token (valid for only 10 minutes)'
		)
	}

	async sendVerification() {
		await this.send(
			'emailVerify',
			'Your email verification token (valid for only 1 day)'
		)
	}
}
