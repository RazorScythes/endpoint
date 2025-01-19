/* NODE MODULES */
const hsts                      = require('hsts')
const express                   = require('express')
const cors                      = require('cors')
const morgan                    = require('morgan')
const path                      = require('path')
const mongoose                  = require('mongoose')

require('dotenv').config();

/* MODELS */
require('./models/user.model')
require('./models/video.model')
require('./models/profile.model')
require('./models/settings.model')
require('./models/grouplist.model')
require('./models/tags.model')
require('./models/category.model')
require('./models/author.model')
require('./models/comment.model')
require('./models/docs.model')

/* API */
const user                      = require('./routes/user')
const account                   = require('./routes/account')
const groups                    = require('./routes/groups') 
const videos                    = require('./routes/videos')
const tags                      = require('./routes/tags')
const category                  = require('./routes/category')
const author                    = require('./routes/author')
const watch                     = require('./routes/watch')
const cron                      = require('./routes/cron')
const documentation             = require('./routes/documentation')

const app   = express()
const port  = process.env.PORT
const db    = mongoose.connection

/* START SERVER */
mongoose.connect(process.env.MONGODB_URI, {   
    useNewUrlParser: true, 
    useUnifiedTopology: true
})
.then(() => {
    app.listen(port, (err) => {
        if(err) throw err
        console.log(`Server is running on PORT: ${port}`)
    })
})

db.once('open', () => {
    console.log('Database Connection Established')
})

/* MIDDLEWARE */
app.use(hsts({
    maxAge: 31536000,       
    includeSubDomains: true,
    preload: true
}))

app.use(morgan('dev'))
app.use(express.urlencoded({
    limit: '55mb',
    parameterLimit: 100000,
    extended: true 
}))

app.use(express.json({limit: '150mb'}))

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', req.header('origin') );
    next();
});

app.use(cors({
    origin: function(origin, callback){
      return callback(null, true);
    },
    optionsSuccessStatus: 200,
    credentials: true
}))

/* ROUTES */
app.get("/", async function(req, res) {
    res.send(`GET Request`);
})

app.use('/user', user);
app.use('/account', account);
app.use('/groups', groups);
app.use('/tags', tags);
app.use('/category', category);
app.use('/author', author);
app.use('/videos', videos);
app.use('/watch', watch);
app.use('/cron', cron);
app.use('/documentation', documentation);
