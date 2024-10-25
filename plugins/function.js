const crypto                = require('crypto');
const uuid                  = require('uuid');

/*
    CONSTANTS STARTS HERE
*/

/*
    CONSTANTS ENDS HERE
*/

/*
    FUNCTION STARTS HERE
*/
const extensionName = (base64String) => {
    return base64String.substring("data:image/".length, base64String.indexOf(";base64"))
}
/*
    FUNCTION ENDS HERE
*/

exports.generateToken = (length = 30) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    let token = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, characters.length);
      token += characters.charAt(randomIndex);
    }
    
    return token;
}

exports.getExtensionName = (base64String) => {
    return base64String.substring("data:image/".length, base64String.indexOf(";base64"))
}

exports.filename = (base64String) => {
    return (uuid.v4() + path.extname(extensionName(base64String)))
}