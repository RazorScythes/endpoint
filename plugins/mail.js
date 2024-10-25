const nodemailer            = require('nodemailer');

/*
    CONSTANTS STARTS HERE
*/
var transporter     = null; 

if(process.env.PRODUCTION) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASSWORD
        }
    });
}
else {
    require('dotenv').config()

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_EMAIL,
            pass: process.env.GMAIL_PASSWORD
        }
    });
}
/*
    CONSTANTS ENDS HERE
*/

exports.sendMail = async (content) => {
    transporter.sendMail(content, (error, info) => {
        if (error) {
            return {
                message: 'failed to send mail, please check try again',
                type: 0
            }
        } else {
            Users.findByIdAndUpdate(id, user, { new: true })
            .then(() => {   
                return {
                    message: 'mail sent successfully',
                    type: 1
                }
            })
            .catch(() => {
                return {
                    message: 'failed to send mail, please check try again',
                    type: 0
                }
            })
        }
    });
}