Turns = require('./turns.coffee')
GameObject = require('./game_object.coffee').GameObject
GameObject2D = require('./game_object_2d.coffee').GameObject2D
Explosion = require('./explosion.coffee').Explosion
State = require('./state.coffee').State
Square = require('./square.coffee').Square
Command = require('./command.coffee')
Serializable = require('./serializable.coffee').Serializable
async = require('./lib/async.js')

classmap = null

API = class API
  constructor: (@username, @token) ->
  
  gameIds: (cb) ->
    cb false, []

  getGames: (cb) ->
    cb false, []

  getGame: (id, cb) ->
    cb true, null
    
  # Design decision: save whole game to API. API must
  # do validation to make sure this isn't cheating!
  saveGame: (game, cb) ->
    cb true, null
  
LocalAPI = class LocalAPI extends API
  constructor: (@username, @token) ->
    super @username, @token
    @getGames (err, games) =>
      if err
        alert "Couldn't start API"
        return

      if not games
        @save @gamesKey(), {}
        @save @gameIdsKey(), []

  load: (key) =>
    item = window.localStorage.getItem key
    item = JSON.parse item
    Serializable.deserialize item, classmap
    item

  save: (key, value) =>
    window.localStorage.setItem key, JSON.stringify(value)

  gamesKey: =>
    @username + '!!!games'

  gameIdsKey: =>
    @username + '!!!game_ids'

  gameIds: (cb) =>
    cb false, @load @gameIdsKey()

  getGame: (id, cb) =>
    @getGames (err, games) =>
      if err
        return cb err, null
      
      cb false, games[id]

  getGames: (cb) =>
    cb false, @load @gamesKey()

  saveGame: (game, cb) =>
    async.parallel {
      game_ids: @gameIds
      games: @getGames
    }, 
    (err, data) =>
      if err
        return cb err, null

      game_ids = data.game_ids
      games = data.games

      if game_ids.length > 20
        first = game_ids[0]
        game_ids.shift()

        console.log 'deleting', first, games[first].id
        delete games[first]

      if not (game.id in game_ids)
        game_ids.push game.id
        @save @gameIdsKey(), game_ids
    
      games[game.id] = game
      @save @gamesKey(), games

      cb false, true

RemoteAPI = class RemoteAPI extends API
  constructor: (@host, @username, @token) ->
    super @username, @token
  
  request: (method, params, callback) ->
    url = @host + method + '?' + $.params + '&callback=?'
    $.getJSON url, (data) -> 
      callback data
      
  gameIds: (cb) ->
    url = @host + '/gameIds?callback=?'
    $.getJSON url, (data) ->
      cb data

  getGames: (cb) ->
    url = @host + '/games?callback=?'
    $.getJSON url, (data) ->
      cb data
  
  getGame: (id, cb) ->
    url = @host + '/games/' + id + '?callback=?'
    $.getJSON url, (data) ->
      cb data
  
  saveGame: (game, cb) ->
    url = @host + '/games/save?callback=?'
    $.post url,
      JSON.stringify(game),
      ((data) ->
        cb data
      ),
      'json'

classmap = Serializable.buildClassMap Turns.Game, Turns.Turn, Turns.Player, \
  GameObject, GameObject2D, Explosion, State, Square, \
  Command.Command, Command.MouseCommand, Command.JoinCommand, Command.ExplodeCommand

exports.API = API
exports.LocalAPI = LocalAPI