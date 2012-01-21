Turns = require('./turns.coffee')
GameObject = require('./game_object.coffee').GameObject
GameObject2D = require('./game_object_2d.coffee').GameObject2D
Explosion = require('./explosion.coffee').Explosion
State = require('./state.coffee').State
Square = require('./square.coffee').Square
Command = require('./command.coffee')
Serializable = require('./serializable.coffee').Serializable

classmap = null

API = class API
  constructor: (@username, @token) ->
  
  gameIds: ->
    []

  getGames: ->
    return []

  getGame: (id) ->
    return false
    
  # Design decision: save whole game to API. API must
  # do validation to make sure this isn't cheating!
  saveGame: (game) ->
    return false
  
LocalAPI = class LocalAPI extends API
  constructor: (@username, @token) ->
    super @username, @token
    if not @getGames()?
      @save @gamesKey(), {}
      @save @gameIdsKey(), []

  load: (key) ->
    item = window.localStorage.getItem key
    item = JSON.parse item
    Serializable.deserialize item, classmap
    item

  save: (key, value) ->
    window.localStorage.setItem key, JSON.stringify(value)

  gamesKey: ->
    @username + '!!!games'

  gameIdsKey: ->
    @username + '!!!game_ids'

  gameIds: ->
    @load @gameIdsKey()

  getGame: (id) ->
    @getGames()[id]

  getGames: ->
    @load @gamesKey()

  saveGame: (game) ->
    games = @getGames()
    game_ids = @gameIds()
    if not (game.id in game_ids)
      game_ids.push game.id
      @save @gameIdsKey(), game_ids
    
    games[game.id] = game
    
    @save @gamesKey(), games

classmap = Serializable.buildClassMap Turns.Game, Turns.Turn, Turns.Player, \
  GameObject, GameObject2D, Explosion, State, Square, \
  Command.Command, Command.MouseCommand, Command.JoinCommand, Command.ExplodeCommand

exports.API = API
exports.LocalAPI = LocalAPI