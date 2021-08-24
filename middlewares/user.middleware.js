const multer = require('multer')
const sharp = require('sharp')
const catchAsync = require('../utils/catchAsync')
const AppError = require('../utils/appError')

const multerStorage = multer.memoryStorage()
const multerFilter = (req, file, cb) => {
	if (file.mimetype.startsWith('image')) {
		cb(null, true)
	} else {
		cb(new AppError('Not an image! Please upload only images.', 400), false)
	}
}

const upload = multer({ storage: multerStorage, fileFilter: multerFilter })
exports.uploadUserPhoto = upload.single('photo')

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
	if (!req.file) {
		return next()
	}

	req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`

	await sharp(req.file.buffer)
		.resize(500, 500)
		.toFormat('jpeg')
		.jpeg({ quality: 90 })
		.toFile(`public/img/users/${req.file.filename}`)

	next()
})

exports.filterObj = (obj, ...allowedFields) => {
	const newObj = {}
	Object.keys(obj).forEach((el) => {
		if (allowedFields.includes(el)) {
			newObj[el] = obj[el]
		}
	})

	return newObj
}

exports.getMe = (req, res, next) => {
	req.params.id = req.user.id
	next()
}
