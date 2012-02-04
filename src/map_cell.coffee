GameObject = require('./game_object.coffee').GameObject

exports.MapCell = class MapCell extends GameObject
  __type: 'MapCell'

  constructor: (@altitude) ->
    @isPlant = false
    @excitement = 0
    @saveInitialState()
    @r = 0
    @g = 0
    @b = 0
    super

  setColor: (r, g, b) ->
    @r = r
    @g = g
    @b = b

  getColor: ->
    [@r, @g, @b]

  clone: ->
    new MapCell(@altitude)

  saveInitialState: ->
    @initial_altitude = @altitude
    @initial_isPlant = @isPlant

  reset: ->
    @altitude = @initial_altitude
    @isPlant = @initial_isPlant

  update: (dt) ->
