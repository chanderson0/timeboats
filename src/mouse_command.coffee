Command = require('./command.coffee').Command

exports.MouseCommand = class MouseCommand extends Command
  __type: 'MouseCommand'

  constructor: (@id, @destx, @desty) ->
    super @id

  apply: (state) ->
    obj = state.getObject @id
    if obj?
      obj.destx = @destx
      obj.desty = @desty