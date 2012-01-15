GameObject = require('./game_object').GameObject
MapCell = require('./map_cell.coffee').MapCell
Random = require('./random.coffee').Random

exports.Map = class Map extends GameObject
  __type: 'Map'

  @CELL_SIZE_PX: 16

  constructor: (@width, @height) ->
    @cells = []
    @isInitialized = false
    super

  clone: ->
    new Map(@width, @height)

  update: (dt) ->


  draw: (context) ->
    if @isInitialized
      for x in [0..@width - 1]
        for y in [0..@height - 1]
          val = 40 + @cells[x][y].altitude * 20
          half_val = val / 2
          context.save()
          context.translate x * Map.CELL_SIZE_PX, y * Map.CELL_SIZE_PX
          context.fillStyle = "rgb(0, #{half_val}, #{val})"
          context.fillRect 0, 0, Map.CELL_SIZE_PX, Map.CELL_SIZE_PX
          context.restore()



  generate: (seed) ->
    random = new Random(seed)
    for x in [0..@width - 1]
      col = []
      for y in [0..@height - 1]
        col.push new MapCell(random.next() % 10)
      @cells.push col
    @isInitialized = true
