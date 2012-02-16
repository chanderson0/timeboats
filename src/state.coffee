Serializable = require('./serializable.coffee').Serializable
Map = require('./map.coffee').Map

exports.State = class State extends Serializable
  __type: 'State'

  constructor: (@time = null) ->
    @objects = {}
    @commands = []
    @scores = {}
    @gameover = false

  clone: (time = null) ->
    st = new State time

    st.gameover = @gameover

    for id, scores of @scores
      st.scores[id] = {}
      for scoretype, value of scores
        st.scores[id][scoretype] = value

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

  addScore: (id, score, scoretype) ->
    console.log id, score, scoretype
    if not @scores[id]?
      @scores[id] = {}
    if not @scores[id][scoretype]?
      @scores[id][scoretype] = 0

    @scores[id][scoretype] += score

  # need mapping turn -> player_id
  # returns player_id -> scoretype -> value
  playerScores: (mapping) ->
    ret = {}
    # console.log 'scores', @scores
    for id, scores of @scores
      player_id = mapping[id]

      # console.log id, player_id, scores

      for scoretype, value of scores
        if not ret[player_id]?
          ret[player_id] = {}
        if not ret[player_id][scoretype]?
          ret[player_id][scoretype] = 0

        ret[player_id][scoretype] += value
    
    ret

  update: (dt) ->
    for command in @commands
      do (command) =>
        command.apply this

    for id, object of @objects
      object.update dt, this

    # UGH
    # Detect end game
    gold = 0
    for id, object of @objects
      if object.__type == 'Mine' or (object.__type == 'Checkpoint' and not object.checked)
        gold++
        break

    if gold == 0
      @gameover = true

    true

  drawRegions: (context) ->
    # Draw dirty region
    for id, object of @objects
      region = object.redrawRegion()
      Map.getInstance().drawRegion context, region: region

  draw: (context, options) =>
    #if @full_redraw
      #@full_redraw = false
      #Map.getInstance().draw context, full_redraw: true

    for id, object of @objects
      object.draw context, dim: options.active != id

    true