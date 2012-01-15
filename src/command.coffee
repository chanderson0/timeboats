Serializable = require('./serializable.coffee').Serializable

exports.Command = class Command extends Serializable
  __type: 'Command'

  constructor: (@id) ->
    super
    # Override me!

  apply: (state) ->
    # Override me!