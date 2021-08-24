const crypto = require('crypto')
const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		trim: true,
		required: [true, 'Please tell us your name']
	},
	email: {
		type: String,
		required: [true, 'Please provide your email'],
		unique: true,
		lowercase: true,
		validate: [validator.isEmail, 'Please provide a valid email']
	},
	photo: {
		type: String,
		default: 'default.jpg'
	},
	role: {
		type: String,
		enum: ['user', 'admin'],
		default: 'user'
	},
	password: {
		type: String,
		required: [true, 'Please provide a password'],
		minlength: 8,
		select: false
	},
	passwordConfirm: {
		type: String,
		required: [true, 'Please confirm your password'],
		validate: {
			// Only works on save, create // won't work on update
			validator: function (el) {
				return el === this.password
			},
			message: 'Passwords are not the same'
		}
	},
	passwordChangedAt: Date,
	passwordResetToken: String,
	passwordResetTokenExpires: Date,
	emailVerificationToken: String,
	emailVerificationTokenExpires: Date,
	active: {
		type: Boolean,
		default: true,
		select: false
	},
	emailVerified: {
		type: Boolean,
		default: false,
		select: false
	}
})

userSchema.pre(/^find/, function (next) {
	this.find({ active: { $ne: false } })
	next()
})

userSchema.pre('save', async function (next) {
	if (!this.isModified('password')) {
		return next()
	}

	this.password = await bcrypt.hash(this.password, 12)
	this.passwordConfirm = undefined
	next()
})

userSchema.pre('save', function (next) {
	if (!this.isModified('password') || this.isNew) {
		return next()
	}

	this.passwordChangedAt = Date.now() - 1000
	next()
})

userSchema.methods.correctPassword = async function (
	candidatePassword,
	userPassword
) {
	return bcrypt.compare(candidatePassword, userPassword)
}

userSchema.methods.changePasswordAfter = function (JWTTimestamp) {
	if (this.passwordChangedAt) {
		const changedTimeStamp = parseInt(
			this.passwordChangedAt.getTime() / 1000,
			10
		)
		return JWTTimestamp < changedTimeStamp
	}

	return false
}

userSchema.methods.createPasswordResetToken = function () {
	const token = crypto.randomBytes(32).toString('hex')
	this.passwordResetToken = crypto
		.createHash('sha256')
		.update(token)
		.digest('hex')
	this.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000 // 10 minutes
	return token
}

userSchema.methods.createVerificationToken = function () {
	const token = crypto.randomBytes(32).toString('hex')
	this.emailVerificationToken = crypto
		.createHash('sha256')
		.update(token)
		.digest('hex')
	this.emailVerificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000 // 1 day valid
	return token
}

const User = mongoose.model('User', userSchema)

module.exports = User
