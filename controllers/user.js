const bcrypt            = require('bcryptjs')
const jwt               = require('jsonwebtoken')
const users             = require('../models/user.model')

exports.register = async (req, res) => {

}

exports.login = async (req, res) => {
    const { username, password } = req.body

    try {
        const data = await users.findOne({ username }).populate('profile_id')

        if(!data) {
            return res.status(404).json({ message: 'unknown username or password' })
        }

        const compare = await bcrypt.compare(password, data.password)

        if(!compare) {
            return res.status(404).json({ message: "unknown username or password" })
        }
        
        const profile = {
            _id             : data._id,
            avatar          : data.avatar,
            first_name      : data.profile_id.first_name,
            last_name       : data.profile_id.last_name,
            username        : data.username,
            role            : data.role
        }

        const token = jwt.sign({ 
            id              : profile._id,
            role            : data.role
        }, process.env.SECRET_KEY, { expiresIn: process.env.EXPIRATION })

        res.status(200).json({ 
            result          : profile, 
            token 
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'internal server error', variant: 'danger' })
    }
}

exports.getUser = async (req, res) => {
    try {
        const user = req.token.user;

        res.status(200).json(user);
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'internal server error', variant: 'danger' })
    }
}