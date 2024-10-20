const bcrypt            = require('bcryptjs')
const jwt               = require('jsonwebtoken')
const users             = require('../models/user.model')

exports.login = async (req, res) => {
    const { username, password } = req.body

    try {
        const data = await users.findOne({ username })

        if(!data) {
            return res.status(404).json({ message: 'unknown username or password' })
        }

        const compare = await bcrypt.compare(password, data.password)

        if(!compare) {
            return res.status(404).json({ message: "unknown username or password" })
        }
        
        const profile = {
            _id         : data._id,
            username    : data.username,
            role        : data.role,
            name        : data.name
        }

        const token = jwt.sign({ 
            username    : profile.username, 
            id          : profile._id 
        }, process.env.SECRET_KEY, { expiresIn: process.env.EXPIRATION })

        res.status(200).json({ 
            result      : profile, 
            token 
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'internal server error' })
    }
}