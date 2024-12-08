const bcrypt            = require('bcryptjs')
const jwt               = require('jsonwebtoken')
const Users             = require('../models/user.model')
const Profile           = require('../models/profile.model')

exports.register = async (req, res) => {

}

exports.login = async (req, res) => {
    const { username, password } = req.body

    try {
        const data = await Users.findOne({ username }).populate('profile_id')

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
            role            : data.role,
            bio             : data.profile_id.bio
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

exports.getProfile = async (req, res) => {
    try {
        const user = req.token.user;

        const data = {
            id              : user._id,
            avatar          : user.avatar && {
                preview: user.avatar,
                save: user.avatar
            },
            username        : user.username,
            email           : user.email,
            bio             : user.profile_id?.bio,
            first_name      : user.profile_id?.first_name,
            middle_name     : user.profile_id?.middle_name,
            last_name       : user.profile_id?.last_name,
            birthday        : user.profile_id?.birthday,
            gender          : user.profile_id?.gender,
            contact_number  : user.profile_id?.contact_number,
            address         : user.profile_id?.address,
        }

        res.status(200).json({
            result: data
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ 
            alert: {
                variant: 'danger', 
                message: 'internal server error' 
            }
        })
    }
}

exports.updateProfile = async (req, res) => {
    const { user } = req.token;

    try {
        let formData = req.body;

        await Profile.findByIdAndUpdate(user.profile_id._id, formData, { new: true });

        if(formData.avatar) {
            await Users.findByIdAndUpdate(user._id, { avatar: formData.avatar }, { new: true });

            formData = {
                ...formData,
                avatar: {
                    preview: formData.avatar,
                    save: formData.avatar
                }
            }
        }

        return res.status(200).json({ 
            result: formData,
            alert: {
                variant: "info",
                heading: "",
                message: "Profile updated"
            }
        })
    } catch(err) {
        console.log(err)
        return res.status(500).json({ 
            alert: {
                variant: 'danger', 
                message: 'internal server error' 
            }
        })
    }
}