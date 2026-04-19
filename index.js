/* NODE MODULES */
const hsts                      = require('hsts')
const express                   = require('express')
const cors                      = require('cors')
const morgan                    = require('morgan')
const path                      = require('path')
const mongoose                  = require('mongoose')
const http                      = require('http')
const { Server }                = require('socket.io')

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
require('./models/activitylog.model')
require('./models/playlist.model')
require('./models/report.model')
require('./models/conversation.model')
require('./models/message.model')
require('./models/budgetCategory.model')
require('./models/expense.model')
require('./models/savings.model')
require('./models/savingsHistory.model')
require('./models/debt.model')
require('./models/budgetList.model')
require('./models/portfolio.model')
require('./models/game.model')
require('./models/project.model')
require('./models/page.model')
require('./models/userImage.model')
require('./models/mapEditor.model')

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
const playlist                  = require('./routes/playlist')
const chat                      = require('./routes/chat')
const budget                    = require('./routes/budget')
const portfolio                 = require('./routes/portfolio')
const gameRoutes                = require('./routes/game')
const projectRoutes             = require('./routes/project')
const pageRoutes                = require('./routes/page')
const mapEditorRoutes           = require('./routes/mapEditor')

const app    = express()
const server = http.createServer(app)
const io     = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH', 'DELETE']
    }
})
const port   = process.env.PORT
const db     = mongoose.connection

io.on('connection', (socket) => {
    socket.on('join_video', (videoId) => {
        socket.join(`video:${videoId}`)
    })

    socket.on('leave_video', (videoId) => {
        socket.leave(`video:${videoId}`)
    })

    socket.on('join_game', (gameId) => {
        socket.join(`game:${gameId}`)
    })

    socket.on('leave_game', (gameId) => {
        socket.leave(`game:${gameId}`)
    })

    socket.on('join_project', (projectId) => {
        socket.join(`project:${projectId}`)
    })

    socket.on('leave_project', (projectId) => {
        socket.leave(`project:${projectId}`)
    })

    socket.on('join_chat', (userId) => {
        socket.join(`user:${userId}`)
    })

    socket.on('typing', ({ conversationId, recipientId, username }) => {
        io.to(`user:${recipientId}`).emit('typing', { conversationId, username })
    })

    socket.on('stop_typing', ({ conversationId, recipientId }) => {
        io.to(`user:${recipientId}`).emit('stop_typing', { conversationId })
    })

    socket.on('disconnect', () => {})
})

app.set('io', io)

/* START SERVER */
mongoose.connect(process.env.MONGODB_URI, {   
    useNewUrlParser: true, 
    useUnifiedTopology: true
})
.then(() => {
    server.listen(port, (err) => {
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
app.use('/playlist', playlist);
app.use('/chat', chat);
app.use('/budget', budget);
app.use('/portfolio', portfolio);
app.use('/game', gameRoutes);
app.use('/project', projectRoutes);
app.use('/page', pageRoutes);
app.use('/gaming/map-editor', mapEditorRoutes);
