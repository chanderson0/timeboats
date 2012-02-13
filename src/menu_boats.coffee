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
    Map.getInstance().draw @m_context, full_redraw: @full_redraw
    @full_redraw = false
    @context.drawImage @m_canvas, 0, 0
