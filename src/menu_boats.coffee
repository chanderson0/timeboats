Map = require('./map.coffee').Map
AssetLoader = require('./asset_loader.coffee').AssetLoader

exports.MenuBoats = class MenuBoats
  constructor: (@canvas, @context, @width, @height, @document = null) ->
    @timestep = 1 / 60
    @renderstep = 1 / 60

    Map.getInstance().generate @width / Map.CELL_SIZE_PX,
      @height / Map.CELL_SIZE_PX,
      new Date().getTime(),
      []

    @full_redraw = false
    if @document?
      @m_canvas = @document.createElement 'canvas'
      @m_canvas.width = @width
      @m_canvas.height = @height
      @m_context = @m_canvas.getContext '2d'
    else
      @m_canvas = null

    console.log Map.getInstance()

  update: (dt) ->
    Map.getInstance().update dt

  draw: ->
    if not @m_canvas?
      @context.clearRect 0, 0, @width + 1, @height + 1
      Map.getInstance().draw @context
      @frame_history[@frame_num].draw @context, active: @game.next_turn_id
    else
      Map.getInstance().draw @m_context, full_redraw: false
      @context.drawImage @m_canvas, 0, 0
