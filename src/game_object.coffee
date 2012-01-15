Serializable = require('./serializable.coffee').Serializable

exports.GameObject = class GameObject extends Serializable
  __type: 'GameObject'

  constructor: () ->
    super

  clone: ->
    new GameObject()

  draw: (context) ->

  update: (dt) ->
    # Override me!

  leave: (callback) ->
    callback()