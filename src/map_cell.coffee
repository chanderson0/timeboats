GameObject = require('./game_object.coffee').GameObject

exports.MapCell = class MapCell extends GameObject
  __type: 'MapCell'

  constructor: (@altitude) ->
    @isPlant = false
    super

  clone: ->
    new MapCell(@altitude)

  update: (dt) ->
