const plugins               = require('../plugins/function');
const { google }            = require('googleapis');
const { Readable }          = require('stream')

/*
    CONSTANTS STARTS HERE
*/
var jwtClient       = null;
var uri             = '';

if(process.env.PRODUCTION) {
    uri = 'https://main-website-sage.vercel.app/account_verify'

    jwtClient = new google.auth.JWT(
        process.env.CLIENT_EMAIL,
        null,
        process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/drive.file'],
        null
    );
}
else {
    require('dotenv').config()

    uri = 'http://localhost:5173/account_verify'

    jwtClient = new google.auth.JWT(
        process.env.CLIENT_EMAIL,
        null,
        process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/drive.file'],
        null
    );
}
/*
    CONSTANTS ENDS HERE
*/

exports.uploadImage = (base64, folder) => {
    if(base64.includes('https://drive.google.com')) {
        return base64.split('=').at(-1);
    }   

    return new Promise(async (resolve, reject) => {
        const drive = google.drive({
            version         : 'v3',
            auth            : jwtClient
        }); 

        const base64Data = base64;

        const imageData = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const imageBuffer = Buffer.from(imageData, 'base64');
        const mimeType = `image/${plugins.getExtensionName(base64)}`;

        const fileMetadata = {
            name            : plugins.filename(base64),
            parents         : [folder]
        };

        const media = {
            mimeType        : mimeType,
            body            : Readable.from(imageBuffer)
        };

        try {
            drive.files.create({
                resource    : fileMetadata,
                media       : media,
                fields      : 'id'
            }, async (err, file) => {
                if (err) {
                    console.error('error uploading image', err.errors);
                    return id
                } else {
                    if (err) {
                        console.log(err)
                        reject(err);
                    } else {
                        console.log("image uploaded", file.data.id)
                        resolve(file.data.id);
                    }
                }
            });
        }
        catch(error) {
            console.log(err)
            reject(error);
        }
    })
}

exports.deleteImage = (id, folder) => {
    return new Promise(async (resolve, reject) => {
        const drive = google.drive({
            version         : 'v3',
            auth            : jwtClient
        });

        let fileID = id.split('=').at(-1)

        try {
            drive.files.delete({ 
                fileId      : fileID,
                resource: {
                    parents : [folder]
                }
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(id);
                }
            });
        }
        catch (err){ 
            reject(err);
        }
    })
}