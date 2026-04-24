const bcrypt            = require('bcryptjs')
const jwt               = require('jsonwebtoken')
const crypto            = require('crypto')
const Users             = require('../models/user.model')
const Profile           = require('../models/profile.model')
const Settings          = require('../models/settings.model')
const ActivityLog       = require('../models/activitylog.model')
const Ban               = require('../models/ban.model')
const { logActivity }   = require('../plugins/logger')
const { sendMail }      = require('../plugins/mail')

const VALID_ROLES = ['User', 'Moderator', 'Admin']

const fetchAllUsers = async () => {
    const users = await Users.find({})
        .select('avatar username email role googleId subscribers verification contribution createdAt')
        .populate('profile_id', 'first_name last_name bio age birthday address contact_number gender')
        .sort({ createdAt: -1 })
        .lean()

    const bans = await Ban.find({}).populate('bannedBy', 'username').lean()
    const banMap = {}
    bans.forEach(b => { banMap[b.user.toString()] = b })

    return users.map(u => ({
        ...u,
        ban: banMap[u._id.toString()] || null
    }))
}

exports.getAllUsers = async (req, res) => {
    try {
        const users = await fetchAllUsers()
        res.status(200).json({ result: users })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.updateUserRole = async (req, res) => {
    const { userId, role } = req.body

    if (!userId || !role) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'User ID and role are required' }
        })
    }

    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({
            alert: { variant: 'danger', message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }
        })
    }

    try {
        const user = await Users.findById(userId)
        if (!user) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'User not found' }
            })
        }

        user.role = role
        await user.save()

        const users = await fetchAllUsers()

        res.status(200).json({
            result: users,
            alert: { variant: 'success', message: `${user.username}'s role updated to ${role}` }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.deleteUser = async (req, res) => {
    const { user } = req.token
    const { id } = req.params

    if (id === user._id.toString()) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'You cannot delete your own account from here' }
        })
    }

    try {
        const targetUser = await Users.findById(id)
        if (!targetUser) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'User not found' }
            })
        }

        if (targetUser.profile_id) await Profile.findByIdAndDelete(targetUser.profile_id)
        if (targetUser.settings_id) await Settings.findByIdAndDelete(targetUser.settings_id)
        await ActivityLog.deleteMany({ user: id })
        await Ban.deleteOne({ user: id })
        await Users.findByIdAndDelete(id)

        const users = await fetchAllUsers()

        res.status(200).json({
            result: users,
            alert: { variant: 'success', message: `${targetUser.username} has been deleted` }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.banUser = async (req, res) => {
    const { user } = req.token
    const { userId, duration, reason } = req.body

    if (!userId || !duration) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'User ID and duration are required' }
        })
    }

    if (userId === user._id.toString()) {
        return res.status(400).json({
            alert: { variant: 'danger', message: 'You cannot ban yourself' }
        })
    }

    try {
        const targetUser = await Users.findById(userId)
        if (!targetUser) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'User not found' }
            })
        }

        if (targetUser.role === 'Admin') {
            return res.status(403).json({
                alert: { variant: 'danger', message: 'Cannot ban an Admin' }
            })
        }

        if (user.role === 'Moderator' && targetUser.role === 'Moderator') {
            return res.status(403).json({
                alert: { variant: 'danger', message: 'Moderators cannot ban other Moderators' }
            })
        }

        let expiresAt = null
        let permanent = false

        if (duration === 'permanent') {
            permanent = true
        } else {
            const days = parseInt(duration)
            if (isNaN(days) || days <= 0) {
                return res.status(400).json({
                    alert: { variant: 'danger', message: 'Invalid duration' }
                })
            }
            expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        }

        await Ban.findOneAndUpdate(
            { user: userId },
            {
                user: userId,
                bannedBy: user._id,
                permanent,
                expiresAt,
                reason: reason || ''
            },
            { upsert: true, new: true }
        )

        const users = await fetchAllUsers()

        res.status(200).json({
            result: users,
            alert: { variant: 'success', message: `${targetUser.username} has been banned${permanent ? ' permanently' : ` for ${duration} days`}` }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.unbanUser = async (req, res) => {
    const { id } = req.params

    try {
        const targetUser = await Users.findById(id)
        if (!targetUser) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'User not found' }
            })
        }

        await Ban.deleteOne({ user: id })

        const users = await fetchAllUsers()

        res.status(200).json({
            result: users,
            alert: { variant: 'success', message: `${targetUser.username} has been unbanned` }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

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
            email: user.email,
            role: user.role,
            bio: '',
            googleId: null,
            verification: { verified: false }
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

        const ban = await Ban.findOne({ user: data._id })
        if (ban) {
            const isBanned = ban.permanent || (ban.expiresAt && new Date(ban.expiresAt) > new Date())
            if (isBanned) {
                const msg = ban.permanent
                    ? 'Your account has been permanently banned.'
                    : `Your account is banned until ${new Date(ban.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
                return res.status(403).json({ message: msg, reason: ban.reason || '' })
            }
        }

        const profile = {
            _id             : data._id,
            avatar          : data.avatar,
            first_name      : data.profile_id.first_name,
            last_name       : data.profile_id.last_name,
            username        : data.username,
            email           : data.email,
            role            : data.role,
            bio             : data.profile_id.bio,
            googleId        : data.googleId || null,
            verification    : data.verification || { verified: false }
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
        let verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (!verifyRes.ok) {
            verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${credential}`);
        }
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
            email: user.email,
            role: user.role,
            bio: user.profile_id?.bio,
            googleId: user.googleId || null,
            verification: user.verification || { verified: true }
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

exports.changePassword = async (req, res) => {
    const { user } = req.token
    const { password } = req.body

    if (!password?.old || !password?.new || !password?.confirm) {
        return res.status(400).json({
            alert: 'All password fields are required',
            variant: 'danger'
        })
    }

    if (password.new !== password.confirm) {
        return res.status(400).json({
            alert: 'New passwords do not match',
            variant: 'danger'
        })
    }

    if (password.new.length < 6) {
        return res.status(400).json({
            alert: 'Password must be at least 6 characters',
            variant: 'danger'
        })
    }

    if (password.old === password.new) {
        return res.status(400).json({
            alert: 'New password must be different from current password',
            variant: 'danger'
        })
    }

    try {
        const fullUser = await Users.findById(user._id)
        if (!fullUser || !fullUser.password) {
            return res.status(400).json({
                alert: 'Password change not available for this account',
                variant: 'danger'
            })
        }

        const isMatch = await bcrypt.compare(password.old, fullUser.password)
        if (!isMatch) {
            return res.status(400).json({
                alert: 'Current password is incorrect',
                variant: 'danger'
            })
        }

        const salt = await bcrypt.genSalt(12)
        const hashed = await bcrypt.hash(password.new, salt)

        await Users.findByIdAndUpdate(user._id, { password: hashed })

        logActivity(req, {
            action: 'change_password',
            category: 'account',
            message: 'Password changed successfully'
        })

        res.status(200).json({
            result: {},
            alert: 'Password updated successfully',
            variant: 'success'
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: 'Internal server error',
            variant: 'danger'
        })
    }
}

exports.getSettings = async (req, res) => {
    try {
        const { user } = req.token

        const settings = user.settings_id || {}

        res.status(200).json({
            result: {
                safe_content: settings.safe_content ?? true,
                reset_password: settings.reset_password ?? false,
                email: user.email,
                username: user.username,
                role: user.role,
                googleId: user.googleId || null,
                verified: user.verification?.verified ?? false,
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.updateSettings = async (req, res) => {
    const { user } = req.token
    const updates = req.body

    try {
        const allowed = ['safe_content', 'reset_password']
        const filtered = {}
        for (const key of allowed) {
            if (updates[key] !== undefined) filtered[key] = updates[key]
        }

        if (Object.keys(filtered).length === 0) {
            return res.status(400).json({
                alert: { variant: 'danger', message: 'No valid settings to update' }
            })
        }

        const updatedSettings = await Settings.findByIdAndUpdate(
            user.settings_id._id,
            filtered,
            { new: true }
        )

        logActivity(req, {
            action: 'update_settings',
            category: 'settings',
            message: `Updated settings: ${Object.keys(filtered).join(', ')}`
        })

        res.status(200).json({
            result: {
                safe_content: updatedSettings.safe_content ?? true,
                reset_password: updatedSettings.reset_password ?? false,
                email: user.email,
                username: user.username,
                role: user.role,
                googleId: user.googleId || null,
                verified: user.verification?.verified ?? false,
            },
            alert: { variant: 'success', message: 'Settings updated' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.deleteAccount = async (req, res) => {
    const { user } = req.token
    const { password } = req.body

    try {
        if (user.password) {
            if (!password) {
                return res.status(400).json({
                    alert: { variant: 'danger', message: 'Password is required to delete your account' }
                })
            }

            const isMatch = await bcrypt.compare(password, user.password)
            if (!isMatch) {
                return res.status(400).json({
                    alert: { variant: 'danger', message: 'Incorrect password' }
                })
            }
        }

        await ActivityLog.create({
            user: user._id,
            action: 'delete_account',
            category: 'account',
            message: `Account "${user.username}" deleted`,
            method: 'DELETE',
            ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
            user_agent: req.headers['user-agent'],
        }).catch(() => {})

        await Profile.findByIdAndDelete(user.profile_id?._id)
        await Settings.findByIdAndDelete(user.settings_id?._id)
        await ActivityLog.deleteMany({ user: user._id })
        await Ban.deleteOne({ user: user._id })
        await Users.findByIdAndDelete(user._id)

        res.status(200).json({
            alert: { variant: 'success', message: 'Account deleted successfully' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.sendVerificationEmail = async (req, res) => {
    const { user } = req.token

    try {
        if (user.verification?.verified) {
            return res.status(400).json({
                alert: { variant: 'info', message: 'Your email is already verified' }
            })
        }

        const lastSent = user.verification?.verification_time_to_send
        if (lastSent) {
            const cooldown = 60 * 1000
            const elapsed = Date.now() - new Date(lastSent).getTime()
            if (elapsed < cooldown) {
                const remaining = Math.ceil((cooldown - elapsed) / 1000)
                return res.status(429).json({
                    alert: { variant: 'danger', message: `Please wait ${remaining}s before requesting another email` }
                })
            }
        }

        const token = crypto.randomBytes(32).toString('hex')

        await Users.findByIdAndUpdate(user._id, {
            'verification.verification_token': token,
            'verification.verification_time_to_send': new Date().toISOString()
        })

        const isDev = process.env.DEVELOPMENT === 'true'
        const baseUrl = isDev ? 'http://localhost:5173' : 'https://main-website-sage.vercel.app'
        const verifyUrl = `${baseUrl}/account_verify?token=${token}`

        const mailContent = {
            from: process.env.GMAIL_EMAIL || process.env.EMAIL,
            to: user.email,
            subject: 'Verify your email address',
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9fafb; border-radius: 12px;">
                    <h2 style="color: #1e293b; margin: 0 0 8px 0; font-size: 20px;">Verify your email</h2>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                        Hi <strong>${user.username}</strong>, click the button below to verify your email address.
                    </p>
                    <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                        Verify Email
                    </a>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
                        If you didn't request this, you can safely ignore this email.
                    </p>
                </div>
            `
        }

        await sendMail(mailContent)

        logActivity(req, {
            action: 'send_verification_email',
            category: 'account',
            message: 'Verification email sent'
        })

        res.status(200).json({
            alert: { variant: 'success', message: 'Verification email sent! Check your inbox.' }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'Failed to send verification email' }
        })
    }
}

exports.getPublicProfile = async (req, res) => {
    const { username } = req.params

    if (!username) {
        return res.status(400).json({ message: 'Username is required' })
    }

    try {
        const Playlist = require('../models/playlist.model')

        const user = await Users.findOne({ username })
            .select('avatar username role subscribers verification createdAt')
            .populate('profile_id', 'first_name last_name bio')
            .lean()

        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        const playlists = await Playlist.find({ user: user._id, privacy: false })
            .populate('videos', 'title thumbnail views createdAt')
            .sort({ createdAt: -1 })
            .lean()

        const ban = await Ban.findOne({ user: user._id }).lean()
        let banInfo = null
        if (ban) {
            const isBanned = ban.permanent || (ban.expiresAt && new Date(ban.expiresAt) > new Date())
            if (isBanned) {
                banInfo = {
                    permanent: ban.permanent,
                    expiresAt: ban.expiresAt,
                    reason: ban.reason,
                }
            }
        }

        res.status(200).json({
            result: {
                _id: user._id,
                avatar: user.avatar,
                username: user.username,
                first_name: user.profile_id?.first_name,
                last_name: user.profile_id?.last_name,
                bio: user.profile_id?.bio,
                role: user.role,
                verified: user.verification?.verified ?? false,
                subscribers: user.subscribers?.length || 0,
                createdAt: user.createdAt,
                ban: banInfo,
                playlists: playlists.map(p => ({
                    _id: p._id,
                    name: p.name,
                    description: p.description,
                    videos: p.videos || [],
                    createdAt: p.createdAt,
                })),
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Internal server error' })
    }
}

exports.verifyEmail = async (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).json({ status: 'notFound' })
    }

    try {
        const user = await Users.findOne({ 'verification.verification_token': token })

        if (!user) {
            return res.status(404).json({ status: 'notFound' })
        }

        if (user.verification?.verified) {
            return res.status(200).json({ status: 'verified' })
        }

        const sentAt = user.verification?.verification_time_to_send
        if (sentAt) {
            const expiry = 24 * 60 * 60 * 1000
            const elapsed = Date.now() - new Date(sentAt).getTime()
            if (elapsed > expiry) {
                return res.status(410).json({ status: 'expired' })
            }
        }

        await Users.findByIdAndUpdate(user._id, {
            'verification.verified': true,
            'verification.verification_token': ''
        })

        res.status(200).json({ status: 'activated' })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ status: 'error' })
    }
}