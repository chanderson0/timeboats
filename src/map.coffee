GameObject = require('./game_object').GameObject
MapCell = require('./map_cell.coffee').MapCell
Random = require('./random.coffee').Random
Gaussian = require('./gaussian.coffee').Gaussian
Point = require('./point.coffee').Point

exports.Map = class Map extends GameObject
  __type: 'Map'

  @CELL_SIZE_PX: 16

  constructor: (@width, @height) ->
    @cells = []
    @isInitialized = false
    @random = null
    @waterLevel = 5
    super

  clone: ->
    new Map(@width, @height)

  update: (dt) ->


  draw: (context) ->
    if @isInitialized
      for x in [0..@width - 1]
        for y in [0..@height - 1]
          context.save()
          context.translate x * Map.CELL_SIZE_PX, y * Map.CELL_SIZE_PX

          bVal = Math.floor(40 + @cells[x][y].altitude * 10)
          rgVal = Math.floor(bVal * 0.9)
          context.fillStyle = "rgba(#{rgVal}, #{rgVal}, #{bVal}, 1)"
          context.fillRect 0, 0, Map.CELL_SIZE_PX, Map.CELL_SIZE_PX

          if @cells[x][y].isPlant
            context.fillStyle="rgba(72, 105, 87, 0.8)"
            context.fillRect 0, 0, Map.CELL_SIZE_PX, Map.CELL_SIZE_PX

          if @cells[x][y].altitude < @waterLevel
            context.fillStyle = "rgba(60, 110, 150, 0.5)"
            context.fillRect(0, 0, Map.CELL_SIZE_PX, Map.CELL_SIZE_PX)

          context.restore()

  # collision methods
  # collideWith(obj) expects a GameObject2D instance.
  # if the map collides with obj, it invokes obj.collide().

  collideWith: (obj, state) ->
    if @isInitialized
      xStart = @.getCellAt(obj.x - obj.radius)
      yStart = @.getCellAt(obj.y - obj.radius)
      xFinish = @.getCellAt(obj.x + obj.radius)
      yFinish = @.getCellAt(obj.y + obj.radius)

      collided = false
      for x in [xStart..xFinish]
        for y in [yStart..yFinish]
          if @cells[x][y].altitude >= @waterLevel # collision with terrain
            obj.collide state
            collided = true
            x = xFinish + 1
            y = yFinish + 1


  getCellAt: (p) ->
    Math.floor(p / Map.CELL_SIZE_PX)



  # map generation methods
  # calling generate(seed) should deterministically generate a pseudorandom map based on seed.

  generate: (seed) ->
    @random = new Random(seed)

    # initialize a blank map
    @isInitialized = false
    @cells = []

    for x in [0..@width - 1]
      col = []
      for y in [0..@height - 1]
        col.push new MapCell(0)
      @cells.push col

    # raise the terrain by swiping gaussians across it

    # first some big wide ones
    @.swipeGaussian(12, 14, 15)
    @.swipeGaussian(12, 14, 15)

    # now some medium ones
    numGaussians = 1 + @random.next() % 3
    for i in [1..numGaussians]
      @.swipeGaussian(6, 8, 4 + @random.next() % 10)

    # finally some narrow tall ones
    numGaussians = 1 + @random.next() % 4
    for i in [1..numGaussians]
      @.swipeGaussian(3, 6, 6)

    # now discretize our altitudes
    # and also make some cells trees.
    for x in [0..@width - 1]
      for y in [0..@height - 1]
        if @cells[x][y].altitude > @waterLevel + 1 and (@cells[x][y].altitude - @waterLevel - 1) * 0.03 > @random.nextf()
          @cells[x][y].isPlant = true
        @cells[x][y].altitude = Math.floor(@cells[x][y].altitude)

    @isInitialized = true

  swipeGaussian: (variance, radius, gaussLife) ->
    gaussX = @random.next() % @width
    gaussY = @random.next() % @height
    gaussVelX = 0.5 + (@random.nextf() * 3.0)
    gaussVelY = 0.5 + (@random.nextf() * 3.0)
    gaussAccX = -0.2 + (@random.nextf() * 0.2)
    gaussAccY = -0.2 + (@random.nextf() * 0.2)

    # console.log "swipeGaussian starting at (#{gaussX},#{gaussY}) with vel (#{gaussVelX},#{gaussVelY}) and life #{gaussLife}"

    g = new Gaussian(variance)
    g.compute(-radius, radius, -radius, radius)
    for i in [1..gaussLife]
      @.applyGaussian(g, radius, Math.floor(gaussX), Math.floor(gaussY))
      gaussX += gaussVelX
      gaussY += gaussVelY
      gaussVelX += gaussAccX
      gaussVelY += gaussAccY

  applyGaussian: (g, radius, xCenter, yCenter) ->
    radius = Math.ceil(radius)
    for x in [xCenter - radius..xCenter + radius]
      for y in [yCenter - radius..yCenter + radius]
        if x >= 0 and x < @width and y >= 0 and y < @height
          @cells[x][y].altitude += g.get2d(x - xCenter, y - yCenter) * 100.0