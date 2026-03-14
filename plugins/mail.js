const nodemailer = require('nodemailer');

require('dotenv').config()

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_EMAIL || process.env.EMAIL,
        pass: process.env.GMAIL_PASSWORD || process.env.PASSWORD
    }
});

exports.sendMail = async (content) => {
    return new Promise((resolve, reject) => {
        transporter.sendMail(content, (error, info) => {
            if (error) {
                console.log('Mail error:', error)
                reject(error)
            } else {
                resolve(info)
            }
        })
    })
}
