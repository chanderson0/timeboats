NODE_ENV = global.process.env.NODE_ENV || 'development'

fb_keys = 
  'development':
    'app_id': '236216303119513'
    'app_secret': '305840219e824288689d39c3695afbf2'
  'production':
    'app_id': '302738666439657'
    'app_secret': '7ff495baaa99f41c3435c0aca5bf2057'

express = require 'express'
async = require 'async'
app = express.createServer(
  express.bodyParser(),
  express.static(__dirname + "/public"),
  express.favicon(),
  express.cookieParser(),
  express.session secret: 'timb0000ats',
)

app.configure ->
  app.set 'view engine', 'ejs'

app.get '/', (req, res) ->
  res.redirect '/paradocks'

port = process.env.PORT || 3000
app.listen port, ->
  console.log "Listening on " + port
