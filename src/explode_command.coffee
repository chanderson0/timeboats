Command = require('./command.coffee').Command

exports.ExplodeCommand = class ExplodeCommand extends Command
  __type: 'ExplodeCommand'

  constructor: (@id) ->
    super @id

  apply: (state) ->
    obj = state.getObject @id
    if obj?
      obj.explode state