Serializable = require('./serializable.coffee').Serializable

exports.GameObject = class GameObject extends Serializable
  __type: 'GameObject'

  constructor: (@id) ->
    super

  clone: ->
    new GameObject @id

  draw: (context) ->

  update: (dt, state) ->
    # Override me!

  leave: (callback) ->
    callback()