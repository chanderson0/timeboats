Serializable = require('./serializable.coffee').Serializable

Command = class Command extends Serializable
  __type: 'Command'

  constructor: (@id) ->
    super
    # Override me!

  apply: (state) ->
    # Override me!

MouseCommand = class MouseCommand extends Command
  __type: 'MouseCommand'

  constructor: (@id, @destx, @desty) ->
    super @id

  apply: (state) ->
    obj = state.getObject @id
    if obj?
      obj.destx = @destx
      obj.desty = @desty

ExplodeCommand = class ExplodeCommand extends Command
  __type: 'ExplodeCommand'

  constructor: (@id) ->
    super @id

  apply: (state) ->
    obj = state.getObject @id
    if obj?
      obj.explode state

JoinCommand = class JoinCommand extends Command
  __type: 'JoinCommand'

  constructor: (@id, @player) ->
    super @id

  apply: (state) ->
    state.addObject @player.id, @player

exports.Command = Command
exports.MouseCommand = MouseCommand
exports.JoinCommand = JoinCommand
exports.ExplodeCommand = ExplodeCommand