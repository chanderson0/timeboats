Map = require('./map.coffee').Map
AssetLoader = require('./asset_loader.coffee').AssetLoader
Player = require('./turns.coffee').Player

exports.MenuBoats = class MenuBoats
  constructor: (@canvas, @context, @width, @height, @document = null) ->
    @timestep = 1 / 60
    @renderstep = 1 / 60

    seed = new Date().getTime()
    console.log seed
    Map.getInstance().generate @width / Map.CELL_SIZE_PX,
      @height / Map.CELL_SIZE_PX,
      seed,
      []# [new Player(0, 0)],
      # { numCheckpoints: 1, numMines: 2 }

    @full_redraw = false
    if @document?
      @m_canvas = @document.createElement 'canvas'
      @m_canvas.width = @width
      @m_canvas.height = @height
      @m_context = @m_canvas.getContext '2d'
    else
      @m_canvas = null

    # AssetLoader.getInstance().load()

  update: (dt) ->
    Map.getInstance().update dt

  draw: ->
    Map.getInstance().draw @m_context, full_redraw: @full_redraw
    @full_redraw = false

    # Map.getInstance().drawNonTerrain @m_context
    # for checkpoint in Map.getInstance().checkpoints
    #   checkpoint.draw @m_context
    # for mine in Map.getInstance().mines
    #   mine.draw @m_context

    @context.drawImage @m_canvas, 0, 0

    