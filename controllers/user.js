const bcrypt            = require('bcryptjs')
const jwt               = require('jsonwebtoken')
const Users             = require('../models/user.model')
const Profile           = require('../models/profile.model')
const Settings          = require('../models/settings.model')
const ActivityLog       = require('../models/activitylog.model')
const { logActivity }   = require('../plugins/logger')

exports.register = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const existingUser = await Users.findOne({ $or: [{ username }, { email }] });

        if (existingUser) {
            const field = existingUser.username === username ? 'Username' : 'Email';
            return res.status(409).json({ message: `${field} already taken` });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const profile = await Profile.create({
            first_name: '',
            last_name: '',
        });

        const settings = await Settings.create({
            safe_content: true,
        });

        const user = await Users.create({
            username,
            email,
            password: hashedPassword,
            role: 'User',
            profile_id: profile._id,
            settings_id: settings._id,
        });

        const result = {
            _id: user._id,
            avatar: user.avatar,
            first_name: '',
            last_name: '',
            username: user.username,
            role: user.role,
            bio: '',
        };

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.SECRET_KEY,
            { expiresIn: process.env.EXPIRATION }
        );

        ActivityLog.create({
            user: user._id,
            action: 'register',
            category: 'auth',
            message: `User "${username}" registered`,
            method: 'POST',
            ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
            user_agent: req.headers['user-agent'],
        }).catch(() => {});

        res.status(201).json({ result, token });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Internal server error' });
    }
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

        ActivityLog.create({
            user: data._id,
            action: 'login',
            category: 'auth',
            message: `User "${data.username}" logged in`,
            method: 'POST',
            ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
            user_agent: req.headers['user-agent']
        }).catch(() => {})

        res.status(200).json({ 
            result          : profile, 
            token 
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'internal server error', variant: 'danger' })
    }
}

exports.googleLogin = async (req, res) => {
    const { credential, email, given_name, family_name, picture, googleId } = req.body;

    if (!credential || !email) {
        return res.status(400).json({ message: 'Missing Google credential' });
    }

    try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${credential}`);
        if (!verifyRes.ok) {
            return res.status(401).json({ message: 'Invalid Google credential' });
        }

        let user = await Users.findOne({ email }).populate('profile_id');

        if (!user) {
            const profile = await Profile.create({
                first_name: given_name || '',
                last_name: family_name || '',
            });

            const settings = await Settings.create({
                safe_content: true,
            });

            user = await Users.create({
                email,
                username: email.split('@')[0],
                avatar: picture || '',
                role: 'User',
                googleId,
                profile_id: profile._id,
                settings_id: settings._id,
            });

            user = await Users.findById(user._id).populate('profile_id');
        }

        const profile = {
            _id: user._id,
            avatar: user.avatar,
            first_name: user.profile_id?.first_name,
            last_name: user.profile_id?.last_name,
            username: user.username,
            role: user.role,
            bio: user.profile_id?.bio,
        };

        const token = jwt.sign(
            { id: profile._id, role: user.role },
            process.env.SECRET_KEY,
            { expiresIn: process.env.EXPIRATION }
        );

        ActivityLog.create({
            user: user._id,
            action: 'login',
            category: 'auth',
            message: `User "${user.username}" logged in via Google`,
            method: 'POST',
            ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
            user_agent: req.headers['user-agent'],
        }).catch(() => {});

        res.status(200).json({ result: profile, token });
    } catch (error) {
        console.log(error);
        res.status(401).json({ message: 'Invalid Google credential' });
    }
};

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

        logActivity(req, {
            action: 'update_profile',
            category: 'profile',
            message: 'Profile information updated'
        })

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