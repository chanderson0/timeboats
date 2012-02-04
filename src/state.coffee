Serializable = require('./serializable.coffee').Serializable
Map = require('./map.coffee').Map

exports.State = class State extends Serializable
  __type: 'State'

  constructor: ->
    @objects = {}
    @commands = []
    @full_redraw = false

  clone: ->
    st = new State()
    #st.full_redraw = @full_redraw

    for id, object of @objects
      st.objects[id] = object.clone()

    return st
  
  setCommands: (commands) ->
    @commands = commands

  addObject: (id, object) ->
    @objects[id] = object

  getObject: (id) ->
    @objects[id]

  removeObject: (id) =>
    @objects[id].leave =>
      delete @objects[id]
    @full_redraw = true

  update: (dt) ->
    for command in @commands
      do (command) =>
        command.apply this

    for id, object of @objects
      object.update dt, this

    true

  draw: (context, options) =>
    if @full_redraw
      #@full_redraw = false
      Map.getInstance().draw context, full_redraw: true
    else
      # Draw dirty region
      for id, object of @objects
        region = 
          x: object.x - object.radius * 2
          y: object.y - object.radius * 2
          width: object.radius * 4
          height: object.radius * 4
        Map.getInstance().drawRegion context, region: region

    for id, object of @objects
      object.draw context, dim: options.active != id

    true