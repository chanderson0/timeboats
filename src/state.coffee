Serializable = require('./serializable.coffee').Serializable

exports.State = class State extends Serializable
  __type: 'State'

  constructor: ->
    @objects = {}
    @commands = []

  clone: ->
    st = new State()

    for id, object of @objects
      st.objects[id] = object.clone()

    return st
  
  setCommands: (commands) ->
    @commands = commands

  addObject: (id, object) ->
    @objects[id] = object

  getObject: (id) ->
    @objects[id]

  removeObject: (id) ->
    @objects[id].leave =>
      delete @objects[id]

  update: (dt) ->
    for command in @commands
      do (command) =>
        command.apply this

    for id, object of @objects
      object.update dt, this

    true

  draw: (context) ->
    for id, object of @objects
      object.draw context

    true