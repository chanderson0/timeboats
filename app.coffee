mongoose = require 'mongoose'
mongoose.connect('mongodb://mongo:mongo@staff.mongohq.com:10033/timeboats-dev')

# Set up the database
Schema = mongoose.Schema
ObjectId = Schema.ObjectId

Invite = mongoose.model 'Invite', new Schema
  user: 
    type: ObjectId
    ref: 'User'
  game:
    type: ObjectId
    ref: 'Game'
  status: String
  created:
    type: Date
    default: Date.now

User = mongoose.model 'User', new Schema
  fb_id: String
  fb_name: String
  fb_token: String
  invites: [
    type: ObjectId
    ref: 'Invite'
  ]
  created:
    type: Date
    default: Date.now

Move = mongoose.model 'Move', new Schema
  user: 
    type: ObjectId
    ref: 'User'
  length: Number
  data: String
  comment: String
  created:
    type: Date
    default: Date.now

Game = mongoose.model 'Game', new Schema
  status: String
  moves: [Move]
  invites: [
    type: ObjectId
    ref: 'Invite'
  ]
  version: Number
  created:
    type: Date
    default: Date.now

everyauth = require 'everyauth'

everyauth.everymodule.findUserById (id, callback) ->
  User.findOne().where({'fb_id': id}).run(callback)

# Debug keys
everyauth.facebook
  .appId('236216303119513')
  .appSecret('305840219e824288689d39c3695afbf2')
  .handleAuthCallbackError((req, res) ->
    # TODO
  ).findOrCreateUser((session, accessToken, accessTokExtra, fbUserMetadata) ->
    promise = this.Promise()
    User.findOne().where('fb_id', fbUserMetadata.id).run (err, user) ->
      if err or not user?
        console.log 'creating user', err
        user = new User()
        user.fb_id = fbUserMetadata.id
        user.fb_name = fbUserMetadata.name
        user.fb_token = accessToken
        user.save (err) ->
          if err
            console.log 'couldnt create'
            return promise.fulfill [err]
          else
            console.log 'successfully created', user
            return promise.fulfill user
      else
        console.log 'found user', user
        return promise.fulfill user
    return promise
  ).redirectPath('/')
  .scope('email')

express = require 'express'
async = require 'async'
app = express.createServer(
  express.bodyParser(),
  express.static(__dirname + "/public"),
  express.favicon(),
  express.cookieParser(),
  express.session secret: 'timb0000ats',
  everyauth.middleware()
)

app.configure ->
  app.set 'view engine', 'ejs'

app.get '/', (req, res) ->
  res.render 'home',
    layout: false

app.get '/game/:id', (req, res) ->
  async.parallel({
    game: Game.findById(req.id).run
  },
  (err, results) ->
    if not err
      res.write results.game
    else
      res.write 'ERROR'
  )

everyauth.helpExpress app
port = process.env.PORT || 3000
app.listen port, ->
  console.log "Listening on " + port
